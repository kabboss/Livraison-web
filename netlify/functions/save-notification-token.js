const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

const client = new MongoClient(MONGODB_URI);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { restaurantId, token } = JSON.parse(event.body);

        if (!restaurantId || !token) {
            return { statusCode: 400, body: 'restaurantId et token sont requis.' };
        }

        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('Restau'); // Votre collection de restaurants

        // Mettre à jour le document du restaurant avec le nouveau jeton
        await collection.updateOne(
            { _id: new ObjectId(restaurantId) },
            { $set: { notificationToken: token, lastTokenUpdate: new Date() } }
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Token enregistré.' })
        };

    } catch (error) {
        console.error("Erreur lors de la sauvegarde du jeton:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: 'Erreur interne du serveur.' })
        };
    } finally {
        // Il est souvent préférable de ne pas fermer la connexion dans un environnement serverless
        // pour la réutiliser.
        // await client.close();
    }
};
