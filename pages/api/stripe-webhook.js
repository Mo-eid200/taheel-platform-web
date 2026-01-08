"use strict";

import Stripe from "stripe";
import admin from "firebase-admin";

// -------- Next.js config (raw body) --------
export const config = { api: { bodyParser: false } };

// -------- Firebase Admin init (idempotent) --------
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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

// helpers
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function safeStr(v) {
  if (v == null) return "";
  return String(v);
}
function normLower(v) {
  return safeStr(v).trim().toLowerCase();
}
function nowISO() {
  return new Date().toISOString();
}
function toDateSafe(v) {
  try {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === "function") return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// service reader
async function fetchServiceFromByClientType(serviceId, clientType, serviceNameFallback = "") {
  const clientTypesToTry = clientType ? [clientType] : ["company", "resident", "nonresident", "other"];

  for (const ct of clientTypesToTry) {
    try {
      const docRef = db.collection("servicesByClientType").doc(String(ct));
      const snap = await docRef.get();
      if (!snap.exists) continue;

      const all = snap.data() || {};

      if (serviceId && Object.prototype.hasOwnProperty.call(all, serviceId)) {
        return all[serviceId];
      }

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

// Expo push
async function sendExpoPushToUser(userRef, title, body, data = {}) {
  try {
    const userSnap = await userRef.get();
    if (!userSnap.exists) return;

    const userData = userSnap.data() || {};
    const expoPushToken = userData.expoPushToken;
    if (!expoPushToken) return;

    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: expoPushToken, sound: "default", title, body, data }),
    });

    const json = await resp.json();
    console.log("Expo push response:", json);
  } catch (err) {
    console.error("❌ sendExpoPushToUser error:", err);
  }
}

// -------- MAIN HANDLER --------
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).send("Server misconfigured (missing STRIPE_WEBHOOK_SECRET)");

  // 1) verify signature
  let event;
  try {
    const buf = await getRawBody(req);
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error("❌ Stripe signature verification failed:", err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }

  // 2) only payment_intent.succeeded
  if (event.type !== "payment_intent.succeeded") return res.json({ received: true });

  try {
    const pi = event.data.object;
    const paymentIntentId = pi.id;
    const md = pi.metadata || {};

    const reqIdFromMeta = md.requestId || md.orderNumber || null;

    const requestTypeMeta = normLower(
      md.requestType ||
        (md.serviceName && normLower(md.serviceName).includes("wallet") ? "wallet_recharge" : "service")
    );
    const clientTypeMeta = normLower(md.clientType || md.client_type || md.serviceClientType || "");

    const coinsGiven = safeNum(md.coinsGiven ?? md.cashbackCoins ?? md.coins ?? 0);
    const coinsUsed = safeNum(md.coinsUsed ?? 0);

    const printingFeeFromMeta = safeNum(md.printingFee ?? 0);
    const processingFeeMeta = safeNum(md.processingFee ?? md.processing_fee ?? md.processing_fee_value ?? 0);

    const serviceId = safeStr(md.serviceId || "");
    const serviceNameFromMeta = safeStr(md.serviceName || "");

    const assignedToMeta = safeStr(md.assignedTo || md.assigned_to || "");
    const assignedToNameMeta = safeStr(md.assignedToName || md.assigned_to_name || "");

    // subscription
    const planKey = safeStr(md.planKey || "").trim();
    const planName = safeStr(md.planName || md.subscriptionName || md.planTitle || "").trim() || planKey;
    const pricingKey = safeStr(md.pricingKey || "").trim();

    const totalSubscriptionDays = safeNum(md.totalSubscriptionDays || md.totalSubDays || 0);
    const subscriptionDays = safeNum(md.subscriptionDays || 0);
    const giftDays = safeNum(md.giftDays || 0);
    const daysToApply = totalSubscriptionDays > 0 ? totalSubscriptionDays : Math.max(0, subscriptionDays + giftDays) || 30;

    const paidMonths = safeNum(md.paidMonths || 0);
    const bonus = safeNum(md.bonus || 0);

    const isSubscription = requestTypeMeta === "subscription" || planKey.length > 0;

    // attachments
    let attachmentsMeta = {};
    if (md.attachments) {
      try {
        attachmentsMeta = JSON.parse(md.attachments) || {};
      } catch {
        attachmentsMeta = {};
      }
    }

    // amount
    const amountSmallest = pi.amount_received ?? pi.amount ?? 0;
    const amountAED = Number((amountSmallest / 100).toFixed(2));

    const processedRef = db.collection("stripePaymentsProcessed").doc(paymentIntentId);

    // locate requestRef
    let requestRef = null;
    let reqId = reqIdFromMeta;

    if (reqId) {
      requestRef = db.collection("requests").doc(String(reqId));
    } else {
      const q = await db.collection("requests").where("paymentIntentId", "==", paymentIntentId).limit(1).get();
      if (!q.empty) {
        requestRef = q.docs[0].ref;
        reqId = q.docs[0].id;
      }
    }

    // locate user
    const customerIdMeta = safeStr(md.customerId || md.userId || "").trim();
    if (!customerIdMeta) {
      await processedRef.set({
        paymentIntentId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        note: "missing_customerId",
        metadata: md,
      });
      return res.json({ received: true });
    }

    const userRef = db.collection("users").doc(customerIdMeta);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await processedRef.set({
        paymentIntentId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        note: "user_not_found",
        metadata: md,
      });
      return res.json({ received: true });
    }

    // service doc (outside tx ok)
    const serviceDoc = await fetchServiceFromByClientType(serviceId, clientTypeMeta, serviceNameFromMeta);

    // push vars
    const langIsEn = normLower(md.lang) === "en";
    let finalRequestIdAfterTx = null;
    let notifyTitleAfterTx = "";
    let notifyBodyAfterTx = "";
    let notifyDataAfterTx = {};

    // =============================
    // Transaction
    // =============================
    await db.runTransaction(async (tx) => {
      // all reads first
      const procCheck = await tx.get(processedRef);
      if (procCheck.exists) throw new Error("ALREADY_PROCESSED");

      const uDoc = await tx.get(userRef);
      if (!uDoc.exists) throw new Error("User disappeared during transaction");

      const udata = uDoc.data() || {};
      const userIsCompany = normLower(udata.accountType || udata.type || "") === "company";
      const isCompany =
        clientTypeMeta === "company" ||
        customerIdMeta.startsWith("COM-") ||
        userIsCompany;

      const rDoc = requestRef ? await tx.get(requestRef) : null;

      const subRef = db.collection("companySubscriptions").doc(customerIdMeta);
      const subSnap = isSubscription && isCompany ? await tx.get(subRef) : null;

      // writes
      let finalRequestId = reqId || null;

      // A) request
      if (requestRef && rDoc && rDoc.exists) {
        finalRequestId = String(rDoc.id);
        const rdata = rDoc.data() || {};

        const history = Array.isArray(rdata.statusHistory) ? [...rdata.statusHistory] : [];
        history.push({ status: "paid", timestamp: nowISO(), updatedBy: "stripe-webhook" });

        const updates = {
          lastUpdated: nowISO(),
          status: "paid",
          paidAmount: amountAED,
          paymentIntentId,
          statusHistory: history,
          paidAt: nowISO(),
          processingFee: typeof rdata.processingFee !== "undefined" ? rdata.processingFee : processingFeeMeta || 0,
          assignedTo: rdata.assignedTo || assignedToMeta || "",
          assignedToName: rdata.assignedToName || assignedToNameMeta || "",
        };

        if (rdata.attachments) updates.attachments = rdata.attachments;
        else if (attachmentsMeta && Object.keys(attachmentsMeta).length) updates.attachments = attachmentsMeta;

        if (rdata.clientSecret) updates.clientSecret = rdata.clientSecret;
        else if (md.clientSecret) updates.clientSecret = md.clientSecret;

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
            clientPrice: safeNum(serviceDoc.clientPrice ?? serviceDoc.price ?? amountAED),
            price: safeNum(serviceDoc.price ?? serviceDoc.clientPrice ?? amountAED),
            printingFee: safeNum(serviceDoc.printingFee ?? printingFeeFromMeta ?? 0),
            tax: safeNum(serviceDoc.tax ?? 0),
            description: serviceDoc.description || "",
            requiredDocuments: Array.isArray(serviceDoc.requiredDocuments) ? serviceDoc.requiredDocuments : [],
            active: typeof serviceDoc.active === "boolean" ? serviceDoc.active : true,
            duration: serviceDoc.duration || "",
            profit: safeNum(serviceDoc.profit ?? 0),
            repeatable: typeof serviceDoc.repeatable === "boolean" ? serviceDoc.repeatable : false,
            requireUpload: typeof serviceDoc.requireUpload === "boolean" ? serviceDoc.requireUpload : false,
          };

          updates.service = svc;
          updates.serviceName = svc.name;
          updates.serviceId = svc.serviceId;
          updates.providers = svc.providers;
          updates.printingFee = rdata.printingFee ?? svc.printingFee ?? printingFeeFromMeta ?? 0;
          updates.requiredDocuments = svc.requiredDocuments;
        }

        tx.update(requestRef, updates);
      } else {
        if (!finalRequestId) {
          finalRequestId = `REQ-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const newReqRef = db.collection("requests").doc(finalRequestId);

        tx.set(newReqRef, {
          requestId: finalRequestId,
          paymentIntentId,
          customerId: userRef.id,

          serviceId: serviceId || "",
          serviceName: serviceNameFromMeta || "",
          requestType: requestTypeMeta,

          paidAmount: amountAED,
          printingFee: printingFeeFromMeta ?? 0,
          processingFee: processingFeeMeta ?? 0,

          coinsGiven,
          coinsUsed,

          createdAt: nowISO(),
          lastUpdated: nowISO(),
          status: "paid",
          paidAt: nowISO(),
          userEmail: safeStr(udata.email || ""),

          statusHistory: [{ status: "paid", timestamp: nowISO(), updatedBy: "stripe-webhook" }],

          metadata: md || {},
          attachments: attachmentsMeta || {},
          clientSecret: md.clientSecret || null,

          assignedTo: assignedToMeta || "",
          assignedToName: assignedToNameMeta || "",
        });

        requestRef = newReqRef;
      }

      // B) wallet/coins
      if (requestTypeMeta === "wallet_recharge") {
        const prevWallet = Number(udata.walletBalance ?? udata.wallet ?? 0);
        const newWallet = +(prevWallet + amountAED).toFixed(2);

        tx.update(userRef, {
          walletBalance: newWallet,
          ...(coinsGiven > 0 ? { coins: admin.firestore.FieldValue.increment(coinsGiven) } : {}),
          lastWalletUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        if (coinsGiven > 0) {
          tx.update(userRef, { coins: admin.firestore.FieldValue.increment(coinsGiven) });
        }
      }

      // C) transactions log
      const txRef = db.collection("transactions").doc();
      tx.set(txRef, {
        userId: userRef.id,
        requestId: finalRequestId,
        amount: amountAED,
        currency: pi.currency || "aed",
        type: "credit",
        status: "succeeded",
        paymentIntentId,
        coinsAdded: coinsGiven,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // D) notification doc
      const notifRef = db.collection("notifications").doc();
      const notifTitle = langIsEn ? (isSubscription ? "Subscription Confirmed" : "Payment Confirmed") : (isSubscription ? "تم تفعيل الاشتراك" : "تم تأكيد الدفع");
      const notifBody = langIsEn
        ? (isSubscription
            ? `Your subscription is now active. Plan: ${planKey || "N/A"} • Order: ${finalRequestId}`
            : `Your payment of ${amountAED.toFixed(2)} AED was received. Order: ${finalRequestId}`)
        : (isSubscription
            ? `تم تفعيل اشتراكك بنجاح. الخطة: ${planKey || "—"} • رقم الطلب: ${finalRequestId}`
            : `تم استلام دفعتك بقيمة ${amountAED.toFixed(2)} د.إ الآن. رقم الطلب: ${finalRequestId}`);

      tx.set(notifRef, {
        targetId: userRef.id,
        title: notifTitle,
        body: notifBody,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isRead: false,
        metadata: { orderId: finalRequestId, paymentIntentId, ...(isSubscription ? { type: "subscription", planKey, planName, pricingKey, subscriptionDays: daysToApply } : {}) },
      });

      // D2) subscription
      if (isSubscription && isCompany) {
        const now = new Date();
        let startDate = now;
        let baseEnd = now;

        if (subSnap && subSnap.exists) {
          const old = subSnap.data() || {};
          const oldEnd = toDateSafe(old.endAt) || toDateSafe(old.expiresAt) || toDateSafe(old.endAtISO);
          const oldStatus = normLower(old.status || "");

          if (oldEnd && oldEnd.getTime() > now.getTime() && (oldStatus === "active" || oldStatus === "trial")) {
            baseEnd = oldEnd;
            const oldStart = toDateSafe(old.startAt) || toDateSafe(old.startAtISO);
            startDate = oldStart || toDateSafe(old.createdAt) || now;
          }
        }

        const endDate = addDays(baseEnd, daysToApply);
        const startTs = admin.firestore.Timestamp.fromDate(startDate);
        const endTs = admin.firestore.Timestamp.fromDate(endDate);

        const isExpiredNow = endDate.getTime() <= now.getTime();
        const statusNow = isExpiredNow ? "expired" : "active";

        const companyPublicId = safeStr(udata.companyId || udata.customerId || udata.userId || customerIdMeta);
        const companyEmail = safeStr(udata.email || md.userEmail || "");

        tx.set(
          subRef,
          {
            companyDocId: customerIdMeta,
            companyId: companyPublicId,
            email: companyEmail,

            planKey,
            planName,
            pricingKey,

            subscriptionDays: daysToApply,
            paidMonths,
            bonus,

            startAt: startTs,
            endAt: endTs,
            startAtISO: startDate.toISOString(),
            endAtISO: endDate.toISOString(),

            status: statusNow,
            isActive: !isExpiredNow,

            computed: {
              isExpired: isExpiredNow,
              isActiveNow: !isExpiredNow,
              nowISO: now.toISOString(),
            },

            lastRequestId: finalRequestId,
            lastPaymentIntentId: paymentIntentId,

            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(subSnap && subSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
          },
          { merge: true }
        );

        tx.set(subRef.collection("history").doc(paymentIntentId), {
          companyDocId: customerIdMeta,
          companyId: companyPublicId,
          email: companyEmail,

          requestId: finalRequestId,
          paymentIntentId,

          planKey,
          planName,
          pricingKey,

          subscriptionDays: daysToApply,
          paidMonths,
          bonus,

          startAt: startTs,
          endAt: endTs,

          status: "active",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // E) processed (idempotency)
      tx.set(processedRef, {
        paymentIntentId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        requestId: finalRequestId,
        amount: amountAED,
        debug: {
          requestTypeMeta,
          clientTypeMeta,
          planKey,
          pricingKey,
          isSubscription,
          isCompany,
          userIsCompany,
          daysToApply,
        },
      });

      // push vars
      finalRequestIdAfterTx = finalRequestId;
      notifyTitleAfterTx = notifTitle;
      notifyBodyAfterTx = notifBody;
      notifyDataAfterTx = { type: "payment_success", orderId: finalRequestId, paymentIntentId };
    });

    // push after tx
    try {
      if (finalRequestIdAfterTx) {
        await sendExpoPushToUser(userRef, notifyTitleAfterTx, notifyBodyAfterTx, notifyDataAfterTx);
      }
    } catch (pushErr) {
      console.error("push send failed:", pushErr);
    }

    return res.json({ received: true });
  } catch (err) {
    if (err?.message === "ALREADY_PROCESSED") return res.json({ received: true });
    console.error("❌ webhook processing error:", err);
    return res.status(500).send("internal_error");
  }
}
