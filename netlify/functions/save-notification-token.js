// Fichier : functions/save-notification-token.js

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

// On prépare les en-têtes CORS pour les réutiliser
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // On autorise POST et OPTIONS
};

const client = new MongoClient(MONGODB_URI);

exports.handler = async (event) => {
    // --- DÉBUT DE LA CORRECTION ---
    // Étape 1 : Gérer la requête de vérification (preflight) OPTIONS
    if (event.httpMethod === 'OPTIONS' ) {
        return {
            statusCode: 200, // Répondre OK
            headers: CORS_HEADERS,
            body: '' // Le corps est vide
        };
    }
    // --- FIN DE LA CORRECTION ---

    // Étape 2 : Valider que c'est bien une requête POST pour la suite
    if (event.httpMethod !== 'POST' ) {
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ message: 'Method Not Allowed' })
        };
    }

    try {
        const { restaurantId, token } = JSON.parse(event.body);

        if (!restaurantId || !token) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ message: 'restaurantId et token sont requis.' })
            };
        }

        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('Restau');

        await collection.updateOne(
            { _id: new ObjectId(restaurantId) },
            { $set: { notificationToken: token, lastTokenUpdate: new Date() } }
        );

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ success: true, message: 'Token enregistré.' })
        };

    } catch (error) {
        console.error("Erreur lors de la sauvegarde du jeton:", error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ success: false, message: 'Erreur interne du serveur.' })
        };
    }
    // La connexion reste ouverte pour être réutilisée par Netlify
};
