// Version ultra-permissive create-order.js
const { MongoClient } = require('mongodb');

// CORS ultra-permissif
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Credentials': 'true'
};

const MONGODB_URI = 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';
const COLLECTION_NAME = 'Commandes';

exports.handler = async (event) => {
    // Gérer OPTIONS très tôt
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    // Logger pour debug
    console.log('Method:', event.httpMethod);
    console.log('Origin:', event.headers.origin);
    console.log('Headers:', event.headers);

    if (!MONGODB_URI) {
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ success: false, message: "Configuration serveur manquante" })
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ success: false, message: 'Méthode non autorisée' })
        };
    }

    const client = new MongoClient(MONGODB_URI);

    try {
        let orderData = JSON.parse(event.body || '{}');
        
        // Validation minimale
        if (!orderData.currentRestaurant?._id || !orderData.items?.length || !orderData.client?.phone) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: false, message: 'Données incomplètes' })
            };
        }

        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        const orderDocument = {
            type: "food",
            restaurant: {
                id: orderData.currentRestaurant._id,
                name: orderData.currentRestaurant.nom || 'Restaurant Inconnu',
            },
            client: {
                name: orderData.client.name || '',
                phone: orderData.client.phone,
                address: orderData.client.address || '',
                position: orderData.client.position || null
            },
            items: orderData.items,
            subtotal: orderData.subtotal || 0,
            deliveryFee: orderData.deliveryFee || 0,
            total: orderData.total || 0,
            notes: orderData.notes || '',
            payment_method: orderData.payment_method || 'on_delivery',
            payment_status: orderData.payment_status || 'pending',
            status: 'pending_restaurant_confirmation',
            orderDate: new Date(orderData.orderDate || new Date()),
            codeCommande: generateOrderCode(),
            createdAt: new Date()
        };

        const result = await collection.insertOne(orderDocument);

        return {
            statusCode: 201,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                orderId: result.insertedId,
                codeCommande: orderDocument.codeCommande,
                message: 'Commande créée avec succès'
            })
        };

    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ 
                success: false, 
                message: "Erreur serveur",
                error: error.message 
            })
        };
    } finally {
        await client.close();
    }
};

function generateOrderCode() {
    const prefix = 'CMD';
    const date = new Date();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${random}`;
}