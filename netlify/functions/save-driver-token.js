// Créer un nouveau fichier: functions/save-driver-token.js
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

const client = new MongoClient(MONGODB_URI);

exports.handler = async (event) => {
    // Headers CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    try {
        const { driverId, token } = JSON.parse(event.body);

        if (!driverId || !token) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'driverId et token sont requis.' }) 
            };
        }

        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('Res_livreur');

        // Mise à jour avec le bon champ d'identification
        const result = await collection.updateOne(
            { id_livreur: driverId }, // Utilisez le bon champ selon votre base
            { 
                $set: { 
                    notificationToken: token, 
                    lastTokenUpdate: new Date(),
                    status: 'actif'
                } 
            },
            { upsert: true } // Crée le document s'il n'existe pas
        );

        console.log('Token sauvegardé pour driver:', driverId, 'Résultat:', result);

        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ 
                success: true,
                message: 'Token enregistré avec succès',
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount
            }) 
        };

    } catch (error) {
        console.error("Erreur sauvegarde jeton livreur:", error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: 'Erreur serveur: ' + error.message }) 
        };
    }
};