// Fichier : functions/reportInfraction.js

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = process.env.DB_NAME || 'FarmsConnect';

const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

function calculateSeverity(infraction) {
    const amount = infraction.amount || infraction.potentialAmount || 0;
    if (amount >= 10000) return 'high';
    if (amount >= 5000) return 'medium';
    return 'low';
}

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }
    const client = await MongoClient.connect(MONGODB_URI);
    cachedDb = client.db(DB_NAME);
    return cachedDb;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS' ) {
        return { statusCode: 204, headers: COMMON_HEADERS };
    }
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    try {
        const data = JSON.parse(event.body);
        const { driverId, infraction, type = 'penalty' } = data;

        if (!driverId || !infraction || !infraction.reason || !infraction.date) {
            return { 
                statusCode: 400, 
                headers: COMMON_HEADERS, 
                body: JSON.stringify({ error: 'Données manquantes ou invalides.' }) 
            };
        }

        const db = await connectToDatabase();
        // La collection peut être renommée pour mieux refléter son contenu, par exemple 'driverRecords'
        const collection = db.collection('driverInfractions'); 

        // Le critère de recherche : trouver le document par l'ID du livreur
        const filter = { driverId: new ObjectId(driverId) };

        // Création du sous-document pour la nouvelle infraction
        const newInfractionEntry = {
            infractionId: new ObjectId(), // ID unique pour CETTE infraction spécifique
            type: type,
            reason: infraction.reason,
            amount: infraction.amount || infraction.potentialAmount || 0,
            date: new Date(infraction.date),
            severity: calculateSeverity(infraction),
            status: 'active'
        };

        // La mise à jour à appliquer
        const updateDoc = {
            // $push ajoute la nouvelle infraction au tableau 'infractionsHistory'
            $push: { infractionsHistory: newInfractionEntry },
            // $inc incrémente le compteur total d'infractions
            $inc: { totalInfractions: 1 },
            // $setOnInsert s'exécute SEULEMENT si un nouveau document est créé (upsert)
            $setOnInsert: {
                driverId: new ObjectId(driverId),
                createdAt: new Date()
            },
            // $set met à jour la date de la dernière infraction à chaque fois
            $set: {
                lastInfractionDate: new Date()
            }
        };

        // Les options : upsert: true est la clé !
        const options = { upsert: true };

        // Exécution de la commande
        const result = await collection.updateOne(filter, updateDoc, options);

        return {
            statusCode: 200,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ 
                success: true, 
                message: `Dossier du livreur mis à jour avec la nouvelle infraction.`,
                matchedCount: result.matchedCount, // 1 si trouvé, 0 si créé
                modifiedCount: result.modifiedCount, // 1 si mis à jour
                upsertedId: result.upsertedId // l'ID du document si créé
            })
        };

    } catch (error) {
        console.error('Erreur dans la fonction reportInfraction:', error);
        if (error.name === 'BSONError') {
            return { statusCode: 400, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'L\'ID du livreur fourni est invalide.' }) };
        }
        return { statusCode: 500, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Erreur interne du serveur.' }) };
    }
};
