// <-- ÉTAPE 1: Importer les modules nécessaires
// On a besoin de ObjectId pour cibler le bon restaurant
const { MongoClient, ObjectId } = require('mongodb');

// <-- ÉTAPE 2: Configurer les constantes
// Utiliser une variable d'environnement est une excellente pratique.
const MONGODB_URI = 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';
const COLLECTION_NAME = 'Restau'; // On va enregistrer le token directement dans la collection des restaurants

// Headers CORS pour la cohérence
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// On sort la connexion pour la réutiliser (meilleures performances)
const client = new MongoClient(MONGODB_URI);

exports.handler = async (event) => {
    // Gérer la requête OPTIONS
    if (event.httpMethod === 'OPTIONS' ) {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    // Valider la méthode HTTP
    if (event.httpMethod !== 'POST' ) {
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ success: false, message: 'Méthode non autorisée. Seul POST est accepté.' })
        };
    }

    try {
        // <-- ÉTAPE 3: Valider les données entrantes
        const { restaurantId, token } = JSON.parse(event.body || '{}');

        if (!restaurantId || !token) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: false, message: 'Les données "restaurantId" et "token" sont requises.' })
            };
        }

        // <-- ÉTAPE 4: Mettre à jour le document du restaurant
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        // On cible le document du restaurant par son _id
        // et on met à jour (ou on ajoute) le champ 'notificationToken'.
        const result = await collection.updateOne(
            { _id: new ObjectId(restaurantId) }, // Le filtre pour trouver le bon restaurant
            { 
                $set: { 
                    notificationToken: token,       // Le champ à mettre à jour
                    lastTokenUpdate: new Date()     // Utile pour le débogage
                } 
            }
        );

        // <-- ÉTAPE 5: Vérifier si la mise à jour a fonctionné
        if (result.matchedCount === 0) {
            // Si aucun restaurant ne correspond à l'ID, on renvoie une erreur.
            return {
                statusCode: 404,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: false, message: `Aucun restaurant trouvé avec l'ID: ${restaurantId}` })
            };
        }

        console.log(`Token mis à jour pour le restaurant ID: ${restaurantId}`);

        // <-- ÉTAPE 6: Renvoyer une réponse de succès
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ success: true, message: 'Jeton de notification enregistré avec succès.' })
        };

    } catch (error) {
        console.error("Erreur lors de l'enregistrement du jeton:", error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ success: false, message: 'Erreur interne du serveur.', error: error.message })
        };
    }
    // La connexion reste ouverte pour être potentiellement réutilisée par Netlify.
};
