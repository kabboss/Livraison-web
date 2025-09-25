const { MongoClient, ObjectId } = require('mongodb'); // Assurez-vous que ObjectId est bien importé

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

// On sort le client pour la performance
const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
});

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

        // --- CAS 1 : Un restaurant demande ses commandes à confirmer ---
        if (restaurantId) {
            const collection = db.collection('Commandes');
            const query = {
                // --- LA CORRECTION EST ICI ---
                'restaurant.id': new ObjectId(restaurantId), // On convertit la chaîne en ObjectId
                'status': 'pending_restaurant_confirmation'
            };
            const orders = await collection.find(query).sort({ orderDate: -1 }).toArray();
            
            // On ne ferme pas le client ici pour qu'il puisse être utilisé par les autres cas
            // await client.close(); // Supprimez cette ligne si elle existe

            return {
                statusCode: 200,
                headers: COMMON_HEADERS,
                body: JSON.stringify({ orders })
            };
        }

        // --- CAS 2 : Un livreur demande TOUTES ses commandes assignées (tous services confondus) ---
        if (driverId && !serviceType) {
            const allAssignedOrders = await getDriverAssignedOrders(db, driverId);
            return {
                statusCode: 200,
                headers: COMMON_HEADERS,
                body: JSON.stringify({ orders: allAssignedOrders })
            };
        }

        // --- CAS 3 : Un livreur consulte les commandes disponibles pour un service spécifique ---
        const collectionMap = {
            packages: 'Livraison',
            food: 'Commandes',
            shopping: 'shopping_orders',
            pharmacy: 'pharmacyOrders'
        };

        if (!serviceType || !collectionMap[serviceType]) {
            return { statusCode: 400, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Type de service invalide' }) };
        }

        const collection = db.collection(collectionMap[serviceType]);
        
        const query = {
            $or: [
                { status: 'pending' },
                { driverId: driverId }
            ],
            isCompleted: { $ne: true } 
        };

        const orders = await collection.find(query).sort({ orderDate: -1 }).limit(200).toArray();

        const enrichedOrders = orders.map(order => ({
            ...order,
            isAssigned: !!order.driverId
        }));

        return {
            statusCode: 200,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ orders: enrichedOrders })
        };

    } catch (error) {
        console.error('Erreur GET getOrders:', error);
        return {
            statusCode: 500,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ error: 'Erreur serveur lors de la récupération des commandes.' })
        };
    } finally {
        // On déplace la fermeture du client ici pour qu'elle s'exécute à la toute fin,
        // quel que soit le cas de figure.
        // Note : Pour Netlify, il est souvent mieux de ne pas fermer le client du tout
        // pour réutiliser la connexion. Vous pouvez commenter la ligne suivante.
        // await client.close();
    }
};

// Fonction utilitaire pour récupérer toutes les commandes assignées à un livreur
async function getDriverAssignedOrders(db, driverId) {
    const collectionsToSearch = ['Livraison', 'Commandes', 'shopping_orders', 'pharmacyOrders'];
    let allAssignedOrders = [];

    for (const collectionName of collectionsToSearch) {
        const collection = db.collection(collectionName);
        const orders = await collection.find({
            driverId: driverId,
            isCompleted: { $ne: true }
        }).toArray();
        allAssignedOrders.push(...orders);
    }

    allAssignedOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    
    return allAssignedOrders;
}
