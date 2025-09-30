// Fichier : functions/utils/notify-all-drivers.js

const { sendMulticastNotification } = require('./send-notification');

/**
 * Notifie tous les livreurs actifs d'une nouvelle commande.
 * @param {Db} db - L'instance de la base de données MongoDB.
 * @param {Object} order - L'objet de la commande.
 * @param {string} serviceType - Le type de service ('packages', 'food', etc.).
 */
async function notifyAllDrivers(db, order, serviceType) {
    console.log(`[NOTIFICATION] Début de la notification de masse pour le service : ${serviceType}`);

    try {
        // --- LA CORRECTION CRITIQUE EST ICI ---
        // On cherche les livreurs qui ont un jeton valide ET qui sont actifs,
        // en vérifiant les deux noms de champ possibles pour le statut.
        const query = {
            notificationToken: { $exists: true, $ne: null },
            $or: [
                { status: 'actif' }, 
                { statut: 'actif' }
            ]
        };

        const drivers = await db.collection('Res_livreur').find(query).project({ notificationToken: 1 }).toArray();

        if (drivers.length === 0) {
            console.log("[NOTIFICATION] Aucun livreur actif avec un jeton valide n'a été trouvé. Processus de notification terminé.");
            return;
        }

        const tokens = drivers.map(driver => driver.notificationToken);
        console.log(`[NOTIFICATION] Préparation de l'envoi à ${tokens.length} livreur(s).`);

        const payload = {
            notification: {
                title: `Nouvelle Course Disponible !`,
                body: `Une commande de type "${serviceType}" est prête. Ouvrez l'application pour l'accepter !`
            },
            data: {
                serviceType: serviceType,
                orderId: String(order._id)
            },
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

        await sendMulticastNotification(tokens, payload);

    } catch (error) {
        console.error("[NOTIFICATION] ERREUR CRITIQUE lors de l'envoi des notifications :", error);
    }
}

module.exports = { notifyAllDrivers };
