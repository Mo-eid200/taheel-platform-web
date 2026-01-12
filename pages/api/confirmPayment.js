"use strict";

import Stripe from "stripe";
import admin from "firebase-admin";

/**
 * Confirm Stripe PaymentIntent succeeded, then mark request as "paid".
 * 🚫 Does NOT touch:
 * - stripePaymentsProcessed
 * - companySubscriptions
 * - users.monthlyTxCredits
 * ✅ Webhook remains single-writer for credits/subscriptions/carry-over.
 */

if (!admin.apps.length) {
  try {
    const sa = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : null;
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

    const piStatus = normLower(pi.status);
    if (piStatus !== "succeeded") {
      return res.status(400).json({ ok: false, error: "PaymentIntent not succeeded", status: pi.status });
    }

    // 2) Amount received
    const amountSmallest = safeNum(pi.amount_received ?? pi.amount ?? 0);
    const amountAED = Number((amountSmallest / 100).toFixed(2));

    // 3) Resolve request id
    const md = pi.metadata || {};
    let reqId = providedRequestId || md.requestId || md.orderNumber || null;

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
      // webhook will still handle credits/subscriptions; we do nothing else
      return res.status(200).json({ ok: true, warning: "request_not_found", paymentIntentId });
    }

    if (requestSnap && requestSnap.exists) {
      const rdata = requestSnap.data() || {};
      if (normLower(rdata.status) === "paid") {
        return res.status(200).json({ ok: true, alreadyPaid: true, orderNumber: requestRef.id, paymentIntentId });
      }
    }

    // 4) Transactional update -> paid
    await db.runTransaction(async (tx) => {
      const r = await tx.get(requestRef);
      if (!r.exists) return;

      const rdata = r.data() || {};
      if (normLower(rdata.status) === "paid") return;

      const history = Array.isArray(rdata.statusHistory) ? [...rdata.statusHistory] : [];
      history.push({ status: "paid", timestamp: nowISO(), updatedBy: "server-confirmPayment" });

      // DO NOT overwrite requestType if it already exists
      const existingType = normLower(rdata.requestType || "");
      const mdType = normLower(md.requestType || "");
      const finalType = existingType || mdType || "service";

      // Only enrich addon/subscription fields if request already is that type OR metadata explicitly indicates it
      const addonKey = safeStr(md.addonKey || "").trim();
      const addonQty = safeNum(md.addonQty || 0);
      const planKey = safeStr(md.planKey || "").trim();
      const pricingKey = safeStr(md.pricingKey || "").trim();

      const updates = {
        lastUpdated: nowISO(),
        status: "paid",
        paidAmount: amountAED,
        paidAt: nowISO(),
        paymentIntentId,
        statusHistory: history,
        requestType: finalType,
      };

      // keep processingFee from request if exists, else fallback metadata
      if (typeof rdata.processingFee === "undefined") {
        updates.processingFee = safeNum(md.processingFee ?? 0);
      }

      if (finalType === "addon" && addonKey) {
        updates.addon = {
          ...(typeof rdata.addon === "object" && rdata.addon ? rdata.addon : {}),
          addonKey,
          qty: addonQty,
        };
      }

      if (finalType === "subscription" && planKey) {
        updates.subscriptionMeta = {
          ...(typeof rdata.subscriptionMeta === "object" && rdata.subscriptionMeta ? rdata.subscriptionMeta : {}),
          planKey,
          pricingKey,
          monthlyIncludedTxLimit: safeNum(md.monthlyIncludedTxLimit ?? 0),
        };
      }

      tx.update(requestRef, updates);
    });

    return res.status(200).json({ ok: true, orderNumber: requestRef.id, paymentIntentId });
  } catch (err) {
    console.error("confirmPayment error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "internal_error" });
  }
}
