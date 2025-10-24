"use strict";

import Stripe from "stripe";
import admin from "firebase-admin";

/**
 * Confirm a Stripe PaymentIntent (idempotent) and sync with Firestore.
 * Handles wallet recharge & service payments.
 */

if (!admin.apps.length) {
  try {
    const sa = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
      : null;
    if (sa && sa.private_key) {
      sa.private_key = sa.private_key.replace(/\\n/g, "\n");
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      admin.initializeApp();
    }
  } catch (e) {
    console.error("Failed to initialize firebase-admin:", e);
    try {
      admin.initializeApp();
    } catch {
      /* ignore */
    }
  }
}

const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function nowISO() {
  return new Date().toISOString();
}

// helper: fetch service data from servicesByClientType/{clientType}
async function fetchServiceFromByClientType(
  serviceId,
  clientType,
  serviceNameFallback = ""
) {
  const clientTypesToTry = clientType
    ? [clientType]
    : ["company", "resident", "nonresident", "other"];
  for (const ct of clientTypesToTry) {
    try {
      const docRef = db.collection("servicesByClientType").doc(String(ct));
      const snap = await docRef.get();
      if (!snap.exists) continue;
      const all = snap.data() || {};
      // direct key match
      if (serviceId && Object.prototype.hasOwnProperty.call(all, serviceId)) {
        return all[serviceId];
      }
      // search by inner id or name
      for (const k of Object.keys(all)) {
        const s = all[k];
        if (!s) continue;
        if (
          (s.serviceId && String(s.serviceId) === String(serviceId)) ||
          (serviceId && String(k) === String(serviceId)) ||
          (serviceNameFallback && String(s.name) === String(serviceNameFallback))
        ) {
          return s;
        }
      }
    } catch (e) {
      console.warn("fetchServiceFromByClientType error for", ct, e?.message || e);
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { paymentIntentId, requestId: providedRequestId } = req.body || {};
  if (!paymentIntentId)
    return res.status(400).json({ error: "Missing paymentIntentId" });

  try {
    // Retrieve PaymentIntent
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!pi) return res.status(400).json({ error: "PaymentIntent not found" });
    if (String(pi.status).toLowerCase() !== "succeeded") {
      return res
        .status(400)
        .json({ error: "PaymentIntent not succeeded", status: pi.status });
    }

    const md = pi.metadata || {};
    let reqId =
      providedRequestId || md.requestId || md.orderNumber || null;

    const requestType =
      md.requestType ||
      (md.serviceName &&
      String(md.serviceName).toLowerCase().includes("wallet")
        ? "wallet_recharge"
        : "service");

    const coinsGiven = safeNum(md.coinsGiven ?? md.cashbackCoins ?? md.coins ?? 0);
    const coinsUsed = safeNum(md.coinsUsed ?? 0);
    const printingFeeFromMeta = safeNum(md.printingFee ?? 0);
    const serviceId = md.serviceId || "";
    const serviceNameFromMeta = md.serviceName || "";
    const clientTypeMeta =
      md.clientType || md.client_type || md.serviceClientType || "";
    const assignedToMeta = md.assignedTo || md.assigned_to || "";
    const assignedToNameMeta =
      md.assignedToName || md.assigned_to_name || "";
    const processingFeeMeta = safeNum(
      md.processingFee ?? md.processing_fee ?? md.processing_fee_value ?? 0
    );

    // safe parse attachments
    let attachmentsMeta = null;
    if (md.attachments) {
      try {
        attachmentsMeta = JSON.parse(md.attachments);
      } catch {
        attachmentsMeta = null;
      }
    }

    const amountSmallest = pi.amount_received ?? pi.amount ?? 0;
    const amountAED = Number((amountSmallest / 100).toFixed(2));

    const processedRef = db
      .collection("stripePaymentsProcessed")
      .doc(paymentIntentId);
    const processedSnap = await processedRef.get();
    if (processedSnap.exists) {
      console.log(`confirmPayment: already processed ${paymentIntentId}`);
      return res.status(200).json({
        ok: true,
        alreadyProcessed: true,
        paymentIntentId,
        orderNumber: processedSnap.data().requestId || null,
      });
    }

    // locate request doc
    let requestRef = null;
    let requestSnap = null;
    if (reqId) {
      requestRef = db.collection("requests").doc(String(reqId));
      requestSnap = await requestRef.get();
    } else {
      const q = await db
        .collection("requests")
        .where("paymentIntentId", "==", paymentIntentId)
        .limit(1)
        .get();
      if (!q.empty) {
        requestSnap = q.docs[0];
        requestRef = requestSnap.ref;
        reqId = requestRef.id;
      }
    }

    // find user
    let userSnap = null;
    const customerIdMeta = md.customerId || md.userId || null;
    if (customerIdMeta) {
      let q = await db
        .collection("users")
        .where("customerId", "==", String(customerIdMeta))
        .limit(1)
        .get();
      if (!q.empty) userSnap = q.docs[0];
      else {
        q = await db
          .collection("users")
          .where("uid", "==", String(customerIdMeta))
          .limit(1)
          .get();
        if (!q.empty) userSnap = q.docs[0];
      }
    }
    if (!userSnap && requestSnap && requestSnap.exists) {
      const rdata = requestSnap.data() || {};
      const cid = rdata.customerId || rdata.customer_id || null;
      if (cid) {
        const q = await db
          .collection("users")
          .where("customerId", "==", String(cid))
          .limit(1)
          .get();
        if (!q.empty) userSnap = q.docs[0];
      }
    }

    if (!userSnap) {
      await processedRef.set({
        paymentIntentId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        note: "user_not_found",
        metadata: md,
      });
      console.warn("confirmPayment: user not found", { paymentIntentId, md });
      return res.status(400).json({ error: "User not found" });
    }

    const userRef = userSnap.ref;
    const serviceDoc = await fetchServiceFromByClientType(
      serviceId,
      clientTypeMeta,
      serviceNameFromMeta
    );

    // -------------------- TRANSACTION --------------------
    let finalRequestId = reqId || null;

    await db.runTransaction(async (tx) => {
      const proc = await tx.get(processedRef);
      if (proc.exists) throw new Error("ALREADY_PROCESSED");

      const uDoc = await tx.get(userRef);
      if (!uDoc.exists) throw new Error("User disappeared during transaction");

      let reqIdToUse = reqId;

      if (requestSnap && requestSnap.exists) {
        // ===== update existing =====
        reqIdToUse = String(requestSnap.id);
        const rdata = requestSnap.data() || {};
        const history = Array.isArray(rdata.statusHistory)
          ? rdata.statusHistory.slice()
          : [];
        history.push({
          status: "paid",
          timestamp: nowISO(),
          updatedBy: "server-confirmPayment",
        });

        const updates = {
          lastUpdated: nowISO(),
          status: "paid",
          paidAmount: amountAED,
          paymentIntentId,
          statusHistory: history,
          paidAt: nowISO(),
          processingFee:
            typeof rdata.processingFee !== "undefined"
              ? rdata.processingFee
              : processingFeeMeta || 0,
        };

        if (rdata.attachments) updates.attachments = rdata.attachments;
        else if (attachmentsMeta) updates.attachments = attachmentsMeta;

        if (rdata.clientSecret)
          updates.clientSecret = rdata.clientSecret;
        else if (md.clientSecret)
          updates.clientSecret = md.clientSecret;

        if (serviceDoc) {
          const svc = {
            name: serviceDoc.name || serviceNameFromMeta || "",
            serviceId: serviceDoc.serviceId || serviceId || "",
            providers: Array.isArray(serviceDoc.providers)
              ? serviceDoc.providers
              : serviceDoc.providers
              ? [serviceDoc.providers]
              : [],
            category: serviceDoc.category || "",
            subcategory: serviceDoc.subcategory || serviceDoc.subCategory || "",
            clientPrice: safeNum(
              serviceDoc.clientPrice ?? serviceDoc.price ?? amountAED
            ),
            price: safeNum(
              serviceDoc.price ?? serviceDoc.clientPrice ?? amountAED
            ),
            printingFee: safeNum(
              serviceDoc.printingFee ?? printingFeeFromMeta ?? 0
            ),
            tax: safeNum(serviceDoc.tax ?? 0),
            description: serviceDoc.description || "",
            requiredDocuments: Array.isArray(serviceDoc.requiredDocuments)
              ? serviceDoc.requiredDocuments
              : [],
            active:
              typeof serviceDoc.active === "boolean"
                ? serviceDoc.active
                : true,
            duration: serviceDoc.duration || "",
            profit: safeNum(serviceDoc.profit ?? 0),
            repeatable:
              typeof serviceDoc.repeatable === "boolean"
                ? serviceDoc.repeatable
                : false,
            requireUpload:
              typeof serviceDoc.requireUpload === "boolean"
                ? serviceDoc.requireUpload
                : false,
          };
          updates.service = svc;
          updates.serviceName = svc.name;
          updates.serviceId = svc.serviceId;
          updates.providers = svc.providers;
          updates.printingFee = rdata.printingFee ?? svc.printingFee;
          updates.requiredDocuments = svc.requiredDocuments;
        } else {
          if (serviceNameFromMeta) updates.serviceName = serviceNameFromMeta;
          if (serviceId) updates.serviceId = serviceId;
        }

        updates.assignedTo =
          rdata.assignedTo || assignedToMeta || "";
        updates.assignedToName =
          rdata.assignedToName || assignedToNameMeta || "";

        tx.update(requestRef, updates);
        finalRequestId = reqIdToUse;
      } else {
        // ===== create new =====
        if (!reqIdToUse)
          reqIdToUse = `REQ-${Math.floor(100 + Math.random() * 900)}-${Math.floor(
            1000 + Math.random() * 9000
          )}`;
        finalRequestId = reqIdToUse;

        let serviceMap = null;
        if (serviceDoc) {
          serviceMap = {
            name: serviceDoc.name || serviceNameFromMeta || "",
            serviceId: serviceDoc.serviceId || serviceId || "",
            providers: Array.isArray(serviceDoc.providers)
              ? serviceDoc.providers
              : serviceDoc.providers
              ? [serviceDoc.providers]
              : [],
            category: serviceDoc.category || "",
            subcategory: serviceDoc.subcategory || serviceDoc.subCategory || "",
            clientPrice: safeNum(
              serviceDoc.clientPrice ?? serviceDoc.price ?? amountAED
            ),
            price: safeNum(
              serviceDoc.price ?? serviceDoc.clientPrice ?? amountAED
            ),
            printingFee: safeNum(
              serviceDoc.printingFee ?? printingFeeFromMeta ?? 0
            ),
            tax: safeNum(serviceDoc.tax ?? 0),
            description: serviceDoc.description || "",
            requiredDocuments: Array.isArray(serviceDoc.requiredDocuments)
              ? serviceDoc.requiredDocuments
              : [],
            active:
              typeof serviceDoc.active === "boolean"
                ? serviceDoc.active
                : true,
            duration: serviceDoc.duration || "",
            profit: safeNum(serviceDoc.profit ?? 0),
            repeatable:
              typeof serviceDoc.repeatable === "boolean"
                ? serviceDoc.repeatable
                : false,
            requireUpload:
              typeof serviceDoc.requireUpload === "boolean"
                ? serviceDoc.requireUpload
                : false,
          };
        }

        const reqObj = {
          requestId: reqIdToUse,
          paymentIntentId,
          customerId: userRef.id,
          serviceId: serviceMap?.serviceId || serviceId || "",
          serviceName: serviceMap?.name || serviceNameFromMeta || "",
          requestType,
          paidAmount: amountAED,
          printingFee: serviceMap?.printingFee ?? printingFeeFromMeta ?? 0,
          coinsGiven,
          coinsUsed,
          createdAt: nowISO(),
          lastUpdated: nowISO(),
          status: "paid",
          paidAt: nowISO(),
          userEmail: uDoc.data().email || "",
          statusHistory: [
            {
              status: "paid",
              timestamp: nowISO(),
              updatedBy: "server-confirmPayment",
            },
          ],
          metadata: md || {},
          attachments: attachmentsMeta || {},
          clientSecret: md.clientSecret || null,
          processingFee: processingFeeMeta || 0,
          assignedTo: assignedToMeta || "",
          assignedToName: assignedToNameMeta || "",
          ...(serviceMap
            ? { service: serviceMap, requiredDocuments: serviceMap.requiredDocuments || [] }
            : {}),
        };

        tx.set(db.collection("requests").doc(reqIdToUse), reqObj);
      }

      // wallet / coins
      if (requestType === "wallet_recharge") {
        const prevWallet = Number(
          uDoc.data().walletBalance ?? uDoc.data().wallet ?? 0
        );
        const newWallet = +(prevWallet + amountAED).toFixed(2);
        tx.update(userRef, {
          walletBalance: newWallet,
          ...(coinsGiven > 0
            ? { coins: admin.firestore.FieldValue.increment(coinsGiven) }
            : {}),
          lastWalletUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        if (coinsGiven > 0)
          tx.update(userRef, {
            coins: admin.firestore.FieldValue.increment(coinsGiven),
          });
      }

      // transaction record
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
        title: md.lang === "en" ? "Payment Confirmed" : "تم تأكيد الدفع",
        body:
          md.lang === "en"
            ? `Your payment of ${amountAED.toFixed(2)} AED was received. Order: ${reqIdToUse}`
            : `تم استلام دفعتك بقيمة ${amountAED.toFixed(
                2
              )} د.إ الآن. رقم الطلب: ${reqIdToUse}`,
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

    return res.status(200).json({ ok: true, orderNumber: finalRequestId });
  } catch (err) {
    if (err.message === "ALREADY_PROCESSED") {
      return res.status(200).json({ ok: true, alreadyProcessed: true });
    }
    console.error("confirmPayment error:", err);
    return res.status(500).json({ error: err.message || "internal_error" });
  }
}
