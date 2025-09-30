// Fichier : functions/save-driver-token.js
const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS' ) {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    const client = new MongoClient(MONGODB_URI);

    try {
        const { driverId, token } = JSON.parse(event.body);

        if (!driverId || !token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'driverId et token sont requis.' }) };
        }

        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('Res_livreur');

        // CORRECTION MAJEURE : Utiliser le bon champ de la base de données
        const result = await collection.updateOne(
            { id_livreur: driverId }, // <-- C'est ici que la correspondance se fait
            { 
                $set: { 
                    notificationToken: token, 
                    lastTokenUpdate: new Date(),
                    status: 'actif' // On s'assure que le livreur est marqué comme actif
                } 
            }
            // On retire { upsert: true } pour éviter de créer des livreurs fantômes.
            // Le livreur doit exister pour recevoir un jeton.
        );

        if (result.matchedCount === 0) {
            console.warn(`Aucun livreur trouvé avec l'ID: ${driverId}`);
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ error: 'Livreur non trouvé.' }) 
            };
        }

        console.log(`Jeton sauvegardé pour le livreur: ${driverId}`);

        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ success: true, message: 'Token enregistré avec succès' }) 
        };

    } catch (error) {
        console.error("Erreur sauvegarde jeton livreur:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur: ' + error.message }) };
    } finally {
        await client.close();
    }
};
