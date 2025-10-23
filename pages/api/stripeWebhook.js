import Stripe from 'stripe';
import admin from 'firebase-admin';

// IMPORTANT: Next.js API route must disable bodyParser to access raw body
export const config = { api: { bodyParser: false } };

// initialize firebase admin once
if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : null;
    if (serviceAccount && serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      // If running in Google environment, default credentials may be available
      admin.initializeApp();
    }
  } catch (e) {
    console.error('Failed to initialize Firebase Admin:', e);
    // try init default
    try { admin.initializeApp(); } catch (e2) {}
  }
}
const db = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// helper to read raw body (no external dependency)
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).send('Server misconfigured');
  }

  let event;
  try {
    const buf = await getRawBody(req); // Buffer
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe signature verification failed:', err && err.message);
    return res.status(400).send(`Webhook Error: ${err && err.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const piId = pi.id;
      const md = pi.metadata || {};

      // metadata keys (should be set when creating PaymentIntent)
      const requestId = md.requestId || md.orderNumber || null;
      const customerIdMeta = md.customerId || md.userId || null;
      const requestType = md.requestType || (md.serviceName && String(md.serviceName).toLowerCase().includes('wallet') ? 'wallet_recharge' : 'service');
      const coinsGiven = safeNum(md.coinsGiven ?? md.cashbackCoins ?? md.coins ?? 0);
      const coinsUsed = safeNum(md.coinsUsed ?? 0);
      const printingFee = safeNum(md.printingFee ?? 0);
      const serviceId = md.serviceId || '';
      const serviceName = md.serviceName || '';

      // amount in smallest unit (fils)
      const amountSmallest = pi.amount_received ?? pi.amount ?? 0;
      const amountAED = Number((amountSmallest / 100).toFixed(2));

      // idempotency check
      const processedRef = db.collection('stripePaymentsProcessed').doc(piId);
      const processedSnap = await processedRef.get();
      if (processedSnap.exists) {
        console.log(`Webhook: already processed ${piId}`);
        return res.json({ received: true });
      }

      // find request doc if exists
      let requestRef = null;
      let requestSnap = null;
      if (requestId) {
        requestRef = db.collection('requests').doc(String(requestId));
        requestSnap = await requestRef.get();
      } else {
        const q = await db.collection('requests').where('paymentIntentId', '==', piId).limit(1).get();
        if (!q.empty) {
          requestSnap = q.docs[0];
          requestRef = requestSnap.ref;
        }
      }

      // find user document
      let userSnap = null;
      if (customerIdMeta) {
        let q = await db.collection('users').where('customerId', '==', String(customerIdMeta)).limit(1).get();
        if (!q.empty) userSnap = q.docs[0];
        else {
          q = await db.collection('users').where('uid', '==', String(customerIdMeta)).limit(1).get();
          if (!q.empty) userSnap = q.docs[0];
        }
      }
      if (!userSnap && requestSnap && requestSnap.exists) {
        const rdata = requestSnap.data() || {};
        const cid = rdata.customerId || rdata.customer_id || null;
        if (cid) {
          const q = await db.collection('users').where('customerId', '==', String(cid)).limit(1).get();
          if (!q.empty) userSnap = q.docs[0];
        }
      }

      if (!userSnap) {
        console.warn(`Webhook: user not found for paymentIntent ${piId} (customerId=${customerIdMeta})`);
        await processedRef.set({ paymentIntentId: piId, processedAt: admin.firestore.FieldValue.serverTimestamp(), note: 'user_not_found', metadata: md });
        return res.json({ received: true });
      }

      const userRef = userSnap.ref;

      // atomic updates
      await db.runTransaction(async (tx) => {
        const uDoc = await tx.get(userRef);
        if (!uDoc.exists) throw new Error('User disappeared during transaction');

        let reqIdToUse = requestId;

        if (requestType === 'wallet_recharge') {
          const prevWallet = Number(uDoc.data().walletBalance ?? uDoc.data().wallet ?? 0);
          const newWallet = +(prevWallet + amountAED).toFixed(2);
          tx.update(userRef, {
            walletBalance: newWallet,
            ...(coinsGiven > 0 ? { coins: admin.firestore.FieldValue.increment(coinsGiven) } : {}),
            lastWalletUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          if (coinsGiven > 0) tx.update(userRef, { coins: admin.firestore.FieldValue.increment(coinsGiven) });
        }

        // update/create request
        if (requestSnap && requestSnap.exists) {
          reqIdToUse = String(requestSnap.id);
          const rdata = requestSnap.data() || {};
          const updates = {
            lastUpdated: new Date().toISOString(),
            status: 'paid',
            paidAmount: amountAED,
            paymentIntentId: piId,
          };
          const history = Array.isArray(rdata.statusHistory) ? rdata.statusHistory.slice() : [];
          history.push({ status: 'paid', timestamp: new Date().toISOString(), updatedBy: 'stripe-webhook' });
          updates.statusHistory = history;
          tx.update(requestRef, updates);
        } else {
          if (!reqIdToUse) reqIdToUse = `REQ-${Date.now()}`;
          const reqObj = {
            requestId: reqIdToUse,
            paymentIntentId: piId,
            customerId: userRef.id,
            serviceId,
            serviceName,
            requestType,
            paidAmount: amountAED,
            printingFee,
            coinsGiven,
            coinsUsed,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            status: 'paid',
            userEmail: uDoc.data().email || '',
            metadata: md || {},
          };
          tx.set(db.collection('requests').doc(reqIdToUse), reqObj);
        }

        // create transaction record
        const txRef = db.collection('transactions').doc();
        tx.set(txRef, {
          userId: userRef.id,
          requestId: reqIdToUse,
          amount: amountAED,
          currency: pi.currency || 'aed',
          type: 'credit',
          status: 'succeeded',
          paymentIntentId: piId,
          coinsAdded: coinsGiven,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // mark processed
        tx.set(processedRef, {
          paymentIntentId: piId,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          requestId: reqIdToUse,
          amount: amountAED,
        });
      });

      console.log(`✅ webhook processed ${piId} for user ${userRef.id}: AED ${amountAED}, coins ${coinsGiven}`);
      return res.json({ received: true });
    }

    // ignore other events
    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).send('internal error');
  }
}