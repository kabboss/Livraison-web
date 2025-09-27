// <-- ÉTAPE 1: Importer les modules nécessaires
// On importe la fonction pour envoyer les notifications
const { sendPushNotification } = require('./send-notification'); 
// On importe MongoClient ET ObjectId pour pouvoir rechercher par _id
const { MongoClient, ObjectId } = require('mongodb');

// CORS ultra-permissif (inchangé)
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Ajout de Content-Type pour être plus standard
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // On ne permet que POST et OPTIONS
};

// <-- ÉTAPE 2: Centraliser la connexion à la base de données
// On sort la connexion de la fonction handler pour la réutiliser si Netlify garde la fonction "chaude"
const MONGODB_URI = 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';
const client = new MongoClient(MONGODB_URI);

exports.handler = async (event) => {
    // Gérer la requête OPTIONS (inchangé)
    if (event.httpMethod === 'OPTIONS' ) {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    // Valider la méthode (inchangé)
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ message: 'Méthode non autorisée' }) };
    }

    try {
        // <-- ÉTAPE 3: Connexion à la base de données
        await client.connect();
        const db = client.db(DB_NAME);
        
        let orderData = JSON.parse(event.body || '{}');
        
        // Validation minimale (inchangée, mais très importante)
        if (!orderData.currentRestaurant?._id || !orderData.items?.length || !orderData.client?.phone) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: false, message: 'Données de commande incomplètes.' })
            };
        }

        // <-- ÉTAPE 4: Préparer le document de la commande
        const commandesCollection = db.collection('Commandes');
        const orderDocument = {
            type: "food",
            restaurant: {
                // On utilise ObjectId pour stocker une référence correcte
                id: new ObjectId(orderData.currentRestaurant._id),
                name: orderData.currentRestaurant.nom || 'Restaurant Inconnu',
            },
            client: {
                name: orderData.client.name || '',
                phone: orderData.client.phone,
                address: orderData.client.address || '',
                position: orderData.client.position || null
            },
            items: orderData.items,
            subtotal: orderData.subtotal || 0,
            deliveryFee: orderData.deliveryFee || 0,
            total: orderData.total || 0,
            notes: orderData.notes || '',
            payment_method: orderData.payment_method || 'on_delivery',
            status: 'pending_restaurant_confirmation',
            orderDate: new Date(orderData.orderDate || new Date()),
            codeCommande: generateOrderCode(),
            createdAt: new Date()
        };

        // Insérer la commande dans la base de données
        const result = await commandesCollection.insertOne(orderDocument);

        // <-- ÉTAPE 5: ENVOYER LA NOTIFICATION PUSH
        try {
            const restauCollection = db.collection('Restau'); // Le nom de votre collection de restaurants
            // On recherche le restaurant par son _id pour trouver son jeton de notification
            const restaurant = await restauCollection.findOne({ _id: new ObjectId(orderData.currentRestaurant._id) });

            // Si le restaurant est trouvé ET qu'il a un jeton de notification enregistré...
            if (restaurant && restaurant.notificationToken) {
                console.log(`Jeton trouvé pour ${restaurant.nom}. Envoi de la notification...`);
                // ...on envoie la notification !
                await sendPushNotification(restaurant.notificationToken, orderDocument);
            } else {
                console.warn(`Aucun jeton de notification trouvé pour le restaurant ID: ${orderData.currentRestaurant._id}`);
            }
        } catch (notificationError) {
            // On ne bloque pas la commande si la notification échoue, mais on le signale.
            console.error("Erreur critique lors de l'envoi de la notification:", notificationError);
        }
        
        // <-- ÉTAPE 6: Renvoyer une réponse de succès
        return {
            statusCode: 201,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                orderId: result.insertedId,
                codeCommande: orderDocument.codeCommande,
                message: 'Commande créée avec succès.'
            })
        };

    } catch (error) {
        console.error('Erreur globale dans la fonction create-order:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ 
                success: false, 
                message: "Erreur interne du serveur.",
                error: error.message 
            })
        };
    }
    // La connexion client n'est pas fermée ici pour être réutilisée.
    // Netlify gère le cycle de vie de la connexion.
};

// Fonction pour générer un code de commande (inchangée)
function generateOrderCode() {
    const prefix = 'CMD';
    const date = new Date();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${random}`;
}
