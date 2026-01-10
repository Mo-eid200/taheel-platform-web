"use strict";

import Stripe from "stripe";
import admin from "firebase-admin";

/**
 * Create Stripe PaymentIntent (server-side fee calc) + create/merge request doc.
 *
 * ✅ Requirements (your rules):
 * 1) processingFee ALWAYS visible for every payment type.
 * 2) base amount (service/subscription/addon/wallet) ALWAYS present.
 * 3) printingFee is the ONLY conditional line:
 *    - HIDE (set to 0) ONLY when:
 *        Company + (Active Subscription OR addonsRemaining > 0)
 *    - Otherwise SHOW normal printingFee (from service)
 *
 * ✅ Compatible with your Stripe webhook:
 * - requestType normalized: service | wallet_recharge | subscription | addon
 * - webhook will write: companySubscriptions + monthlyTxCredits
 * - addon purchases pass addonKey/addonQty (resolved from catalog)
 * - subscription passes monthlyIncludedTxLimit (resolved server-side if missing)
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
function normType(v) {
  const t = safeStr(v).trim().toLowerCase();
  if (t === "wallet" || t === "walletrecharge" || t === "wallet-recharge") return "wallet_recharge";
  if (t === "sub" || t === "subs") return "subscription";
  if (t === "add-on" || t === "addon" || t === "add_on") return "addon";
  if (t === "service" || !t) return "service";
  return t;
}
function normLower(v) {
  return safeStr(v).trim().toLowerCase();
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
 * ✅ Determine if printing fee should be waived:
 * - Company + (Active subscription OR addonsRemaining > 0)
 *
 * Notes:
 * - Subscription activeness checked from companySubscriptions doc:
 *    status/ isActive + endAt/endAtISO in the future
 * - Addon credits checked from user.monthlyTxCredits.addonsRemaining
 */
async function shouldWaivePrintingFeeForCompany(customerId) {
  try {
    const userRef = db.collection("users").doc(String(customerId));
    const userSnap = await userRef.get();
    if (!userSnap.exists) return false;

    const u = userSnap.data() || {};
    const accountType = normLower(u.accountType || u.type || "");
    if (accountType !== "company") return false;

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
        const endAt = toDateSafe(sub.endAt) || toDateSafe(sub.expiresAt) || (sub.endAtISO ? new Date(sub.endAtISO) : null);
        subValid = isActive && endAt && endAt.getTime() > Date.now();
      }
    } catch (e) {
      // ignore and fallback to addonsRemaining only
      console.warn("shouldWaivePrintingFeeForCompany subscription read error:", e?.message || e);
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
    const addonQtyFromBody = safeNum(body.addonQty || body.addonTransactions || body.qty || 0);

    if (!customerId) return res.status(400).json({ ok: false, error: "Missing customerId" });

    const userRef = db.collection("users").doc(customerId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(400).json({ ok: false, error: "User not found" });

    // --------------------------------
    // Amount calc
    // --------------------------------
    // base amount MUST exist for all types; for service, can be resolved from catalog
    let baseAmountAED = safeNum(body.amountAED || body.amount || 0);

    // printing fee will be resolved from service then optionally waived
    let printingFeeAED = safeNum(body.printingFee || 0);

    let serviceDoc = null;
    let addonDoc = null;

    // ✅ resolvedQty used in metadata for webhook
    let resolvedAddonQty = addonQtyFromBody;

    // ✅ resolved monthly limit used in metadata for webhook
    let resolvedMonthlyIncludedTxLimit = safeNum(body.monthlyIncludedTxLimit || 0);

    // ADDON: price + qty from catalog only
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

    // SERVICE: resolve from service catalog if baseAmount not provided
    if (requestType === "service") {
      if (!baseAmountAED) {
        serviceDoc = await fetchServiceFromByClientType(serviceId, clientType, serviceName);
        if (serviceDoc) {
          baseAmountAED = safeNum(serviceDoc.clientPrice ?? serviceDoc.price ?? 0);
          printingFeeAED = safeNum(serviceDoc.printingFee ?? 0);
        }
      } else {
        // base amount passed from client - still prefer catalog printingFee if service is known (optional)
        serviceDoc = await fetchServiceFromByClientType(serviceId, clientType, serviceName);
        if (serviceDoc) {
          printingFeeAED = safeNum(serviceDoc.printingFee ?? printingFeeAED ?? 0);
        }
      }

      // ✅ printingFee conditional rule (ONLY for service):
      // hide (set 0) when Company + (active subscription OR addonsRemaining>0)
      if (printingFeeAED > 0) {
        const waivePrinting = await shouldWaivePrintingFeeForCompany(customerId);
        if (waivePrinting) printingFeeAED = 0;
      }
    }

    // SUBSCRIPTION: must have amount, resolve monthly limit if not provided
    if (requestType === "subscription") {
      printingFeeAED = 0;

      if (!planKey) return res.status(400).json({ ok: false, error: "Missing planKey for subscription" });
      if (baseAmountAED <= 0) return res.status(400).json({ ok: false, error: "Missing/invalid amount for subscription" });

      if (!(resolvedMonthlyIncludedTxLimit > 0)) {
        resolvedMonthlyIncludedTxLimit = await fetchPlanMonthlyLimit(planKey);
      }
    }

    // WALLET
    if (requestType === "wallet_recharge") {
      printingFeeAED = 0;
      if (baseAmountAED <= 0) {
        return res.status(400).json({ ok: false, error: "Missing/invalid amount for wallet recharge" });
      }
    }

    // ✅ base amount must be > 0 for all payment types
    if (baseAmountAED <= 0) return res.status(400).json({ ok: false, error: "Invalid base amount (0)" });

    // ✅ processingFee ALWAYS calculated & present
    const processingFeeAED = calcProcessingFeeAED(baseAmountAED + printingFeeAED);

    // total includes base + (printing if any) + processing
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

    // ----------------- Create PaymentIntent -----------------
    const pi = await stripe.paymentIntents.create({
      amount: amountSmallest,
      currency: "aed",
      automatic_payment_methods: { enabled: true },
      metadata: {
        // ✅ webhook uses these
        customerId,
        lang,
        monthKey,

        requestId: orderNumber,
        requestType, // normalized
        clientType,
        serviceId,
        serviceName,

        assignedTo,
        assignedToName,

        // ✅ ALWAYS present for UI + webhook
        baseAmountAED: String(baseAmountAED.toFixed(2)),
        printingFee: String(printingFeeAED.toFixed(2)), // 0 only when waived or not applicable
        processingFee: String(processingFeeAED.toFixed(2)),
        totalAED: String(totalAED.toFixed(2)),

        coinsUsed: String(coinsUsed),
        coinsGiven: String(coinsGiven),

        // subscription (webhook reads planKey + monthlyIncludedTxLimit)
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

        // addon (webhook reads addonKey/addonQty)
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

    // ----------------- Create/merge request doc -----------------
    await db.collection("requests").doc(orderNumber).set(
      {
        requestId: orderNumber,
        paymentIntentId: pi.id,
        clientSecret: pi.client_secret || null,

        customerId,
        userEmail: safeStr(userSnap.data()?.email || ""),

        requestType, // normalized
        clientType,
        serviceId,
        serviceName,

        // ✅ persist breakdown for UI
        baseAmountAED,
        printingFee: printingFeeAED,
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
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      orderNumber,

      // ✅ always show
      processingFee: processingFeeAED,
      finalPrice: totalAED,

      // ✅ always present; UI decides to hide printing line if printingFeeAED === 0
      breakdown: { baseAmountAED, printingFeeAED, processingFeeAED, totalAED },

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
