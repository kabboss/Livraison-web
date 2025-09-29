// Fichier : netlify/functions/getOrders.js

const { MongoClient, ObjectId } = require('mongodb');

// Recommandé : Utiliser les variables d'environnement pour les informations sensibles
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

// Initialiser le client en dehors du handler pour la réutilisation et la performance
const client = new MongoClient(MONGODB_URI);

exports.handler = async (event) => {
    // Gérer la requête de pré-vérification CORS (pre-flight)
    if (event.httpMethod === 'OPTIONS' ) {
        return { statusCode: 200, headers: COMMON_HEADERS, body: '' };
    }

    if (event.httpMethod !== 'GET' ) {
        return { statusCode: 405, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    try {
        const { serviceType, driverId, restaurantId } = event.queryStringParameters || {};
        
        await client.connect();
        const db = client.db(DB_NAME);

        // --- CAS 1 : Requête pour l'application du RESTAURANT ---
        if (restaurantId) {
            const orders = await db.collection('Commandes').find({
                'restaurant.id': new ObjectId(restaurantId),
                'status': 'pending_restaurant_confirmation'
            }).sort({ orderDate: -1 }).toArray();
            return { statusCode: 200, headers: COMMON_HEADERS, body: JSON.stringify({ orders }) };
        }

        // --- CAS 2 : Requête pour l'application du LIVREUR ---
        if (!serviceType) {
            return { statusCode: 400, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Le paramètre "serviceType" est requis.' }) };
        }

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
        
        // --- LA LOGIQUE DE REQUÊTE UNIVERSELLE ET CORRIGÉE ---
        
        // Statuts signifiant "disponible pour tous"
        const availableStatuses = ['pending', 'en attente', 'en_attente_assignation'];
        
        // Statuts signifiant "en cours pour un livreur"
        const assignedStatuses = ['assigned', 'assigné', 'en_cours_de_livraison'];

        const query = {
            $or: [
                // Condition 1: La commande est disponible pour tout le monde.
                // On vérifie les deux noms de champ possibles : 'status' et 'statut'.
                { status: { $in: availableStatuses } },
                { statut: { $in: availableStatuses } },
                
                // Condition 2: OU la commande est assignée à CE livreur spécifique.
                { 
                    $and: [
                        // ET elle a un statut de type "assigné"
                        { $or: [{ status: { $in: assignedStatuses } }, { statut: { $in: assignedStatuses } }] },
                        // ET l'ID du livreur correspond
                        { $or: [{ driverId: driverId }, { idLivreurEnCharge: driverId }, { id_livreur: driverId } ] }
                    ]
                }
            ],
            // Exclure les commandes déjà marquées comme terminées pour alléger l'interface
            isCompleted: { $ne: true },
            statut: { $ne: 'livré' } 
        };

        const orders = await collection.find(query).sort({ _id: -1 }).limit(200).toArray();

        // Enrichir les données pour simplifier l'affichage côté client
        const enrichedOrders = orders.map(order => ({
            ...order,
            isAssigned: !!(order.driverId || order.idLivreurEnCharge),
            isMyAssignment: (order.driverId === driverId || order.idLivreurEnCharge === driverId)
        }));

        return {
            statusCode: 200,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ orders: enrichedOrders })
        };

    } catch (error) {
        console.error('Erreur critique dans getOrders:', error);
        return {
            statusCode: 500,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ error: 'Erreur interne du serveur.' })
        };
    }
    // La connexion n'est pas fermée pour être réutilisée par Netlify
};
