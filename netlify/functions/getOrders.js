// Fichier : netlify/functions/getOrders.js

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

const client = new MongoClient(MONGODB_URI);

exports.handler = async (event) => {
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

        // CAS 1 : Pour l'application du restaurant (inchangé)
        if (restaurantId) {
            const orders = await db.collection('Commandes').find({
                'restaurant.id': new ObjectId(restaurantId),
                'status': 'pending_restaurant_confirmation'
            }).sort({ orderDate: -1 }).toArray();
            return { statusCode: 200, headers: COMMON_HEADERS, body: JSON.stringify({ orders }) };
        }

        // CAS 2 : Pour l'application du livreur
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
        
        // --- LA NOUVELLE LOGIQUE DE REQUÊTE UNIVERSELLE ---
        // On définit tous les statuts qui signifient "disponible" ou "en cours pour moi".
        const availableStatuses = ['pending', 'en attente', 'en_attente_assignation'];
        const assignedStatuses = ['assigned', 'assigné', 'en_cours_de_livraison'];

        const query = {
            $or: [
                // Condition 1: La commande est disponible pour tout le monde
                { statut: { $in: availableStatuses } },
                { status: { $in: availableStatuses } },
                
                // Condition 2: OU la commande est assignée à CE livreur
                { 
                    $and: [
                        { $or: [{ statut: { $in: assignedStatuses } }, { status: { $in: assignedStatuses } }] },
                        { $or: [{ driverId: driverId }, { idLivreurEnCharge: driverId }] }
                    ]
                }
            ],
            // On exclut les commandes déjà terminées
            isCompleted: { $ne: true },
            statut: { $ne: 'livré' } // Double sécurité
        };

        const orders = await collection.find(query).sort({ _id: -1 }).limit(200).toArray();

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
        console.error('Erreur dans getOrders:', error);
        return {
            statusCode: 500,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ error: 'Erreur interne du serveur.' })
        };
    }
};
