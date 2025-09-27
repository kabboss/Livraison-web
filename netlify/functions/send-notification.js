const admin = require('firebase-admin');

// Initialiser Firebase Admin une seule fois
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error('Erreur d\'initialisation de Firebase Admin:', e);
  }
}

async function sendPushNotification(token, order) {
  // Vérification pour éviter les erreurs si l'initialisation a échoué
  if (!admin.apps.length) {
    console.error('Firebase Admin n\'est pas initialisé. Impossible d\'envoyer la notification.');
    return { success: false, error: 'Firebase Admin not initialized' };
  }

  const message = {
    token: token,

    // --- SECTION 1 : NOTIFICATION (Pour l'affichage et le son) ---
    // C'est ce que l'utilisateur verra et entendra.
    notification: {
      title: 'Nouvelle Commande !',
      body: `Commande #${order.codeCommande} de ${order.client.name}`
    },

    // --- SECTION 2 : DATA (Pour votre application) ---
    // Données invisibles que votre application peut utiliser.
    data: {
      orderId: order._id.toString(),
      codeCommande: order.codeCommande,
      // Vous pouvez ajouter d'autres infos si nécessaire
    },

    // --- SECTION 3 : CONFIGURATION ANDROID ---
    // Pour personnaliser le comportement sur Android.
    android: {
      priority: 'high', // Assure que la notification arrive rapidement.
      notification: {
        // Nom du fichier son dans /res/raw, SANS extension.
        // Assurez-vous que le nom est exact.
        sound: 'notification', 
        
        // ID du canal que vous avez créé dans MainActivity.java.
        channel_id: 'new_orders_channel',

        // Action qui rend la notification cliquable et ouvre l'application.
        click_action: 'FLUTTER_NOTIFICATION_CLICK' 
      }
    },

    // Configuration pour iOS (bonne pratique de l'inclure)
    apns: {
      payload: {
        aps: {
          sound: 'default', // ou le nom d'un fichier son pour iOS
          'content-available': 1
        }
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
