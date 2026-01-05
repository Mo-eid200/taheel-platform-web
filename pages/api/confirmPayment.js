"use strict";

import Stripe from "stripe";
import admin from "firebase-admin";

/**
 * Confirm a Stripe PaymentIntent (idempotent) and sync with Firestore.
 * Handles wallet recharge & service payments.
 *
 * ✅ Subscriptions:
 * - Do NOT change requests structure/logic.
 * - Only write subscription info into NEW collection: companySubscriptions
 * - Keep requests flow intact (still creates/updates request doc normally).
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
    if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
    if (typeof v === "number") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
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

// نفس اللى في الويب هوك: نقرأ الخدمة من servicesByClientType
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { paymentIntentId, requestId: providedRequestId } = req.body || {};
  if (!paymentIntentId) return res.status(400).json({ error: "Missing paymentIntentId" });

  try {
    // 1) Retrieve PaymentIntent
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!pi) return res.status(400).json({ error: "PaymentIntent not found" });

    if (normLower(pi.status) !== "succeeded") {
      return res.status(400).json({ error: "PaymentIntent not succeeded", status: pi.status });
    }

    // 2) Metadata
    const md = pi.metadata || {};
    let reqId = providedRequestId || md.requestId || md.orderNumber || null;

    // ✅ normalize requestType + clientType hard
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

    // ✅ Subscription metadata
    const subPlanKey = safeStr(md.planKey || "").trim();
    const subPricingKey = safeStr(md.pricingKey || "").trim();
    const subPaidMonths = safeNum(md.paidMonths || 0);
    const subBonus = safeNum(md.bonus || 0);

    // ✅ prefer totalSubscriptionDays
    const totalSubscriptionDays = safeNum(md.totalSubscriptionDays || md.totalSubDays || 0);
    const subDays = safeNum(md.subscriptionDays || 0);
    const daysToApply = totalSubscriptionDays > 0 ? totalSubscriptionDays : subDays > 0 ? subDays : 30;

    const subPlanName =
      safeStr(md.planName || md.subscriptionName || md.planTitle || "").trim() || subPlanKey;

    // ✅ isSubscription hard (planKey OR requestType)
    const isSubscription = subPlanKey.length > 0 || requestTypeMeta === "subscription";

    // attachments JSON
    let attachmentsMeta = null;
    if (md.attachments) {
      try {
        attachmentsMeta = JSON.parse(md.attachments);
      } catch {
        attachmentsMeta = null;
      }
    }

    // Amount
    const amountSmallest = pi.amount_received ?? pi.amount ?? 0;
    const amountAED = Number((amountSmallest / 100).toFixed(2));

    // 3) Idempotency doc
    const processedRef = db.collection("stripePaymentsProcessed").doc(paymentIntentId);
    const processedSnap = await processedRef.get();
    if (processedSnap.exists) {
      return res.status(200).json({
        ok: true,
        alreadyProcessed: true,
        paymentIntentId,
        orderNumber: processedSnap.data().requestId || null,
      });
    }

    // 4) Get request (if exists)
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

    // 5) customerId required
    const customerIdMeta = safeStr(md.customerId || md.userId || "").trim();
    if (!customerIdMeta) {
      await processedRef.set({
        paymentIntentId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        note: "missing_customerId",
        metadata: md,
      });
      return res.status(400).json({ error: "Missing customerId in metadata" });
    }

    // ✅ IMPORTANT: in your system company doc id = customerId (COM-xxx)
    const companyDocId = customerIdMeta;

    const userRef = db.collection("users").doc(companyDocId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await processedRef.set({
        paymentIntentId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        note: "user_not_found",
        metadata: md,
      });
      return res.status(400).json({ error: "User not found" });
    }

    // ✅ stronger company detection (metadata + user doc fallback)
    const udataTop = userSnap.data() || {};
    const userIsCompany =
      normLower(udataTop.accountType || udataTop.type || "") === "company";
    const isCompany = clientTypeMeta === "company" || userIsCompany;

    // 6) Fetch service definition (for embedding in request)
    const serviceDoc = await fetchServiceFromByClientType(serviceId, clientTypeMeta, serviceNameFromMeta);

    // =========================
    // 7) Transaction
    // =========================
    let finalRequestId = reqId || null;

    await db.runTransaction(async (tx) => {
      const proc = await tx.get(processedRef);
      if (proc.exists) throw new Error("ALREADY_PROCESSED");

      const uDoc = await tx.get(userRef);
      if (!uDoc.exists) throw new Error("User disappeared during transaction");

      let reqIdToUse = reqId;

      // A) UPDATE EXISTING REQUEST
      if (requestSnap && requestSnap.exists) {
        reqIdToUse = String(requestSnap.id);
        finalRequestId = reqIdToUse;

        const rdata = requestSnap.data() || {};
        const history = Array.isArray(rdata.statusHistory) ? rdata.statusHistory.slice() : [];
        history.push({ status: "paid", timestamp: nowISO(), updatedBy: "server-confirmPayment" });

        const updates = {
          lastUpdated: nowISO(),
          status: "paid",
          paidAmount: amountAED,
          paymentIntentId,
          statusHistory: history,
          paidAt: nowISO(),
          processingFee: typeof rdata.processingFee !== "undefined" ? rdata.processingFee : processingFeeMeta || 0,
        };

        if (rdata.attachments) updates.attachments = rdata.attachments;
        else if (attachmentsMeta) updates.attachments = attachmentsMeta;

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
        } else {
          if (serviceNameFromMeta) updates.serviceName = serviceNameFromMeta;
          if (serviceId) updates.serviceId = serviceId;
        }

        updates.assignedTo = rdata.assignedTo || assignedToMeta || "";
        updates.assignedToName = rdata.assignedToName || assignedToNameMeta || "";

        // ✅ IMPORTANT: DO NOT write any subscription fields into requests
        tx.update(requestRef, updates);
      } else {
        // B) CREATE NEW REQUEST
        if (!reqIdToUse) {
          reqIdToUse = `REQ-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
        }
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
        }

        const reqObj = {
          requestId: reqIdToUse,
          paymentIntentId,
          customerId: userRef.id,

          serviceId: serviceMap?.serviceId || serviceId || "",
          serviceName: serviceMap?.name || serviceNameFromMeta || "",
          requestType: requestTypeMeta,

          paidAmount: amountAED,
          printingFee: serviceMap?.printingFee ?? printingFeeFromMeta ?? 0,
          processingFee: processingFeeMeta || 0,

          coinsGiven,
          coinsUsed,

          createdAt: nowISO(),
          lastUpdated: nowISO(),
          status: "paid",
          paidAt: nowISO(),
          userEmail: uDoc.data().email || "",

          statusHistory: [{ status: "paid", timestamp: nowISO(), updatedBy: "server-confirmPayment" }],

          metadata: md || {},
          attachments: attachmentsMeta || {},
          clientSecret: md.clientSecret || null,

          assignedTo: assignedToMeta || "",
          assignedToName: assignedToNameMeta || "",
          ...(serviceMap ? { service: serviceMap, requiredDocuments: serviceMap.requiredDocuments || [] } : {}),
        };

        tx.set(db.collection("requests").doc(reqIdToUse), reqObj);
      }

      // C) UPDATE WALLET / COINS
      if (requestTypeMeta === "wallet_recharge") {
        const prevWallet = Number(uDoc.data().walletBalance ?? uDoc.data().wallet ?? 0);
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

      // ✅ D) SUBSCRIPTION — create companySubscriptions/{COM-...}
      if (isSubscription && isCompany) {
        const subRef = db.collection("companySubscriptions").doc(companyDocId);
        const subSnap = await tx.get(subRef);

        const now = new Date();
        let startDate = now;

        if (subSnap.exists) {
          const old = subSnap.data() || {};
          const oldEnd = toDateSafe(old.endAt) || toDateSafe(old.expiresAt) || toDateSafe(old.endAtISO) || null;
          const oldStatus = normLower(old.status || "");

          if (oldEnd && oldEnd.getTime() > now.getTime() && (oldStatus === "active" || oldStatus === "trial")) {
            startDate = oldEnd;
          }
        }

        const endDate = addDays(startDate, daysToApply);

        const startTs = admin.firestore.Timestamp.fromDate(startDate);
        const endTs = admin.firestore.Timestamp.fromDate(endDate);

        const udata = uDoc.data() || {};
        const companyPublicId = safeStr(udata.companyId || udata.customerId || udata.userId || companyDocId);
        const companyEmail = safeStr(udata.email || md.userEmail || "");

        const planName =
          subPlanName || safeStr(serviceNameFromMeta) || (normLower(md.lang) === "en" ? "Subscription" : "اشتراك");

        tx.set(
          subRef,
          {
            companyDocId,
            companyId: companyPublicId,
            email: companyEmail,

            isActive: true,
            status: "active",

            planKey: subPlanKey,
            planName,
            pricingKey: subPricingKey,

            subscriptionDays: daysToApply,
            paidMonths: subPaidMonths,
            bonus: subBonus,

            startAt: startTs,
            endAt: endTs,

            startAtISO: startDate.toISOString(),
            endAtISO: endDate.toISOString(),

            lastRequestId: finalRequestId,
            lastPaymentIntentId: paymentIntentId,

            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(subSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
          },
          { merge: true }
        );

        // history subcollection
        const histRef = subRef.collection("history").doc();
        tx.set(histRef, {
          companyDocId,
          companyId: companyPublicId,
          email: companyEmail,

          requestId: finalRequestId,
          paymentIntentId,

          planKey: subPlanKey,
          planName,
          pricingKey: subPricingKey,

          subscriptionDays: daysToApply,
          paidMonths: subPaidMonths,
          bonus: subBonus,

          startAt: startTs,
          endAt: endTs,

          status: "active",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // E) TRANSACTION LOG
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

      // F) NOTIFICATION
      const notifRef = db.collection("notifications").doc();
      tx.set(notifRef, {
        targetId: userRef.id,
        title:
          normLower(md.lang) === "en"
            ? isSubscription
              ? "Subscription Confirmed"
              : "Payment Confirmed"
            : isSubscription
            ? "تم تفعيل الاشتراك"
            : "تم تأكيد الدفع",
        body:
          normLower(md.lang) === "en"
            ? isSubscription
              ? `Your subscription is now active. Plan: ${subPlanKey || "N/A"} • Order: ${finalRequestId}`
              : `Your payment of ${amountAED.toFixed(2)} AED was received. Order: ${finalRequestId}`
            : isSubscription
            ? `تم تفعيل اشتراكك بنجاح. الخطة: ${subPlanKey || "—"} • رقم الطلب: ${finalRequestId}`
            : `تم استلام دفعتك بقيمة ${amountAED.toFixed(2)} د.إ الآن. رقم الطلب: ${finalRequestId}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isRead: false,
        metadata: {
          orderId: finalRequestId,
          paymentIntentId,
          ...(isSubscription
            ? {
                type: "subscription",
                planKey: subPlanKey,
                planName: subPlanName,
                pricingKey: subPricingKey,
                subscriptionDays: daysToApply,
              }
            : {}),
        },
      });

      // G) MARK AS PROCESSED (WITH DEBUG)
      tx.set(
        processedRef,
        {
          paymentIntentId,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          requestId: finalRequestId,
          amount: amountAED,

          // ✅ DEBUG (helps you know why sub didn't run)
          debug: {
            requestTypeMeta,
            clientTypeMeta,
            subPlanKey,
            subPricingKey,
            isSubscription,
            isCompany,
            userIsCompany,
            companyDocId,
            daysToApply,
          },
        },
        { merge: true }
      );
    });

    return res.status(200).json({
      ok: true,
      orderNumber: finalRequestId,
      ...(isSubscription
        ? {
            subscription: {
              planKey: safeStr(md.planKey || ""),
              planName: safeStr(md.planName || md.subscriptionName || ""),
              pricingKey: safeStr(md.pricingKey || ""),
              subscriptionDays: safeNum(md.totalSubscriptionDays || md.subscriptionDays || 0) || 30,
            },
          }
        : {}),
    });
  } catch (err) {
    if (err?.message === "ALREADY_PROCESSED") {
      return res.status(200).json({ ok: true, alreadyProcessed: true });
    }
    console.error("confirmPayment error:", err);
    return res.status(500).json({ error: err?.message || "internal_error" });
  }
}
