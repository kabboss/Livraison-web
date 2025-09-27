// Fichier : netlify/functions/getOrders.js

// --- IMPORTS ET CONFIGURATION ---
const { MongoClient, ObjectId } = require('mongodb');

// Utilisation des variables d'environnement pour plus de sécurité (recommandé)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

// En-têtes CORS pour autoriser les requêtes depuis votre application web
const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': '*', // Pour le développement, '*' est ok. En production, remplacez par l'URL de votre site.
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

// On initialise le client MongoDB en dehors du handler pour la performance.
// Netlify peut réutiliser cette connexion si la fonction reste "chaude".
const client = new MongoClient(MONGODB_URI);

// --- HANDLER PRINCIPAL DE LA FONCTION NETLIFY ---
exports.handler = async (event) => {
    // Gestion de la requête OPTIONS (pre-flight) envoyée par les navigateurs
    if (event.httpMethod === 'OPTIONS' ) {
        return { statusCode: 200, headers: COMMON_HEADERS, body: '' };
    }

    // On s'assure que seule la méthode GET est utilisée
    if (event.httpMethod !== 'GET' ) {
        return { statusCode: 405, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    try {
        // Récupération des paramètres depuis l'URL (ex: /getOrders?serviceType=food&driverId=123)
        const { serviceType, driverId, restaurantId } = event.queryStringParameters || {};
        
        // Connexion à la base de données
        await client.connect();
        const db = client.db(DB_NAME);

        // --- CAS 1 : Un RESTAURANT demande ses commandes à confirmer ---
        if (restaurantId) {
            const collection = db.collection('Commandes');
            const query = {
                'restaurant.id': new ObjectId(restaurantId),
                'status': 'pending_restaurant_confirmation' // Ne cherche QUE les commandes en attente de confirmation
            };
            const orders = await collection.find(query).sort({ orderDate: -1 }).toArray();
            
            return {
                statusCode: 200,
                headers: COMMON_HEADERS,
                body: JSON.stringify({ orders })
            };
        }

        // --- CAS 2 : Un LIVREUR demande les commandes disponibles ou qui lui sont assignées ---
        
        // Validation : le paramètre 'serviceType' est obligatoire pour un livreur
        if (!serviceType) {
            return { statusCode: 400, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Le paramètre "serviceType" est requis pour les livreurs.' }) };
        }

        // Map pour trouver le nom de la collection en fonction du service demandé
        const collectionMap = {
            packages: 'Livraison',
            food: 'Commandes',
            shopping: 'shopping_orders',
            pharmacy: 'pharmacyOrders'
        };

        const collectionName = collectionMap[serviceType];
        if (!collectionName) {
            return { statusCode: 400, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Type de service invalide' }) };
        }

        const collection = db.collection(collectionName);
        
        // --- LA LOGIQUE DE REQUÊTE CORRIGÉE ET ROBUSTE ---
        // On construit une requête qui récupère :
        // 1. Les commandes disponibles pour TOUS les livreurs (statut 'pending').
        // 2. OU les commandes qui sont spécifiquement assignées à CE livreur (statut 'assigned' ET bon driverId).
        
        const query = {
            $or: [
                // Condition 1: Commande disponible pour tout le monde
                { status: 'pending' }, 
                
                // Condition 2 (CORRIGÉE) : Commande assignée à ce livreur spécifique
                { 
                    status: 'assigned', // On s'assure que le statut est bien "assigned"
                    driverId: driverId   // ET que c'est bien notre livreur
                }
            ],
            // On exclut les commandes déjà terminées pour ne pas surcharger l'interface
            isCompleted: { $ne: true } 
        };

        // Exécution de la requête
        const orders = await collection.find(query).sort({ orderDate: -1 }).limit(200).toArray();

        // On enrichit chaque commande avec des informations claires pour le front-end
        // Cela simplifie la logique d'affichage dans votre fichier livreur.html
        const enrichedOrders = orders.map(order => ({
            ...order,
            // 'isAssigned' est vrai si un livreur est déjà dessus
            isAssigned: !!order.driverId,
            // 'isMyAssignment' est vrai si C'EST CE livreur qui est dessus
            isMyAssignment: order.driverId === driverId 
        }));

        // Envoi de la réponse avec les commandes trouvées
        return {
            statusCode: 200,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ orders: enrichedOrders })
        };

    } catch (error) {
        // Gestion des erreurs globales (problème de connexion, erreur de requête, etc.)
        console.error('Erreur dans la fonction getOrders:', error);
        return {
            statusCode: 500,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ error: 'Erreur interne du serveur lors de la récupération des commandes.' })
        };
    } 
    // Note : On ne ferme pas la connexion client ici (client.close()) pour que Netlify puisse la réutiliser
    // lors des prochains appels, ce qui améliore les performances.
};
