const admin = require('firebase-admin');

// Initialiser Firebase Admin une seule fois
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function sendPushNotification(token, order) {
  const message = {
    token: token,
    data: {
      title: `Nouvelle Commande #${order.codeCommande}`,
      body: `Client: ${order.client.name} - Total: ${order.total} FCFA`,
      orderId: order._id.toString()
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'notification_sound', // <-- LE NOM DE VOTRE FICHIER SON SANS EXTENSION
        channelId: 'new_orders_channel' // Important pour Android 8+
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notification envoyée avec succès:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification:', error);
    return { success: false, error };
  }
}

module.exports = { sendPushNotification };
