const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

// On sort le client pour la performance, c'est une bonne pratique
const client = new MongoClient(MONGODB_URI);

exports.handler = async (event) => {
    // Gestion de la requête OPTIONS (pre-flight)
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

        // --- CAS 1 : Un restaurant demande ses commandes à confirmer ---
        // Cette partie est pour l'application du restaurant. Elle est déjà correcte.
        if (restaurantId) {
            const collection = db.collection('Commandes');
            const query = {
                'restaurant.id': new ObjectId(restaurantId),
                'status': 'pending_restaurant_confirmation' // Ne cherche que les commandes en attente de confirmation
            };
            const orders = await collection.find(query).sort({ orderDate: -1 }).toArray();
            return {
                statusCode: 200,
                headers: COMMON_HEADERS,
                body: JSON.stringify({ orders })
            };
        }

        // --- CAS 2 : Un livreur demande les commandes ---
        // Validation : serviceType est obligatoire pour un livreur
        if (!serviceType) {
            return { statusCode: 400, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Le paramètre "serviceType" est requis pour les livreurs.' }) };
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
        
        // --- LA NOUVELLE LOGIQUE DE REQUÊTE EST ICI ---
        // On construit une requête qui récupère :
        // 1. Les commandes disponibles pour TOUS les livreurs (statut 'pending').
        // 2. OU les commandes qui sont spécifiquement assignées à CE livreur (driverId).
        
        const query = {
            $or: [
                // Condition 1: Commande disponible pour tout le monde
                { status: 'pending' }, 
                
                // Condition 2: Commande assignée à ce livreur spécifique
                { driverId: driverId } 
            ],
            // On exclut les commandes déjà terminées
            isCompleted: { $ne: true } 
        };

        const orders = await collection.find(query).sort({ orderDate: -1 }).limit(200).toArray();

        // On enrichit chaque commande avec une information claire pour le front-end
        const enrichedOrders = orders.map(order => ({
            ...order,
            // 'isAssigned' est vrai si un livreur est déjà dessus
            isAssigned: !!order.driverId,
            // 'isMyAssignment' est vrai si C'EST CE livreur qui est dessus
            isMyAssignment: order.driverId === driverId 
        }));

        return {
            statusCode: 200,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ orders: enrichedOrders })
        };

    } catch (error) {
        console.error('Erreur dans getOrders:', error);
        return {
            statusCode: 500,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ error: 'Erreur interne du serveur lors de la récupération des commandes.' })
        };
    } 
    // Note : On ne ferme pas le client ici pour que Netlify puisse réutiliser la connexion.
};
