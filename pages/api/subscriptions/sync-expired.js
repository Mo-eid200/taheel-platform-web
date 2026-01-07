// pages/api/subscriptions/sync-expired.js
"use strict";
import admin from "firebase-admin";

if (!admin.apps.length) {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : null;
  if (sa?.private_key) {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  // حماية بسيطة
  const token = req.headers["x-cron-token"];
  if (!process.env.CRON_TOKEN || token !== process.env.CRON_TOKEN) {
    return res.status(401).send("unauthorized");
  }

  const now = admin.firestore.Timestamp.now();

  // هات اللي isActive=true و endAt <= now
  const q = await db
    .collection("companySubscriptions")
    .where("isActive", "==", true)
    .where("endAt", "<=", now)
    .limit(500)
    .get();

  if (q.empty) return res.json({ ok: true, updated: 0 });

  const batch = db.batch();
  q.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      isActive: false,
      status: "expired",
      "computed.isExpired": true,
      "computed.isActiveNow": false,
      "computed.expiredAtISO": new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
  return res.json({ ok: true, updated: q.size });
}
