// Updated createPaymentIntent handler — creates PaymentIntent with detailed metadata
// and always creates a 'request' document (requestType indicates wallet_recharge vs service).
// Paste in your backend and mount route as you do (e.g., app.use('/api/pay', require('./routes/createPaymentIntent')))

import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// تهيئة Firebase Admin مرة واحدة فقط
let firestore;
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  initializeApp({ credential: cert(serviceAccount) });
  firestore = getFirestore();
} else {
  firestore = getFirestore();
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

function generateOrderNumber() {
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${part1}-${part2}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    amount,
    serviceId,
    serviceName,
    customerId,
    userEmail,
    attachments = {},
    providers = [],
    coinsUsed = 0,
    coinsGiven = 0,
    printingFee = 0,
    assignedTo = "",
    assignedToName = "",
    status = "pending",
    employeeData = {},
    lang = "ar",
  } = req.body;

  if (!amount || !serviceName || !customerId || !userEmail) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const requestId = generateOrderNumber();

    // تعيين نوع الطلب لسهولة المعالجة في الـ webhook
    const requestType = (serviceId === "wallet-recharge" || serviceName === "شحن المحفظة" || String(serviceName).toLowerCase().includes("wallet"))
      ? "wallet_recharge"
      : "service";

    // أنشئ PaymentIntent مع metadata كاملة (مهمة للـ webhook)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100), // amount بالـ AED -> fils
      currency: 'aed',
      receipt_email: userEmail,
      metadata: {
        requestId,
        customerId,
        serviceId: serviceId || "",
        serviceName,
        coinsUsed: String(coinsUsed || 0),
        coinsGiven: String(coinsGiven || 0),
        printingFee: String(printingFee || 0),
        requestType,
        assignedTo: assignedTo || "",
        assignedToName: assignedToName || "",
        lang: String(lang || "ar"),
      },
      description: `دفع خدمة ${serviceName}`,
    });

    // أنشئ doc الطلب (بغض النظر إن كانت شحن محفظة أم خدمة) — status يبقى pending حتى يكتمل الدفع
    const requestDoc = {
      requestId,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      customerId,
      serviceId: serviceId || "",
      serviceName,
      requestType,
      paidAmount: Number(amount), // المبلغ الأساسي (قبل خصم/إضافة معالجة)
      printingFee,
      coinsUsed,
      coinsGiven,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status,
      userEmail,
      attachments,
      providers,
      assignedTo,
      assignedToName,
      employeeData,
      lang,
      statusHistory: [
        {
          status,
          timestamp: new Date().toISOString(),
          updatedBy: assignedToName || userEmail || "system"
        }
      ]
    };

    await firestore.collection("requests").doc(requestId).set(requestDoc);

    // أرجع clientSecret و رقم الطلب (واجهة العميل ستستخدم clientSecret لتأكيد البطاقة)
    res.status(200).json({ clientSecret: paymentIntent.client_secret, orderNumber: requestId, paymentIntentId: paymentIntent.id });
  } catch (error) {
    console.error("createPaymentIntent error:", error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}