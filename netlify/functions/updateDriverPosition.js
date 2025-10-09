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
  if (event.httpMethod === 'OPTIONS' ) {
    return { statusCode: 200, headers: COMMON_HEADERS };
  }
  if (event.httpMethod !== 'POST' ) {
    return { statusCode: 405, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  let client;
  try {
    const data = JSON.parse(event.body);
    const { orderId, driverId, location } = data;

    if (!orderId || !driverId || !location?.latitude || !location?.longitude) {
      return { statusCode: 400, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Données manquantes ou invalides' }) };
    }

    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);

    const positionData = {
      latitude: parseFloat(location.latitude),
      longitude: parseFloat(location.longitude),
      accuracy: location.accuracy ? parseFloat(location.accuracy) : null,
      timestamp: new Date()
    };

    // ✅ Filtre amélioré pour cibler la bonne commande dans la collection "Livraison"
    const filter = {
      colisID: orderId,
      $or: [
        { driverId: driverId },
        { idLivreurEnCharge: driverId },
        { id_livreur: driverId }
      ]
    };

    const updateResult = await db.collection('Livraison').updateOne(
      filter,
      {
        $set: {
          driverLocation: positionData, // On met à jour la position principale
          lastPositionUpdate: new Date()
        },
        $push: {
          // On garde un historique des 100 dernières positions
          positionHistory: {
            $each: [positionData],
            $slice: -100 
          }
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      return {
        statusCode: 404,
        headers: COMMON_HEADERS,
        body: JSON.stringify({ error: 'Commande non trouvée ou livreur non assigné à cette commande.' })
      };
    }

    return {
      statusCode: 200,
      headers: COMMON_HEADERS,
      body: JSON.stringify({ success: true, message: 'Position mise à jour avec succès.' })
    };

  } catch (error) {
    console.error('Erreur serveur updateDriverPosition:', error);
    return { statusCode: 500, headers: COMMON_HEADERS, body: JSON.stringify({ error: 'Erreur serveur.' }) };
  } finally {
    if (client) await client.close();
  }
};
