"use server";
import Stripe from "stripe";
import admin from "firebase-admin";

// Next.js API route (pages/api/confirmPayment.js)
// Purpose: idempotently confirm a Stripe PaymentIntent (by ID) and create/update
// the corresponding requests/transactions/notifications in Firestore.
//
// Required env:
// - STRIPE_SECRET_KEY
// - GOOGLE_SERVICE_ACCOUNT_KEY  (JSON string, with \n escaped or unescaped)
// Notes:
// - This endpoint is safe to call from client after confirmCardPayment to ensure
//   the server creates the canonical request record (or rely on webhook).
// - It is idempotent: it records processed PI ids in collection "stripePaymentsProcessed".

if (!admin.apps.length) {
  try {
    const sa = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : null;
    if (sa && sa.private_key) {
      // ensure newline characters are correct
      sa.private_key = sa.private_key.replace(/\\n/g, "\n");
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      admin.initializeApp();
    }
  } catch (e) {
    console.error("Failed to init firebase-admin:", e);
    try { admin.initializeApp(); } catch (e2) { /* ignore */ }
  }
}
const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function nowISO() { return new Date().toISOString(); }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { paymentIntentId, requestId: providedRequestId } = req.body || {};
  if (!paymentIntentId) return res.status(400).json({ error: "Missing paymentIntentId" });

  try {
    // Retrieve PaymentIntent from Stripe
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!pi) return res.status(400).json({ error: "PaymentIntent not found" });
    if (String(pi.status).toLowerCase() !== "succeeded") {
      return res.status(400).json({ error: "PaymentIntent not succeeded", status: pi.status });
    }

    const md = pi.metadata || {};
    let reqId = providedRequestId || md.requestId || md.orderNumber || null;
    const requestType = md.requestType || (md.serviceName && String(md.serviceName).toLowerCase().includes("wallet") ? "wallet_recharge" : "service");
    const coinsGiven = safeNum(md.coinsGiven ?? md.cashbackCoins ?? md.coins ?? 0);
    const coinsUsed = safeNum(md.coinsUsed ?? 0);
    const printingFee = safeNum(md.printingFee ?? 0);
    const serviceId = md.serviceId || "";
    const serviceName = md.serviceName || "";
    const amountSmallest = pi.amount_received ?? pi.amount ?? 0;
    const amountAED = Number((amountSmallest / 100).toFixed(2));

    const processedRef = db.collection("stripePaymentsProcessed").doc(paymentIntentId);
    // Idempotency check
    const processedSnap = await processedRef.get();
    if (processedSnap.exists) {
      console.log(`confirmPayment: already processed ${paymentIntentId}`);
      return res.status(200).json({ ok: true, alreadyProcessed: true, paymentIntentId, orderNumber: processedSnap.data().requestId || null });
    }

    // Locate request document (by provided id or by paymentIntentId)
    let requestRef = null;
    let requestSnap = null;
    if (reqId) {
      requestRef = db.collection("requests").doc(String(reqId));
      requestSnap = await requestRef.get();
    } else {
      const q = await db.collection("requests").where("paymentIntentId", "==", paymentIntentId).limit(1).get();
      if (!q.empty) {
        requestSnap = q.docs[0];
        requestRef = requestSnap.ref;
        reqId = requestRef.id;
      }
    }

    // Try to find user doc (best effort)
    let userSnap = null;
    const customerIdMeta = md.customerId || md.userId || null;
    if (customerIdMeta) {
      let q = await db.collection("users").where("customerId", "==", String(customerIdMeta)).limit(1).get();
      if (!q.empty) userSnap = q.docs[0];
      else {
        q = await db.collection("users").where("uid", "==", String(customerIdMeta)).limit(1).get();
        if (!q.empty) userSnap = q.docs[0];
      }
    }
    if (!userSnap && requestSnap && requestSnap.exists) {
      const rdata = requestSnap.data() || {};
      const cid = rdata.customerId || rdata.customer_id || null;
      if (cid) {
        const q = await db.collection("users").where("customerId", "==", String(cid)).limit(1).get();
        if (!q.empty) userSnap = q.docs[0];
      }
    }

    if (!userSnap) {
      // To avoid repeated retries mark processed and return an error for visibility
      await processedRef.set({ paymentIntentId, processedAt: admin.firestore.FieldValue.serverTimestamp(), note: "user_not_found", metadata: md });
      console.warn("confirmPayment: user not found", { paymentIntentId, md });
      return res.status(400).json({ error: "User not found" });
    }
    const userRef = userSnap.ref;

    // Transaction: create/update request, transactions, notifications, mark processed
    await db.runTransaction(async (tx) => {
      const proc = await tx.get(processedRef);
      if (proc.exists) throw new Error("ALREADY_PROCESSED");

      const uDoc = await tx.get(userRef);
      if (!uDoc.exists) throw new Error("User disappeared");

      let reqIdToUse = reqId;

      if (requestSnap && requestSnap.exists) {
        // update existing request
        reqIdToUse = String(requestSnap.id);
        const rdata = requestSnap.data() || {};
        const history = Array.isArray(rdata.statusHistory) ? rdata.statusHistory.slice() : [];
        history.push({ status: "paid", timestamp: nowISO(), updatedBy: "server-confirmPayment" });
        const updates = {
          lastUpdated: nowISO(),
          status: "paid",
          paidAmount: amountAED,
          paymentIntentId,
          statusHistory: history,
        };
        tx.update(requestRef, updates);
      } else {
        // create new request doc (use provided reqId if exists, else generate)
        if (!reqIdToUse) {
          reqIdToUse = `REQ-${Math.floor(100 + Math.random()*900)}-${Math.floor(1000 + Math.random()*9000)}`;
        }
        const reqObj = {
          requestId: reqIdToUse,
          paymentIntentId,
          customerId: userRef.id,
          serviceId,
          serviceName,
          requestType,
          paidAmount: amountAED,
          printingFee,
          coinsGiven,
          coinsUsed,
          createdAt: nowISO(),
          lastUpdated: nowISO(),
          status: "paid",
          userEmail: uDoc.data().email || "",
          statusHistory: [{ status: "paid", timestamp: nowISO(), updatedBy: "server-confirmPayment" }],
          metadata: md || {},
        };
        tx.set(db.collection("requests").doc(reqIdToUse), reqObj);
      }

      // Wallet / coins handling
      if (requestType === "wallet_recharge") {
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

      // create transaction record
      const txRef = db.collection("transactions").doc();
      tx.set(txRef, {
        userId: userRef.id,
        requestId: reqIdToUse,
        amount: amountAED,
        currency: pi.currency || "aed",
        type: "credit",
        status: "succeeded",
        paymentIntentId,
        coinsAdded: coinsGiven,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // notification
      const notifRef = db.collection("notifications").doc();
      tx.set(notifRef, {
        targetId: userRef.id,
        title: (md.lang === "en" ? "Payment Confirmed" : "تم تأكيد الدفع"),
        body: (md.lang === "en"
          ? `Your payment of ${amountAED.toFixed(2)} AED was received. Order: ${reqIdToUse}`
          : `تم استلام دفعتك بقيمة ${amountAED.toFixed(2)} د.إ الآن. رقم الطلب: ${reqIdToUse}`),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isRead: false,
        metadata: { orderId: reqIdToUse, paymentIntentId },
      });

      // mark processed
      tx.set(processedRef, {
        paymentIntentId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        requestId: reqIdToUse,
        amount: amountAED,
      });
    }); // end transaction

    return res.status(200).json({ ok: true, orderNumber: reqId });
  } catch (err) {
    console.error("confirmPayment error:", err);
    return res.status(500).json({ error: err.message || "internal_error" });
  }
}