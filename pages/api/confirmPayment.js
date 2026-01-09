"use strict";

import Stripe from "stripe";
import admin from "firebase-admin";

/**
 * Confirm a Stripe PaymentIntent and sync request to "paid" WITHOUT touching:
 * - stripePaymentsProcessed
 * - companySubscriptions
 * - monthlyTxCredits
 *
 * ✅ Safe alongside webhook:
 * - webhook remains the single writer of processed/subscriptions/monthlyTxCredits/addons carry-over logic.
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { paymentIntentId, requestId: providedRequestId } = req.body || {};
  if (!paymentIntentId) return res.status(400).json({ ok: false, error: "Missing paymentIntentId" });

  try {
    // 1) Retrieve PaymentIntent
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!pi) return res.status(400).json({ ok: false, error: "PaymentIntent not found" });

    if (normLower(pi.status) !== "succeeded") {
      return res.status(400).json({ ok: false, error: "PaymentIntent not succeeded", status: pi.status });
    }

    // 2) Metadata
    const md = pi.metadata || {};
    let reqId = providedRequestId || md.requestId || md.orderNumber || null;

    const amountSmallest = pi.amount_received ?? pi.amount ?? 0;
    const amountAED = Number((amountSmallest / 100).toFixed(2));

    const processingFeeMeta = safeNum(md.processingFee ?? md.processing_fee ?? md.processing_fee_value ?? 0);

    // 3) Find request
    let requestRef = null;
    let requestSnap = null;

    if (reqId) {
      requestRef = db.collection("requests").doc(String(reqId));
      requestSnap = await requestRef.get();
    } else {
      const q = await db.collection("requests").where("paymentIntentId", "==", paymentIntentId).limit(1).get();
      if (!q.empty) {
        requestRef = q.docs[0].ref;
        requestSnap = q.docs[0];
        reqId = requestRef.id;
      }
    }

    if (!requestRef) {
      // لا نعمل processed ولا أي شيء — نخلي الويبهوك يظبط
      return res.status(200).json({ ok: true, warning: "request_not_found", paymentIntentId });
    }

    // 4) If already paid -> ok
    if (requestSnap && requestSnap.exists) {
      const rdata = requestSnap.data() || {};
      if (normLower(rdata.status) === "paid") {
        return res.status(200).json({ ok: true, alreadyPaid: true, orderNumber: requestRef.id, paymentIntentId });
      }
    }

    // 5) Update request to paid (best-effort) — WITHOUT processed
    await db.runTransaction(async (tx) => {
      const r = await tx.get(requestRef);
      if (!r.exists) return;

      const rdata = r.data() || {};
      if (normLower(rdata.status) === "paid") return;

      const history = Array.isArray(rdata.statusHistory) ? [...rdata.statusHistory] : [];
      history.push({ status: "paid", timestamp: nowISO(), updatedBy: "server-confirmPayment" });

      tx.update(requestRef, {
        lastUpdated: nowISO(),
        status: "paid",
        paidAmount: amountAED,
        paidAt: nowISO(),
        paymentIntentId,
        processingFee: typeof rdata.processingFee !== "undefined" ? rdata.processingFee : processingFeeMeta || 0,
        statusHistory: history,
      });
    });

    return res.status(200).json({ ok: true, orderNumber: requestRef.id, paymentIntentId });
  } catch (err) {
    console.error("confirmPayment error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
}
