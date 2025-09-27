// Fichier : netlify/functions/get-food-orders.js (ou le nom que vous lui avez donné)

// --- IMPORTS ET CONFIGURATION ---
const { MongoClient } = require('mongodb');

// Utilisation des variables d'environnement pour la chaîne de connexion
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';
const COLLECTION_NAME = 'Commandes'; // La collection où se trouvent les commandes de nourriture

// En-têtes CORS pour autoriser les requêtes
const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': '*', // À remplacer par l'URL de votre site en production
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

// Initialisation du client MongoDB en dehors du handler pour la performance
const client = new MongoClient(MONGODB_URI);

// --- HANDLER PRINCIPAL DE LA FONCTION NETLIFY ---
exports.handler = async (event) => {
    // Gestion de la requête OPTIONS (pre-flight)
    if (event.httpMethod === 'OPTIONS' ) {
        return {
            statusCode: 200,
            headers: COMMON_HEADERS,
            body: '' // Le corps doit être vide pour les requêtes OPTIONS
        };
    }

    // On vérifie que la méthode est bien GET
    if (event.httpMethod !== 'GET' ) {
        return {
            statusCode: 405, // 405 Method Not Allowed
            headers: COMMON_HEADERS,
            body: JSON.stringify({ error: 'Méthode non autorisée' })
        };
    }

    try {
        // Connexion à la base de données
        await client.connect();
        const db = client.db(DB_NAME);
        
        // --- LOGIQUE DE RÉCUPÉRATION DES COMMANDES ---
        // Cette fonction récupère uniquement les commandes de nourriture prêtes à être prises par un livreur.
        
        const orders = await db.collection(COLLECTION_NAME)
            .find({ 
                type: 'food',       // On s'assure que ce sont bien des commandes de nourriture
                status: 'pending'   // On ne récupère QUE les commandes avec le statut exact "pending"
            })
            .sort({ _id: -1 }) // Trie les commandes des plus récentes aux plus anciennes
            .toArray();

        // Envoi de la réponse avec les commandes trouvées
        return {
            statusCode: 200,
            headers: COMMON_HEADERS,
            body: JSON.stringify(orders) // On renvoie le tableau des commandes au format JSON
        };

    } catch (error) {
        // Gestion des erreurs (ex: problème de connexion à la base de données)
        console.error('Erreur lors de la récupération des commandes de nourriture:', error);
        return {
            statusCode: 500,
            headers: COMMON_HEADERS,
            body: JSON.stringify({ 
                error: "Erreur interne du serveur.",
                // On peut ajouter plus de détails en mode développement pour le débogage
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    } 
    // Note : On ne ferme pas la connexion (client.close()) pour permettre sa réutilisation par Netlify.
};
