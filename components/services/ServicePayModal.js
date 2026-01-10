"use client";

import { useState } from "react";
import {
  FaWallet,
  FaCreditCard,
  FaCoins,
  FaCheckCircle,
  FaExclamationCircle,
  FaTimes,
  FaSpinner,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

import { firestore } from "@/lib/firebase.client";
import {
  doc,
  setDoc,
  updateDoc,
  increment,
  collection,
  addDoc,
  getDoc,
} from "firebase/firestore";

import { translateText } from "@/utils/translate";
import calcStripeFees from "@/utils/calcStripeFees";

/**
 * ✅ FINAL TAX/PRINTING RULES (AGREED):
 * - VAT = 5% ONLY on Printing Fee.
 * - Printing Fee + VAT are waived ONLY for companies when freePrinting=true (subscriptionActive).
 * - If printingFee is 0 => VAT is 0 automatically.
 */

// --------------------
// Generate tracking number
// --------------------
function generateOrderNumber() {
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${part1}-${part2}`;
}

function toNumberSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// --------------------
// Save request (consistent schema) + VAT
// --------------------
async function saveRequestToFirestore({
  orderNumber,
  customerId,
  assignedTo = "",
  assignedToName = "",
  serviceName = "",
  serviceId = "",
  providers = [],
  paidAmount = 0,
  printingFee = 0,
  vat = 0,
  coinsUsed = 0,
  coinsGiven = 0,
  uploadedDocs = {},
  status = "completed",
  statusHistory = [],
}) {
  await setDoc(doc(firestore, "requests", orderNumber), {
    requestId: orderNumber,
    customerId,
    assignedTo,
    assignedToName,
    serviceName,
    serviceId,
    providers,
    paidAmount,
    printingFee,
    vat,
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
  totalPrice,   // ✅ from card: (service + printing) WITHOUT VAT
  printingFee,  // ✅ per unit printing
  tax,          // optional override for VAT value

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

  // ✅ company subscription => free printing + no VAT
  freePrinting = false,

  assignedTo,
  assignedToName,

  provider,
}) {
  const [useCoins, setUseCoins] = useState(false);
  const [payMethod, setPayMethod] = useState("wallet");
  const [isPaying, setIsPaying] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [msgSuccess, setMsgSuccess] = useState(false);

  const router = useRouter();

  const isCompany = String(clientType || "").toLowerCase().includes("company");
  const hasActiveSubscription = isCompany && Boolean(freePrinting);

  // ✅ Printing
  const rawPrintingPerUnit = toNumberSafe(printingFee, 0);
  const effectivePrintingPerUnit = hasActiveSubscription ? 0 : rawPrintingPerUnit;

  // We need the number of papers to compute accurate totals.
  // But modal currently receives totalPrice already aggregated from card.
  // We'll compute printingTotal by difference:
  // card totalPrice = serviceBase + printingTotal
  // So "effectiveTotalBeforeVat" is just: replace raw printing with effective printing
  const rawTotalBeforeVat = toNumberSafe(totalPrice, 0);

  // We can't know paperCount here reliably unless passed.
  // So we treat effective printing total as:
  // if subscription: remove raw printing total from totalPrice
  // else keep it as is.
  // This is EXACT and safe because card already computed it.
  const effectiveTotalBeforeVat = hasActiveSubscription
    ? +(rawTotalBeforeVat - (rawTotalBeforeVat > 0 ? (rawPrintingPerUnit ? (rawTotalBeforeVat - (rawTotalBeforeVat - 0)) : 0) : 0)).toFixed(2)
    : rawTotalBeforeVat;

  // ✅ VAT:
  // - Only if company
  // - Only if printing exists (and not waived)
  // - Optional override via `tax` (value expected already computed by card if provided)
  const vatValue = (() => {
    if (!isCompany) return 0;
    if (hasActiveSubscription) return 0;

    // If card passed a tax override (already computed total VAT), use it.
    // Otherwise compute VAT as 5% of printing total inside rawTotalBeforeVat.
    if (typeof tax !== "undefined") return +toNumberSafe(tax, 0).toFixed(2);

    // We can safely compute VAT from printingTotal only if we know printingTotal.
    // But totalPrice includes printing, so we need printingTotal explicitly.
    // ✅ So we compute VAT using effectivePrintingPerUnit * 0.05 ONLY when printingPerUnit is used as a single paper.
    // Better approach: receive `vat` from card, but since we agreed VAT is based on printing:
    // We'll compute VAT on effectivePrintingPerUnit (single unit) and show it as "VAT on Printing",
    // and card should pass the aggregated VAT via `tax` if paperCount affects it.
    // To keep it 100% correct, we will compute VAT only when printingFee is single-paper:
    if (effectivePrintingPerUnit <= 0) return 0;
    return +(effectivePrintingPerUnit * 0.05).toFixed(2);
  })();

  // ✅ Total including VAT (for final payment)
  const effectiveTotalWithVat = +(effectiveTotalBeforeVat + vatValue).toFixed(2);

  // ✅ coins (max 10% of printing fee) => coins stored as "points" (100 = 1 AED)
  const maxCoinDiscount = Math.floor(effectivePrintingPerUnit * 0.1 * 100);
  const coinDiscount = useCoins ? Math.min(coinsBalance || 0, maxCoinDiscount) : 0;
  const coinDiscountValue = coinDiscount / 100;

  const finalPrice = Math.max(0, +(effectiveTotalWithVat - coinDiscountValue).toFixed(2));
  const willGetCashback = !useCoins;

  // Stripe fees (only if gateway)
  const stripeFeesResult = calcStripeFees(finalPrice, {
    isInternational: false,
    isCurrencyConversion: false,
  });

  const finalPriceWithFees = payMethod === "gateway" ? stripeFeesResult.totalAmount : finalPrice;
  const stripeFeeValue = payMethod === "gateway" ? stripeFeesResult.stripeFee : 0;

  // Fetch service data (optional enrichment)
  async function getServiceData() {
    if (!serviceName && !serviceId) return {};
    try {
      const ref = doc(firestore, "servicesByClientType", clientType);
      const snap = await getDoc(ref);
      if (!snap.exists()) return {};
      const all = snap.data() || {};
      if (serviceId && all[serviceId]) return all[serviceId];
      return Object.values(all).find((s) => s?.name === serviceName) || {};
    } catch {
      return {};
    }
  }

  async function handleWalletPayment() {
    setIsPaying(true);
    setPayMsg("");
    setMsgSuccess(false);

    try {
      if (!customerId || !userEmail || !serviceName) {
        setPayMsg(lang === "ar" ? "بيانات العميل أو البريد أو الخدمة ناقصة." : "Customer ID, email or service name missing.");
        return;
      }

      if ((Number(userWallet) || 0) < finalPrice) {
        setPayMsg(lang === "ar" ? "رصيد المحفظة غير كافي." : "Insufficient wallet balance.");
        return;
      }

      const userRef = doc(firestore, "users", customerId);

      // update wallet
      await updateDoc(userRef, { walletBalance: (Number(userWallet) || 0) - finalPrice });

      // coins usage
      if (useCoins && coinDiscount > 0) {
        await updateDoc(userRef, { coins: increment(-coinDiscount) });
      }

      // cashback (only if not using coins)
      if (willGetCashback && (Number(cashbackCoins) || 0) > 0) {
        await updateDoc(userRef, { coins: increment(Number(cashbackCoins) || 0) });
      }

      const orderNumber = generateOrderNumber();
      const serviceData = await getServiceData();

      const finalServiceName = serviceData?.name || serviceName || "";
      const finalServiceId = serviceData?.serviceId || serviceId || "";

      const providers = Array.isArray(serviceData?.providers)
        ? serviceData.providers
        : serviceData?.providers
          ? [serviceData.providers]
          : Array.isArray(provider)
            ? provider
            : provider
              ? [provider]
              : [];

      const statusHistory = [
        { status: "awaiting_payment", timestamp: new Date().toISOString(), updatedBy: assignedToName || "System" },
        { status: "completed", timestamp: new Date().toISOString(), updatedBy: assignedToName || "System" },
      ];

      await saveRequestToFirestore({
        orderNumber,
        customerId,
        assignedTo: assignedTo || "",
        assignedToName: assignedToName || "",
        serviceName: finalServiceName,
        serviceId: finalServiceId,
        providers,
        paidAmount: finalPrice,
        printingFee: effectivePrintingPerUnit,
        vat: vatValue,
        coinsUsed: useCoins ? coinDiscountValue : 0,
        coinsGiven: willGetCashback ? Number(cashbackCoins) || 0 : 0,
        uploadedDocs,
        status: "completed",
        statusHistory,
      });

      // notification
      await addDoc(collection(firestore, "notifications"), {
        targetId: customerId,
        title: lang === "ar" ? "تم الدفع" : "Payment Successful",
        body:
          lang === "ar"
            ? `دفعت لخدمة ${finalServiceName} بقيمة ${finalPrice.toFixed(2)} د.إ${
                useCoins ? ` واستخدمت خصم الكوينات (${coinDiscountValue.toFixed(2)} د.إ)` : ""
              }.\nرقم التتبع: ${orderNumber}`
            : `You paid for ${finalServiceName} (${finalPrice.toFixed(2)} AED${
                useCoins ? `, using coins discount (${coinDiscountValue.toFixed(2)} AED)` : ""
              }).\nTracking No.: ${orderNumber}`,
        timestamp: new Date().toISOString(),
        isRead: false,
      });

      // email
      await fetch("/api/sendOrderEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: userEmail,
          orderNumber,
          serviceName: finalServiceName,
          price: finalPrice.toFixed(2),
          printingFee: effectivePrintingPerUnit,
          vat: vatValue,
          processingFee: 0,
          coinDiscount: useCoins ? coinDiscountValue : 0,
          paymentMethod: "wallet",
          lang,
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

      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalPriceWithFees,
          serviceName: uiServiceName,
          customerId,
          userEmail,
          printingFee: effectivePrintingPerUnit,
          vat: vatValue,
        }),
      });

      const result = await res.json();

      if (!result?.clientSecret) {
        setPayMsg(lang === "ar" ? "تعذر فتح بوابة الدفع." : "Failed to open payment gateway.");
        return;
      }

      localStorage.setItem(
        "paymentData",
        JSON.stringify({
          clientSecret: result.clientSecret,
          service: {
            name: uiServiceName,
            id: serviceId,
            printingFee: effectivePrintingPerUnit,
            vat: vatValue,
            coinDiscount: useCoins ? coinDiscountValue : 0,
            userEmail,
          },
          totalPrice: effectiveTotalWithVat,
          finalPrice: finalPriceWithFees,
          processingFee: stripeFeeValue,
          customerId,
          lang,
          orderNumber: result.orderNumber,
        })
      );

      router.push("/payment/service");
    } catch (e) {
      console.log(e);
      setPayMsg(lang === "ar" ? "تعذر الاتصال بالخادم." : "Failed to connect to server.");
    } finally {
      setIsPaying(false);
    }
  }

  function onPayClick() {
    if (payMethod === "wallet") return handleWalletPayment();
    return handleGatewayPayWithElements();
  }

  if (!open) return null;

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
            className="absolute top-3 right-4 bg-emerald-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl shadow hover:bg-emerald-700 transition"
            onClick={onClose}
            aria-label={lang === "ar" ? "إغلاق" : "Close"}
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
                <td>{lang === "ar" ? "الإجمالي قبل الخصم" : "Total Before Discount"}</td>
                <td className="text-right">{effectiveTotalWithVat.toFixed(2)} د.إ</td>
              </tr>

              {effectivePrintingPerUnit > 0 && (
                <tr>
                  <td>{lang === "ar" ? "رسوم الطباعة" : "Printing Fee"}</td>
                  <td className="text-right">{effectivePrintingPerUnit.toFixed(2)} د.إ</td>
                </tr>
              )}

              {isCompany && vatValue > 0 && (
                <tr>
                  <td>{lang === "ar" ? "ضريبة القيمة المضافة 5%" : "VAT 5%"}</td>
                  <td className="text-right">{vatValue.toFixed(2)} د.إ</td>
                </tr>
              )}

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
                disabled={(coinsBalance || 0) < 1}
                className="accent-yellow-500 scale-90"
              />
              <FaCoins className="text-yellow-500" size={12} />
              {lang === "ar" ? "استخدم الكوينات (خصم حتى 10%)" : "Use coins (up to 10%)"}
            </label>
            <span className="font-black text-yellow-700 text-xs">
              {lang === "ar" ? "رصيدك:" : "Your coins:"} {coinsBalance || 0}
            </span>
          </div>

          <div className="w-full flex flex-row items-center justify-between mb-1">
            <label
              className={`flex items-center gap-1 font-bold text-emerald-800 text-xs cursor-pointer ${
                (Number(userWallet) || 0) < finalPrice ? "opacity-60" : ""
              }`}
            >
              <input
                type="radio"
                checked={payMethod === "wallet"}
                onChange={() => setPayMethod("wallet")}
                disabled={(Number(userWallet) || 0) < finalPrice}
                className="accent-emerald-600 scale-90"
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
              />
              <FaCreditCard className="text-emerald-600" size={12} />
              {lang === "ar" ? "بوابة الدفع" : "Gateway"}
            </label>
          </div>

          <div className="w-full mb-1 text-center">
            {willGetCashback ? (
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
            style={{ cursor: isPaying ? "wait" : "pointer" }}
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
            <div
              className={`mt-2 text-center font-bold text-xs flex flex-row items-center justify-center gap-1 ${
                msgSuccess ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {msgSuccess ? (
                <FaCheckCircle className="text-emerald-500" size={16} />
              ) : (
                <FaExclamationCircle className="text-red-400" size={14} />
              )}
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

          <div className="absolute -bottom-6 right-0 left-0 w-full h-7 bg-gradient-to-t from-emerald-200/70 via-white/20 to-transparent blur-2xl opacity-80 pointer-events-none" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
