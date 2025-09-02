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

// Stripe secret key من متغيرات البيئة
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    assignedTo = "",       // معرف الموظف لو الطلب من الموظف
    assignedToName = "",   // اسم الموظف
    status = "pending",    // الحالة الابتدائية
    employeeData = {},     // بيانات الموظف الإضافية إذا احتجت
  } = req.body;

  if (!amount || !serviceName || !customerId || !userEmail) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const requestId = generateOrderNumber();

    // Stripe PaymentIntent (لـ Stripe Elements)
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount * 100),
  currency: 'aed',
  receipt_email: userEmail,
  metadata: { requestId, customerId, serviceId: serviceId || "", serviceName },
  description: `دفع خدمة ${serviceName}`,
});

// تحقق هل العملية شحن محفظة؟
const isWalletRecharge = 
  serviceId === "wallet-recharge" ||
  serviceName === "شحن المحفظة" ||
  serviceName.toLowerCase().includes("wallet");

// سجل الطلب فقط لو ليست شحن محفظة
if (!isWalletRecharge) {
  await firestore.collection("requests").doc(requestId).set({
    requestId,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    customerId,
    serviceId: serviceId || "",
    serviceName,
    paidAmount: amount,
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
    statusHistory: [
      {
        status,
        timestamp: new Date().toISOString(),
        updatedBy: assignedToName || userEmail || "system"
      }
    ]
  });
}

// أرجع clientSecret ورقم الطلب للواجهة
res.status(200).json({ clientSecret: paymentIntent.client_secret, orderNumber: requestId });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}