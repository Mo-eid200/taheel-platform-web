// pages/api/pay-with-wallet.js
"use strict";

import admin from "firebase-admin";

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = req.body || {};
    const customerId = safeStr(body.customerId || "").trim();
    const clientType = normLower(body.clientType || "");
    const serviceId = safeStr(body.serviceId || "").trim();
    const serviceName = safeStr(body.serviceName || "").trim();
    const lang = safeStr(body.lang || "ar").trim();
    const source = safeStr(body.source || "mobile").trim();

    const useCoins = !!body.useCoins; // boolean
    const attachments = body.attachments || body.uploadedDocs || null;

    // optional idempotency key from app
    const requestId = safeStr(body.requestId || body.orderNumber || "").trim() || generateOrderNumber();

    if (!customerId) return res.status(400).json({ ok: false, error: "Missing customerId" });
    if (!serviceId && !serviceName) return res.status(400).json({ ok: false, error: "Missing serviceId/serviceName" });

    const userRef = db.collection("users").doc(customerId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(400).json({ ok: false, error: "User not found" });

    // resolve service truth
    const serviceDoc = await fetchServiceFromByClientType(serviceId, clientType, serviceName);
    if (!serviceDoc) return res.status(400).json({ ok: false, error: "Service not found" });

    const baseAmountAED = safeNum(serviceDoc.clientPrice ?? serviceDoc.price ?? 0);
    if (!(baseAmountAED > 0)) return res.status(400).json({ ok: false, error: "Invalid service price" });

    // printing from catalog
    let printingFeeAED = safeNum(serviceDoc.printingFee ?? 0);

    // VAT rule for services حسب اتفاقك القديم: VAT على الطباعة فقط
    // هنا انت في المودال بتعرض vatTotal — هنحسبه server truth:
    // NOTE: لو انت فعلاً ناوي تلغي VAT للخدمات تمامًا في السيرفر الجديد، غيّر السطرين دول.
    const vatAED = printingFeeAED > 0 ? Number((printingFeeAED * 0.05).toFixed(2)) : 0;

    // totals for service
    const totalBeforeCoins = Number((baseAmountAED + printingFeeAED + vatAED).toFixed(2));

    // coins discount: 10% من إجمالي المبلغ (المطلوب منك)
    // coins stored as points where 100 points = 1 AED
    const maxDiscountAED = Number((totalBeforeCoins * 0.10).toFixed(2));
    const maxDiscountPoints = Math.floor(maxDiscountAED * 100);

    // idempotency doc for wallet payments
    const processedRef = db.collection("walletPaymentsProcessed").doc(requestId);

    let responsePayload = null;

    await db.runTransaction(async (tx) => {
      // idempotency
      const proc = await tx.get(processedRef);
      if (proc.exists) throw new Error("ALREADY_PROCESSED");

      const uDoc = await tx.get(userRef);
      if (!uDoc.exists) throw new Error("USER_NOT_FOUND");
      const u = uDoc.data() || {};

      const walletBalance = safeNum(u.walletBalance ?? u.wallet ?? 0);
      const coins = safeNum(u.coins ?? 0);

      // company detection
      const userIsCompany = normLower(u.accountType || u.type || u.clientType || "") === "company";
      const metaSaysCompany = clientType === "company";
      const idLooksCompany = String(customerId).startsWith("COM-");
      const isCompany = userIsCompany || metaSaysCompany || idLooksCompany;

      // monthlyTxCredits normalize
      const now = new Date();
      const currentMonthKey = getMonthKey(now);
      const mtc0 = u.monthlyTxCredits || {};
      const monthKey0 = String(mtc0.monthKey || "");

      const baseLimit0 = typeof mtc0.baseLimit === "number" ? mtc0.baseLimit : Number(mtc0.baseLimit || 0);
      const baseRemaining0 =
        typeof mtc0.baseRemaining === "number"
          ? mtc0.baseRemaining
          : (typeof baseLimit0 === "number" ? baseLimit0 : 0);
      const used0 = typeof mtc0.usedThisMonth === "number" ? mtc0.usedThisMonth : Number(mtc0.usedThisMonth || 0);
      let addonBucketsAll = Array.isArray(mtc0.addonBuckets) ? [...mtc0.addonBuckets] : [];

      let monthKey = monthKey0 || currentMonthKey;
      let baseLimit = baseLimit0;
      let baseRemaining = baseRemaining0;
      let usedThisMonth = used0;

      // reset month if changed
      if (!monthKey0 || monthKey0 !== currentMonthKey) {
        monthKey = currentMonthKey;
        baseRemaining = baseLimit;
        usedThisMonth = 0;
      }

      const norm0 = normalizeBucketsForMonth(addonBucketsAll, monthKey);
      let addonBuckets = norm0.keep;
      let addonsRemaining = Number(norm0.sum || 0);

      // subscription split states (وقت من users.subscriptionActive)
      const timeActiveNow = Boolean(u.subscriptionActive);
      const hasCreditsNow = (Number(baseRemaining || 0) + Number(addonsRemaining || 0)) > 0;
      const benefitsActiveNow = timeActiveNow && hasCreditsNow;

      // waive printing fee if company + benefitsActiveNow (حسب اتفاقكم)
      if (isCompany && benefitsActiveNow && printingFeeAED > 0) {
        printingFeeAED = 0;
      }

      // recompute VAT + total after potential waiver
      const vat2 = printingFeeAED > 0 ? Number((printingFeeAED * 0.05).toFixed(2)) : 0;
      const totalTruthBeforeCoins = Number((baseAmountAED + printingFeeAED + vat2).toFixed(2));

      const maxDiscountAED2 = Number((totalTruthBeforeCoins * 0.10).toFixed(2));
      const maxDiscountPoints2 = Math.floor(maxDiscountAED2 * 100);

      const coinsToUsePoints = useCoins ? Math.min(coins, maxDiscountPoints2) : 0;
      const coinsDiscountAED = Number((coinsToUsePoints / 100).toFixed(2));

      const totalAfterCoins = Math.max(0, Number((totalTruthBeforeCoins - coinsDiscountAED).toFixed(2)));

      // wallet must cover
      if (walletBalance + 1e-9 < totalAfterCoins) {
        const msg = lang === "en" ? "Insufficient wallet balance" : "رصيد المحفظة غير كافٍ";
        throw new Error(msg);
      }

      // Create request as PAID مباشرة
      const reqRef = db.collection("requests").doc(requestId);

      const requestDoc = {
        requestId,
        customerId,
        requestType: "service",
        clientType: clientType || "",
        serviceId: safeStr(serviceDoc.serviceId || serviceId || ""),
        serviceName: safeStr(serviceDoc.name || serviceName || ""),

        baseAmountAED,
        printingFee: printingFeeAED,
        vat: vat2,
        totalPriceAED: totalTruthBeforeCoins,
        processingFee: 0,
        totalAED: totalAfterCoins,

        paidAmount: totalAfterCoins,
        status: "paid",
        paidAt: nowISO(),
        createdAt: nowISO(),
        lastUpdated: nowISO(),

        paymentMethod: "wallet",
        source,

        coinsUsed: coinsToUsePoints,
        coinsGiven: 0,

        ...(attachments ? { attachments } : {}),
        statusHistory: [{ status: "paid", timestamp: nowISO(), updatedBy: "wallet-api" }],
        service: {
          name: safeStr(serviceDoc.name || serviceName || ""),
          serviceId: safeStr(serviceDoc.serviceId || serviceId || ""),
          providers: Array.isArray(serviceDoc.providers)
            ? serviceDoc.providers
            : serviceDoc.providers
            ? [serviceDoc.providers]
            : [],
          category: serviceDoc.category || "",
          subcategory: serviceDoc.subcategory || serviceDoc.subCategory || "",
          clientPrice: baseAmountAED,
          price: safeNum(serviceDoc.price ?? baseAmountAED),
          printingFee: safeNum(serviceDoc.printingFee ?? 0),
          requiredDocuments: Array.isArray(serviceDoc.requiredDocuments) ? serviceDoc.requiredDocuments : [],
        },
      };

      tx.set(reqRef, requestDoc, { merge: true });

      // deduct wallet + coins
      tx.update(userRef, {
        walletBalance: Number((walletBalance - totalAfterCoins).toFixed(2)),
        ...(coinsToUsePoints > 0 ? { coins: admin.firestore.FieldValue.increment(-coinsToUsePoints) } : {}),
        lastWalletUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // decrement credits for company services (بعد الدفع)
      const shouldDecrementCredits = isCompany;

      if (shouldDecrementCredits) {
        if (Number(baseRemaining) > 0) {
          baseRemaining = Math.max(0, Number(baseRemaining) - 1);
          usedThisMonth = Number(usedThisMonth || 0) + 1;
        } else {
          // deduct from addon buckets (usableMonthKey == monthKey)
          addonBucketsAll = Array.isArray(addonBucketsAll) ? [...addonBucketsAll] : [];
          for (let i = 0; i < addonBucketsAll.length; i++) {
            const b = addonBucketsAll[i] || {};
            const usableKey = String(b.usableMonthKey || b.expiresMonthKey || b.purchasedMonthKey || "");
            if (usableKey !== monthKey) continue;

            const qty = Number(b.qtyRemaining || 0);
            if (qty > 0) {
              addonBucketsAll[i] = { ...b, qtyRemaining: Math.max(0, qty - 1) };
              usedThisMonth = Number(usedThisMonth || 0) + 1;
              break;
            }
          }
        }

        const normAfter = normalizeBucketsForMonth(addonBucketsAll, monthKey);
        addonBuckets = normAfter.keep;
        addonsRemaining = Number(normAfter.sum || 0);

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

        // update companySubscriptions state mirror
        const subRef = db.collection("companySubscriptions").doc(customerId);
        const creditsRemaining = Number(baseRemaining || 0) + Number(addonsRemaining || 0);
        const creditsActive = creditsRemaining > 0;
        const finalTime = Boolean(u.subscriptionActive);
        const finalBenefits = finalTime && creditsActive;

        tx.set(
          subRef,
          {
            status: finalTime ? "active" : "expired",
            timeActive: !!finalTime,
            isActive: !!creditsActive,
            benefitsState: finalBenefits ? "on" : "off",
            txCredits: {
              monthKey,
              baseLimit: Number(baseLimit || 0),
              baseRemaining: Number(baseRemaining || 0),
              usedThisMonth: Number(usedThisMonth || 0),
              addonsRemaining: Number(addonsRemaining || 0),
              totalRemaining: Number(creditsRemaining || 0),
              updatedAtISO: nowISO(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      // notification
      const notifRef = db.collection("notifications").doc();
      const isEn = normLower(lang) === "en";
      const notifTitle = isEn ? "Payment Confirmed" : "تم تأكيد الدفع";
      const notifBody = isEn
        ? `Wallet payment received: ${totalAfterCoins.toFixed(2)} AED • Order: ${requestId}`
        : `تم الدفع من المحفظة بقيمة ${totalAfterCoins.toFixed(2)} د.إ • رقم الطلب: ${requestId}`;

      tx.set(notifRef, {
        targetId: customerId,
        title: notifTitle,
        body: notifBody,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isRead: false,
        metadata: { orderId: requestId, paymentMethod: "wallet", type: "service" },
      });

      // processed
      tx.set(processedRef, {
        requestId,
        customerId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalBeforeCoins: totalTruthBeforeCoins,
        coinsUsed: coinsToUsePoints,
        paidAmount: totalAfterCoins,
      });

      responsePayload = {
        ok: true,
        orderNumber: requestId,
        requestId,
        paidAmount: totalAfterCoins,
        breakdown: {
          baseAmountAED,
          printingFeeAED,
          vatAED: vat2,
          totalBeforeCoins: totalTruthBeforeCoins,
          coinsDiscountAED,
          totalAfterCoins,
        },
      };
    });

    return res.status(200).json(responsePayload || { ok: true });
  } catch (e) {
    if (e?.message === "ALREADY_PROCESSED") return res.status(200).json({ ok: true, received: true });
    console.error("pay-with-wallet error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
}
