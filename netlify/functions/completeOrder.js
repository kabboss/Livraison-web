const { MongoClient, ObjectId } = require('mongodb');

// Vos informations de connexion à la base de données
const MONGODB_URI = 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

// Headers CORS pour les réponses de la fonction
const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

/**
 * Fonction utilitaire pour extraire le gain de la livraison à partir d'une commande,
 * quel que soit le service.
 * @param {object} order - L'objet de la commande originale.
 * @param {string} serviceType - Le type de service ('packages', 'food', etc.).
 * @returns {number} Le montant du gain de la livraison.
 */
function getDeliveryGain(order, serviceType) {
    if (!order) return 0;

    switch (serviceType) {
        case 'packages':
            // Pour les colis, le gain est dans l'objet 'pricing', champ 'price'.
            return order.pricing?.price || 0;
        
        case 'food':
        case 'shopping':
        case 'pharmacy':
            // Pour les autres services, le gain est directement dans le champ 'deliveryFee'.
            return order.deliveryFee || 0;
            
        default:
            // Si le service n'est pas reconnu, on retourne 0 pour éviter les erreurs.
            return 0;
    }
}

/**
 * Fonction principale (handler) pour la finalisation d'une commande.
 */
exports.handler = async (event) => {
    // Gestion de la requête OPTIONS (preflight)
    if (event.httpMethod === 'OPTIONS' ) {
        return { statusCode: 200, headers: COMMON_HEADERS };
    }
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    let client;
    try {
        const data = JSON.parse(event.body);
        const { orderId, serviceType, driverId, driverName, notes, completionLocation } = data;

        // Validation des données d'entrée
        if (!orderId || !serviceType || !driverId || !driverName) {
            return { statusCode: 400, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Données requises manquantes.' }) };
        }

        // Connexion à la base de données
        client = await MongoClient.connect(MONGODB_URI);
        const db = client.db(DB_NAME);

        const collectionMap = {
            packages: 'Livraison',
            food: 'Commandes',
            shopping: 'shopping_orders',
            pharmacy: 'pharmacyOrders'
        };
        const collectionName = collectionMap[serviceType];
        if (!collectionName) {
            return { statusCode: 400, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Type de service invalide.' }) };
        }

        const collection = db.collection(collectionName);
        const order = await findOrder(collection, orderId, serviceType);

        if (!order) {
            return { statusCode: 404, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Commande non trouvée.' }) };
        }

        // Vérifications de sécurité (assignation, déjà complétée)
        if (order.driverId !== driverId && order.idLivreurEnCharge !== driverId) {
            return { statusCode: 403, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Cette commande n\'est pas assignée à ce livreur.' }) };
        }
        if (isOrderCompleted(order)) {
            return { statusCode: 409, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Cette commande est déjà marquée comme terminée.' }) };
        }

        // --- LOGIQUE CENTRALE CORRIGÉE ---
        // 1. Extraire le gain de la livraison en utilisant notre fonction utilitaire
        const deliveryGain = getDeliveryGain(order, serviceType);

        // 2. Démarrer une transaction pour assurer l'intégrité des données
        const session = client.startSession();
        try {
            await session.withTransaction(async () => {
                // 2a. Archiver la commande en passant le gain calculé
                await archiveCompletedOrder(db, order, { ...data, deliveryGain }, collectionName, session);
                
                // 2b. Supprimer la commande de la collection active
                await collection.deleteOne({ _id: order._id }, { session });
            });
        } finally {
            await session.endSession();
        }

        // 3. Répondre avec succès
        return {
            statusCode: 200,
            headers: COMMON_HEADERS,
            body: JSON.stringify({
                success: true,
                message: 'Livraison finalisée et archivée avec succès !',
                archivedGain: deliveryGain // On peut renvoyer le gain pour le débogage
            })
        };

    } catch (error) {
        console.error('Erreur dans la fonction completeOrder:', error);
        return { statusCode: 500, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Erreur interne du serveur.' }) };
    } finally {
        if (client) await client.close();
    }
};

/**
 * Archive une commande terminée en y ajoutant le gain standardisé.
 */
async function archiveCompletedOrder(db, originalOrder, completionData, originalCollection, session) {
    const now = new Date();
    
    const archivedOrder = {
        ...originalOrder, // Copie toutes les données de la commande originale
        archiveMetadata: {
            originalCollection,
            archivedAt: now,
        },
        completionData: {
            completedBy: completionData.driverName,
            completedById: completionData.driverId,
            completedAt: now,
            completionNotes: completionData.notes,
            completionLocation: completionData.completionLocation,
            
            // ✅✅✅ AJOUT DU CHAMP STANDARDISÉ `deliveryGain` ✅✅✅
            deliveryGain: completionData.deliveryGain 
        }
    };

    await db.collection('completed_orders_archive').insertOne(archivedOrder, { session });
}

/**
 * Fonctions utilitaires pour trouver et vérifier les commandes.
 */
async function findOrder(collection, orderId, serviceType) {
    const tryObjectId = (id) => ObjectId.isValid(id) ? new ObjectId(id) : id;
    const strategies = {
        packages: [{ colisID: orderId }, { _id: tryObjectId(orderId) }],
        food: [{ codeCommande: orderId }, { _id: tryObjectId(orderId) }],
        default: [{ _id: tryObjectId(orderId) }]
    };
    for (const query of (strategies[serviceType] || strategies.default)) {
        const order = await collection.findOne(query);
        if (order) return order;
    }
    return null;
}

function isOrderCompleted(order) {
    const status = (order.status || order.statut || '').toLowerCase();
    return ['completed', 'delivered', 'livré', 'terminé'].includes(status) || order.isCompleted === true;
}
