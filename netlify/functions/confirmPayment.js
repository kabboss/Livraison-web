// Fichier : functions/confirmPayment.js

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS'  ) {
        return { statusCode: 204, headers: COMMON_HEADERS };
    }
    if (event.httpMethod !== 'POST'  ) {
        return { statusCode: 405, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    let client;
    try {
        const data = JSON.parse(event.body);
        const { driverId, phoneNumber, amount, confirmationDate } = data;

        if (!driverId || !phoneNumber || !amount) {
            return { statusCode: 400, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Données manquantes.' }) };
        }

        client = await MongoClient.connect(MONGODB_URI);
        const db = client.db(DB_NAME);
        const collection = db.collection('confirmations_paiement');

        const result = await collection.insertOne({
            driverId,
            phoneNumber,
            amount: parseInt(amount),
            confirmationDate: new Date(confirmationDate),
            status: 'pending_validation', // Statut initial en attente de votre validation
            createdAt: new Date()
        });

        return {
            statusCode: 200,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ success: true, message: 'Confirmation enregistrée.', insertedId: result.insertedId })
        };

    } catch (error) {
        console.error('Erreur dans la fonction confirmPayment:', error);
        return { statusCode: 500, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Erreur interne du serveur.' }) };
    } finally {
        if (client) {
            await client.close();
        }
    }
};
