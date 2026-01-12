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

// ----------------- helpers -----------------
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

// --------- month helpers (monthlyTxCredits) ----------
function monthKeyOf(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonthKeyOf(d = new Date()) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  return monthKeyOf(x);
}
function isInLast7DaysOfMonth(d = new Date()) {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  const diffDays = Math.floor((end.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 6; // آخر 7 أيام
}

// ✅ الشهر الفعلي للإضافة (طبقًا لقاعدة 7 أيام)
function effectiveMonthKeyForAddon(purchasedAtDate) {
  return isInLast7DaysOfMonth(purchasedAtDate)
    ? nextMonthKeyOf(purchasedAtDate)
    : monthKeyOf(purchasedAtDate);
}

/**
 * ✅ Normalize buckets for CURRENT month only
 * - NEW format: bucket.effectiveMonthKey
 * - Backward compatible with old format (purchasedMonthKey/expiresMonthKey):
 *   يعتبر bucket شغال لهذا الشهر لو expiresMonthKey == currentMonthKey (ترحيل) أو purchasedMonthKey == currentMonthKey
 */
function normalizeBucketsForMonth(buckets, currentMonthKey) {
  const arr = Array.isArray(buckets) ? buckets : [];

  const eligible = arr.filter((b) => {
    const qty = Number(b?.qtyRemaining || 0);
    if (!(qty > 0)) return false;

    // ✅ الجديد: effectiveMonthKey
    if (b && b.effectiveMonthKey) {
      return String(b.effectiveMonthKey) === String(currentMonthKey);
    }

    // ✅ توافق قديم: purchasedMonthKey/expiresMonthKey
    const purchasedKey = String(b?.purchasedMonthKey || "");
    const expiresKey = String(b?.expiresMonthKey || "");
    return purchasedKey === currentMonthKey || expiresKey === currentMonthKey;
  });

  const sum = eligible.reduce((acc, b) => acc + Number(b?.qtyRemaining || 0), 0);
  return { eligible, sum };
}

/**
 * ✅ Lazy reset monthlyTxCredits on month change
 * - resets baseRemaining to baseLimit
 * - usedThisMonth = 0
 * - addonsRemaining recalculated from buckets eligible for CURRENT month only
 * - DOES NOT delete buckets (addons not monthly, they stay until consumed)
 */
async function lazyResetMonthlyCreditsIfNeeded(tx, userRef) {
  const userSnap = await tx.get(userRef);
  if (!userSnap.exists) throw new Error("USER_NOT_FOUND");

  const u = userSnap.data() || {};
  const mtc = u.monthlyTxCredits || {};

  const now = new Date();
  const currentMonthKey = monthKeyOf(now);

  // if not initialized
  if (!mtc.monthKey) {
    const baseLimit = Number(mtc.baseLimit || 0);
    const allBuckets = Array.isArray(mtc.addonBuckets) ? mtc.addonBuckets : [];
    const { sum } = normalizeBucketsForMonth(allBuckets, currentMonthKey);

    tx.set(
      userRef,
      {
        monthlyTxCredits: {
          monthKey: currentMonthKey,
          baseLimit,
          baseRemaining: baseLimit,
          usedThisMonth: 0,
          addonBuckets: allBuckets,
          addonsRemaining: sum,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    return { didReset: true, monthKey: currentMonthKey };
  }

  // same month -> optional repair addonsRemaining
  if (String(mtc.monthKey || "") === currentMonthKey) {
    const allBuckets = Array.isArray(mtc.addonBuckets) ? mtc.addonBuckets : [];
    const { sum } = normalizeBucketsForMonth(allBuckets, currentMonthKey);

    if (Number(mtc.addonsRemaining || 0) !== sum) {
      tx.update(userRef, {
        "monthlyTxCredits.addonsRemaining": sum,
        "monthlyTxCredits.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { didReset: false, monthKey: currentMonthKey };
  }

  // new month
  const baseLimit = Number(mtc.baseLimit || 0);
  const allBuckets = Array.isArray(mtc.addonBuckets) ? mtc.addonBuckets : [];
  const { sum } = normalizeBucketsForMonth(allBuckets, currentMonthKey);

  tx.update(userRef, {
    "monthlyTxCredits.monthKey": currentMonthKey,
    "monthlyTxCredits.baseRemaining": baseLimit,
    "monthlyTxCredits.usedThisMonth": 0,
    "monthlyTxCredits.addonsRemaining": sum,
    "monthlyTxCredits.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
  });

  return { didReset: true, monthKey: currentMonthKey };
}

/**
 * ✅ Apply Add-on to monthlyTxCredits with carry-over last 7 days
 * - If purchased in last 7 days => effectiveMonthKey = NEXT month (NOT counted now)
 * - Else => effectiveMonthKey = current month
 */
async function applyAddonCreditTx(tx, userRef, { paymentIntentId, addonKey, addonQty, purchasedAt }) {
  await lazyResetMonthlyCreditsIfNeeded(tx, userRef);

  const userSnap = await tx.get(userRef);
  if (!userSnap.exists) throw new Error("USER_NOT_FOUND");

  const u = userSnap.data() || {};
  const mtc = u.monthlyTxCredits || {};
  const now = new Date();
  const currentMonthKey = String(mtc.monthKey || monthKeyOf(now));

  const qty = Number(addonQty || 0);
  if (!(qty > 0)) {
    return {
      added: 0,
      effectiveMonthKey: "",
      monthKey: currentMonthKey,
      addonsRemaining: Number(mtc.addonsRemaining || 0),
    };
  }

  const allBuckets = Array.isArray(mtc.addonBuckets) ? [...mtc.addonBuckets] : [];
  const effectiveMonthKey = effectiveMonthKeyForAddon(purchasedAt);

  allBuckets.push({
    id: String(paymentIntentId),
    addonKey: String(addonKey || ""),
    qtyRemaining: qty,
    purchasedAt: admin.firestore.Timestamp.fromDate(purchasedAt),
    effectiveMonthKey, // ✅ الأساس
  });

  const { sum } = normalizeBucketsForMonth(allBuckets, currentMonthKey);

  tx.update(userRef, {
    "monthlyTxCredits.addonBuckets": allBuckets,
    "monthlyTxCredits.addonsRemaining": sum,
    "monthlyTxCredits.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
  });

  return { added: qty, effectiveMonthKey, monthKey: currentMonthKey, addonsRemaining: sum };
}

/**
 * ✅ Apply subscription base limit for current month
 * - baseRemaining resets to baseLimit
 * - usedThisMonth resets to 0
 * - addonsRemaining recalculated for CURRENT month eligible buckets
 */
async function applySubscriptionBaseLimitTx(tx, userRef, baseLimit) {
  await lazyResetMonthlyCreditsIfNeeded(tx, userRef);

  const userSnap = await tx.get(userRef);
  if (!userSnap.exists) throw new Error("USER_NOT_FOUND");

  const u = userSnap.data() || {};
  const mtc = u.monthlyTxCredits || {};

  const now = new Date();
  const currentMonthKey = String(mtc.monthKey || monthKeyOf(now));

  const allBuckets = Array.isArray(mtc.addonBuckets) ? mtc.addonBuckets : [];
  const { sum } = normalizeBucketsForMonth(allBuckets, currentMonthKey);

  const lim = Number(baseLimit || 0);

  tx.update(userRef, {
    "monthlyTxCredits.monthKey": currentMonthKey,
    "monthlyTxCredits.baseLimit": lim,
    "monthlyTxCredits.baseRemaining": lim,
    "monthlyTxCredits.usedThisMonth": 0,
    "monthlyTxCredits.addonsRemaining": sum,
    "monthlyTxCredits.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    monthKey: currentMonthKey,
    baseLimit: lim,
    baseRemaining: lim,
    usedThisMonth: 0,
    addonsRemaining: sum,
    totalRemaining: lim + sum,
  };
}

/**
 * ✅ CONSUME 1 TX after each successful SERVICE (company only)
 * - priority: baseRemaining -> addonBuckets FIFO
 * - IMPORTANT: consume add-on ONLY if bucket is eligible for CURRENT month
 */
async function consumeOneCompanyTxCreditTx(tx, userRef, { requestId, paymentIntentId }) {
  await lazyResetMonthlyCreditsIfNeeded(tx, userRef);

  const snap = await tx.get(userRef);
  if (!snap.exists) throw new Error("USER_NOT_FOUND");

  const u = snap.data() || {};
  const mtc = u.monthlyTxCredits || {};
  const currentMonthKey = String(mtc.monthKey || monthKeyOf(new Date()));

  const baseRemaining = Number(mtc.baseRemaining || 0);
  if (baseRemaining > 0) {
    tx.update(userRef, {
      "monthlyTxCredits.baseRemaining": admin.firestore.FieldValue.increment(-1),
      "monthlyTxCredits.usedThisMonth": admin.firestore.FieldValue.increment(1),
      "monthlyTxCredits.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
      "monthlyTxCredits.lastConsume": {
        requestId: String(requestId || ""),
        paymentIntentId: String(paymentIntentId || ""),
        source: "base",
        atISO: new Date().toISOString(),
      },
    });
    return { source: "base" };
  }

  const buckets = Array.isArray(mtc.addonBuckets) ? [...mtc.addonBuckets] : [];
  let consumed = false;

  for (let i = 0; i < buckets.length; i++) {
    const qty = Number(buckets[i]?.qtyRemaining || 0);
    if (!(qty > 0)) continue;

    // ✅ NEW format
    if (buckets[i]?.effectiveMonthKey) {
      if (String(buckets[i].effectiveMonthKey) !== currentMonthKey) continue;
    } else {
      // ✅ OLD format fallback
      const purchasedKey = String(buckets[i]?.purchasedMonthKey || "");
      const expiresKey = String(buckets[i]?.expiresMonthKey || "");
      if (!(purchasedKey === currentMonthKey || expiresKey === currentMonthKey)) continue;
    }

    buckets[i] = { ...buckets[i], qtyRemaining: qty - 1 };
    consumed = true;
    break;
  }

  if (consumed) {
    const { sum } = normalizeBucketsForMonth(buckets, currentMonthKey);

    tx.update(userRef, {
      "monthlyTxCredits.addonBuckets": buckets,
      "monthlyTxCredits.addonsRemaining": sum,
      "monthlyTxCredits.usedThisMonth": admin.firestore.FieldValue.increment(1),
      "monthlyTxCredits.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
      "monthlyTxCredits.lastConsume": {
        requestId: String(requestId || ""),
        paymentIntentId: String(paymentIntentId || ""),
        source: "addon",
        atISO: new Date().toISOString(),
      },
    });

    return { source: "addon" };
  }

  return { source: "none" };
}

// ---------------- service reader ----------------
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

// ---------------- Expo push ----------------
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
      md.requestType || (md.serviceName && normLower(md.serviceName).includes("wallet") ? "wallet_recharge" : "service")
    );

    const clientTypeMeta = normLower(md.clientType || md.client_type || md.serviceClientType || "");

    const coinsGiven = safeNum(md.coinsGiven ?? md.cashbackCoins ?? md.coins ?? 0);
    const coinsUsed = safeNum(md.coinsUsed ?? 0);

    const printingFeeFromMeta = safeNum(md.printingFee ?? 0);
    const processingFeeMeta = safeNum(md.processingFee ?? md.processing_fee ?? md.processing_fee_value ?? 0);

    // ✅ MUST be present for UI breakdown
    const baseAmountFromMeta = safeNum(md.baseAmountAED ?? md.baseAmount ?? 0);
    const totalAEDFromMeta = safeNum(md.totalAED ?? 0);

    const serviceId = safeStr(md.serviceId || "");
    const serviceNameFromMeta = safeStr(md.serviceName || "");

    const assignedToMeta = safeStr(md.assignedTo || md.assigned_to || "");
    const assignedToNameMeta = safeStr(md.assignedToName || md.assigned_to_name || "");

    // -------- ADDON META --------
    const addonKey = safeStr(md.addonKey || md.addon_id || md.addonId || "").trim();
    const addonTypeMeta = normLower(md.addonType || md.addon_type || "");
    const addonQtyMeta = safeNum(md.addonQty || md.addon_qty || 0);
    const isAddon =
      requestTypeMeta === "addon" ||
      addonKey.length > 0 ||
      normLower(serviceId).startsWith("addon_") ||
      normLower(serviceNameFromMeta).includes("add-on");

    // subscription
    const planKey = safeStr(md.planKey || "").trim();
    const planName = safeStr(md.planName || md.subscriptionName || md.planTitle || "").trim() || planKey;
    const pricingKey = safeStr(md.pricingKey || "").trim();

    const totalSubscriptionDays = safeNum(md.totalSubscriptionDays || md.totalSubDays || 0);
    const subscriptionDays = safeNum(md.subscriptionDays || 0);
    const giftDays = safeNum(md.giftDays || 0);
    const daysToApply =
      totalSubscriptionDays > 0 ? totalSubscriptionDays : Math.max(0, subscriptionDays + giftDays) || 30;

    const paidMonths = safeNum(md.paidMonths || 0);
    const bonus = safeNum(md.bonus || 0);

    const isSubscription = requestTypeMeta === "subscription" || planKey.length > 0;

    const planMonthlyLimitMeta = safeNum(md.monthlyIncludedTxLimit || md.monthlyTxLimit || md.monthlyLimit || 0);

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
      const isCompany = clientTypeMeta === "company" || customerIdMeta.startsWith("COM-") || userIsCompany;

      const rDoc = requestRef ? await tx.get(requestRef) : null;

      const subRef = db.collection("companySubscriptions").doc(customerIdMeta);
      const subSnap = isCompany ? await tx.get(subRef) : null;
      // ✅ AUTO-EXPIRE subscription if endAt passed (global guard)
if (isCompany && subSnap && subSnap.exists) {
  const sub = subSnap.data() || {};
  const endAt = toDateSafe(sub.endAt) || (sub.endAtISO ? new Date(sub.endAtISO) : null);
  const isExpired = !!endAt && endAt.getTime() <= Date.now();

  if (isExpired && sub.isActive === true) {
    tx.set(
      subRef,
      {
        isActive: false,
        status: "expired",
        computed: {
          ...(sub.computed || {}),
          isExpired: true,
          nowISO: new Date().toISOString(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
}


      // ✅ Credits snapshot (what user currently has)
      const addonsRemainingNow = safeNum(udata?.monthlyTxCredits?.addonsRemaining || 0);
      const baseRemainingNow = safeNum(udata?.monthlyTxCredits?.baseRemaining || 0);
      const totalRemainingNow = baseRemainingNow + addonsRemainingNow;

      // ✅ Printing/VAT hide rule (ONLY with manual isActive + time valid + credits > 0)
      let subManualActive = false;
      let subTimeValid = false;
      if (isCompany && subSnap && subSnap.exists) {
        const sub = subSnap.data() || {};
        subManualActive = sub.isActive === true; // ✅ التحكم الوحيد
        const endAt = toDateSafe(sub.endAt) || (sub.endAtISO ? new Date(sub.endAtISO) : null);
        subTimeValid = !!endAt && endAt.getTime() > Date.now();
      }

      const shouldHidePrintingFee =
        isCompany &&
        requestTypeMeta === "service" &&
        !isAddon &&
        !isSubscription &&
        subManualActive &&
        subTimeValid &&
        totalRemainingNow > 0;

      // addon catalog doc (ONLY if addon)
      let addonCatalog = null;
      let resolvedAddonQty = addonQtyMeta;

      if (isAddon && addonKey) {
        const addonRef = db.collection("companyAddonsCatalog").doc(addonKey);
        const addonSnap = await tx.get(addonRef);
        if (addonSnap.exists) {
          addonCatalog = addonSnap.data() || {};
          if (!resolvedAddonQty || resolvedAddonQty <= 0) {
            const q = Number(addonCatalog.qty || 0);
            resolvedAddonQty = Number.isFinite(q) ? q : 0;
          }
        }
      }

      // plan doc (ONLY if subscription) -> resolve monthlyIncludedTxLimit
      let planMonthlyLimitResolved = planMonthlyLimitMeta;
      if (isSubscription && planKey && !(planMonthlyLimitResolved > 0)) {
        const planRef = db.collection("companySubscriptionPlans").doc(planKey);
        const planSnap = await tx.get(planRef);
        if (planSnap.exists) {
          const pdata = planSnap.data() || {};
          const lim = Number(pdata.monthlyIncludedTxLimit || 0);
          if (Number.isFinite(lim) && lim > 0) planMonthlyLimitResolved = lim;
        }
      }

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

          // ✅ always persist breakdown for UI
          baseAmountAED: baseAmountFromMeta || safeNum(rdata.baseAmountAED || 0),
          processingFee: typeof rdata.processingFee !== "undefined" ? rdata.processingFee : processingFeeMeta || 0,
          totalAED: totalAEDFromMeta || amountAED,

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

          if (!updates.baseAmountAED) updates.baseAmountAED = baseAmountFromMeta || safeNum(md.baseAmountAED || 0);
          if (!updates.totalAED) updates.totalAED = totalAEDFromMeta || amountAED;

          updates.service = svc;
          updates.serviceName = svc.name;
          updates.serviceId = svc.serviceId;
          updates.providers = svc.providers;

          // ✅ Printing/VAT hide logic enforced here
          updates.printingFee = shouldHidePrintingFee ? 0 : (rdata.printingFee ?? svc.printingFee ?? printingFeeFromMeta ?? 0);

          updates.requiredDocuments = svc.requiredDocuments;
        }

        if (isAddon) {
          updates.requestType = "addon";
          updates.addon = {
            addonKey,
            addonType: addonTypeMeta || normLower(addonCatalog?.type || ""),
            addonQty: resolvedAddonQty || 0,
            catalog: addonCatalog
              ? {
                  addonKey: safeStr(addonCatalog.addonKey || addonKey),
                  type: safeStr(addonCatalog.type || ""),
                  qty: safeNum(addonCatalog.qty || 0),
                  popular: !!addonCatalog.popular,
                }
              : null,
          };
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
          requestType: isAddon ? "addon" : requestTypeMeta,

          paidAmount: amountAED,

          // ✅ breakdown always stored
          baseAmountAED: baseAmountFromMeta || 0,
          printingFee: shouldHidePrintingFee ? 0 : (printingFeeFromMeta ?? 0),
          processingFee: processingFeeMeta ?? 0,
          totalAED: totalAEDFromMeta || amountAED,

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

          ...(isAddon
            ? {
                addon: {
                  addonKey,
                  addonType: addonTypeMeta || normLower(addonCatalog?.type || ""),
                  addonQty: resolvedAddonQty || 0,
                  catalog: addonCatalog
                    ? {
                        addonKey: safeStr(addonCatalog.addonKey || addonKey),
                        type: safeStr(addonCatalog.type || ""),
                        qty: safeNum(addonCatalog.qty || 0),
                        popular: !!addonCatalog.popular,
                      }
                    : null,
                },
              }
            : {}),
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

      // ✅ B2) ADDON → monthlyTxCredits + mirror into companySubscriptions (NO touching isActive/status)
      if (isAddon && isCompany) {
        const qtyToAdd = Number(resolvedAddonQty || 0);
        if (qtyToAdd > 0) {
          const purchasedAt = new Date();

          const r = await applyAddonCreditTx(tx, userRef, {
            paymentIntentId,
            addonKey: addonKey || (addonCatalog?.addonKey || ""),
            addonQty: qtyToAdd,
            purchasedAt,
          });

          const uAfter = await tx.get(userRef);
          const mtcAfter = (uAfter.data() || {}).monthlyTxCredits || {};

          const companyPublicId = safeStr(udata.companyId || udata.customerId || udata.userId || customerIdMeta);
          const companyEmail = safeStr(udata.email || md.userEmail || "");

          tx.set(
            subRef,
            {
              companyDocId: customerIdMeta,
              companyId: companyPublicId,
              email: companyEmail,

              txCredits: {
                monthKey: String(mtcAfter.monthKey || r.monthKey || ""),
                baseLimit: safeNum(mtcAfter.baseLimit || 0),
                baseRemaining: safeNum(mtcAfter.baseRemaining || 0),
                usedThisMonth: safeNum(mtcAfter.usedThisMonth || 0),
                addonsRemaining: safeNum(mtcAfter.addonsRemaining || r.addonsRemaining || 0),
                totalRemaining: safeNum(mtcAfter.baseRemaining || 0) + safeNum(mtcAfter.addonsRemaining || 0),
                updatedAtISO: nowISO(),
              },

              lastAddon: {
                addonKey: addonKey || "",
                addonQty: qtyToAdd,
                effectiveMonthKey: r.effectiveMonthKey || "",
                paymentIntentId,
                requestId: finalRequestId,
                amountAED,
                purchasedAtISO: purchasedAt.toISOString(),
              },

              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              ...(subSnap && subSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
            },
            { merge: true }
          );

          const histRef = userRef.collection("monthlyTxCreditsHistory").doc(paymentIntentId);
          tx.set(histRef, {
            type: "addon_topup",
            paymentIntentId,
            requestId: finalRequestId,
            addonKey: addonKey || "",
            addonQtyAdded: qtyToAdd,
            effectiveMonthKey: r.effectiveMonthKey || "",
            amountAED,
            purchasedAtISO: purchasedAt.toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // ✅ B3) SUBSCRIPTION → set baseLimit/baseRemaining monthly + reset usedThisMonth
      // ✅ IMPORTANT: isActive is NOT based on credits (manual control)
      if (isSubscription && isCompany) {
        const lim = Number(planMonthlyLimitResolved || 0);
        const snap = await applySubscriptionBaseLimitTx(tx, userRef, lim);

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

            monthlyIncludedTxLimit: lim,

            txCredits: {
              monthKey: snap.monthKey,
              baseLimit: snap.baseLimit,
              baseRemaining: snap.baseRemaining,
              usedThisMonth: snap.usedThisMonth,
              addonsRemaining: snap.addonsRemaining,
              totalRemaining: snap.totalRemaining,
              updatedAtISO: nowISO(),
            },

            // ✅ فتح الاشتراك بالشراء فقط
            isActive: true,
            status: "active",

            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(subSnap && subSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
          },
          { merge: true }
        );

        const histRef = userRef.collection("monthlyTxCreditsHistory").doc(`${paymentIntentId}_sub`);
        tx.set(histRef, {
          type: "subscription_reset",
          paymentIntentId,
          requestId: finalRequestId,
          planKey,
          pricingKey,
          baseLimit: lim,
          monthKey: snap.monthKey,
          amountAED,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // ✅ B4) SERVICE → consume 1 tx after successful payment (company only)
      const isServicePurchase =
        requestTypeMeta === "service" &&
        !isAddon &&
        !isSubscription &&
        requestTypeMeta !== "wallet_recharge";

      if (isCompany && isServicePurchase) {
        const consume = await consumeOneCompanyTxCreditTx(tx, userRef, {
          requestId: finalRequestId,
          paymentIntentId,
        });

        if (requestRef) {
          tx.update(requestRef, { creditSource: consume.source });
        }

        const uAfterConsume = await tx.get(userRef);
        const mtcAfterConsume = (uAfterConsume.data() || {}).monthlyTxCredits || {};
        const totalAfter = safeNum(mtcAfterConsume.baseRemaining || 0) + safeNum(mtcAfterConsume.addonsRemaining || 0);

        // ✅ update companySubscriptions credits ONLY (NO touching isActive/status)
        tx.set(
          subRef,
          {
            txCredits: {
              monthKey: String(mtcAfterConsume.monthKey || ""),
              baseLimit: safeNum(mtcAfterConsume.baseLimit || 0),
              baseRemaining: safeNum(mtcAfterConsume.baseRemaining || 0),
              usedThisMonth: safeNum(mtcAfterConsume.usedThisMonth || 0),
              addonsRemaining: safeNum(mtcAfterConsume.addonsRemaining || 0),
              totalRemaining: totalAfter,
              updatedAtISO: nowISO(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
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
        ...(isAddon ? { addonKey: addonKey || "", addonQty: Number(resolvedAddonQty || 0) } : {}),
        ...(isSubscription ? { planKey, pricingKey } : {}),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // D) notification doc
      const notifRef = db.collection("notifications").doc();

      const notifTitle = langIsEn
        ? isSubscription
          ? "Subscription Confirmed"
          : isAddon
          ? "Add-on Activated"
          : "Payment Confirmed"
        : isSubscription
        ? "تم تفعيل الاشتراك"
        : isAddon
        ? "تم تفعيل الإضافة"
        : "تم تأكيد الدفع";

      const notifBody = langIsEn
        ? isSubscription
          ? `Your subscription is now active. Plan: ${planKey || "N/A"} • Order: ${finalRequestId}`
          : isAddon
          ? `Your add-on is active. +${Number(resolvedAddonQty || 0)} tx • Order: ${finalRequestId}`
          : `Your payment of ${amountAED.toFixed(2)} AED was received. Order: ${finalRequestId}`
        : isSubscription
        ? `تم تفعيل اشتراكك بنجاح. الخطة: ${planKey || "—"} • رقم الطلب: ${finalRequestId}`
        : isAddon
        ? `تم تفعيل الإضافة بنجاح. تمت إضافة +${Number(resolvedAddonQty || 0)} معاملات لرصيدك • رقم الطلب: ${finalRequestId}`
        : `تم استلام دفعتك بقيمة ${amountAED.toFixed(2)} د.إ الآن. رقم الطلب: ${finalRequestId}`;

      tx.set(notifRef, {
        targetId: userRef.id,
        title: notifTitle,
        body: notifBody,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isRead: false,
        metadata: {
          orderId: finalRequestId,
          paymentIntentId,
          ...(isSubscription ? { type: "subscription", planKey, planName, pricingKey, subscriptionDays: daysToApply } : {}),
          ...(isAddon ? { type: "addon", addonKey: addonKey || "", addonQty: Number(resolvedAddonQty || 0) } : {}),
        },
      });


// ✅ RULES:
// - isActive = TRUE عند الشراء (فقط)
// - يقفل تلقائي لو endAt انتهى (guard فوق)
// - status يظل "active" طالما وقت الاشتراك لم ينته، وإلا "expired"
if (isSubscription && isCompany) {
  const now = new Date();
  let startDate = now;
  let baseEnd = now;

  if (subSnap && subSnap.exists) {
    const old = subSnap.data() || {};
    const oldEnd =
      toDateSafe(old.endAt) || toDateSafe(old.expiresAt) || toDateSafe(old.endAtISO);

    // ✅ لو لسه شغال، نمد من آخر endAt
    if (oldEnd && oldEnd.getTime() > now.getTime()) {
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

  const companyPublicId = safeStr(
    udata.companyId || udata.customerId || udata.userId || customerIdMeta
  );
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

      // ✅ status informative
      status: statusNow,

      // ✅ وقت الشراء فقط: لو انتهى الوقت فورًا (نادر) يبقى false
      // غير كده نخليها true (والـ guard يقفلها بعدين تلقائيًا)
      isActive: !isExpiredNow,

      computed: {
        isExpired: isExpiredNow,
        nowISO: now.toISOString(),
      },

      lastRequestId: finalRequestId,
      lastPaymentIntentId: paymentIntentId,

      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(subSnap && subSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );

  // history
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

    status: statusNow,
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
          isAddon,
          addonKey,
          addonQtyMeta,
          resolvedAddonQty,
          isCompany,
          userIsCompany,
          daysToApply,
          planMonthlyLimitResolved,
        },
      });

      // push vars
      finalRequestIdAfterTx = finalRequestId;
      notifyTitleAfterTx = notifTitle;
      notifyBodyAfterTx = notifBody;
      notifyDataAfterTx = {
        type: "payment_success",
        orderId: finalRequestId,
        paymentIntentId,
        ...(isAddon ? { requestType: "addon", addonKey: addonKey || "", addonQty: Number(resolvedAddonQty || 0) } : {}),
        ...(isSubscription
          ? { requestType: "subscription", planKey, pricingKey, monthlyIncludedTxLimit: Number(planMonthlyLimitResolved || 0) }
          : {}),
      };
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
