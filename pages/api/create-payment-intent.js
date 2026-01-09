"use strict";

import Stripe from "stripe";
import admin from "firebase-admin";

/**
 * Create Stripe PaymentIntent (server-side fee calc) + create/merge request doc.
 *
 * ✅ Rules:
 * - Keep requests flow intact
 * - Subscription info stays in metadata ONLY; webhook writes companySubscriptions + monthlyTxCredits
 * - Add-on purchases: store addonKey/addonQty in metadata so webhook can top-up monthlyTxCredits (with carry-over last 7 days)
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
function getMonthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Read service definition from servicesByClientType
async function fetchServiceFromByClientType(serviceId, clientType, serviceNameFallback = "") {
  const clientTypesToTry = clientType ? [clientType] : ["company", "resident", "nonresident", "other"];

  for (const ct of clientTypesToTry) {
    try {
      const docRef = db.collection("servicesByClientType").doc(String(ct));
      const snap = await docRef.get();
      if (!snap.exists) continue;

      const all = snap.data() || {};

      if (serviceId && Object.prototype.hasOwnProperty.call(all, serviceId)) return all[serviceId];

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

// ✅ Read addon catalog doc (companyAddonsCatalog/<addonKey>)
async function fetchAddonFromCatalog(addonKey) {
  if (!addonKey) return null;
  try {
    const ref = db.collection("companyAddonsCatalog").doc(String(addonKey));
    const snap = await ref.get();
    if (!snap.exists) return null;
    const d = snap.data() || {};
    if (d.isActive === false) return null;
    return { id: snap.id, ...d };
  } catch (e) {
    console.warn("fetchAddonFromCatalog error:", e?.message || e);
    return null;
  }
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

    const customerId = safeStr(body.customerId || body.userId).trim();
    const lang = safeStr(body.lang || "ar").trim();

    const requestType = safeStr(body.requestType || "service").trim(); // service | wallet_recharge | subscription | addon
    const clientType = safeStr(body.clientType || body.client_type || "").trim();
    const serviceId = safeStr(body.serviceId || "").trim();
    const serviceName = safeStr(body.serviceName || "").trim();

    const assignedTo = safeStr(body.assignedTo || "").trim();
    const assignedToName = safeStr(body.assignedToName || "").trim();

    const coinsUsed = safeNum(body.coinsUsed || 0);
    const coinsGiven = safeNum(body.coinsGiven || 0);

    // subscription meta
    const planKey = safeStr(body.planKey || "").trim();
    const planName = safeStr(body.planName || body.subscriptionName || "").trim() || planKey;
    const pricingKey = safeStr(body.pricingKey || "").trim();

    const subscriptionDays = safeNum(body.subscriptionDays || body.subDays || 0);
    const giftDays = safeNum(body.giftDays || body.bonusDays || 0);
    const totalSubDays = Math.max(0, subscriptionDays + giftDays);

    const monthsShown = safeNum(body.monthsShown || 0);
    const paidMonths = safeNum(body.paidMonths || 0);
    const bonus = safeNum(body.bonus || 0);

    // ✅ optional: pass plan monthly limit in metadata (webhook can still fallback to plans collection)
    const monthlyIncludedTxLimit = safeNum(body.monthlyIncludedTxLimit || 0);

    // addon meta
    const addonKeyFromBody = safeStr(body.addonKey || body.addonId || "").trim();
    const addonQtyFromBody = safeNum(body.addonQty || body.addonTransactions || body.qty || 0);

    if (!customerId) return res.status(400).json({ ok: false, error: "Missing customerId" });

    const userRef = db.collection("users").doc(customerId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(400).json({ ok: false, error: "User not found" });

    // --------------------------------
    // Amount calc
    // --------------------------------
    let baseAmountAED = safeNum(body.amountAED || body.amount || 0);
    let printingFeeAED = safeNum(body.printingFee || 0);

    let serviceDoc = null;
    let addonDoc = null;
    let resolvedAddonQty = addonQtyFromBody;

    if (requestType === "addon") {
      if (!addonKeyFromBody) return res.status(400).json({ ok: false, error: "Missing addonKey" });

      addonDoc = await fetchAddonFromCatalog(addonKeyFromBody);
      if (!addonDoc) return res.status(400).json({ ok: false, error: "Addon not found or inactive" });

      baseAmountAED = safeNum(addonDoc.price || 0);
      printingFeeAED = 0;

      resolvedAddonQty = safeNum(addonDoc.qty || resolvedAddonQty || 0);

      if (baseAmountAED <= 0) return res.status(400).json({ ok: false, error: "Invalid addon price" });
      if (resolvedAddonQty <= 0) return res.status(400).json({ ok: false, error: "Invalid addon qty" });
    }

    if (!baseAmountAED && requestType === "service") {
      serviceDoc = await fetchServiceFromByClientType(serviceId, clientType, serviceName);
      if (serviceDoc) {
        baseAmountAED = safeNum(serviceDoc.clientPrice ?? serviceDoc.price ?? 0);
        printingFeeAED = safeNum(serviceDoc.printingFee ?? 0);
      }
    }

    if (requestType === "subscription") {
      printingFeeAED = 0;
      if (baseAmountAED <= 0) return res.status(400).json({ ok: false, error: "Missing/invalid amount for subscription" });
    }

    if (requestType === "wallet_recharge" && baseAmountAED <= 0) {
      return res.status(400).json({ ok: false, error: "Missing/invalid amount for wallet recharge" });
    }

    if (baseAmountAED <= 0) return res.status(400).json({ ok: false, error: "Invalid amount (0)" });

    const processingFeeAED = calcProcessingFeeAED(baseAmountAED + printingFeeAED);
    const totalAED = Number((baseAmountAED + printingFeeAED + processingFeeAED).toFixed(2));
    const amountSmallest = Math.round(totalAED * 100);

    const orderNumber = safeStr(body.requestId || body.orderNumber || generateOrderNumber()).trim();

    const attachments = body.attachments || null;
    let attachmentsJson = "";
    if (attachments) {
      try {
        attachmentsJson = JSON.stringify(attachments);
      } catch {
        attachmentsJson = "";
      }
    }

    const monthKey = getMonthKey(new Date());

    const pi = await stripe.paymentIntents.create({
      amount: amountSmallest,
      currency: "aed",
      automatic_payment_methods: { enabled: true },
      metadata: {
        customerId,
        lang,
        monthKey,

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

        // subscription
        planKey,
        planName,
        pricingKey,
        subscriptionDays: String(subscriptionDays),
        giftDays: String(giftDays),
        totalSubscriptionDays: String(totalSubDays),
        monthsShown: String(monthsShown),
        paidMonths: String(paidMonths),
        bonus: String(bonus),
        monthlyIncludedTxLimit: String(monthlyIncludedTxLimit || 0),

        // addon
        ...(requestType === "addon"
          ? {
              isAddon: "1",
              addonKey: addonKeyFromBody,
              addonQty: String(resolvedAddonQty),
              addonType: safeStr(addonDoc?.type || ""),
              addonTitleAr: safeStr(addonDoc?.title?.ar || ""),
              addonTitleEn: safeStr(addonDoc?.title?.en || ""),
            }
          : {}),

        ...(attachmentsJson ? { attachments: attachmentsJson } : {}),
      },
    });

    await db.collection("requests").doc(orderNumber).set(
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

        ...(requestType === "addon"
          ? {
              addon: {
                addonKey: addonKeyFromBody,
                qty: resolvedAddonQty,
                type: safeStr(addonDoc?.type || ""),
                title: addonDoc?.title || null,
              },
            }
          : {}),

        metadata: pi.metadata || {},
        ...(attachments ? { attachments } : {}),
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      orderNumber,
      processingFee: processingFeeAED,
      finalPrice: totalAED,
      breakdown: { baseAmountAED, printingFeeAED, processingFeeAED },
      addon: requestType === "addon" ? { addonKey: addonKeyFromBody, qty: resolvedAddonQty, title: addonDoc?.title || null } : null,
      subscription:
        requestType === "subscription"
          ? { planKey, planName, pricingKey, subscriptionDays, giftDays, totalSubscriptionDays: totalSubDays, monthlyIncludedTxLimit }
          : null,
    });
  } catch (e) {
    console.error("createPaymentIntent error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
}
