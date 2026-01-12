"use client";

import { useMemo, useState } from "react";
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
 * - If printingFee/printingTotal is 0 => VAT is 0 automatically.
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

  // ✅ totals
  serviceBase = 0,
  printingTotal = 0,
  printingFeePerUnit = 0,
  vatTotal = 0,

  coinsUsed = 0, // AED value
  coinsGiven = 0, // points
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

    // ✅ keep old field names but store totals (best for reporting)
    printingFee: printingTotal,
    vat: vatTotal,

    // ✅ extra safe fields (won't break existing reads)
    serviceBase,
    printingFeePerUnit,

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

  totalPrice, // (serviceBase + printingTotal) WITHOUT VAT - fallback only
  printingFee, // per unit printing (fallback only)

  // ✅ exact totals from card (source of truth)
  serviceBase,
  printingTotal,
  vatTotal,

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
  initialPayMethod = "wallet",
}) {
  const [useCoins, setUseCoins] = useState(false);
  const [payMethod, setPayMethod] = useState(initialPayMethod || "wallet");
  const [isPaying, setIsPaying] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [msgSuccess, setMsgSuccess] = useState(false);

  const router = useRouter();

  const isCompany = String(clientType || "").toLowerCase().includes("company");
  const hasActiveSubscription = isCompany && Boolean(freePrinting);

  // --------------------
  // ✅ Build totals (Source of Truth)
  // --------------------
  const totals = useMemo(() => {
    const sBase = toNumberSafe(serviceBase, NaN);
    const pTotal = toNumberSafe(printingTotal, NaN);
    const vTotal = toNumberSafe(vatTotal, NaN);

    // ✅ Best path: card sent everything exact
    if (Number.isFinite(sBase) && Number.isFinite(pTotal) && Number.isFinite(vTotal)) {
      const beforeVat = +(sBase + pTotal).toFixed(2);
      const withVat = +(beforeVat + vTotal).toFixed(2);
      return {
        serviceBase: +sBase.toFixed(2),
        printingTotal: +pTotal.toFixed(2),
        vatTotal: +vTotal.toFixed(2),
        totalBeforeVat: beforeVat,
        totalWithVat: withVat,
        usedCardTotals: true,
      };
    }

    // ✅ Fallback (only if someone didn't pass totals)
    const beforeVat = +toNumberSafe(totalPrice, 0).toFixed(2);
    const perUnit = +toNumberSafe(printingFee, 0).toFixed(2);
    const assumedPrintingTotal = hasActiveSubscription ? 0 : perUnit; // assumes paperCount=1
    const assumedVat = hasActiveSubscription
      ? 0
      : (assumedPrintingTotal > 0 ? +(assumedPrintingTotal * 0.05).toFixed(2) : 0);

    const withVat = +(beforeVat + assumedVat).toFixed(2);

    return {
      serviceBase: Math.max(0, +(beforeVat - assumedPrintingTotal).toFixed(2)),
      printingTotal: +assumedPrintingTotal.toFixed(2),
      vatTotal: +assumedVat.toFixed(2),
      totalBeforeVat: beforeVat,
      totalWithVat: withVat,
      usedCardTotals: false,
    };
  }, [serviceBase, printingTotal, vatTotal, totalPrice, printingFee, hasActiveSubscription]);

  // ✅ Enforce subscription rule as final guard
  const effectivePrintingTotal = hasActiveSubscription ? 0 : +totals.printingTotal.toFixed(2);

  // ✅ VAT source of truth:
  // - if card sent vatTotal => use it
  // - else fallback calc from printing
  const effectiveVatTotal = hasActiveSubscription
    ? 0
    : (Number.isFinite(toNumberSafe(vatTotal, NaN))
        ? +toNumberSafe(vatTotal, 0).toFixed(2)
        : (effectivePrintingTotal > 0 ? +(effectivePrintingTotal * 0.05).toFixed(2) : 0)
      );

  // ✅ Total before VAT (after subscription enforcement)
  const cleanTotalBeforeVat = hasActiveSubscription
    ? Math.max(0, +(totals.totalBeforeVat - totals.printingTotal).toFixed(2))
    : +totals.totalBeforeVat.toFixed(2);

  // ✅ Total with VAT (final)
  const totalWithVatFinal = +(cleanTotalBeforeVat + effectiveVatTotal).toFixed(2);

  // ✅ Derive clean service base (for saving)
  const cleanServiceBase = Math.max(0, +(cleanTotalBeforeVat - effectivePrintingTotal).toFixed(2));

  // --------------------
  // ✅ Coins: max 10% of PRINTING TOTAL (points: 100 = 1 AED)
  // --------------------
  const maxCoinDiscountPoints = Math.floor(effectivePrintingTotal * 0.1 * 100);
  const coinDiscountPoints = useCoins ? Math.min(coinsBalance || 0, maxCoinDiscountPoints) : 0;
  const coinDiscountValueAed = coinDiscountPoints / 100;

  const finalPriceNoGateway = Math.max(0, +(totalWithVatFinal - coinDiscountValueAed).toFixed(2));
  const willGetCashback = !useCoins;

  // --------------------
  // ✅ Stripe fees (only if gateway)
  // --------------------
  const stripeFeesResult = calcStripeFees(finalPriceNoGateway, {
    isInternational: false,
    isCurrencyConversion: false,
  });

  const stripeFeeValue = payMethod === "gateway" ? +stripeFeesResult.stripeFee.toFixed(2) : 0;

  const finalPriceWithFees =
    payMethod === "gateway" ? +stripeFeesResult.totalAmount.toFixed(2) : finalPriceNoGateway;

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

      if ((Number(userWallet) || 0) < finalPriceNoGateway) {
        setPayMsg(lang === "ar" ? "رصيد المحفظة غير كافي." : "Insufficient wallet balance.");
        return;
      }

      const userRef = doc(firestore, "users", customerId);

      // update wallet
      await updateDoc(userRef, {
        walletBalance: (Number(userWallet) || 0) - finalPriceNoGateway,
      });

      // coins usage
      if (useCoins && coinDiscountPoints > 0) {
        await updateDoc(userRef, { coins: increment(-coinDiscountPoints) });
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

        paidAmount: finalPriceNoGateway,

        // ✅ totals (final)
        serviceBase: cleanServiceBase,
        printingTotal: effectivePrintingTotal,
        printingFeePerUnit: toNumberSafe(printingFee, 0),
        vatTotal: effectiveVatTotal,

        coinsUsed: useCoins ? coinDiscountValueAed : 0,
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
            ? `دفعت لخدمة ${finalServiceName} بقيمة ${finalPriceNoGateway.toFixed(2)} د.إ${
                useCoins ? ` واستخدمت خصم الكوينات (${coinDiscountValueAed.toFixed(2)} د.إ)` : ""
              }.\nرقم التتبع: ${orderNumber}`
            : `You paid for ${finalServiceName} (${finalPriceNoGateway.toFixed(2)} AED${
                useCoins ? `, using coins discount (${coinDiscountValueAed.toFixed(2)} AED)` : ""
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
          price: finalPriceNoGateway.toFixed(2),

          printingFee: effectivePrintingTotal,
          vat: effectiveVatTotal,
          processingFee: 0,

          coinDiscount: useCoins ? coinDiscountValueAed : 0,
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

          printingFee: effectivePrintingTotal,
          vat: effectiveVatTotal,
          processingFee: stripeFeeValue,
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
            printingFee: effectivePrintingTotal,
            vat: effectiveVatTotal,
            userEmail,
          },

          // ✅ exact totals the user saw
          serviceBase: cleanServiceBase,
          printingTotal: effectivePrintingTotal,
          vatTotal: effectiveVatTotal,

          totalBeforeVat: cleanTotalBeforeVat,
          totalWithVat: totalWithVatFinal,

          coinDiscount: useCoins ? coinDiscountValueAed : 0,
          processingFee: stripeFeeValue,
          finalPrice: finalPriceWithFees,

          payMethod: "gateway",
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

const isWallet = payMethod === "wallet";
const isGateway = payMethod === "gateway";

const headerTheme = isWallet
  ? "from-emerald-700 via-emerald-600 to-green-700"
  : "from-indigo-700 via-blue-700 to-cyan-600";

const payBtnTheme = isWallet
  ? "from-emerald-500 via-emerald-600 to-green-600 hover:from-emerald-600 hover:to-green-700"
  : "from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700";

const methodRing = (active) =>
  active
    ? "ring-2 ring-offset-2 ring-emerald-400 shadow-emerald-200/60"
    : "ring-1 ring-white/40 hover:ring-emerald-200/70";

return (
  <AnimatePresence>
    <motion.div
      className="fixed inset-0 z-[100] flex justify-center items-center bg-black/60 backdrop-blur-[6px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative w-full max-w-md rounded-[28px] overflow-hidden shadow-2xl border border-white/15"
        initial={{ scale: 0.98, opacity: 0, y: 26 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 26 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {/* Header */}
        <div className={`px-6 pt-6 pb-5 bg-gradient-to-r ${headerTheme}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow">
                {isWallet ? (
                  <FaWallet className="text-white text-xl" />
                ) : (
                  <FaCreditCard className="text-white text-xl" />
                )}
              </div>

              <div className="flex flex-col">
                <div className="text-white font-black text-lg leading-tight">
                  {lang === "ar" ? "بوابة الدفع" : "Payment"}
                </div>
                <div className="text-white/85 text-xs font-semibold">
                  {lang === "ar" ? "عملية مشفّرة وآمنة" : "Secure & Encrypted"}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition"
              aria-label={lang === "ar" ? "إغلاق" : "Close"}
            >
              <FaTimes />
            </button>
          </div>

          {/* Service name */}
          <div className="mt-4 rounded-2xl bg-white/10 border border-white/15 p-3">
            <div className="text-white/75 text-[11px] font-bold">
              {lang === "ar" ? "الخدمة" : "Service"}
            </div>
            <div className="text-white font-extrabold text-sm leading-snug">
              {serviceName}
            </div>

            {/* Badges */}
            <div className="mt-2 flex flex-wrap gap-2">
              {hasActiveSubscription && (
                <span className="px-2 py-1 rounded-full text-[10px] font-black bg-emerald-200/20 text-emerald-100 border border-emerald-200/30">
                  {lang === "ar" ? "اشتراك فعّال: طباعة مجانية" : "Active Subscription: Free Printing"}
                </span>
              )}
              <span className="px-2 py-1 rounded-full text-[10px] font-black bg-white/10 text-white/90 border border-white/15">
                {lang === "ar" ? "VAT 5% على الطباعة فقط" : "VAT 5% on printing only"}
              </span>
              <span className="px-2 py-1 rounded-full text-[10px] font-black bg-white/10 text-white/90 border border-white/15">
                🔒 {lang === "ar" ? "Secure" : "Secure"}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-6 bg-gradient-to-b from-white via-emerald-50 to-white">
          {/* Invoice */}
          <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-black text-emerald-900 text-sm">
                {lang === "ar" ? "ملخص الدفع" : "Payment Summary"}
              </div>
              <div className="text-[11px] font-bold text-gray-500">
                {totals.usedCardTotals ? (lang === "ar" ? "قيم دقيقة" : "Exact") : (lang === "ar" ? "قيم تقديرية" : "Fallback")}
              </div>
            </div>

            <div className="space-y-2 text-[12px] font-bold text-gray-700">
              <div className="flex justify-between">
                <span>{lang === "ar" ? "الإجمالي قبل خصم الكوينات" : "Total Before Coins"}</span>
                <span>{totalWithVatFinal.toFixed(2)} د.إ</span>
              </div>

              {effectivePrintingTotal > 0 && (
                <div className="flex justify-between">
                  <span>{lang === "ar" ? "رسوم الطباعة (إجمالي)" : "Printing Total"}</span>
                  <span>{effectivePrintingTotal.toFixed(2)} د.إ</span>
                </div>
              )}

              {effectiveVatTotal > 0 && (
                <div className="flex justify-between">
                  <span>{lang === "ar" ? "ضريبة 5% على الطباعة" : "VAT 5% on Printing"}</span>
                  <span>{effectiveVatTotal.toFixed(2)} د.إ</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <FaCoins className="text-yellow-500" size={12} />
                  {lang === "ar" ? "خصم الكوينات" : "Coins Discount"}
                </span>
                <span className="text-yellow-700">
                  {useCoins ? `-${coinDiscountValueAed.toFixed(2)} د.إ` : "0 د.إ"}
                </span>
              </div>

              <div className="flex justify-between">
                <span>{lang === "ar" ? "رسوم المعالجة" : "Processing Fee"}</span>
                <span>{isGateway ? stripeFeeValue.toFixed(2) : "0.00"} د.إ</span>
              </div>

              <div className="h-px bg-emerald-100 my-2" />

              <div className="flex justify-between text-[13px]">
                <span className="font-extrabold text-emerald-900">
                  {lang === "ar" ? "السعر النهائي" : "Final Total"}
                </span>
                <span className="font-black text-emerald-800">
                  {finalPriceWithFees.toFixed(2)} د.إ
                </span>
              </div>
            </div>
          </div>

          {/* Coins toggle */}
          <div className="mt-4 rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 font-black text-[12px] text-emerald-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCoins}
                  onChange={(e) => setUseCoins(e.target.checked)}
                  disabled={(coinsBalance || 0) < 1 || maxCoinDiscountPoints <= 0}
                  className="accent-yellow-500"
                />
                <FaCoins className="text-yellow-500" />
                {lang === "ar" ? "استخدم الكوينات" : "Use coins"}
                <span className="text-[10px] font-bold text-gray-500">
                  ({lang === "ar" ? "حتى 10% من الطباعة" : "up to 10% of printing"})
                </span>
              </label>

              <div className="text-[11px] font-black text-yellow-700">
                {lang === "ar" ? "رصيدك:" : "Balance:"} {coinsBalance || 0}
              </div>
            </div>

            <div className="mt-2 text-[11px] font-semibold text-gray-600">
              {!useCoins ? (
                <span className="flex items-center gap-2">
                  <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500" />
                  {lang === "ar"
                    ? `ستحصل على ${cashbackCoins} كوين مكافأة`
                    : `You’ll get ${cashbackCoins} coins cashback`}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="inline-flex w-2 h-2 rounded-full bg-gray-400" />
                  {lang === "ar" ? "لا مكافأة عند استخدام الكوينات" : "No cashback when using coins"}
                </span>
              )}
            </div>
          </div>

          {/* Pay method visual cards */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* Wallet */}
            <button
              type="button"
              onClick={() => setPayMethod("wallet")}
              disabled={(Number(userWallet) || 0) < finalPriceNoGateway}
              className={`text-left rounded-2xl p-4 bg-white border transition relative ${
                (Number(userWallet) || 0) < finalPriceNoGateway
                  ? "opacity-50 cursor-not-allowed border-gray-200"
                  : `cursor-pointer ${methodRing(isWallet)} border-emerald-100 hover:shadow`
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <FaWallet className="text-emerald-700" />
                </div>
                {isWallet && <FaCheckCircle className="text-emerald-600" />}
              </div>

              <div className="mt-3 font-black text-emerald-900 text-sm">
                {lang === "ar" ? "المحفظة" : "Wallet"}
              </div>
              <div className="text-[11px] font-bold text-gray-600 mt-1">
                {lang === "ar" ? "الرصيد:" : "Balance:"} {Number(userWallet || 0).toFixed(2)} د.إ
              </div>

              {(Number(userWallet) || 0) < finalPriceNoGateway && (
                <div className="mt-2 text-[10px] font-black text-red-600">
                  {lang === "ar" ? "الرصيد غير كافي" : "Insufficient balance"}
                </div>
              )}
            </button>

            {/* Gateway */}
            <button
              type="button"
              onClick={() => setPayMethod("gateway")}
              className={`text-left rounded-2xl p-4 bg-white border border-blue-100 transition cursor-pointer ${methodRing(isGateway)} hover:shadow`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <FaCreditCard className="text-blue-700" />
                </div>
                {isGateway && <FaCheckCircle className="text-emerald-600" />}
              </div>

              <div className="mt-3 font-black text-blue-900 text-sm">
                {lang === "ar" ? "بوابة الدفع" : "Gateway"}
              </div>
              <div className="text-[11px] font-bold text-gray-600 mt-1">
                {lang === "ar" ? "Stripe / Cards" : "Stripe / Cards"}
              </div>
            </button>
          </div>

          {/* Pay button */}
          <button
            onClick={onPayClick}
            disabled={isPaying}
            className={`mt-4 w-full py-3 rounded-full font-black text-base text-white shadow-lg transition bg-gradient-to-r ${payBtnTheme} ${
              isPaying ? "opacity-50 cursor-wait" : "hover:scale-[1.02]"
            }`}
          >
            {isPaying ? (
              <span className="flex items-center justify-center gap-2 text-[13px]">
                <FaSpinner className="animate-spin" />
                {lang === "ar" ? "جاري الدفع..." : "Processing..."}
              </span>
            ) : (
              <span>
                {lang === "ar"
                  ? `ادفع الآن (${finalPriceWithFees.toFixed(2)} د.إ)`
                  : `Pay Now (${finalPriceWithFees.toFixed(2)} AED)`}
              </span>
            )}
          </button>

          {/* Message */}
          {payMsg && (
            <div
              className={`mt-3 text-center font-black text-xs flex items-center justify-center gap-2 ${
                msgSuccess ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {msgSuccess ? <FaCheckCircle /> : <FaExclamationCircle />}
              <span>{payMsg}</span>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-4 text-center text-[11px] font-semibold text-gray-500">
            🔒 {lang === "ar" ? "بيانات الدفع مشفرة بالكامل" : "Payment data is fully encrypted"}
          </div>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);
}
