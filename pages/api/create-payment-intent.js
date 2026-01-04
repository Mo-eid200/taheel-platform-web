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

/**
 * ✅ حساب رسوم Stripe (processingFee) على السيرفر
 * خليها قابلة للتعديل من env:
 * STRIPE_FEE_PERCENT مثلا: 0.029
 * STRIPE_FEE_FIXED_AED مثلا: 1.0
 */
function calcStripeFeeAED(baseAmountAED, options = {}) {
  const percent = Number(process.env.STRIPE_FEE_PERCENT ?? 0.029); // 2.9%
  const fixed = Number(process.env.STRIPE_FEE_FIXED_AED ?? 1.0); // 1 AED

  const isInternational = !!options.isInternational;
  const isCurrencyConversion = !!options.isCurrencyConversion;

  const intlFee = isInternational ? baseAmountAED * 0.01 : 0;
  const currencyFee = isCurrencyConversion ? baseAmountAED * 0.01 : 0;

  const fee = baseAmountAED * percent + fixed + intlFee + currencyFee;
  return Math.round(fee * 100) / 100; // 2 decimals
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const {
    amount, // رقم عادي بالدرهم (مثلاً 250.00) = قيمة الخدمة/الاشتراك فقط
    serviceId,
    serviceName,
    customerId,
    userEmail,
    clientType, // "resident" | "nonresident" | "company" | "other"
    attachments = {},
    providers = [],
    coinsUsed = 0,
    coinsGiven = 0,
    printingFee = 0,

    // ⚠️ processingFee من الفرونت هنحترمه للخدمات العادية زي ما هو (منطق قديم)
    // أما للاشتراك هنحسبه سيرفر ونتجاهل القادم
    processingFee = 0,

    assignedTo = "",
    assignedToName = "",
    status = "pending",
    employeeData = {},
    lang = "ar",

    // ✅ Subscriptions (optional)
    planKey = "",
    pricingKey = "",
    monthsShown = 0,
    paidMonths = 0,
    bonus = 0,

    // ✅ مدة الاشتراك بالأيام (لو الفرونت بعتها)
    subscriptionDays = 0,
    subscriptionName = "",

    // ✅ اختياري: لو عايز تحسب رسوم إضافية
    isInternational = false,
    isCurrencyConversion = false,

    // ✅ لو عندك vat/coinDiscount موجودين في منطقك القديم (لو مش بتبعتهم، هيفضلوا 0)
    vat = 0,
    coinDiscount = 0,
  } = req.body || {};

  const baseAmount = Number(amount);

  // validations الأساسية (كما هي)
  if (!baseAmount || baseAmount <= 0 || !serviceName || !customerId || !userEmail) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const requestId = generateOrderNumber();

    // ✅ Detect subscription (موسع + صحيح)
    const isSubscription =
      String(serviceId || "").startsWith("sub_") ||
      String(serviceId || "").startsWith("subscription_") ||
      String(serviceId || "").startsWith("subscription-") ||
      String(serviceName || "").toLowerCase().includes("subscription") ||
      String(serviceName || "").includes("اشتراك") ||
      String(planKey || "").trim().length > 0;

    // ✅ منطق الشحن كما هو
    const isWallet =
      serviceId === "wallet-recharge" ||
      serviceName === "شحن المحفظة" ||
      String(serviceName || "").toLowerCase().includes("wallet");

    // ✅ requestType كما هو لكن مع الاشتراك
    const requestType = isWallet ? "wallet_recharge" : isSubscription ? "subscription" : "service";

    /**
     * ==========================
     * ✅ الحفاظ على المنطق القديم للخدمات + الشحن
     * ==========================
     *
     * - service / wallet_recharge: لا نغير طريقة الحساب (processingFee, vat, coins, printingFee...) كما يجي من الفرونت
     * - subscription: نحولها لمنطق خاص:
     *      العميل يدفع: baseAmount + StripeFee فقط
     *      (printingFee/vat/coinDiscount/coinsUsed/coinsGiven = 0)
     */

    // القيم القديمة (كما تأتي) للخدمات/الشحن
    const oldPrintingFee = Number(printingFee || 0);
    const oldProcessingFee = Number(processingFee || 0);
    const oldVat = Number(vat || 0);
    const oldCoinDiscount = Number(coinDiscount || 0);
    const oldCoinsUsed = Number(coinsUsed || 0);
    const oldCoinsGiven = Number(coinsGiven || 0);

    // ✅ قيم الاشتراك (تتطبق فقط لو isSubscription)
    const subStripeFee = calcStripeFeeAED(baseAmount, { isInternational, isCurrencyConversion });

    // ✅ اختار القيم النهائية بناءً على النوع بدون ما نبوّظ القديم
    const safePrintingFee = isSubscription ? 0 : oldPrintingFee;
    const safeVat = isSubscription ? 0 : oldVat;
    const safeCoinDiscount = isSubscription ? 0 : oldCoinDiscount;

    // processingFee:
    // - اشتراك: StripeFee محسوبة سيرفر
    // - غير ذلك: processingFee القديم كما هو
    const safeProcessingFee = isSubscription ? subStripeFee : oldProcessingFee;

    // coins:
    const safeCoinsUsed = isSubscription ? 0 : oldCoinsUsed;
    const safeCoinsGiven = isSubscription ? 0 : oldCoinsGiven;

    // ✅ إجمالي قبل الخصم
    // - اشتراك: baseAmount (لا VAT/printing/coins)
    // - قديم: (baseAmount + printing + vat) - coinDiscount  (لو منطقك كان مختلف، غيّره هنا فقط)
    const totalBeforeDiscount = isSubscription
      ? baseAmount
      : Math.round((baseAmount + safePrintingFee + safeVat - safeCoinDiscount) * 100) / 100;

    // ✅ finalPrice = totalBeforeDiscount + processingFee (في الاشتراك processingFee = StripeFee)
    const finalPrice = Math.round((totalBeforeDiscount + safeProcessingFee) * 100) / 100;

    // ✅ المبلغ الذي سيخصم فعلياً في Stripe = finalPrice
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(finalPrice) * 100), // fils
      currency: "aed",
      receipt_email: userEmail,
      metadata: {
        requestId,
        customerId,
        serviceId: serviceId || "",
        serviceName,
        clientType: clientType || "",
        requestType,

        // ✅ مبالغ واضحة (لا تكسر القديم)
        baseAmount: String(baseAmount),
        printingFee: String(safePrintingFee || 0),
        vat: String(safeVat || 0),
        coinDiscount: String(safeCoinDiscount || 0),
        processingFee: String(safeProcessingFee || 0),
        totalBeforeDiscount: String(totalBeforeDiscount || 0),
        finalPrice: String(finalPrice || 0),

        coinsUsed: String(safeCoinsUsed || 0),
        coinsGiven: String(safeCoinsGiven || 0),

        assignedTo: assignedTo || "",
        assignedToName: assignedToName || "",
        lang: String(lang || "ar"),
        userEmail: String(userEmail || ""),
        currency: "AED",

        attachments: JSON.stringify(attachments || {}),
        providers: JSON.stringify(providers || []),
        employeeData: JSON.stringify(employeeData || {}),

        // ✅ Subscriptions
        planKey: String(planKey || ""),
        pricingKey: String(pricingKey || ""),
        monthsShown: String(monthsShown || 0),
        paidMonths: String(paidMonths || 0),
        bonus: String(bonus || 0),
        subscriptionDays: String(subscriptionDays || 0),
        subscriptionName: String(subscriptionName || ""),
      },
      description:
        lang === "en"
          ? `Payment for ${requestType} ${serviceName}`
          : `دفع ${requestType === "subscription" ? "اشتراك" : "خدمة"} ${serviceName}`,
    });

    const nowIso = new Date().toISOString();

    // ✅ لا نغيّر أسماء الحقول القديمة، فقط نضيف حقول واضحة + نحافظ على paidAmount
    const requestDoc = {
      requestId,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,

      customerId,
      serviceId: serviceId || "",
      serviceName,
      requestType,

      // ✅ القديم كان عندك paidAmount = amount
      // دلوقتي نخلي paidAmount = finalPrice لأن ده اللي هيتخصم فعلاً (آمن لكل الأنواع)
      paidAmount: Number(finalPrice) || 0,

      // ✅ نحافظ على الحقول المعروفة (printingFee/processingFee/coins...) بالقيم الصحيحة
      printingFee: Number(safePrintingFee) || 0,
      processingFee: Number(safeProcessingFee) || 0,
      vat: Number(safeVat) || 0,
      coinDiscount: Number(safeCoinDiscount) || 0,

      coinsUsed: Number(safeCoinsUsed) || 0,
      coinsGiven: Number(safeCoinsGiven) || 0,

      // ✅ إضافات غير كاسرة (مفيدة للـ UI/Reports)
      baseAmount: Number(baseAmount) || 0,
      totalBeforeDiscount: Number(totalBeforeDiscount) || 0,
      finalPrice: Number(finalPrice) || 0,

      createdAt: nowIso,
      lastUpdated: nowIso,
      status,
      paidAt: null,

      userEmail,
      attachments,
      providers,
      assignedTo,
      assignedToName,
      employeeData,
      lang,

      // ✅ Subscriptions fields (اختياري)
      planKey: planKey || "",
      pricingKey: pricingKey || "",
      monthsShown: Number(monthsShown) || 0,
      paidMonths: Number(paidMonths) || 0,
      bonus: Number(bonus) || 0,
      subscriptionDays: Number(subscriptionDays) || 0,
      subscriptionName: subscriptionName || "",

      statusHistory: [
        {
          status,
          timestamp: nowIso,
          updatedBy: assignedToName || userEmail || "system",
        },
      ],
    };

    await firestore.collection("requests").doc(requestId).set(requestDoc);

    // ✅ رجّع للفرونت قيم UI بدون كسر القديم (نفس أسماءك)
    return res.status(200).json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      orderNumber: requestId,
      paymentIntentId: paymentIntent.id,

      // ✅ UI fields
      processingFee: Number(safeProcessingFee) || 0,
      finalPrice: Number(finalPrice) || 0,
      totalPrice: Number(totalBeforeDiscount) || 0,

      // ✅ إضافي (مش لازم تستخدمه)
      baseAmount: Number(baseAmount) || 0,
      requestType,
    });
  } catch (error) {
    console.error("createPaymentIntent error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
