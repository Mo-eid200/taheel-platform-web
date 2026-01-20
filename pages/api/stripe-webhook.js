// pages/api/stripe-webhook.js
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
  return diffDays <= 6; // 0..6 => آخر 7 أيام
}

// ✅ Add-on purchase rule (month-based):
function computeAddonUsableMonthKey(purchasedAtDate) {
  return isInLast7DaysOfMonth(purchasedAtDate)
    ? nextMonthKeyOf(purchasedAtDate)
    : monthKeyOf(purchasedAtDate);
}

/**
 * ✅ فلترة الـ buckets:
 * - qtyRemaining > 0
 * - صالح فقط للشهر = usableMonthKey
 *   (لو اتشترى آخر 7 أيام => usableMonthKey = الشهر القادم)
 *
 * توافق:
 * - لو bucket قديم مفيهوش usableMonthKey => fallback لـ expiresMonthKey ثم purchasedMonthKey
 */
function normalizeBucketsForMonth(allBuckets, currentMonthKey) {
  const arr = Array.isArray(allBuckets) ? allBuckets : [];
  const keep = arr.filter((b) => {
    const qty = Number(b?.qtyRemaining || 0);
    if (!(qty > 0)) return false;

    const usableKey = String(b?.usableMonthKey || b?.expiresMonthKey || b?.purchasedMonthKey || "");
    return usableKey === currentMonthKey;
  });

  const sum = keep.reduce((acc, b) => acc + Number(b?.qtyRemaining || 0), 0);
  return { keep, sum };
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
      md.requestType ||
        (md.serviceName && normLower(md.serviceName).includes("wallet") ? "wallet_recharge" : "service")
    );

    const clientTypeMeta = normLower(md.clientType || md.client_type || md.serviceClientType || "");

    const coinsGiven = safeNum(md.coinsGiven ?? md.cashbackCoins ?? md.coins ?? 0);
    const coinsUsed = safeNum(md.coinsUsed ?? 0);
    const coinsRequestedAED = safeNum(md.coinsRequestedAED ?? 0);
    const coinsAppliedAED = safeNum(md.coinsAppliedAED ?? 0);

    const printingFeeFromMeta = safeNum(md.printingFee ?? 0);
    const processingFeeMeta = safeNum(md.processingFee ?? md.processing_fee ?? md.processing_fee_value ?? 0);

    // ✅ لازم موجودين للـ UI breakdown
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

    // -------- SUBSCRIPTION META --------
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

    // amount (Stripe بالـ cents)
    const amountSmallest = pi.amount_received ?? pi.amount ?? 0;
    const amountAED = Number((amountSmallest / 100).toFixed(2));

    // idempotency doc
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

    // locate user (mandatory)
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
    // Transaction (SAFE: all reads first)
    // =============================
    await db.runTransaction(async (tx) => {
      // --------- READS (must be before any writes) ---------
      const procCheck = await tx.get(processedRef);
      if (procCheck.exists) throw new Error("ALREADY_PROCESSED");

      const uDoc = await tx.get(userRef);
      if (!uDoc.exists) throw new Error("USER_NOT_FOUND");
      const udata = uDoc.data() || {};
   
// ✅ Coins deduction (READ-ONLY هنا — NO WRITES YET)
// Stored coins are points: 100 points = 1 AED
const coinsBalancePoints = safeNum(
  udata.coins ?? udata.cashbackCoins ?? udata.coinsBalance ?? 0
);

// Use AED values computed in create-payment-intent
const coinsAppliedAEDMeta = safeNum(coinsAppliedAED);
const coinsRequestedAEDMeta = safeNum(coinsRequestedAED);

// ⛔ لا تعمل tx.update هنا
let coinsToDeductPoints = 0;

const shouldDeductCoins =
  requestTypeMeta === "service" && !isAddon && !isSubscription && coinsAppliedAEDMeta > 0;

if (shouldDeductCoins) {
  const wantPoints = Math.round(coinsAppliedAEDMeta * 100);
  coinsToDeductPoints = Math.max(0, Math.min(coinsBalancePoints, wantPoints));
}


      // تحديد الشركة مضبوط (حسب اتفاقنا)
      const userIsCompany = normLower(udata.accountType || udata.type || udata.clientType || "") === "company";
      const metaSaysCompany = clientTypeMeta === "company" || normLower(md.accountType || "") === "company";
      const idLooksCompany = String(customerIdMeta || "").startsWith("COM-");
      const isCompany = userIsCompany || metaSaysCompany || idLooksCompany;

      // request doc read (if exists)
      const rDoc = requestRef ? await tx.get(requestRef) : null;

      // companySubscriptions (only for companies)
      const subRef = db.collection("companySubscriptions").doc(customerIdMeta);
      const subSnap = isCompany ? await tx.get(subRef) : null;

      // addon catalog (only if addon)
      let addonCatalog = null;
      let resolvedAddonQty = addonQtyMeta;

      if (isAddon && isCompany && addonKey) {
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

      // plan monthly limit resolve (only if subscription)
      let planMonthlyLimitResolved = planMonthlyLimitMeta;
      if (isSubscription && isCompany && planKey && !(planMonthlyLimitResolved > 0)) {
        const planRef = db.collection("companySubscriptionPlans").doc(planKey);
        const planSnap = await tx.get(planRef);
        if (planSnap.exists) {
          const pdata = planSnap.data() || {};
          const lim = Number(pdata.monthlyIncludedTxLimit || 0);
          if (Number.isFinite(lim) && lim > 0) planMonthlyLimitResolved = lim;
        }
      }

      // --------- COMPUTE monthlyTxCredits normalized (NO WRITES YET) ---------
      const now = new Date();
      const currentMonthKey = monthKeyOf(now);

      const mtc0 = udata.monthlyTxCredits || {};
      const monthKey0 = String(mtc0.monthKey || "");

      // ✅ لا تستخدم || مع أرقام (0 قيمة صحيحة)
      const baseLimit0 =
        typeof mtc0.baseLimit === "number" ? mtc0.baseLimit : Number(mtc0.baseLimit || 0);

      const baseRemaining0 =
        typeof mtc0.baseRemaining === "number"
          ? mtc0.baseRemaining
          : baseLimit0;

      const used0 =
        typeof mtc0.usedThisMonth === "number" ? mtc0.usedThisMonth : Number(mtc0.usedThisMonth || 0);

      const buckets0 = Array.isArray(mtc0.addonBuckets) ? mtc0.addonBuckets : [];

      // لو أول مرة أو شهر اتغير => reset lazy
      let monthKey = monthKey0 || currentMonthKey;
      let baseLimit = baseLimit0;
      let baseRemaining = baseRemaining0;
      let usedThisMonth = used0;

      // ✅ احتفظ بكل البكتس (الأصل) للخصم
      let addonBucketsAll = [...buckets0];

      // reset الشهر لو اتغير
      if (!monthKey0) {
        monthKey = currentMonthKey;
        baseRemaining = baseLimit;
        usedThisMonth = 0;
      } else if (monthKey0 !== currentMonthKey) {
        monthKey = currentMonthKey;
        baseRemaining = baseLimit;
        usedThisMonth = 0;
      }

      // ✅ للعرض فقط: فلترة البكتس للشهر الحالي
      const norm0 = normalizeBucketsForMonth(addonBucketsAll, monthKey);
      let addonBuckets = norm0.keep; // للعرض / التخزين كـ view
      let addonsRemaining = Number(norm0.sum || 0);

      // =============================
      // ✅ Subscription State Split:
      // timeActive = صلاحية الوقت (Timer/UI)
      // isActive   = صلاحية الرصيد (credits only)
      // benefitsState = وقت + رصيد
      // =============================
      // ✅ التعديل 1: timeActiveNow مصدره users.subscriptionActive فقط (حسب الاتفاق)
      let timeActiveNow = Boolean(udata.subscriptionActive); // time only
      let benefitsActiveNow = false; // time + credits (for printing hide logic)

      // الرصيد الحالي (Base + Addons) بعد normalize/reset الشهري
      const hasCreditsNow = (Number(baseRemaining || 0) + Number(addonsRemaining || 0)) > 0;

      // ✅ benefits (الإعفاء) = وقت صالح + رصيد
      benefitsActiveNow = timeActiveNow && hasCreditsNow;

      // ✅ منطق إخفاء رسوم الطباعة للشركات:
      // - خدمات فقط (مش addon ولا subscription)
      // - الإعفاء شغال => hide printingFee
      const shouldHidePrintingFee =
        isCompany &&
        requestTypeMeta === "service" &&
        !isAddon &&
        !isSubscription &&
        (benefitsActiveNow === true);

      // --------- PREPARE request update/create (NO WRITES YET) ---------
      let finalRequestId = reqId || null;

      // ✅ APPLY coins deduction HERE (after all reads, before writes section)
if (coinsToDeductPoints > 0) {
  tx.update(userRef, {
    coins: admin.firestore.FieldValue.increment(-coinsToDeductPoints),
  });
}


      // --------- WRITES start هنا ---------
      const monthlyTxCreditsPatch = {
        monthKey,
        baseLimit: Number(baseLimit || 0),
        baseRemaining: Number(baseRemaining || 0),
        usedThisMonth: Number(usedThisMonth || 0),
        addonBuckets,
        addonsRemaining: Number(addonsRemaining || 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // (B) request update/create
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
          coinsRequestedAED: coinsRequestedAEDMeta,
          coinsAppliedAED: coinsAppliedAEDMeta,

          baseAmountAED: baseAmountFromMeta || safeNum(rdata.baseAmountAED || 0),
          processingFee:
            typeof rdata.processingFee !== "undefined" ? rdata.processingFee : processingFeeMeta || 0,
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

          updates.service = svc;
          updates.serviceName = svc.name;
          updates.serviceId = svc.serviceId;
          updates.providers = svc.providers;

          // ✅ printingFee = 0 لو benefitsActiveNow شغال
          updates.printingFee = shouldHidePrintingFee
            ? 0
            : (typeof rdata.printingFee !== "undefined"
                ? rdata.printingFee
                : (svc.printingFee ?? printingFeeFromMeta ?? 0));

          updates.requiredDocuments = svc.requiredDocuments;
        } else {
          updates.printingFee = shouldHidePrintingFee
            ? 0
            : (typeof rdata.printingFee !== "undefined" ? rdata.printingFee : printingFeeFromMeta || 0);
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

          baseAmountAED: baseAmountFromMeta || 0,
          printingFee: shouldHidePrintingFee ? 0 : (printingFeeFromMeta ?? 0),
          processingFee: processingFeeMeta ?? 0,
          totalAED: totalAEDFromMeta || amountAED,

          coinsGiven,
          coinsUsed,
          coinsRequestedAED: safeNum(coinsRequestedAED),
          coinsAppliedAED: safeNum(coinsAppliedAED),

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

      // =============================
      // (X) DECREMENT monthly tx credits AFTER successful SERVICE payment
      // =============================
      const shouldDecrementCredits =
        isCompany &&
        requestTypeMeta === "service" &&
        !isAddon &&
        !isSubscription;

      if (shouldDecrementCredits) {
        if (Number(baseRemaining) > 0) {
          // خصم من الشهرية
          baseRemaining = Math.max(0, Number(baseRemaining) - 1);
          usedThisMonth = Number(usedThisMonth || 0) + 1;
        } else {
          // ✅ خصم من الـ Add-ons (من الأصل addonBucketsAll) بشرط usableMonthKey == monthKey
          addonBucketsAll = Array.isArray(addonBucketsAll) ? [...addonBucketsAll] : [];

          let decremented = false;

          for (let i = 0; i < addonBucketsAll.length; i++) {
            const b = addonBucketsAll[i] || {};
            const usableKey = String(b.usableMonthKey || b.expiresMonthKey || b.purchasedMonthKey || "");
            if (usableKey !== monthKey) continue;

            const qty = Number(b.qtyRemaining || 0);
            if (qty > 0) {
              addonBucketsAll[i] = { ...b, qtyRemaining: Math.max(0, qty - 1) };
              usedThisMonth = Number(usedThisMonth || 0) + 1;
              decremented = true;
              break;
            }
          }

          if (!decremented) {
            // no bucket usable for this month
          }
        }

        // ✅ بعد الخصم: اعمل normalize للعرض/الإجمالي
        const normAfter = normalizeBucketsForMonth(addonBucketsAll, monthKey);
        addonBuckets = normAfter.keep;
        addonsRemaining = Number(normAfter.sum || 0);

        const totalRemainingAfterSpend = Number(baseRemaining || 0) + Number(addonsRemaining || 0);

        // update user monthlyTxCredits after spend
        tx.set(
          userRef,
          {
            monthlyTxCredits: {
              monthKey,
              baseLimit: Number(baseLimit || 0),
              baseRemaining: Number(baseRemaining || 0),
              usedThisMonth: Number(usedThisMonth || 0),
              addonBuckets,
              addonsRemaining: Number(addonsRemaining || 0),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );

        // ✅ تحديث companySubscriptions بعد الخصم فقط
        const creditsActiveAfterSpend = totalRemainingAfterSpend > 0;
        const benefitsAfterSpend = timeActiveNow && creditsActiveAfterSpend;

        tx.set(
          subRef,
          {
            status: timeActiveNow ? "active" : "expired",
            timeActive: !!timeActiveNow,
            isActive: !!creditsActiveAfterSpend,
            benefitsState: benefitsAfterSpend ? "on" : "off",
            txCredits: {
              monthKey,
              baseLimit: Number(baseLimit || 0),
              baseRemaining: Number(baseRemaining || 0),
              usedThisMonth: Number(usedThisMonth || 0),
              addonsRemaining: Number(addonsRemaining || 0),
              totalRemaining: Number(totalRemainingAfterSpend || 0),
              updatedAtISO: nowISO(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      // (C) wallet/coins
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

      // (D) ADDON → تعديل buckets + mirror في companySubscriptions
      if (isAddon && isCompany) {
        const qtyToAdd = Number(resolvedAddonQty || 0);
        if (qtyToAdd > 0) {
          const purchasedAt = new Date();
          const purchasedMonthKey = monthKeyOf(purchasedAt);
          const usableMonthKey = computeAddonUsableMonthKey(purchasedAt);

          // ✅ لازم نضيف على الأصل addonBucketsAll (مش view)
          addonBucketsAll = Array.isArray(addonBucketsAll) ? [...addonBucketsAll] : [];
          addonBucketsAll.push({
            id: String(paymentIntentId),
            addonKey: String(addonKey || ""),
            qtyRemaining: qtyToAdd,
            purchasedAt: admin.firestore.Timestamp.fromDate(purchasedAt),
            purchasedMonthKey,
            usableMonthKey,
            expiresMonthKey: usableMonthKey,
          });

          const normAfterAdd = normalizeBucketsForMonth(addonBucketsAll, monthKey);
          addonBuckets = normAfterAdd.keep;
          const addonsRemainingAfter = Number(normAfterAdd.sum || 0);

          const creditsActiveAfterAddon =
            (Number(baseRemaining || 0) + Number(addonsRemainingAfter || 0)) > 0; // credits فقط
          const benefitsAfterAddon = (timeActiveNow && creditsActiveAfterAddon); // وقت + رصيد

          // ✅ Mirror to users so UI counter sees add-ons
          tx.set(
            userRef,
            {
              monthlyTxCredits: {
                monthKey,
                baseLimit: Number(baseLimit || 0),
                baseRemaining: Number(baseRemaining || 0),
                usedThisMonth: Number(usedThisMonth || 0),
                addonBuckets,
                addonsRemaining: Number(addonsRemainingAfter || 0),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );

          const companyPublicId = safeStr(udata.companyId || udata.customerId || udata.userId || customerIdMeta);
          const companyEmail = safeStr(udata.email || md.userEmail || "");

          tx.set(
            subRef,
            {
              companyDocId: customerIdMeta,
              companyId: companyPublicId,
              email: companyEmail,

              status: timeActiveNow ? "active" : "expired",
              timeActive: !!timeActiveNow,
              isActive: !!creditsActiveAfterAddon,
              benefitsState: benefitsAfterAddon ? "on" : "off",

              txCredits: {
                monthKey,
                baseLimit: Number(baseLimit || 0),
                baseRemaining: Number(baseRemaining || 0),
                usedThisMonth: Number(usedThisMonth || 0),
                addonsRemaining: Number(addonsRemainingAfter || 0),
                totalRemaining: Number(baseRemaining || 0) + Number(addonsRemainingAfter || 0),
                updatedAtISO: nowISO(),
              },

              lastAddon: {
                addonKey: safeStr(addonKey || ""),
                addonQty: qtyToAdd,
                usableMonthKey: safeStr(usableMonthKey || ""),
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

          tx.set(userRef.collection("monthlyTxCreditsHistory").doc(paymentIntentId), {
            type: "addon_topup",
            paymentIntentId,
            requestId: finalRequestId,
            addonKey: safeStr(addonKey || ""),
            addonQtyAdded: qtyToAdd,
            usableMonthKey: safeStr(usableMonthKey || ""),
            amountAED,
            purchasedAtISO: purchasedAt.toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          addonsRemaining = addonsRemainingAfter;
        }
      }

      // (E) SUBSCRIPTION ... + ✅ rule: renew last 7 days => carry addons to next month, else clear addons
      if (isSubscription && isCompany) {
        const renewInLast7DaysOfMonth = isInLast7DaysOfMonth(now);

        if (renewInLast7DaysOfMonth) {
          addonBuckets = (Array.isArray(addonBuckets) ? addonBuckets : []).map((b) => ({
            ...b,
            usableMonthKey: nextMonthKeyOf(now),
            expiresMonthKey: nextMonthKeyOf(now),
          }));
        } else {
          addonBuckets = [];
          addonsRemaining = 0;
        }

        const lim = Number(planMonthlyLimitResolved || 0);

        baseLimit = lim;
        baseRemaining = lim;
        usedThisMonth = 0;

        const normAfterSubBuckets = normalizeBucketsForMonth(addonBuckets, monthKey);
        addonBuckets = normAfterSubBuckets.keep;
        const addonsRemainingAfterSub = Number(normAfterSubBuckets.sum || 0);

        tx.set(
          userRef,
          {
            monthlyTxCredits: {
              monthKey,
              baseLimit: Number(baseLimit || 0),
              baseRemaining: Number(baseRemaining || 0),
              usedThisMonth: Number(usedThisMonth || 0),
              addonBuckets,
              addonsRemaining: Number(addonsRemainingAfterSub || 0),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );

        // ---- compute subscription dates ----
        let startDate = now;
        let baseEnd = now;

        if (subSnap && subSnap.exists) {
          const old = subSnap.data() || {};
          const oldEnd = toDateSafe(old.endAt) || (old.endAtISO ? new Date(old.endAtISO) : null);
          const oldActiveNow = !!oldEnd && oldEnd.getTime() > now.getTime();

          if (oldActiveNow) {
            baseEnd = oldEnd;
            const oldStart = toDateSafe(old.startAt) || (old.startAtISO ? new Date(old.startAtISO) : null);
            startDate = oldStart || now;
          }
        }

        const endDate = addDays(baseEnd, daysToApply);

        // ✅ time-based validity (Timer/UI)
        const timeValid = endDate.getTime() > now.getTime();
        const statusNow = timeValid ? "active" : "expired";

        // ✅ credits validity (credits only)
        const creditsActiveAfterSub = (Number(baseRemaining || 0) + Number(addonsRemainingAfterSub || 0)) > 0;

        // ✅ benefits validity (time + credits)
        const benefitsAfterSub = (timeValid && creditsActiveAfterSub);

        // user mirror (time only)
        tx.set(
          userRef,
          {
            subscriptionActive: timeValid,
            subscriptionStatus: statusNow,
            subscriptionEndAtISO: endDate.toISOString(),
            subscriptionPlanKey: planKey || "",
            subscriptionUpdatedAtISO: nowISO(),
          },
          { merge: true }
        );

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

            subscriptionDays: Number(daysToApply || 0),
            paidMonths: Number(paidMonths || 0),
            bonus: Number(bonus || 0),

            monthlyIncludedTxLimit: lim,

            startAt: admin.firestore.Timestamp.fromDate(startDate),
            endAt: admin.firestore.Timestamp.fromDate(endDate),
            startAtISO: startDate.toISOString(),
            endAtISO: endDate.toISOString(),

            // ✅ split states
            status: statusNow,
            timeActive: !!timeValid,
            isActive: !!creditsActiveAfterSub,
            benefitsState: benefitsAfterSub ? "on" : "off",

            txCredits: {
              monthKey,
              baseLimit: Number(baseLimit || 0),
              baseRemaining: Number(baseRemaining || 0),
              usedThisMonth: Number(usedThisMonth || 0),
              addonsRemaining: Number(addonsRemainingAfterSub || 0),
              totalRemaining: Number(baseRemaining || 0) + Number(addonsRemainingAfterSub || 0),
              updatedAtISO: nowISO(),
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

          monthlyIncludedTxLimit: lim,
          subscriptionDays: Number(daysToApply || 0),
          paidMonths: Number(paidMonths || 0),
          bonus: Number(bonus || 0),

          startAt: admin.firestore.Timestamp.fromDate(startDate),
          endAt: admin.firestore.Timestamp.fromDate(endDate),

          status: statusNow,
          timeActive: !!timeValid,
          isActive: !!creditsActiveAfterSub,
          benefitsState: benefitsAfterSub ? "on" : "off",

          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.set(userRef.collection("monthlyTxCreditsHistory").doc(`${paymentIntentId}_sub`), {
          type: "subscription_reset",
          paymentIntentId,
          requestId: finalRequestId,
          planKey,
          pricingKey,
          baseLimit: lim,
          monthKey,
          amountAED,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        addonsRemaining = addonsRemainingAfterSub;
      }

      // ✅ FINAL: enforce isActive strictly by credits (base + addons)
      // and benefitsState by (time + credits), every webhook run.
      if (isCompany) {
        const finalCreditsRemaining =
          Number(baseRemaining || 0) + Number(addonsRemaining || 0);

        const finalCreditsActive = finalCreditsRemaining > 0;

        const finalTimeActive = !!timeActiveNow; // ✅ time من users.subscriptionActive فقط

        const finalBenefits = finalTimeActive && finalCreditsActive;

        tx.set(
          subRef,
          {
            isActive: !!finalCreditsActive,

            timeActive: !!finalTimeActive,
            status: finalTimeActive ? "active" : "expired",

            benefitsState: finalBenefits ? "on" : "off",

            txCredits: {
              monthKey,
              baseLimit: Number(baseLimit || 0),
              baseRemaining: Number(baseRemaining || 0),
              usedThisMonth: Number(usedThisMonth || 0),
              addonsRemaining: Number(addonsRemaining || 0),
              totalRemaining: Number(finalCreditsRemaining || 0),
              updatedAtISO: nowISO(),
            },

            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      // (F) transactions log
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

      // (G) notification doc
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

      // (H) processed (idempotency)
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
          planMonthlyLimitResolved: planMonthlyLimitResolved || 0,
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
          ? {
              requestType: "subscription",
              planKey,
              pricingKey,
              monthlyIncludedTxLimit: Number(planMonthlyLimitResolved || 0),
            }
          : {}),
      };
    });

    // push after tx (outside transaction)
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
