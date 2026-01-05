"use strict";

import Stripe from "stripe";
import admin from "firebase-admin";

/**
 * Create Stripe PaymentIntent (server-side fee calc) and create/merge request doc.
 *
 * ✅ Rules:
 * - DO NOT touch requests schema/logic
 * - Subscription info stays in metadata ONLY; confirm endpoint will write into companySubscriptions
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

// ---------------- Helpers ----------------
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function safeStr(v) {
  if (v == null) return "";
  return String(v);
}
function nowISO() {
  return new Date().toISOString();
}
function generateOrderNumber() {
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${part1}-${part2}`;
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

/**
 * ✅ Processing fee calc (editable via env)
 * - STRIPE_FEE_FIXED_AED = "1.00"
 * - STRIPE_FEE_PERCENT  = "0.029"
 */
function calcProcessingFeeAED(amountAED) {
  const fixed = safeNum(process.env.STRIPE_FEE_FIXED_AED || 0);
  const percent = safeNum(process.env.STRIPE_FEE_PERCENT || 0);
  const fee = fixed + amountAED * percent;
  return Number(fee.toFixed(2));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = req.body || {};

    // REQUIRED
    const customerId = safeStr(body.customerId || body.userId);
    const lang = safeStr(body.lang || "ar");

    // Payment context
    const requestType = safeStr(body.requestType || "service"); // "service" | "wallet_recharge" | "subscription"
    const clientType = safeStr(body.clientType || body.client_type || "");
    const serviceId = safeStr(body.serviceId || "");
    const serviceName = safeStr(body.serviceName || "");

    // Optional assignment
    const assignedTo = safeStr(body.assignedTo || "");
    const assignedToName = safeStr(body.assignedToName || "");

    // Optional coins
    const coinsUsed = safeNum(body.coinsUsed || 0);
    const coinsGiven = safeNum(body.coinsGiven || 0);

    // ---------------- Subscription metadata ----------------
    // ✅ Plan identity
    const planKey = safeStr(body.planKey || "");
    const planName = safeStr(body.planName || body.subscriptionName || "") || planKey; // يظهر في كارت الشركة
    const pricingKey = safeStr(body.pricingKey || "");

    // ✅ DAYS (monthly 30 days + gift 7 days = 37)
    const subscriptionDays = safeNum(body.subscriptionDays || body.subDays || 0); // مثال: 30
    const giftDays = safeNum(body.giftDays || body.bonusDays || 0);              // مثال: 7
    const totalSubDays = Math.max(0, subscriptionDays + giftDays);

    // (optional old fields for compatibility)
    const monthsShown = safeNum(body.monthsShown || 0);
    const paidMonths = safeNum(body.paidMonths || 0);
    const bonus = safeNum(body.bonus || 0);

    if (!customerId) return res.status(400).json({ ok: false, error: "Missing customerId" });

    // Load user (customerId لازم يبقى موجود)
    const userRef = db.collection("users").doc(customerId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(400).json({ ok: false, error: "User not found" });

    // ✅ IMPORTANT:
    // Frontend sends "amount" (not amountAED) for subscriptions/services flow
    let baseAmountAED = safeNum(body.amountAED || body.amount || 0);
    let printingFeeAED = safeNum(body.printingFee || 0);

    // لو مش مبعوت amount (خدمات فقط)، نجيب من servicesByClientType
    let serviceDoc = null;
    if (!baseAmountAED && requestType !== "wallet_recharge") {
      serviceDoc = await fetchServiceFromByClientType(serviceId, clientType, serviceName);
      if (serviceDoc) {
        baseAmountAED = safeNum(serviceDoc.clientPrice ?? serviceDoc.price ?? 0);
        printingFeeAED = safeNum(serviceDoc.printingFee ?? 0);
      }
    }

    // Wallet recharge must provide amount
    if (requestType === "wallet_recharge" && baseAmountAED <= 0) {
      return res.status(400).json({ ok: false, error: "Missing/invalid amount for wallet recharge" });
    }

    if (baseAmountAED <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid amount (0)" });
    }

    // ✅ Calculate processing fee on server
    const processingFeeAED = calcProcessingFeeAED(baseAmountAED + printingFeeAED);

    // Total charge
    const totalAED = Number((baseAmountAED + printingFeeAED + processingFeeAED).toFixed(2));
    const amountSmallest = Math.round(totalAED * 100);

    // Request id (doc id) => orderNumber
    const orderNumber = safeStr(body.requestId || generateOrderNumber());

    // Attachments metadata
    let attachments = body.attachments || null;
    let attachmentsJson = "";
    if (attachments) {
      try {
        attachmentsJson = JSON.stringify(attachments);
      } catch {
        attachmentsJson = "";
      }
    }

    // Create PaymentIntent
    const pi = await stripe.paymentIntents.create({
      amount: amountSmallest,
      currency: "aed",
      automatic_payment_methods: { enabled: true },
      metadata: {
        customerId,
        lang,

        requestId: orderNumber,
        requestType,
        clientType,
        serviceId,
        serviceName,

        assignedTo,
        assignedToName,

        baseAmountAED: String(baseAmountAED.toFixed(2)),
        printingFee: String(printingFeeAED.toFixed(2)),
        processingFee: String(processingFeeAED.toFixed(2)),
        totalAED: String(totalAED.toFixed(2)),

        coinsUsed: String(coinsUsed),
        coinsGiven: String(coinsGiven),

        // ✅ subscription fields (DAYS)
        planKey,
        planName,
        pricingKey,
        subscriptionDays: String(subscriptionDays),
        giftDays: String(giftDays),
        totalSubscriptionDays: String(totalSubDays),

        // optional old fields (leave them if you want)
        monthsShown: String(monthsShown),
        paidMonths: String(paidMonths),
        bonus: String(bonus),

        ...(attachmentsJson ? { attachments: attachmentsJson } : {}),
      },
    });

    // Create/merge request doc (normal schema)
    await db
      .collection("requests")
      .doc(orderNumber)
      .set(
        {
          requestId: orderNumber,
          paymentIntentId: pi.id,
          clientSecret: pi.client_secret || null,

          customerId,
          userEmail: safeStr(userSnap.data()?.email || ""),

          requestType,
          clientType,
          serviceId,
          serviceName,

          paidAmount: 0,
          status: "pending_payment",
          createdAt: nowISO(),
          lastUpdated: nowISO(),

          printingFee: printingFeeAED,
          processingFee: processingFeeAED,

          coinsUsed,
          coinsGiven,

          assignedTo,
          assignedToName,

          metadata: pi.metadata || {},
          ...(attachments ? { attachments } : {}),
        },
        { merge: true }
      );

    // ✅ RETURN KEYS THE FRONTEND EXPECTS
    return res.status(200).json({
      ok: true,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,

      // frontend expects this name:
      orderNumber,

      // frontend expects these:
      processingFee: processingFeeAED,
      finalPrice: totalAED,

      // optional details (safe)
      breakdown: {
        baseAmountAED,
        printingFeeAED,
        processingFeeAED,
      },

      // useful for UI
      subscription: requestType === "subscription"
        ? {
            planKey,
            planName,
            pricingKey,
            subscriptionDays,
            giftDays,
            totalSubscriptionDays: totalSubDays,
          }
        : null,
    });
  } catch (e) {
    console.error("createPaymentIntent error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
}
