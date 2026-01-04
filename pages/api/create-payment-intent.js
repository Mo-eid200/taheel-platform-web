// /api/createPaymentIntent.js (أو route مشابه)
import Stripe from "stripe";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// تهيئة Firebase Admin مرة واحدة
let firestore;
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  initializeApp({ credential: cert(serviceAccount) });
  firestore = getFirestore();
} else {
  firestore = getFirestore();
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

// نولّد رقم طلب شبه "REQ-123-4567"
function generateOrderNumber() {
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${part1}-${part2}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const {
    amount,            // رقم عادي بالدرهم (مثلاً 250.00)
    serviceId,         // ID الخدمة
    serviceName,       // اسم الخدمة (عربي/إنجليزي أو حسب اللغة)
    customerId,        // IMPORTANT: نفس الـ document ID في users
    userEmail,
    clientType,        // "resident" | "nonresident" | "company" | "other"
    attachments = {},  // مستندات مرفوعة قبل الدفع (جواز/إقامة/الخ...)
    providers = [],    // مزود الخدمة الداخلي (اختياري)
    coinsUsed = 0,
    coinsGiven = 0,
    printingFee = 0,
    processingFee = 0, // رسوم خدمة/بوابة لو فيه
    assignedTo = "",   // uid الموظف أو كوده
    assignedToName = "",
    status = "pending", // الطلب لسه مش مدفوع
    employeeData = {},  // معلومات الموظف اللي استلم الطلب (للأدمن)
    lang = "ar",        // "ar" | "en"

    // ✅ ADD (Subscriptions - optional)
    planKey = "",
    pricingKey = "",
    monthsShown = 0,
    paidMonths = 0,
    bonus = 0,
  } = req.body || {};

  // validations الأساسية
  if (
    !amount ||
    !serviceName ||
    !customerId ||
    !userEmail
  ) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    // هنبدأ دايمًا بإنشاء requestId بنفس الاستايل بتاعنا
    const requestId = generateOrderNumber();

    // ✅ ADD (Detect subscription)
const isSubscription =
  String(serviceId || "").startsWith("sub_") ||
  String(serviceId || "").startsWith("subscription_") ||
  String(serviceId || "").startsWith("subscription-") || // ✅ add this
  String(serviceName || "").toLowerCase().includes("subscription") ||
  String(serviceName || "").includes("اشتراك") ||
  String(planKey || "").trim().length > 0;


    // لو الخدمة دي عبارة عن شحن محفظة أو "Wallet Recharge"
    const requestType =
      serviceId === "wallet-recharge" ||
      serviceName === "شحن المحفظة" ||
      String(serviceName).toLowerCase().includes("wallet")
        ? "wallet_recharge"
        : isSubscription
          ? "subscription" // ✅ ADD
          : "service";

    // مهم: الويب هوك و confirmPayment بيعتمدوا على الـ metadata اللي بنبعتها هنا
    // علشان يربطوا العملية باليوزر والطلب ويكملوا التحديث
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100), // بالـ fils
      currency: "aed",
      receipt_email: userEmail,
      metadata: {
        requestId,               // لازم
        customerId,              // لازم - هو نفسه ID جوه users
        serviceId: serviceId || "",
        serviceName,
        clientType: clientType || "",

        requestType,             // "wallet_recharge" | "service" | "subscription" ✅

        coinsUsed: String(coinsUsed || 0),
        coinsGiven: String(coinsGiven || 0),

        printingFee: String(printingFee || 0),
        processingFee: String(processingFee || 0),

        assignedTo: assignedTo || "",
        assignedToName: assignedToName || "",

        lang: String(lang || "ar"),

        // مفيد للـ admin/debug
        amount: String(amount),
        currency: "AED",
        userEmail: String(userEmail || ""),

        // نخزن الـ attachments INLINE كـ stringified json
        // علشان لو العميل قفل الابليكيشن بعد الدفع مباشرة، الويب هوك يقدر يحفظ الملفات جوه الطلب
        attachments: JSON.stringify(attachments || {}),

        // معلومة اختيارية: نحتفظ بـ providers
        providers: JSON.stringify(providers || []),

        // ممكن تحط أي بيانات تخص الـ employee اللي استلم الطلب وقت الإنشاء
        employeeData: JSON.stringify(employeeData || {}),

        // ✅ ADD (Subscriptions metadata - optional)
        planKey: String(planKey || ""),
        pricingKey: String(pricingKey || ""),
        monthsShown: String(monthsShown || 0),
        paidMonths: String(paidMonths || 0),
        bonus: String(bonus || 0),
      },
      description:
        lang === "en"
          ? `Payment for service ${serviceName}`
          : `دفع خدمة ${serviceName}`,
    });

    // الطلب نفسه لازم يدخل Firestore من دلوقتي كـ draft/pending
    // عشان نقدر نعرضه للموظف حتى قبل الدفع النهائي
    // و confirmPayment / webhook هيكمّلوا عليه
    const nowIso = new Date().toISOString();

    const requestDoc = {
      requestId,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,

      customerId, // ده نفس ID بتاع document في users
      serviceId: serviceId || "",
      serviceName,
      requestType, // "wallet_recharge" / "service" / "subscription" ✅

      paidAmount: Number(amount), // المبلغ المتوقع
      printingFee: Number(printingFee) || 0,
      processingFee: Number(processingFee) || 0,

      coinsUsed: Number(coinsUsed) || 0,
      coinsGiven: Number(coinsGiven) || 0,

      createdAt: nowIso,
      lastUpdated: nowIso,
      status, // "pending" في البداية - لسه مش "paid"
      paidAt: null, // لسه

      userEmail,

      // مهم جداً: attachments اللي عند العميل وقت ما ضغط دفع
      attachments, // object { passport: {...}, eidFront: {...}, ... }

      providers, // array of providers / channels اللي هتنفذ الخدمة

      assignedTo,
      assignedToName,

      employeeData, // معلومات الموظف اللي استلم الطلب (لو applicable)

      lang,

      // ✅ ADD (Subscriptions fields - optional)
      planKey: planKey || "",
      pricingKey: pricingKey || "",
      monthsShown: Number(monthsShown) || 0,
      paidMonths: Number(paidMonths) || 0,
      bonus: Number(bonus) || 0,

      statusHistory: [
        {
          status,
          timestamp: nowIso,
          updatedBy: assignedToName || userEmail || "system",
        },
      ],
    };

    await firestore.collection("requests").doc(requestId).set(requestDoc);

    // الرد اللي هنرجعه للفرونت:
    // - clientSecret: علشان Stripe confirm card من الموبايل / الويب
    // - orderNumber/requestId: علشان نعرضه للعميل ونعمل tracking
    // - paymentIntentId: مهم لو حصل retry
    return res.status(200).json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      orderNumber: requestId,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("createPaymentIntent error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Internal server error" });
  }
}
