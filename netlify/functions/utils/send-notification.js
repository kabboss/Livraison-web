const admin = require('firebase-admin');

// --- Initialisation de Firebase Admin ---
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialisé avec succès.');
  } catch (e) {
    console.error('ERREUR CRITIQUE: Échec de l\'initialisation de Firebase Admin.', e);
  }
}

/**
 * Envoie une notification à une liste de plusieurs destinataires (jetons).
 * @param {string[]} tokens - Un tableau contenant tous les jetons de notification des livreurs.
 * @param {Object} payload - L'objet contenant le titre, le corps et les données de la notification.
 */
async function sendMulticastNotification(tokens, payload) {
  if (!admin.apps.length) {
    console.error('Firebase Admin non initialisé. Envoi de notification annulé.');
    return;
  }
  if (!tokens || tokens.length === 0) {
    console.log('Aucun jeton fourni, envoi de notification annulé.');
    return;
  }

  // On construit le message final avec le payload et les jetons.
  const message = {
    // Le payload contient déjà : notification: { title, body }, data: { ... }
    ...payload, 
    tokens: tokens,

    // --- CONFIGURATION ANDROID CORRIGÉE ET COMPLÈTE ---
    android: {
      priority: 'high', // Priorité maximale pour une livraison immédiate.
      notification: {
        // Nom du fichier son dans /res/raw, SANS l'extension .mp3
        sound: 'sound', 
        
        // ID du canal que vous avez créé dans MainActivity.java
        channel_id: 'new_driver_orders_channel',

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
    const response = await admin.messaging().sendMulticast(message);
    console.log(`Rapport d'envoi : ${response.successCount} succès, ${response.failureCount} échecs.`);
    
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Échec pour le jeton ${tokens[idx]}:`, resp.error);
        }
      });
    }
  } catch (error) {
    console.error('Erreur majeure lors de l\'envoi multicast:', error);
  }
}

// On exporte la fonction pour que les autres fichiers puissent l'utiliser.
module.exports = { sendMulticastNotification };
