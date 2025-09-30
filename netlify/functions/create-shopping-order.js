// Fichier : functions/create-shopping-order.js

const { MongoClient } = require('mongodb');
const { notifyAllDrivers } = require('./utils/notify-all-drivers');

const MONGODB_URI = 'mongodb+srv://kabboss:ka23bo23re23@cluster0.uy2xz.mongodb.net/FarmsConnect?retryWrites=true&w=majority';
const DB_NAME = 'FarmsConnect';

const mongoClient = new MongoClient(MONGODB_URI, {
  connectTimeoutMS: 5000,
  serverSelectionTimeoutMS: 5000
});

const COMMON_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  await mongoClient.connect();
  cachedDb = mongoClient.db(DB_NAME);
  return cachedDb;
}

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS' ) {
    return { statusCode: 200, headers: COMMON_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST' ) {
    return { statusCode: 405, headers: COMMON_HEADERS, body: JSON.stringify({ message: 'Méthode non autorisée' }) };
  }

  try {
    const data = JSON.parse(event.body);
    const db = await connectToDatabase();
    const collection = db.collection('shopping_orders');

    // --- DÉBUT DE LA CORRECTION ---
    // 1. On utilise 'data' pour créer une nouvelle variable 'order' propre.
    //    On y ajoute les informations que le serveur doit gérer (date, statut).
    const order = {
        ...data, // On copie toutes les informations envoyées par le client
        createdAt: new Date(),
        status: 'pending' // On définit le statut initial
    };

    // 2. On insère cet objet 'order' complet dans la base de données.
    const result = await collection.insertOne(order);
    // --- FIN DE LA CORRECTION ---

    // 3. Maintenant, la variable 'order' existe et peut être utilisée.
    if (result.insertedId) {
        console.log(`Nouvelle commande de courses ${result.insertedId}. Déclenchement des notifications.`);
        
        // On s'assure que l'objet 'order' a bien l'_id avant de l'envoyer à la fonction de notification.
        order._id = result.insertedId; 
        await notifyAllDrivers(db, order, 'shopping');
    }

    return {
      statusCode: 201, // 201 Created : plus correct pour une création
      headers: COMMON_HEADERS,
      body: JSON.stringify({ message: 'Commande enregistrée avec succès', id: result.insertedId })
    };

  } catch (error) {
    console.error('Erreur dans create-shopping-order:', error);
    return {
      statusCode: 500,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ message: 'Erreur serveur', error: error.message })
    };
  }
};
