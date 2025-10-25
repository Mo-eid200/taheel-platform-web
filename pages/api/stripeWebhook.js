// pages/api/stripe-webhook.js
"use strict";

import Stripe from "stripe";
import admin from "firebase-admin";

// لازم في Next.js API Routes علشان ناخد الـ raw body ونعمل verify للـ Stripe signature
export const config = { api: { bodyParser: false } };

// ---------- Firebase Admin init (idempotent) ----------
if (!admin.apps.length) {
  try {
    const sa = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
      : null;

    if (sa && sa.private_key) {
      sa.private_key = sa.private_key.replace(/\\n/g, "\n");
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      // running on GCP or already authed
      admin.initializeApp();
    }
  } catch (e) {
    console.error("Failed to initialize firebase-admin:", e);
    try {
      admin.initializeApp();
    } catch (e2) {
      /* ignore */
    }
  }
}

const db = admin.firestore();

// ---------- Stripe init ----------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

// ---------- helpers ----------
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function nowISO() {
  return new Date().toISOString();
}

// ناخد الـ raw body من req (Stripe محتاج ده علشان يتحقق من الـ signature)
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// نجيب تعريف الخدمة من servicesByClientType بنفس منطق confirmPayment
async function fetchServiceFromByClientType(
  serviceId,
  clientType,
  serviceNameFallback = ""
) {
  // بنحاول clientType الرئيسي الأول، ولو مش موجود نجرب باقي الأنواع
  const clientTypesToTry = clientType
    ? [clientType]
    : ["company", "resident", "nonresident", "other"];

  for (const ct of clientTypesToTry) {
    try {
      const docRef = db.collection("servicesByClientType").doc(String(ct));
      const snap = await docRef.get();
      if (!snap.exists) continue;
      const all = snap.data() || {};

      // محاولة match بـ key المباشر
      if (serviceId && Object.prototype.hasOwnProperty.call(all, serviceId)) {
        return all[serviceId];
      }

      // محاولة match من جوه الـ object
      for (const k of Object.keys(all)) {
        const s = all[k];
        if (!s) continue;
        if (
          (s.serviceId && String(s.serviceId) === String(serviceId)) ||
          (serviceId && String(k) === String(serviceId)) ||
          (serviceNameFallback &&
            String(s.name) === String(serviceNameFallback))
        ) {
          return s;
        }
      }
    } catch (e) {
      console.warn(
        "fetchServiceFromByClientType error for",
        clientType,
        e?.message || e
      );
    }
  }

  return null;
}

// ---------- MAIN HANDLER ----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).send("Server misconfigured");
  }

  // 1) verify Stripe signature
  let event;
  try {
    const buf = await getRawBody(req);
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error("❌ Stripe signature verification failed:", err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }

  // 2) احنا مهتمين بس بـ payment_intent.succeeded
  if (event.type !== "payment_intent.succeeded") {
    return res.json({ received: true });
  }

  try {
    // =============================
    //        Extract data
    // =============================
    const pi = event.data.object;
    const paymentIntentId = pi.id;
    const md = pi.metadata || {};

    // نوع العملية: شحن محفظة ولا خدمة عادية
    const requestType =
      md.requestType ||
      (md.serviceName &&
      String(md.serviceName).toLowerCase().includes("wallet")
        ? "wallet_recharge"
        : "service");

    // requestId/ orderNumber اللي frontend بعته
    let reqId = md.requestId || md.orderNumber || null;

    const coinsGiven = safeNum(
      md.coinsGiven ?? md.cashbackCoins ?? md.coins ?? 0
    );
    const coinsUsed = safeNum(md.coinsUsed ?? 0);

    const printingFeeFromMeta = safeNum(md.printingFee ?? 0);
    const processingFeeMeta = safeNum(
      md.processingFee ??
        md.processing_fee ??
        md.processing_fee_value ??
        0
    );

    const serviceId = md.serviceId || "";
    const serviceNameFromMeta = md.serviceName || "";
    const clientTypeMeta =
      md.clientType ||
      md.client_type ||
      md.serviceClientType ||
      "";

    const assignedToMeta = md.assignedTo || md.assigned_to || "";
    const assignedToNameMeta =
      md.assignedToName || md.assigned_to_name || "";

    // attachments جايين من الميتاداتا كـ JSON String
    let attachmentsMeta = {};
    if (md.attachments) {
      try {
        attachmentsMeta = JSON.parse(md.attachments) || {};
      } catch {
        attachmentsMeta = {};
      }
    }

    // Stripe بيدي المبلغ بالـ "أصغر وحدة" (فلس)، فـ /100 يطلع د.إ
    const amountSmallest = pi.amount_received ?? pi.amount ?? 0;
    const amountAED = Number((amountSmallest / 100).toFixed(2));

    // =============================
    //   3) idempotency check
    // =============================
    const processedRef = db
      .collection("stripePaymentsProcessed")
      .doc(paymentIntentId);
    const processedSnap = await processedRef.get();
    if (processedSnap.exists) {
      console.log("⚠️ already processed this PI:", paymentIntentId);
      return res.json({ received: true });
    }

    // =============================
    //   4) Locate request (order)
    // =============================
    let requestRef = null;
    let requestSnap = null;

    if (reqId) {
      requestRef = db.collection("requests").doc(String(reqId));
      requestSnap = await requestRef.get();
    } else {
      const q = await db
        .collection("requests")
        .where("paymentIntentId", "==", paymentIntentId)
        .limit(1)
        .get();
      if (!q.empty) {
        requestSnap = q.docs[0];
        requestRef = requestSnap.ref;
        reqId = requestRef.id;
      }
    }

    // =============================
    //   5) Locate user (IMPORTANT)
    // =============================
    // الـ frontend لازم يكون بعِت md.customerId = نفس الـ document ID جوه users
    const customerIdMeta = md.customerId || md.userId || null;

    if (!customerIdMeta) {
      console.warn(
        "❗ Missing customerId in Stripe metadata for PI:",
        paymentIntentId
      );
      await processedRef.set({
        paymentIntentId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        note: "missing_customerId",
        metadata: md,
      });
      return res.json({ received: true });
    }

    // هنا بنفترض إن document ID = customerIdMeta
    let userRef = db.collection("users").doc(String(customerIdMeta));
    let userSnap = await userRef.get();

    // fallback بسيط: لو الـ request اللي لقيناه فيه customerId مختلف، جرّب تستعمله
    if (!userSnap.exists && requestSnap && requestSnap.exists) {
      const rdata = requestSnap.data() || {};
      if (rdata.customerId && rdata.customerId !== customerIdMeta) {
        const altUserRef = db
          .collection("users")
          .doc(String(rdata.customerId));
        const altSnap = await altUserRef.get();
        if (altSnap.exists) {
          console.log(
            "➡ using fallback user:",
            rdata.customerId,
            "instead of",
            customerIdMeta
          );
          userRef = altUserRef;
          userSnap = altSnap;
        }
      }
    }

    // لو بعد كل ده برضه مفيش يوزر مسجل
    if (!userSnap.exists) {
      console.warn(
        "❗ user not found for PI:",
        paymentIntentId,
        "customerId:",
        customerIdMeta
      );
      await processedRef.set({
        paymentIntentId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        note: "user_not_found",
        metadata: md,
      });
      return res.json({ received: true });
    }

    // =============================
    //   6) Load service definition
    // =============================
    const serviceDoc = await fetchServiceFromByClientType(
      serviceId,
      clientTypeMeta,
      serviceNameFromMeta
    );

    // =============================
    //   7) Firestore Transaction
    // =============================
    await db.runTransaction(async (tx) => {
      // متخليش اتنين workers يعالجوا نفس الـ PI مع بعض
      const procCheck = await tx.get(processedRef);
      if (procCheck.exists) {
        throw new Error("ALREADY_PROCESSED");
      }

      const uDoc = await tx.get(userRef);
      if (!uDoc.exists) {
        throw new Error("User disappeared during transaction");
      }

      // هنستعمل finalRequestId بعدين سواء كنا حدّثنا طلب قديم أو عملنا جديد
      let finalRequestId = reqId || null;

      // --------------------------------
      // A) UPDATE OR CREATE REQUEST DOC
      // --------------------------------
      if (requestSnap && requestSnap.exists) {
        // update existing request
        finalRequestId = String(requestSnap.id);

        const rdata = requestSnap.data() || {};
        const history = Array.isArray(rdata.statusHistory)
          ? [...rdata.statusHistory]
          : [];

        history.push({
          status: "paid",
          timestamp: nowISO(),
          updatedBy: "stripe-webhook",
        });

        const updates = {
          lastUpdated: nowISO(),
          status: "paid",
          paidAmount: amountAED,
          paymentIntentId: paymentIntentId,
          statusHistory: history,
          paidAt: nowISO(),
          processingFee:
            typeof rdata.processingFee !== "undefined"
              ? rdata.processingFee
              : processingFeeMeta || 0,
        };

        // attachments & clientSecret
        if (rdata.attachments) {
          updates.attachments = rdata.attachments;
        } else if (
          attachmentsMeta &&
          Object.keys(attachmentsMeta).length
        ) {
          updates.attachments = attachmentsMeta;
        }

        if (rdata.clientSecret) {
          updates.clientSecret = rdata.clientSecret;
        } else if (md.clientSecret) {
          updates.clientSecret = md.clientSecret;
        }

        // service embedding
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
            subcategory:
              serviceDoc.subcategory ||
              serviceDoc.subCategory ||
              "",
            clientPrice: safeNum(
              serviceDoc.clientPrice ??
                serviceDoc.price ??
                amountAED
            ),
            price: safeNum(
              serviceDoc.price ??
                serviceDoc.clientPrice ??
                amountAED
            ),
            printingFee: safeNum(
              serviceDoc.printingFee ??
                printingFeeFromMeta ??
                0
            ),
            tax: safeNum(serviceDoc.tax ?? 0),
            description: serviceDoc.description || "",
            requiredDocuments: Array.isArray(
              serviceDoc.requiredDocuments
            )
              ? serviceDoc.requiredDocuments
              : [],
            active:
              typeof serviceDoc.active === "boolean"
                ? serviceDoc.active
                : true,
            duration: serviceDoc.duration || "",
            profit: safeNum(serviceDoc.profit ?? 0),
            repeatable:
              typeof serviceDoc.repeatable === "boolean"
                ? serviceDoc.repeatable
                : false,
            requireUpload:
              typeof serviceDoc.requireUpload === "boolean"
                ? serviceDoc.requireUpload
                : false,
          };

          updates.service = svc;
          updates.serviceName = svc.name;
          updates.serviceId = svc.serviceId;
          updates.providers = svc.providers;
          updates.printingFee =
            rdata.printingFee ??
            svc.printingFee ??
            printingFeeFromMeta ??
            0;
          updates.requiredDocuments = svc.requiredDocuments;
        } else {
          if (serviceNameFromMeta) updates.serviceName = serviceNameFromMeta;
          if (serviceId) updates.serviceId = serviceId;
        }

        // assignedTo
        updates.assignedTo = rdata.assignedTo || assignedToMeta || "";
        updates.assignedToName =
          rdata.assignedToName || assignedToNameMeta || "";

        tx.update(requestRef, updates);
      } else {
        // create new request
        if (!finalRequestId) {
          finalRequestId = `REQ-${Math.floor(
            100 + Math.random() * 900
          )}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

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
            subcategory:
              serviceDoc.subcategory ||
              serviceDoc.subCategory ||
              "",
            clientPrice: safeNum(
              serviceDoc.clientPrice ??
                serviceDoc.price ??
                amountAED
            ),
            price: safeNum(
              serviceDoc.price ??
                serviceDoc.clientPrice ??
                amountAED
            ),
            printingFee: safeNum(
              serviceDoc.printingFee ??
                printingFeeFromMeta ??
                0
            ),
            tax: safeNum(serviceDoc.tax ?? 0),
            description: serviceDoc.description || "",
            requiredDocuments: Array.isArray(
              serviceDoc.requiredDocuments
            )
              ? serviceDoc.requiredDocuments
              : [],
            active:
              typeof serviceDoc.active === "boolean"
                ? serviceDoc.active
                : true,
            duration: serviceDoc.duration || "",
            profit: safeNum(serviceDoc.profit ?? 0),
            repeatable:
              typeof serviceDoc.repeatable === "boolean"
                ? serviceDoc.repeatable
                : false,
            requireUpload:
              typeof serviceDoc.requireUpload === "boolean"
                ? serviceDoc.requireUpload
                : false,
          };
        }

        const reqObj = {
          requestId: finalRequestId,
          paymentIntentId: paymentIntentId,
          customerId: userRef.id, // ده هو نفس الـ doc id بتاع اليوزر
          serviceId: serviceMap?.serviceId || serviceId || "",
          serviceName: serviceMap?.name || serviceNameFromMeta || "",
          requestType,
          paidAmount: amountAED,
          printingFee:
            serviceMap?.printingFee ??
            printingFeeFromMeta ??
            0,
          coinsGiven,
          coinsUsed,
          createdAt: nowISO(),
          lastUpdated: nowISO(),
          status: "paid",
          paidAt: nowISO(),
          userEmail: uDoc.data().email || "",
          statusHistory: [
            {
              status: "paid",
              timestamp: nowISO(),
              updatedBy: "stripe-webhook",
            },
          ],
          metadata: md || {},
          attachments: attachmentsMeta || {},
          clientSecret: md.clientSecret || null,
          processingFee: processingFeeMeta || 0,
          assignedTo: assignedToMeta || "",
          assignedToName: assignedToNameMeta || "",
          ...(serviceMap
            ? {
                service: serviceMap,
                requiredDocuments:
                  serviceMap.requiredDocuments || [],
              }
            : {}),
        };

        tx.set(db.collection("requests").doc(finalRequestId), reqObj);

        // حدّث الـ refs عشان باقي الكود لو محتاجه
        requestRef = db.collection("requests").doc(finalRequestId);
      }

      // --------------------------------
      // B) WALLET / COINS UPDATE
      // --------------------------------
      if (requestType === "wallet_recharge") {
        const prevWallet = Number(
          uDoc.data().walletBalance ?? uDoc.data().wallet ?? 0
        );
        const newWallet = +(prevWallet + amountAED).toFixed(2);

        tx.update(userRef, {
          walletBalance: newWallet,
          ...(coinsGiven > 0
            ? {
                coins: admin.firestore.FieldValue.increment(
                  coinsGiven
                ),
              }
            : {}),
          lastWalletUpdatedAt:
            admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // خدمة عادية = زوّد coins بس لو فيه bonus
        if (coinsGiven > 0) {
          tx.update(userRef, {
            coins: admin.firestore.FieldValue.increment(coinsGiven),
          });
        }
      }

      // --------------------------------
      // C) TRANSACTION RECORD
      // --------------------------------
      const txRef = db.collection("transactions").doc();
      tx.set(txRef, {
        userId: userRef.id, // نفس الـ customerId
        requestId: finalRequestId,
        amount: amountAED,
        currency: pi.currency || "aed",
        type: "credit",
        status: "succeeded",
        paymentIntentId: paymentIntentId,
        coinsAdded: coinsGiven,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // --------------------------------
      // D) NOTIFICATION
      // --------------------------------
      const notifRef = db.collection("notifications").doc();
      tx.set(notifRef, {
        targetId: userRef.id,
        title: md.lang === "en" ? "Payment Confirmed" : "تم تأكيد الدفع",
        body:
          md.lang === "en"
            ? `Your payment of ${amountAED.toFixed(
                2
              )} AED was received. Order: ${finalRequestId}`
            : `تم استلام دفعتك بقيمة ${amountAED.toFixed(
                2
              )} د.إ الآن. رقم الطلب: ${finalRequestId}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isRead: false,
        metadata: {
          orderId: finalRequestId,
          paymentIntentId,
        },
      });

      // --------------------------------
      // E) MARK AS PROCESSED
      // --------------------------------
      tx.set(processedRef, {
        paymentIntentId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        requestId: finalRequestId,
        amount: amountAED,
      });
    });

    console.log(
      `✅ webhook processed ${paymentIntentId} (AED ${amountAED})`
    );
    return res.json({ received: true });
  } catch (err) {
    if (err.message === "ALREADY_PROCESSED") {
      // في حالة الاتنين استجابوا في نفس اللحظة
      return res.json({ received: true });
    }
    console.error("❌ webhook processing error:", err);
    return res.status(500).send("internal_error");
  }
}
