// Fichier : functions/utils/send-notification.js

const admin = require('firebase-admin');

// --- L'initialisation de Firebase Admin reste identique et correcte ---
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
    ...payload, 
    tokens: tokens, // La liste des destinataires

    // --- Les configurations Android et APNS (iOS) sont déjà correctes ---
    android: {
      priority: 'high',
      notification: {
        sound: 'sound', 
        channel_id: 'new_driver_orders_channel',
        click_action: 'FLUTTER_NOTIFICATION_CLICK' 
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          'content-available': 1
        }
      }
    }
  };

  try {
    // --- LA CORRECTION EST ICI ---
    // On remplace "sendMulticast" par le nom correct : "sendEachForMulticast"
    const response = await admin.messaging().sendEachForMulticast(message);
    // --- FIN DE LA CORRECTION ---
    
    console.log(`[RAPPORT D'ENVOI] Succès: ${response.successCount}, Échecs: ${response.failureCount}`);
    
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          console.error(`Échec pour le jeton ${tokens[idx]}:`, resp.error);
          // Ici, vous pourriez ajouter du code pour supprimer les jetons invalides de votre base de données
        }
      });
      console.log("Liste des jetons en échec :", failedTokens);
    }
  } catch (error) {
    console.error('Erreur majeure lors de l\'envoi multicast:', error);
  }
}

module.exports = { sendMulticastNotification };
