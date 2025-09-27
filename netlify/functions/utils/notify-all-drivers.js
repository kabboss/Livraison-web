// Fichier : functions/utils/notify-all-drivers.js

// On importe la fonction qui sait comment parler à Firebase pour envoyer les notifications.
const { sendMulticastNotification } = require('./send-notification');

/**
 * Notifie tous les livreurs actifs d'une nouvelle commande.
 * @param {Db} db - L'instance de la base de données MongoDB.
 * @param {Object} order - L'objet de la commande qui vient d'être créée/confirmée.
 * @param {string} serviceType - Le type de service ('food', 'packages', etc.).
 */
async function notifyAllDrivers(db, order, serviceType) {
    console.log(`Début de la notification de masse pour une commande de type : ${serviceType}`);

    try {
        // 1. Récupérer TOUS les livreurs actifs qui ont un jeton de notification valide.
        const drivers = await db.collection('Res_livreur').find({
            status: 'actif', // Assurez-vous que vos livreurs ont bien ce statut
            notificationToken: { $exists: true, $ne: null }
        }).project({ notificationToken: 1 }).toArray(); // .project() est une optimisation pour ne récupérer que le jeton.

        if (drivers.length === 0) {
            console.log("Aucun livreur avec un jeton de notification trouvé. Fin du processus.");
            return;
        }

        // 2. Extraire la liste des jetons.
        const tokens = drivers.map(driver => driver.notificationToken);
        console.log(`Préparation de la notification pour ${tokens.length} livreur(s).`);

        // 3. Préparer le contenu du message.
        const payload = {
            notification: {
                title: `Nouvelle Course Disponible !`,
                body: `Une commande de "${serviceType}" est prête. Ouvrez l'app pour l'accepter !`
            },
            data: {
                serviceType: serviceType,
                orderId: String(order._id) // On envoie l'ID de la commande au cas où
            },
            // --- AJOUT ESSENTIEL CI-DESSOUS ---
            android: {
                priority: 'high', // Priorité maximale pour réveiller le téléphone
                notification: {
                    sound: 'sound', // LE NOM DE VOTRE FICHIER SON (sans .mp3)
                    channel_id: 'new_driver_orders_channel', // L'ID du canal créé dans MainActivity.java
                    click_action: 'FLUTTER_NOTIFICATION_CLICK' // Pour rendre la notification cliquable
                }
            },
            apns: { // Configuration pour les iPhones
                payload: {
                    aps: {
                        sound: 'default', // Son par défaut sur iOS
                        'content-available': 1
                    }
                }
            }
        };

        // 4. Appeler notre outil d'envoi de notification.
        await sendMulticastNotification(tokens, payload);

    } catch (error) {
        console.error("ERREUR CRITIQUE lors de la notification de tous les livreurs:", error);
    }
}

// On exporte la fonction pour que les autres fichiers puissent l'utiliser.
module.exports = { notifyAllDrivers };
