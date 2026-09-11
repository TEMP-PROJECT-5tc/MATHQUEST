/**
 * Firebase Cloud Functions para MathQuest VIP
 * Exporta endpoints serverless para pagos y webhooks de Culqi
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Configuración de producto
const VIP_PRICE_CENTS = 1990; // S/ 19.90
const VIP_CURRENCY = 'PEN';
const VIP_PRODUCT_ID = 'mathquest-vip';

/**
 * Webhook Oficial de Culqi para Firebase Cloud Functions
 * URL en Panel de Culqi: https://<region>-<project-id>.cloudfunctions.net/culqiWebhook
 */
exports.culqiWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Método no permitido');
    }

    try {
        const body = req.body || {};
        const eventType = body.type;
        const eventData = body.data || body;

        console.log("Evento recibido de Culqi:", eventType, eventData.id);

        if (eventType === 'charge.creation.succeeded' || eventData.outcome?.type === 'venta_exitosa') {
            const chargeId = eventData.id;
            const uid = eventData.metadata?.uid;
            const amount = eventData.amount;
            const currency = eventData.currency_code;
            const productId = eventData.metadata?.productId;

            if (productId !== VIP_PRODUCT_ID || amount !== VIP_PRICE_CENTS || currency !== VIP_CURRENCY) {
                console.warn("Monto o producto no coincidente:", amount, currency, productId);
                return res.status(200).json({ received: true, status: 'ignored' });
            }

            if (!uid) {
                console.warn("UID ausente en metadata del cargo:", chargeId);
                return res.status(200).json({ received: true, status: 'missing_uid' });
            }

            // Idempotencia: Verificar si el pago ya fue registrado
            const paymentRef = db.collection('payments').doc(chargeId);
            const paymentSnap = await paymentRef.get();

            if (paymentSnap.exists) {
                console.log("Pago ya procesado previamente:", chargeId);
                return res.status(200).json({ received: true, status: 'already_processed' });
            }

            // Registrar pago en Firestore
            await paymentRef.set({
                paymentId: chargeId,
                uid: uid,
                productId: VIP_PRODUCT_ID,
                amount: amount,
                currency: currency,
                status: 'approved',
                method: 'yape',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                source: 'culqi_webhook'
            });

            // Activar VIP en el documento de usuario
            await db.collection('users').doc(uid).set({
                vip: {
                    active: true,
                    productId: VIP_PRODUCT_ID,
                    productName: 'MathQuest VIP - Acceso Total',
                    purchasedAt: Date.now(),
                    paymentId: chargeId,
                    amount: amount / 100,
                    currency: currency,
                    method: 'yape',
                    status: 'confirmed'
                },
                updatedAt: Date.now()
            }, { merge: true });

            console.log("VIP activado con éxito para usuario:", uid);
            return res.status(200).json({ received: true, status: 'vip_activated' });
        }

        return res.status(200).json({ received: true, status: 'unhandled_event' });
    } catch (error) {
        console.error("Error en webhook de Culqi:", error);
        return res.status(500).json({ error: error.message });
    }
});
