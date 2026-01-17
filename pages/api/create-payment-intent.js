"use strict";

import Stripe from "stripe";
import admin from "firebase-admin";

/**
 * Create Stripe PaymentIntent + create/merge request doc.
 *
 * ✅ Rules:
 * - processingFee ALWAYS present
 * - base amount ALWAYS present (AED)
 * - printingFee ONLY conditional for SERVICE:
 *    Company + (Active Subscription OR addonsRemaining > 0) => printingFee=0
 * - ADDON: price & qty from catalog only
 * - SUBSCRIPTION: monthlyIncludedTxLimit resolved server-side if missing
 *
 * ✅ VAT:
 * - Apply VAT 5% ONLY for: subscription + addon (packages)
 * - VAT is calculated on: (baseAmount + processingFee)  ✅ as requested
 * - 2-pass to stabilize fee since fee depends on total
 *
 * ✅ Webhook remains single-writer for:
 * - stripePaymentsProcessed
 * - companySubscriptions
 * - users.monthlyTxCredits
 * - carry-over
 */

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
    } catch {}
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
function normLower(v) {
  return safeStr(v).trim().toLowerCase();
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
function normType(v) {
  const t = normLower(v);
  if (t === "wallet" || t === "walletrecharge" || t === "wallet-recharge") return "wallet_recharge";
  if (t === "sub" || t === "subs") return "subscription";
  if (t === "add-on" || t === "addon" || t === "add_on") return "addon";
  if (t === "service" || !t) return "service";
  return t;
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

/**
 * Amount normalization:
 * Prefer body.amountAED.
 * If body.amount is provided:
 * - if body.amountInSmallestUnit === true => amount is fils => convert to AED
 * - else => treat as AED
 */
function resolveAmountAED(body) {
  const amountAED = safeNum(body.amountAED);
  if (amountAED > 0) return Number(amountAED.toFixed(2));

  const raw = safeNum(body.amount);
  if (!(raw > 0)) return 0;

  const inSmallest = !!body.amountInSmallestUnit;
  const aed = inSmallest ? raw / 100 : raw;
  return Number(aed.toFixed(2));
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

// ✅ Read plan monthly limit (companySubscriptionPlans/<planKey>)
async function fetchPlanMonthlyLimit(planKey) {
  if (!planKey) return 0;
  try {
    const ref = db.collection("companySubscriptionPlans").doc(String(planKey));
    const snap = await ref.get();
    if (!snap.exists) return 0;

    const d = snap.data() || {};
    const lim = Number(d.monthlyIncludedTxLimit || 0);
    return Number.isFinite(lim) ? lim : 0;
  } catch (e) {
    console.warn("fetchPlanMonthlyLimit error:", e?.message || e);
    return 0;
  }
}

/**
 * ✅ Determine if printing fee should be waived for SERVICE:
 * Company + (Active Subscription OR addonsRemaining > 0)
 */
async function shouldWaivePrintingFeeForCompany({ customerId, clientType }) {
  try {
    const userRef = db.collection("users").doc(String(customerId));
    const userSnap = await userRef.get();
    if (!userSnap.exists) return false;

    const u = userSnap.data() || {};
    const accountType = normLower(u.accountType || u.type || "");

    const isCompany =
      accountType === "company" ||
      normLower(clientType) === "company" ||
      normLower(customerId).startsWith("com-");

    if (!isCompany) return false;

    const mtc = u.monthlyTxCredits || {};
    const addonsRemaining = Number(mtc.addonsRemaining || 0);

    let subValid = false;
    try {
      const subRef = db.collection("companySubscriptions").doc(String(customerId));
      const subSnap = await subRef.get();

      if (subSnap.exists) {
        const sub = subSnap.data() || {};
        const status = normLower(sub.status || "");
        const isActive = !!sub.isActive || status === "active" || status === "trial";

        const endAt =
          toDateSafe(sub.endAt) ||
          toDateSafe(sub.expiresAt) ||
          (sub.endAtISO ? new Date(sub.endAtISO) : null);

        subValid = isActive && endAt && endAt.getTime() > Date.now();
      }
    } catch (e) {
      console.warn("subscription read error:", e?.message || e);
    }

    return subValid || addonsRemaining > 0;
  } catch (e) {
    console.warn("shouldWaivePrintingFeeForCompany error:", e?.message || e);
    return false;
  }
}

/**
 * ✅ Processing fee calc (editable via env)
 * - STRIPE_FEE_FIXED_AED = "1.00"
 * - STRIPE_FEE_PERCENT  = "0.029"
 */
function calcStripeFees(amount, options = {}) {
  const percentFee = 0.029; // 2.9%
  const fixedFee = 1; // 1 AED
  const intlFee = options.isInternational ? amount * 0.01 : 0;
  const currencyFee = options.isCurrencyConversion ? amount * 0.01 : 0;

  const stripeFee = amount * percentFee + fixedFee + intlFee + currencyFee;
  return { stripeFee: Number(stripeFee.toFixed(2)) };
}

// ✅ VAT 5%
function calcVatAED(amountAED) {
  const vat = safeNum(amountAED) * 0.05;
  return Number(vat.toFixed(2));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = req.body || {};

    const customerId = safeStr(body.customerId || body.userId).trim();
    const lang = safeStr(body.lang || "ar").trim();

    const requestType = normType(body.requestType || "service");
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

    // addon meta
    const addonKeyFromBody = safeStr(body.addonKey || body.addonId || "").trim();

    if (!customerId) return res.status(400).json({ ok: false, error: "Missing customerId" });

    const userRef = db.collection("users").doc(String(customerId));
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(400).json({ ok: false, error: "User not found" });
    const userData = userSnap.data() || {};

    // --------------------------------
    // Amount + Fee calc (server truth)
    // --------------------------------
    let baseAmountAED = resolveAmountAED(body); // AED
    let printingFeeAED = safeNum(body.printingFee || 0); // may be overridden
    let serviceDoc = null;
    let addonDoc = null;

    let resolvedAddonQty = 0;
    let resolvedMonthlyIncludedTxLimit = safeNum(body.monthlyIncludedTxLimit || 0);

    // ADDON: price + qty from catalog ONLY
    if (requestType === "addon") {
      if (!addonKeyFromBody) return res.status(400).json({ ok: false, error: "Missing addonKey" });

      addonDoc = await fetchAddonFromCatalog(addonKeyFromBody);
      if (!addonDoc) return res.status(400).json({ ok: false, error: "Addon not found or inactive" });

      baseAmountAED = safeNum(addonDoc.price || 0);
      printingFeeAED = 0;

      resolvedAddonQty = safeNum(addonDoc.qty || 0);
      if (!(baseAmountAED > 0)) return res.status(400).json({ ok: false, error: "Invalid addon price" });
      if (!(resolvedAddonQty > 0)) return res.status(400).json({ ok: false, error: "Invalid addon qty" });
    }

    // SERVICE: resolve from catalog if missing
    if (requestType === "service") {
      serviceDoc = await fetchServiceFromByClientType(serviceId, clientType, serviceName);

      if (!(baseAmountAED > 0) && serviceDoc) {
        baseAmountAED = safeNum(serviceDoc.clientPrice ?? serviceDoc.price ?? 0);
      }

      // printingFee always from catalog if exists
      if (serviceDoc) {
        printingFeeAED = safeNum(serviceDoc.printingFee ?? 0);
      } else {
        // if unknown service, accept passed printingFee but still safe
        printingFeeAED = safeNum(printingFeeAED || 0);
      }

      // conditional waive
      if (printingFeeAED > 0) {
        const waive = await shouldWaivePrintingFeeForCompany({ customerId, clientType });
        if (waive) printingFeeAED = 0;
      }
    }

    // SUBSCRIPTION
    if (requestType === "subscription") {
      printingFeeAED = 0;

      if (!planKey) return res.status(400).json({ ok: false, error: "Missing planKey for subscription" });
      if (!(baseAmountAED > 0))
        return res.status(400).json({ ok: false, error: "Missing/invalid amountAED for subscription" });

      if (!(resolvedMonthlyIncludedTxLimit > 0)) {
        resolvedMonthlyIncludedTxLimit = await fetchPlanMonthlyLimit(planKey);
      }
    }

    // WALLET
    if (requestType === "wallet_recharge") {
      printingFeeAED = 0;
      if (!(baseAmountAED > 0)) {
        return res.status(400).json({ ok: false, error: "Missing/invalid amountAED for wallet recharge" });
      }
    }

    if (!(baseAmountAED > 0)) return res.status(400).json({ ok: false, error: "Invalid base amount (0)" });

    // --------------------------------
    // ✅ Fee + VAT logic (as per header rules)
    // --------------------------------
    const applyVat = requestType === "subscription" || requestType === "addon";

    const feeOpts = {
      isInternational: !!body.isInternational,
      isCurrencyConversion: !!body.isCurrencyConversion,
    };

    let processingFeeAED = 0;
    let vatAED = 0;
    let totalPriceAED = 0;
    let totalAED = 0;

    if (!applyVat) {
      // SERVICE/WALLET => no VAT
      totalPriceAED = Number((baseAmountAED + printingFeeAED).toFixed(2));
      processingFeeAED = calcStripeFees(totalPriceAED, feeOpts).stripeFee;
      vatAED = 0;
      totalAED = Number((totalPriceAED + processingFeeAED).toFixed(2));
    } else {
      // VAT is on (baseAmount + processingFee) ✅ requested
      // Pass 1
      const fee1 = calcStripeFees(baseAmountAED, feeOpts).stripeFee; // fee depends on amount
      const vat1 = calcVatAED(baseAmountAED + fee1);

      // Pass 2 (stabilize)
      const fee2 = calcStripeFees(baseAmountAED + vat1, feeOpts).stripeFee;
      const vat2 = calcVatAED(baseAmountAED + fee2);

      processingFeeAED = fee2;
      vatAED = vat2;

      // final totals
      totalPriceAED = Number((baseAmountAED + vatAED).toFixed(2));
      totalAED = Number((totalPriceAED + processingFeeAED).toFixed(2));
    }

    // ---- order/meta/helpers ----
    const amountSmallest = Math.round(totalAED * 100);
    const orderNumber = safeStr(body.requestId || body.orderNumber || generateOrderNumber()).trim();
    const monthKey = getMonthKey(new Date());

    // attachments safe
    const attachments = body.attachments || null;
    let attachmentsJson = "";
    if (attachments) {
      try {
        attachmentsJson = JSON.stringify(attachments);
      } catch {
        attachmentsJson = "";
      }
    }

    // ----------------- Create PaymentIntent -----------------
const pi = await stripe.paymentIntents.create(
  {
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

      // breakdown
      baseAmountAED: String(baseAmountAED.toFixed(2)),
      printingFee: String(printingFeeAED.toFixed(2)),
      vatAED: String(vatAED.toFixed(2)),
      totalPriceAED: String(totalPriceAED.toFixed(2)),
      processingFee: String(processingFeeAED.toFixed(2)),
      totalAED: String(totalAED.toFixed(2)),

      coinsUsed: String(coinsUsed),
      coinsGiven: String(coinsGiven),

      // subscription meta
      planKey,
      planName,
      pricingKey,
      subscriptionDays: String(subscriptionDays),
      giftDays: String(giftDays),
      totalSubscriptionDays: String(totalSubDays),
      monthsShown: String(monthsShown),
      paidMonths: String(paidMonths),
      bonus: String(bonus),
      monthlyIncludedTxLimit: String(resolvedMonthlyIncludedTxLimit || 0),

      // addon meta
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
  },
  {
    // ✅ هنا المكان الصح
    idempotencyKey: orderNumber,
  }
);


    // ----------------- Create/merge request doc -----------------
    const requestDoc = {
      requestId: orderNumber,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret || null,

      customerId,
      userEmail: safeStr(userData?.email || ""),

      requestType,
      clientType,
      serviceId,
      serviceName,

      baseAmountAED,
      printingFee: printingFeeAED,
      vat: vatAED,
      totalPriceAED,
      processingFee: processingFeeAED,
      totalAED,

      paidAmount: 0,
      status: "pending_payment",
      createdAt: nowISO(),
      lastUpdated: nowISO(),

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

      ...(requestType === "subscription"
        ? {
            subscriptionMeta: {
              planKey,
              planName,
              pricingKey,
              monthlyIncludedTxLimit: resolvedMonthlyIncludedTxLimit || 0,
              totalSubscriptionDays: totalSubDays,
            },
          }
        : {}),

      metadata: pi.metadata || {},
      ...(attachments ? { attachments } : {}),
    };

    await db.collection("requests").doc(orderNumber).set(requestDoc, { merge: true });

    return res.status(200).json({
      ok: true,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      orderNumber,

      processingFee: processingFeeAED,
      vat: vatAED,
      totalPrice: totalPriceAED,
      finalPrice: totalAED,

      breakdown: {
        baseAmountAED,
        printingFeeAED,
        vatAED,
        totalPriceAED,
        processingFeeAED,
        totalAED,
      },

      addon:
        requestType === "addon"
          ? { addonKey: addonKeyFromBody, qty: resolvedAddonQty, title: addonDoc?.title || null }
          : null,

      subscription:
        requestType === "subscription"
          ? {
              planKey,
              planName,
              pricingKey,
              subscriptionDays,
              giftDays,
              totalSubscriptionDays: totalSubDays,
              monthlyIncludedTxLimit: resolvedMonthlyIncludedTxLimit || 0,
            }
          : null,
    });
  } catch (e) {
    console.error("createPaymentIntent error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
}
