// pages/api/consume-tx-and-create-request.js
"use strict";

import admin from "firebase-admin";

// ---------------- Firebase Admin init (idempotent) ----------------
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

// ---------------- helpers ----------------
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

// -------- month helpers (monthlyTxCredits) ----------
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

// ✅ Add-on usableMonthKey rule
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

function generateReqNumber() {
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${part1}-${part2}`;
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

    const json = await resp.json().catch(() => ({}));
    console.log("Expo push response:", json);
  } catch (err) {
    console.error("❌ sendExpoPushToUser error:", err);
  }
}

// ---------------- MAIN HANDLER ----------------
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // ✅ مهم: Next.js API غالبًا بيكون body جاهز object
  try {
    const body = req.body || {};

    // ---- basics ----
    const customerId = safeStr(body.customerId || body.userId || body.clientId || "").trim(); // COM-...
    const clientType = normLower(body.clientType || body.client_type || "company");
    const lang = normLower(body.lang) === "en" ? "en" : "ar";

    const serviceId = safeStr(body.serviceId || "").trim();
    const serviceName = safeStr(body.serviceName || body.serviceNameFallback || "").trim();

    const assignedTo = safeStr(body.assignedTo || "").trim();
    const assignedToName = safeStr(body.assignedToName || "").trim();

    // ✅ amounts from UI (source of truth for request)
    // الاتفاق: gov + processing فقط (printing/vat = 0)
    const govAmountAED = safeNum(body.govAmountAED ?? body.baseAmountAED ?? body.baseAmount ?? 0);
    const processingFeeAED = safeNum(body.processingFeeAED ?? body.processingFee ?? 0);

    // 🔒 enforce: printing/vat must be zero in this flow
    const printingFeeAED = 0;
    const vatAED = 0;

    const totalToChargeAED = +(govAmountAED + processingFeeAED).toFixed(2);

    // attachments optional
    const attachments = body.attachments && typeof body.attachments === "object" ? body.attachments : {};
    const meta = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    // idempotency key
    const consumeKey =
      safeStr(body.consumeKey || body.idempotencyKey || req.headers["x-idempotency-key"] || "").trim() ||
      `${customerId || "NA"}_${serviceId || "NA"}_${Date.now()}`;

    // validations
    if (!customerId || !String(customerId).startsWith("COM-")) {
      return res.status(400).json({ ok: false, error: "invalid_customerId" });
    }
    if (clientType !== "company") {
      return res.status(403).json({ ok: false, error: "only_company_allowed" });
    }
    if (!serviceId && !serviceName) {
      return res.status(400).json({ ok: false, error: "missing_service" });
    }
    if (!(govAmountAED > 0) || !(processingFeeAED >= 0) || !(totalToChargeAED > 0)) {
      return res.status(400).json({ ok: false, error: "invalid_amounts" });
    }

    const userRef = db.collection("users").doc(customerId);
    const subRef = db.collection("companySubscriptions").doc(customerId);
    const processedRef = db.collection("txConsumeProcessed").doc(consumeKey);

    // fetch service doc (outside transaction ok)
    const serviceDoc = await fetchServiceFromByClientType(serviceId, "company", serviceName);

    let notifyTitleAfterTx = "";
    let notifyBodyAfterTx = "";
    let notifyDataAfterTx = {};
    let finalRequestIdAfterTx = "";

    // =============================
    // Transaction
    // =============================
    try {
      await db.runTransaction(async (tx) => {
        // idempotency
        const proc = await tx.get(processedRef);
        if (proc.exists) {
          const prev = proc.data() || {};
          const prevReqId = safeStr(prev.requestId || "");
          throw new Error(`ALREADY_PROCESSED:${prevReqId || ""}`);
        }

        const uSnap = await tx.get(userRef);
        if (!uSnap.exists) throw new Error("USER_NOT_FOUND");
        const udata = uSnap.data() || {};

        const subSnap = await tx.get(subRef);
        if (!subSnap.exists) throw new Error("SUBSCRIPTION_NOT_FOUND");

        const now = new Date();
        const currentMonthKey = monthKeyOf(now);

        // ---- verify subscription time validity ----
        const sub = subSnap.data() || {};
        const status = normLower(sub.status || "");
        const endAt = toDateSafe(sub.endAt) || (sub.endAtISO ? new Date(sub.endAtISO) : null);

        const timeValid =
          (status === "active" || status === "trial") &&
          !!endAt &&
          endAt.getTime() > now.getTime();

        if (!timeValid) {
          if (endAt && endAt.getTime() <= now.getTime()) {
            tx.set(
              subRef,
              {
                status: "expired",
                isActive: false,
                expiredAtISO: now.toISOString(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
          throw new Error("SUBSCRIPTION_EXPIRED");
        }

        // ---- monthlyTxCredits normalize/reset month ----
        const mtc0 = udata.monthlyTxCredits || {};
        const monthKey0 = String(mtc0.monthKey || "");
        const baseLimit0 = Number(mtc0.baseLimit || 0);
        const baseRemaining0 = Number(mtc0.baseRemaining ?? baseLimit0);
        const used0 = Number(mtc0.usedThisMonth || 0);
        let addonBuckets0 = Array.isArray(mtc0.addonBuckets) ? mtc0.addonBuckets : [];

        let monthKey = monthKey0 || currentMonthKey;
        let baseLimit = baseLimit0;
        let baseRemaining = baseRemaining0;
        let usedThisMonth = used0;
        let addonBuckets = [...addonBuckets0];

        if (!monthKey0) {
          monthKey = currentMonthKey;
          baseRemaining = baseLimit;
          usedThisMonth = 0;
        } else if (monthKey0 !== currentMonthKey) {
          // ✅ reset أول كل شهر
          monthKey = currentMonthKey;
          baseRemaining = baseLimit;
          usedThisMonth = 0;
        }

        // ✅ normalize buckets for CURRENT month only
        let addonsRemaining = 0;
        {
          const { keep, sum } = normalizeBucketsForMonth(addonBuckets, monthKey);
          addonBuckets = keep;
          addonsRemaining = Number(sum || 0);
        }

        const totalRemainingNow = Number(baseRemaining || 0) + Number(addonsRemaining || 0);
        if (!(totalRemainingNow > 0)) {
          // timeValid لكن مفيش رصيد => isActive false
          tx.set(
            subRef,
            {
              isActive: false,
              txCredits: {
                monthKey,
                baseLimit: Number(baseLimit || 0),
                baseRemaining: Number(baseRemaining || 0),
                usedThisMonth: Number(usedThisMonth || 0),
                addonsRemaining: Number(addonsRemaining || 0),
                totalRemaining: Number(totalRemainingNow || 0),
                updatedAtISO: nowISO(),
              },
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          throw new Error("NO_CREDITS");
        }

        // ---- consume 1 tx (base first, else addons) ----
        let consumedFrom = "base";
        if (Number(baseRemaining || 0) > 0) {
          baseRemaining = Math.max(0, Number(baseRemaining || 0) - 1);
          usedThisMonth = Number(usedThisMonth || 0) + 1;
          consumedFrom = "base";
        } else {
          addonBuckets = Array.isArray(addonBuckets) ? [...addonBuckets] : [];
          let decDone = false;

          for (let i = 0; i < addonBuckets.length; i++) {
            const qty = Number(addonBuckets[i]?.qtyRemaining || 0);
            if (qty > 0) {
              addonBuckets[i] = { ...addonBuckets[i], qtyRemaining: Math.max(0, qty - 1) };
              usedThisMonth = Number(usedThisMonth || 0) + 1;
              decDone = true;
              consumedFrom = "addon";
              break;
            }
          }
          if (!decDone) throw new Error("NO_CREDITS");
        }

        // re-normalize after spend
        const { keep, sum: addonsRemainingAfterSpend } = normalizeBucketsForMonth(addonBuckets, monthKey);
        addonBuckets = keep;
        addonsRemaining = Number(addonsRemainingAfterSpend || 0);

        const totalRemainingAfter = Number(baseRemaining || 0) + Number(addonsRemaining || 0);

        // benefit flag
        const benefitsActive = timeValid && totalRemainingAfter > 0;

        // ---- write monthlyTxCredits back (user) ----
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

        // ---- mirror to companySubscriptions ----
        const companyPublicId = safeStr(udata.companyId || udata.customerId || udata.userId || customerId);
        const companyEmail = safeStr(udata.email || "");

        tx.set(
          subRef,
          {
            companyDocId: customerId,
            companyId: companyPublicId,
            email: companyEmail,

            isActive: benefitsActive,

            txCredits: {
              monthKey,
              baseLimit: Number(baseLimit || 0),
              baseRemaining: Number(baseRemaining || 0),
              usedThisMonth: Number(usedThisMonth || 0),
              addonsRemaining: Number(addonsRemaining || 0),
              totalRemaining: Number(totalRemainingAfter || 0),
              updatedAtISO: nowISO(),
            },

            lastConsume: {
              consumeKey,
              serviceId: safeStr(serviceId || ""),
              serviceName: safeStr(serviceName || ""),
              consumedFrom,
              monthKey,
              atISO: now.toISOString(),
            },

            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(subSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
          },
          { merge: true }
        );

        // ---- create request (NOT paid) ----
        const requestId = safeStr(body.requestId || "").trim() || generateReqNumber();
        finalRequestIdAfterTx = requestId;

        const requestRef = db.collection("requests").doc(requestId);

        // service snapshot
        let svc = null;
        if (serviceDoc) {
          svc = {
            name: serviceDoc.name || serviceName || "",
            serviceId: serviceDoc.serviceId || serviceId || "",
            providers: Array.isArray(serviceDoc.providers)
              ? serviceDoc.providers
              : serviceDoc.providers
              ? [serviceDoc.providers]
              : [],
            category: serviceDoc.category || "company",
            subcategory: serviceDoc.subcategory || serviceDoc.subCategory || "",
            clientPrice: safeNum(serviceDoc.clientPrice ?? serviceDoc.price ?? 0),
            price: safeNum(serviceDoc.price ?? serviceDoc.clientPrice ?? 0),
            printingFee: safeNum(serviceDoc.printingFee ?? 0),
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

        // ✅ حسب اتفاقنا: printing/vat = 0
        tx.set(requestRef, {
          requestId,
          customerId,

          requestType: "service",
          // ✅ مدفوع حكومي + رسوم دفع، لكن TX من الاشتراك
          paymentMethod: "subscription_credits_plus_gateway",
          consumeKey,

          serviceId: serviceId || (svc?.serviceId || ""),
          serviceName: serviceName || (svc?.name || ""),
          ...(svc ? { service: svc, providers: svc.providers } : {}),

          // ✅ NOT PAID YET
          status: "pending_payment",
          createdAt: nowISO(),
          lastUpdated: nowISO(),

          // ✅ amounts to charge (gov + processing)
          govAmountAED: +govAmountAED.toFixed(2),
          processingFeeAED: +processingFeeAED.toFixed(2),
          printingFee: 0,
          vatAED: 0,
          totalToChargeAED: +totalToChargeAED.toFixed(2),

          // assignment
          assignedTo: assignedTo || "",
          assignedToName: assignedToName || "",

          userEmail: safeStr(udata.email || ""),

          // audit
          statusHistory: [
            { status: "pending_payment", timestamp: nowISO(), updatedBy: "consume-tx" },
          ],

          // attachments + metadata
          attachments: attachments || {},
          metadata: meta || {},

          // credit info
          credits: {
            monthKey,
            consumedFrom,
            after: {
              baseRemaining: Number(baseRemaining || 0),
              addonsRemaining: Number(addonsRemaining || 0),
              totalRemaining: Number(totalRemainingAfter || 0),
            },
          },
        });

        // ---- history log ----
        tx.set(userRef.collection("monthlyTxCreditsHistory").doc(`${consumeKey}`), {
          type: "service_consume_create_request",
          consumeKey,
          requestId,
          serviceId: safeStr(serviceId || ""),
          serviceName: safeStr(serviceName || ""),
          monthKey,
          consumedFrom,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // ---- transactions log (credits) ----
        const txRef = db.collection("transactions").doc();
        tx.set(txRef, {
          userId: customerId,
          requestId,
          amount: 0,
          currency: "aed",
          type: "debit",
          status: "succeeded",
          method: "subscription_credits",
          consumeKey,
          monthKey,
          consumedFrom,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // ---- notification ----
        const notifRef = db.collection("notifications").doc();

        const notifTitle =
          lang === "en" ? "Request Created" : "تم إنشاء الطلب";
        const notifBody =
          lang === "en"
            ? `Subscription TX consumed. Please complete payment. Order: ${requestId}`
            : `تم خصم معاملة من الاشتراك. برجاء إكمال الدفع. رقم الطلب: ${requestId}`;

        tx.set(notifRef, {
          targetId: customerId,
          title: notifTitle,
          body: notifBody,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          isRead: false,
          metadata: {
            type: "service_consume_create_request",
            orderId: requestId,
            consumeKey,
            serviceId: safeStr(serviceId || ""),
            serviceName: safeStr(serviceName || ""),
            consumedFrom,
            monthKey,
          },
        });

        // ---- processed marker ----
        tx.set(processedRef, {
          consumeKey,
          requestId,
          userId: customerId,
          serviceId: safeStr(serviceId || ""),
          serviceName: safeStr(serviceName || ""),
          monthKey,
          consumedFrom,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // push vars after tx
        notifyTitleAfterTx = notifTitle;
        notifyBodyAfterTx = notifBody;
        notifyDataAfterTx = {
          type: "service_consume_create_request",
          orderId: requestId,
          consumeKey,
          serviceId: safeStr(serviceId || ""),
          serviceName: safeStr(serviceName || ""),
          monthKey,
          consumedFrom,
        };
      });
    } catch (txErr) {
      const m = safeStr(txErr?.message || "");
      if (m.startsWith("ALREADY_PROCESSED:")) {
        const requestId = (m.split("ALREADY_PROCESSED:")[1] || "").trim();
        return res.json({ ok: true, requestId: requestId || null, alreadyProcessed: true, consumeKey });
      }
      throw txErr;
    }

    // push after tx
    try {
      if (finalRequestIdAfterTx) {
        await sendExpoPushToUser(db.collection("users").doc(customerId), notifyTitleAfterTx, notifyBodyAfterTx, notifyDataAfterTx);
      }
    } catch (e) {
      console.error("push send failed:", e);
    }

    return res.json({
      ok: true,
      requestId: finalRequestIdAfterTx,
      consumeKey,
    });
  } catch (err) {
    const msg = safeStr(err?.message || "");

    if (msg === "USER_NOT_FOUND") return res.status(404).json({ ok: false, error: "user_not_found" });
    if (msg === "SUBSCRIPTION_NOT_FOUND") return res.status(403).json({ ok: false, error: "no_subscription" });
    if (msg === "SUBSCRIPTION_EXPIRED") return res.status(403).json({ ok: false, error: "subscription_expired" });
    if (msg === "NO_CREDITS") return res.status(403).json({ ok: false, error: "no_credits" });

    console.error("❌ consume-tx-and-create-request error:", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}
