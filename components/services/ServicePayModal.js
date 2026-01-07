import { useState, useMemo } from "react";
import {
  FaWallet,
  FaCreditCard,
  FaCoins,
  FaCheckCircle,
  FaExclamationCircle,
  FaTimes,
  FaSpinner,
} from "react-icons/fa";
import { firestore } from "@/lib/firebase.client";
import { motion, AnimatePresence } from "framer-motion";
import { doc, setDoc, updateDoc, increment, collection, addDoc, getDoc } from "firebase/firestore";
import { translateText } from "@/utils/translate";
import { useRouter } from "next/navigation";
import calcStripeFees from "@/utils/calcStripeFees";

// دالة توليد رقم تتبع بالشكل المطلوب
function generateOrderNumber() {
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${part1}-${part2}`;
}

// دالة حفظ الطلب في requests بنفس هيكل الصورة
async function saveRequestToFirestore({
  orderNumber,
  customerId,
  assignedTo,
  assignedToName,
  serviceName,
  serviceId,
  providers,
  paidAmount,
  printingFee,
  coinsUsed,
  coinsGiven,
  uploadedDocs,
  status = "completed",
  statusHistory = [],
  // (اختياري) لو حبيت تسجل VAT صريح
  vat = 0,
  processingFee = 0,
}) {
  await setDoc(doc(firestore, "requests", orderNumber), {
    requestId: orderNumber,
    customerId,
    assignedTo,
    assignedToName,
    serviceName,
    serviceId,
    providers,
    paidAmount,       // اللي اتخصم من العميل فعلياً (بعد خصم الكوينات) — *بدون Stripe fee*
    printingFee,
    vat,
    processingFee,
    coinsUsed,
    coinsGiven,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    status,
    attachments: uploadedDocs || {},
    statusHistory,
  });
}

export default function ServicePayModal({
  open,
  onClose,
  serviceName,
  serviceId,
  provider,
  totalPrice,     // قد يكون شامل
  printingFee,
  tax,            // VAT (مربوطة بالطباعة)
  coinsBalance,
  cashbackCoins,
  userWallet,
  lang = "ar",
  customerId,
  userId,
  userEmail,
  uploadedDocs,
  onPaid,
  clientType = "resident",

  // ✅ NEW: لو الشركة عندها اشتراك فعّال
  freePrinting = false,

  assignedTo,
  assignedToName,
}) {
  const [useCoins, setUseCoins] = useState(false);
  const [payMethod, setPayMethod] = useState("wallet");
  const [isPaying, setIsPaying] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [msgSuccess, setMsgSuccess] = useState(false);

  const router = useRouter();

  if (!open) return null;

  // ✅ effective printing fee (subscription => 0 for companies)
  const effectivePrintingFee =
    clientType === "company" && freePrinting ? 0 : (Number(printingFee) || 0);

  // ✅ VAT مرتبط بالطباعة فقط => لو طباعة = 0 يبقى VAT = 0
  const effectiveVat =
    effectivePrintingFee > 0
      ? (typeof tax !== "undefined"
          ? Number(tax) || 0
          : +(effectivePrintingFee * 0.05).toFixed(2))
      : 0;

  /**
   * ✅ استخراج "سعر الخدمة فقط" من totalPrice القديم (اللي غالباً شامل طباعة + VAT)
   * serviceBase = totalPrice - printingFee - oldVat
   * oldVat نحسبه بناءً على printingFee (مش effectivePrintingFee) عشان نفكك totalPrice القديم صح.
   */
  const oldVatFromOldPrinting =
    (Number(printingFee) || 0) > 0
      ? (typeof tax !== "undefined"
          ? Number(tax) || 0
          : +((Number(printingFee) || 0) * 0.05).toFixed(2))
      : 0;

  const serviceBase = useMemo(() => {
    const tp = Number(totalPrice) || 0;
    const pf = Number(printingFee) || 0;
    const base = tp - pf - oldVatFromOldPrinting;
    // حماية لو حصل negative بسبب بيانات قديمة
    return base > 0 ? +base.toFixed(2) : 0;
  }, [totalPrice, printingFee, oldVatFromOldPrinting]);

  // ✅ الإجمالي الصحيح: خدمة + طباعة + VAT
  const effectiveTotalPrice = +(serviceBase + effectivePrintingFee + effectiveVat).toFixed(2);

  // ✅ الكوينات: انت عاملها خصم على printing فقط (10%)
  const maxCoinDiscount = Math.floor(effectivePrintingFee * 0.1 * 100); // بالـ "فلس" (cents)
  const coinDiscount = useCoins ? Math.min(coinsBalance, maxCoinDiscount) : 0;
  const coinDiscountValue = coinDiscount / 100;

  // ✅ السعر بعد خصم الكوينات (قبل Stripe)
  const finalPrice = +(effectiveTotalPrice - coinDiscountValue).toFixed(2);
  const willGetCashback = !useCoins;

  // Stripe
  const stripeFeesResult = calcStripeFees(finalPrice, {
    isInternational: false,
    isCurrencyConversion: false,
  });
  const stripeFeeValue = payMethod === "gateway" ? (stripeFeesResult.stripeFee || 0) : 0;
  const finalPriceWithFees =
    payMethod === "gateway" ? (stripeFeesResult.totalAmount || finalPrice) : finalPrice;

  // دفع المحفظة
  async function handlePayment() {
    setIsPaying(true);
    setPayMsg("");
    setMsgSuccess(false);

    if (!customerId || !userEmail || !serviceName) {
      setPayMsg(lang === "ar" ? "بيانات العميل أو البريد أو الخدمة ناقصة." : "Customer ID, email or service name missing.");
      setIsPaying(false);
      return;
    }

    try {
      if (userWallet < finalPrice) {
        setPayMsg(lang === "ar" ? "رصيد المحفظة غير كافي." : "Insufficient wallet balance.");
        setIsPaying(false);
        return;
      }

      const userRef = doc(firestore, "users", customerId);

      await updateDoc(userRef, { walletBalance: userWallet - finalPrice });

      if (useCoins && coinDiscount > 0) {
        await updateDoc(userRef, { coins: increment(-coinDiscount) });
      }
      if (willGetCashback && cashbackCoins > 0) {
        await updateDoc(userRef, { coins: increment(cashbackCoins) });
      }

      const orderNumber = generateOrderNumber();

      // جلب بيانات الخدمة
      let serviceData = {};
      try {
        const serviceDocRef = doc(firestore, "servicesByClientType", clientType);
        const serviceDocSnap = await getDoc(serviceDocRef);
        if (serviceDocSnap.exists()) {
          const allServices = serviceDocSnap.data();
          serviceData =
            serviceId && allServices[serviceId]
              ? allServices[serviceId]
              : Object.values(allServices).find((s) => s.name === serviceName) || {};
        }
      } catch (e) {
        console.log("خطأ في جلب بيانات الخدمة:", e);
      }

      const originalServiceName = serviceData?.name || serviceName || "";
      const providers = Array.isArray(serviceData?.providers)
        ? serviceData.providers
        : serviceData?.providers
          ? [serviceData.providers]
          : [];

      const statusHistory = [
        { status: "awaiting_payment", timestamp: new Date().toISOString(), updatedBy: assignedToName || "System" },
        { status: "completed",        timestamp: new Date().toISOString(), updatedBy: assignedToName || "System" },
      ];

      await saveRequestToFirestore({
        orderNumber,
        customerId,
        assignedTo: assignedTo || "",
        assignedToName: assignedToName || "",
        serviceName: originalServiceName,
        serviceId: serviceData.serviceId || serviceId || "",
        providers,
        paidAmount: finalPrice,
        printingFee: effectivePrintingFee,
        vat: effectiveVat,
        processingFee: 0,
        coinsUsed: useCoins ? coinDiscountValue : 0,
        coinsGiven: willGetCashback ? cashbackCoins : 0,
        uploadedDocs,
        status: "completed",
        statusHistory,
      });

      await addDoc(collection(firestore, "notifications"), {
        targetId: customerId,
        title: lang === "ar" ? "تم الدفع" : "Payment Successful",
        body:
          lang === "ar"
            ? `دفعت لخدمة ${originalServiceName} بقيمة ${finalPrice.toFixed(2)} د.إ${useCoins ? ` واستخدمت خصم الكوينات (${coinDiscountValue.toFixed(2)} د.إ)` : ""}.\nرقم التتبع: ${orderNumber}`
            : `You paid for ${originalServiceName} (${finalPrice.toFixed(2)} AED${useCoins ? `, using coins discount (${coinDiscountValue.toFixed(2)} AED)` : ""}).\nTracking No.: ${orderNumber}`,
        timestamp: new Date().toISOString(),
        isRead: false,
      });

      await fetch("/api/sendOrderEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: userEmail,
          orderNumber,
          serviceName: originalServiceName,
          price: finalPrice.toFixed(2),
        }),
      });

      setMsgSuccess(true);
      setPayMsg(lang === "ar" ? "تم الدفع بنجاح!" : "Payment successful!");
      if (typeof onPaid === "function") onPaid();
      setTimeout(() => onClose(), 1200);
    } catch (e) {
      console.log("Payment error:", e);
      setPayMsg(lang === "ar" ? "حدث خطأ أثناء الدفع." : "Payment error.");
    } finally {
      setIsPaying(false);
    }
  }

  // دفع بوابة Stripe Elements
  async function handleGatewayPayWithElements() {
    setIsPaying(true);
    setPayMsg("");
    setMsgSuccess(false);

    try {
      const uiServiceName =
        lang === "ar"
          ? serviceName
          : await translateText({
              text: serviceName || "",
              target: "en",
              source: "ar",
              fieldKey: `service:${serviceId || serviceName}:name:en`,
            });

      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalPriceWithFees,     // شامل Stripe Fee
          serviceName: uiServiceName,
          customerId,
          userEmail,
          printingFee: effectivePrintingFee,
          vat: effectiveVat,              // ✅ هنا VAT الصح
        }),
      });

      const result = await response.json();

      if (result.clientSecret) {
        localStorage.setItem(
          "paymentData",
          JSON.stringify({
            clientSecret: result.clientSecret,
            service: {
              name: uiServiceName,
              id: serviceId,
              price: serviceBase,                 // سعر الخدمة فقط
              printingFee: effectivePrintingFee,
              vat: effectiveVat,
              coinDiscount: useCoins ? coinDiscountValue : 0,
              userEmail,
            },
            totalPrice: effectiveTotalPrice,      // (خدمة + طباعة + VAT) قبل Stripe + قبل خصم coins؟ (هنا بعد coins؟ لا)
            finalPrice: finalPriceWithFees,       // النهائي شامل Stripe Fee وبعد خصم coins
            processingFee: stripeFeeValue,
            customerId,
            lang,
            orderNumber: result.orderNumber,
          })
        );

        router.push("/payment/service");
      } else {
        setPayMsg(lang === "ar" ? "تعذر فتح بوابة الدفع." : "Failed to open payment gateway.");
      }
    } catch (e) {
      setPayMsg(lang === "ar" ? "تعذر الاتصال بالخادم." : "Failed to connect to server.");
    } finally {
      setIsPaying(false);
    }
  }

  function onPayClick() {
    if (payMethod === "wallet") handlePayment();
    if (payMethod === "gateway") handleGatewayPayWithElements();
  }

  const payBtnCursor = isPaying ? "wait" : "pointer";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex justify-center items-center bg-gradient-to-br from-black/60 via-emerald-900/60 to-black/60 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gradient-to-br from-white via-emerald-50 to-emerald-100 rounded-3xl shadow-2xl border border-emerald-200 px-6 pt-7 pb-4 max-w-sm w-full relative flex flex-col items-center"
          initial={{ scale: 0.97, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 30 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
        >
          <img
            src="/logo3.png"
            alt="Logo"
            className="mb-2 w-14 h-14 object-contain rounded-full shadow border border-emerald-100"
            draggable={false}
            loading="eager"
          />

          <button
            className="absolute top-3 right-4 bg-emerald-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl shadow hover:bg-emerald-700 transition cursor-pointer"
            onClick={onClose}
            aria-label={lang === "ar" ? "إغلاق" : "Close"}
            style={{ cursor: "pointer" }}
          >
            <FaTimes />
          </button>

          <div className="text-emerald-700 font-black text-lg mb-1 text-center">
            {lang === "ar" ? "دفع الخدمة" : "Service Payment"}
          </div>
          <div className="font-bold text-emerald-900 text-base mb-3 text-center">
            {serviceName}
          </div>

          <table className="w-full text-xs text-gray-700 font-bold mb-2 border-separate border-spacing-y-1">
            <tbody>
              <tr>
                <td>{lang === "ar" ? "سعر الخدمة" : "Service Price"}</td>
                <td className="text-right">{serviceBase.toFixed(2)} د.إ</td>
              </tr>
              <tr>
                <td>{lang === "ar" ? "رسوم الطباعة" : "Printing Fee"}</td>
                <td className="text-right">{effectivePrintingFee.toFixed(2)} د.إ</td>
              </tr>
              <tr>
                <td>{lang === "ar" ? "ضريبة القيمة المضافة 5%" : "VAT 5%"}</td>
                <td className="text-right">{effectiveVat.toFixed(2)} د.إ</td>
              </tr>
              <tr>
                <td className="flex items-center gap-1">
                  <FaCoins className="text-yellow-500 mr-1" size={10} />
                  {lang === "ar" ? "خصم الكوينات" : "Coins Discount"}
                </td>
                <td className="text-right text-yellow-700">
                  {useCoins ? `-${coinDiscountValue.toFixed(2)} د.إ` : "0 د.إ"}
                </td>
              </tr>
              <tr>
                <td>{lang === "ar" ? "الإجمالي قبل الخصم" : "Total Before Discount"}</td>
                <td className="text-right">{effectiveTotalPrice.toFixed(2)} د.إ</td>
              </tr>
              <tr>
                <td>{lang === "ar" ? "رسوم معالجة الدفع الإلكتروني" : "Processing Fee"}</td>
                <td className="text-right">
                  {payMethod === "gateway" ? stripeFeeValue.toFixed(2) : "0.00"} د.إ
                </td>
              </tr>
              <tr>
                <td className="font-extrabold text-emerald-700">
                  {lang === "ar" ? "السعر النهائي" : "Final"}
                </td>
                <td className="font-extrabold text-emerald-800 text-right">
                  {finalPriceWithFees.toFixed(2)} د.إ
                </td>
              </tr>
            </tbody>
          </table>

          <div className="w-full flex flex-row items-center justify-between mb-1">
            <label className="flex items-center gap-1 font-bold text-xs text-emerald-700 cursor-pointer">
              <input
                type="checkbox"
                checked={useCoins}
                onChange={(e) => setUseCoins(e.target.checked)}
                disabled={coinsBalance < 1 || effectivePrintingFee <= 0} // ✅ منطقي: مفيش طباعة => مفيش خصم coins
                className="accent-yellow-500 scale-90"
                style={{ marginTop: 0 }}
              />
              <FaCoins className="text-yellow-500" size={12} />
              {lang === "ar" ? "استخدم الكوينات (خصم حتى 10%)" : "Use coins (up to 10%)"}
            </label>
            <span className="font-black text-yellow-700 text-xs">
              {lang === "ar" ? "رصيدك:" : "Your coins:"} {coinsBalance}
            </span>
          </div>

          <div className="w-full flex flex-row items-center justify-between mb-1">
            <label className={`flex items-center gap-1 font-bold text-emerald-800 text-xs cursor-pointer ${userWallet < finalPrice ? "opacity-60" : ""}`}>
              <input
                type="radio"
                checked={payMethod === "wallet"}
                onChange={() => setPayMethod("wallet")}
                disabled={userWallet < finalPrice}
                className="accent-emerald-600 scale-90"
                style={{ marginTop: 0 }}
              />
              <FaWallet className="text-emerald-600" size={12} />
              {lang === "ar" ? "المحفظة" : "Wallet"}
              <span className="text-gray-600 font-bold ml-2">{userWallet} د.إ</span>
            </label>

            <label className="flex items-center gap-1 font-bold text-emerald-800 text-xs cursor-pointer">
              <input
                type="radio"
                checked={payMethod === "gateway"}
                onChange={() => setPayMethod("gateway")}
                className="accent-emerald-600 scale-90"
                style={{ marginTop: 0 }}
              />
              <FaCreditCard className="text-emerald-600" size={12} />
              {lang === "ar" ? "بوابة الدفع" : "Gateway"}
            </label>
          </div>

          <div className="w-full mb-1 text-center">
            {!useCoins ? (
              <div className="flex flex-row items-center justify-center gap-1 text-yellow-700 font-bold text-xs">
                <FaCoins className="text-yellow-500" size={12} />
                {lang === "ar"
                  ? `ستحصل على ${cashbackCoins} كوين مكافأة`
                  : `You'll get ${cashbackCoins} coins cashback`}
              </div>
            ) : (
              <div className="text-gray-500 text-xs font-bold">
                {lang === "ar" ? "لا مكافأة عند استخدام الكوينات" : "No cashback if you use coins"}
              </div>
            )}
          </div>

          <button
            onClick={onPayClick}
            disabled={isPaying}
            className={`w-full py-2 rounded-full font-black text-base shadow-lg transition
              bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 text-white
              hover:from-emerald-600 hover:to-emerald-500 hover:shadow-emerald-200/90
              hover:scale-105 duration-150
              focus:outline-none focus:ring-2 focus:ring-emerald-400
              ${isPaying ? "opacity-40" : ""}
            `}
            style={{ cursor: payBtnCursor }}
          >
            {isPaying ? (
              <span className="flex items-center justify-center gap-2 text-xs">
                <FaSpinner className="animate-spin" />
                {lang === "ar" ? "جاري الدفع..." : "Processing..."}
              </span>
            ) : (
              <span>
                {lang === "ar"
                  ? `دفع الآن (${finalPriceWithFees.toFixed(2)} د.إ)`
                  : `Pay Now (${finalPriceWithFees.toFixed(2)} AED)`}
              </span>
            )}
          </button>

          {payMsg && (
            <div className={`mt-2 text-center font-bold text-xs flex flex-row items-center justify-center gap-1 ${msgSuccess ? "text-emerald-700" : "text-red-600"}`}>
              {msgSuccess ? <FaCheckCircle className="text-emerald-500" size={16} /> : <FaExclamationCircle className="text-red-400" size={14} />}
              <span>{payMsg}</span>
            </div>
          )}

          <div className="w-full text-center mt-5 mb-1 flex flex-col items-center gap-1">
            <div className="text-xs text-emerald-700 font-semibold flex items-center justify-center">
              <FaCheckCircle className="inline mr-2 text-emerald-500" />
              {lang === "ar"
                ? "جميع بياناتك مشفرة وآمنة ويتم حفظها بسرية تامة."
                : "All your data is encrypted and securely stored."}
            </div>
          </div>

          <div className="absolute -bottom-6 right-0 left-0 w-full h-7 bg-gradient-to-t from-emerald-200/70 via-white/20 to-transparent blur-2xl opacity-80 pointer-events-none"></div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
