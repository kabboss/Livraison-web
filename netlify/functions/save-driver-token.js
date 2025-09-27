const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';
const client = new MongoClient(MONGODB_URI);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { driverId, token } = JSON.parse(event.body);

        if (!driverId || !token) {
            return { statusCode: 400, body: 'driverId et token sont requis.' };
        }

        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('Res_livreur');

        // Met à jour le livreur correspondant à 'id_livreur'
        await collection.updateOne(
            { id_livreur: driverId }, // Assurez-vous que ce champ correspond bien à votre base de données
            { $set: { notificationToken: token, lastTokenUpdate: new Date() } }
        );

        return { statusCode: 200, body: JSON.stringify({ success: true }) };

    } catch (error) {
        console.error("Erreur sauvegarde jeton livreur:", error);
        return { statusCode: 500, body: 'Erreur serveur.' };
    }
};
