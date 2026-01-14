"use client";

import { useMemo, useState, useEffect } from "react";
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
 * - Printing Fee + VAT are waived ONLY for companies when waiver active.
 * - If printingTotal is 0 => VAT is 0 automatically.
 * - Service fee & gateway fee ALWAYS apply (never waived).
 *
 * ✅ IMPORTANT:
 * - DO NOT consume subscription credits from frontend.
 * - Credits consumption happens ONLY in Stripe webhook after successful payment.
 */

// --------------------
// Helpers
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
// ✅ Subscription helper (UI ONLY)
// Reads:
// companySubscriptions/{companyId}
// - isActive (waiver enabled now)
// - txCredits.totalRemaining (optional display)
// --------------------
async function getCompanyWaiverInfo(companyId) {
  if (!companyId) return { waiver: false, totalRemaining: 0 };

  try {
    const subRef = doc(firestore, "companySubscriptions", String(companyId));
    const snap = await getDoc(subRef);
    if (!snap.exists()) return { waiver: false, totalRemaining: 0 };

    const d = snap.data() || {};
    return {
      waiver: !!d.isActive,
      totalRemaining: toNumberSafe(d?.txCredits?.totalRemaining, 0),
    };
  } catch {
    return { waiver: false, totalRemaining: 0 };
  }
}

// --------------------
// ✅ Save request (same shape) but:
// - uses requestId if exists (update same doc)
// - merge safe
// - createdAt only once
// - does NOT wipe attachments unless uploadedDocs has keys
// --------------------
async function saveRequestToFirestore({
  orderNumber,
  requestId = "",

  customerId,
  assignedTo = "",
  assignedToName = "",
  serviceName = "",
  serviceId = "",
  providers = [],
  paidAmount = 0,

  // totals
  serviceBase = 0,
  printingTotal = 0,
  printingFeePerUnit = 0,
  vatTotal = 0,

  processingFee = 0,
  paymentMethod = "wallet",

  coinsUsed = 0, // AED value
  coinsGiven = 0, // points
  uploadedDocs = {},
  status = "completed",
  statusHistory = [],
}) {
  const finalId = String(requestId || orderNumber || "").trim();
  if (!finalId) throw new Error("missing_requestId");

  const ref = doc(firestore, "requests", finalId);
  const snap = await getDoc(ref);

  const safeUploads =
    uploadedDocs && typeof uploadedDocs === "object" ? uploadedDocs : {};
  const hasUploads = Object.keys(safeUploads).length > 0;

  const payload = {
    requestId: finalId,
    customerId,
    assignedTo,
    assignedToName,
    serviceName,
    serviceId,
    providers,

    paymentMethod,
    paidAmount,

    // ✅ keep old field names
    printingFee: printingTotal,
    vat: vatTotal,

    // ✅ extra safe fields (won't break old reads)
    serviceBase,
    printingFeePerUnit,

    // ✅ gateway fee if any
    processingFee,

    coinsUsed,
    coinsGiven,

    status,
    statusHistory,

    lastUpdated: new Date().toISOString(),
    ...(snap.exists() ? {} : { createdAt: new Date().toISOString() }),

    ...(hasUploads ? { attachments: safeUploads } : {}),
  };

  await setDoc(ref, payload, { merge: true });
}

export default function ServicePayModal({
  open,
  onClose,

  serviceName,
  serviceId,

  // ✅ if request already created before payment pass it here
  requestId = "",

  totalPrice, // fallback only
  printingFee, // fallback only

  // ✅ exact totals from card (source of truth)
  serviceBase,
  printingTotal,
  vatTotal,

  coinsBalance,
  cashbackCoins,
  userWallet,

  lang = "ar",
  customerId,
  userId, // unused but kept
  userEmail,
  uploadedDocs,
  onPaid,

  clientType = "resident",

  // legacy prop — still works if you pass it manually
  freePrinting = false,

  // ✅ for subscription lookup (UI)
  companyId = "",

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

  const isCompany = String(clientType || "")
    .toLowerCase()
    .includes("company");

  // =========================
  // ✅ Waiver state (UI only)
  // =========================
  const [waiverInfo, setWaiverInfo] = useState({
    waiver: false,
    totalRemaining: 0,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!open) return;

      // Non-company => no waiver
      if (!isCompany) {
        if (mounted)
          setWaiverInfo({ waiver: false, totalRemaining: 0, loading: false });
        return;
      }

      // Legacy override
      if (freePrinting) {
        if (mounted)
          setWaiverInfo({ waiver: true, totalRemaining: 1, loading: false });
        return;
      }

      const cid = String(companyId || customerId || "").trim();
      const info = await getCompanyWaiverInfo(cid);
      if (mounted) setWaiverInfo({ ...info, loading: false });
    }

    load();
    return () => {
      mounted = false;
    };
  }, [open, isCompany, freePrinting, companyId, customerId]);

  // ✅ Waiver active (only affects printing + VAT)
  const waiverActive = isCompany && !waiverInfo.loading && waiverInfo.waiver;

  // --------------------
  // ✅ Build totals (Source of Truth)
  // --------------------
  const totals = useMemo(() => {
    const sBase = toNumberSafe(serviceBase, NaN);
    const pTotal = toNumberSafe(printingTotal, NaN);
    const vTotal = toNumberSafe(vatTotal, NaN);

    // ✅ Best path: exact totals from card
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
    const assumedPrintingTotal = perUnit; // assumes paperCount=1
    const assumedVat = assumedPrintingTotal > 0 ? +(assumedPrintingTotal * 0.05).toFixed(2) : 0;

    const withVat = +(beforeVat + assumedVat).toFixed(2);

    return {
      serviceBase: Math.max(0, +(beforeVat - assumedPrintingTotal).toFixed(2)),
      printingTotal: +assumedPrintingTotal.toFixed(2),
      vatTotal: +assumedVat.toFixed(2),
      totalBeforeVat: beforeVat,
      totalWithVat: withVat,
      usedCardTotals: false,
    };
  }, [serviceBase, printingTotal, vatTotal, totalPrice, printingFee]);

  // ✅ Apply waiver ONLY for printing+VAT
  const effectivePrintingTotal = waiverActive ? 0 : +totals.printingTotal.toFixed(2);

  const effectiveVatTotal = waiverActive
    ? 0
    : Number.isFinite(toNumberSafe(vatTotal, NaN))
    ? +toNumberSafe(vatTotal, 0).toFixed(2)
    : effectivePrintingTotal > 0
    ? +(effectivePrintingTotal * 0.05).toFixed(2)
    : 0;

  // ✅ Total before VAT (after waiver)
  const cleanTotalBeforeVat = waiverActive
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
    payMethod === "gateway"
      ? +stripeFeesResult.totalAmount.toFixed(2)
      : finalPriceNoGateway;

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
        setPayMsg(
          lang === "ar"
            ? "بيانات العميل أو البريد أو الخدمة ناقصة."
            : "Customer ID, email or service name missing."
        );
        return;
      }

      if ((Number(userWallet) || 0) < finalPriceNoGateway) {
        setPayMsg(lang === "ar" ? "رصيد المحفظة غير كافي." : "Insufficient wallet balance.");
        return;
      }

      const userRef = doc(firestore, "users", customerId);

      // ✅ update wallet
      await updateDoc(userRef, {
        walletBalance: (Number(userWallet) || 0) - finalPriceNoGateway,
      });

      // ✅ coins usage
      if (useCoins && coinDiscountPoints > 0) {
        await updateDoc(userRef, { coins: increment(-coinDiscountPoints) });
      }

      // ✅ cashback
      if (willGetCashback && (Number(cashbackCoins) || 0) > 0) {
        await updateDoc(userRef, { coins: increment(Number(cashbackCoins) || 0) });
      }

      // ✅ keep request id if already exists, else generate
      const finalRequestId = String(requestId || "").trim();
      const orderNumber = finalRequestId || generateOrderNumber();

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
        {
          status: "awaiting_payment",
          timestamp: new Date().toISOString(),
          updatedBy: assignedToName || "System",
        },
        {
          status: "completed",
          timestamp: new Date().toISOString(),
          updatedBy: assignedToName || "System",
        },
      ];

      // ✅ Save request (same shape)
      await saveRequestToFirestore({
        orderNumber,
        requestId: finalRequestId,
        customerId,
        assignedTo: assignedTo || "",
        assignedToName: assignedToName || "",
        serviceName: finalServiceName,
        serviceId: finalServiceId,
        providers,

        paymentMethod: "wallet",
        processingFee: 0,
        paidAmount: finalPriceNoGateway,

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

      // ✅ notification
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

      // ✅ email
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
      setTimeout(() => onClose(), 900);
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

          // ✅ link existing request if any
          requestId: String(requestId || "").trim() || undefined,

          // ✅ for server/webhook logic (decision should be server-side)
          companyId: String(companyId || "").trim() || undefined,
          clientType,
          waiverUi: !!waiverActive, // UI only
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

          requestId: String(requestId || "").trim(),
          companyId: String(companyId || "").trim(),
          waiverUi: !!waiverActive,
          clientType,
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

  // ✅ Themes (unchanged logic, just styles)
  const headerTheme = isWallet
    ? "from-emerald-900 via-emerald-800 to-green-900"
    : "from-[#0b1f3a] via-[#123a6b] to-[#0b1f3a]";

  const payBtnTheme = isWallet
    ? "from-emerald-500 via-emerald-600 to-green-600 hover:from-emerald-600 hover:to-green-700"
    : "from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700";

  const methodRing = (active) =>
    active
      ? "ring-2 ring-offset-2 ring-emerald-400 shadow-emerald-200/60"
      : "ring-1 ring-white/30 hover:ring-emerald-200/70";

  const badgeBase = "px-2 py-1 rounded-full text-[10px] font-black border backdrop-blur";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex justify-center items-center bg-black/60 backdrop-blur-[6px] px-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full max-w-4xl rounded-[22px] overflow-hidden shadow-2xl border border-white/15"
          initial={{ scale: 0.98, opacity: 0, y: 18 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 18 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Header */}
          <div className={`px-4 pt-4 pb-3 bg-gradient-to-r ${headerTheme}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow">
                  {isWallet ? (
                    <FaWallet className="text-white text-[16px]" />
                  ) : (
                    <FaCreditCard className="text-white text-[16px]" />
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="text-white font-black text-[15px] leading-tight">
                    {lang === "ar" ? "الدفع" : "Payment"}
                  </div>
                  <div className="text-white/80 text-[10px] font-semibold">
                    {lang === "ar" ? "عملية مشفّرة وآمنة" : "Secure & Encrypted"}
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition cursor-pointer"
                aria-label={lang === "ar" ? "إغلاق" : "Close"}
              >
                <FaTimes />
              </button>
            </div>

            {/* Service row */}
            <div className="mt-3 rounded-2xl bg-white/10 border border-white/15 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white/70 text-[10px] font-bold">
                    {lang === "ar" ? "الخدمة" : "Service"}
                  </div>
                  <div className="text-white font-extrabold text-[12px] leading-snug truncate">
                    {serviceName}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  {waiverActive && (
                    <span
                      className={`${badgeBase} bg-white/10 text-emerald-100 border-emerald-200/25`}
                    >
                      {lang === "ar" ? "مجانًا: طباعة + ضريبة" : "Free: Printing + VAT"}
                    </span>
                  )}
                  <span className={`${badgeBase} bg-white/10 text-white/90 border-white/15`}>
                    {lang === "ar" ? "VAT 5% على الطباعة" : "VAT 5% on printing"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-4 bg-gradient-to-b from-white via-emerald-50 to-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* LEFT */}
              <div className="space-y-3">
                {/* Coins */}
                <div className="rounded-2xl border border-yellow-100 bg-white p-3 shadow-sm">
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
                          ? `مكافأة: ${cashbackCoins} كوين`
                          : `Cashback: ${cashbackCoins} coins`}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="inline-flex w-2 h-2 rounded-full bg-gray-400" />
                        {lang === "ar" ? "لا مكافأة عند الخصم" : "No cashback with discount"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Methods */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayMethod("wallet")}
                    disabled={(Number(userWallet) || 0) < finalPriceNoGateway}
                    className={`text-left rounded-2xl p-3 bg-white border transition relative ${
                      (Number(userWallet) || 0) < finalPriceNoGateway
                        ? "opacity-50 cursor-not-allowed border-gray-200"
                        : `cursor-pointer ${methodRing(isWallet)} border-emerald-100 hover:shadow`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                        <FaWallet className="text-emerald-700" />
                      </div>
                      {isWallet && <FaCheckCircle className="text-emerald-600" />}
                    </div>

                    <div className="mt-2 font-black text-emerald-900 text-[12px]">
                      {lang === "ar" ? "المحفظة" : "Wallet"}
                    </div>
                    <div className="text-[10px] font-bold text-gray-600 mt-1">
                      {lang === "ar" ? "الرصيد:" : "Balance:"}{" "}
                      {Number(userWallet || 0).toFixed(2)} د.إ
                    </div>

                    {(Number(userWallet) || 0) < finalPriceNoGateway && (
                      <div className="mt-2 text-[10px] font-black text-red-600">
                        {lang === "ar" ? "الرصيد غير كافي" : "Insufficient balance"}
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod("gateway")}
                    className={`text-left rounded-2xl p-3 bg-white border border-blue-100 transition cursor-pointer ${methodRing(
                      isGateway
                    )} hover:shadow`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                        <FaCreditCard className="text-blue-700" />
                      </div>
                      {isGateway && <FaCheckCircle className="text-emerald-600" />}
                    </div>

                    <div className="mt-2 font-black text-blue-900 text-[12px]">
                      {lang === "ar" ? "البوابة" : "Gateway"}
                    </div>
                    <div className="text-[10px] font-bold text-gray-600 mt-1">Stripe / Cards</div>
                  </button>
                </div>

                <div className="text-center text-[10px] font-semibold text-gray-500">
                  🔒 {lang === "ar" ? "بيانات الدفع مشفرة بالكامل" : "Payment data is fully encrypted"}
                </div>
              </div>

              {/* RIGHT */}
              <div className="space-y-3">
                {/* Invoice */}
                <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-black text-emerald-900 text-[13px]">
                      {lang === "ar" ? "ملخص الدفع" : "Summary"}
                    </div>
                    <div className="text-[10px] font-bold text-gray-500">
                      {totals.usedCardTotals ? (lang === "ar" ? "قيم دقيقة" : "Exact") : lang === "ar" ? "تقديري" : "Fallback"}
                    </div>
                  </div>

                  <div className="space-y-2 text-[12px] font-bold text-gray-700">
                    <div className="flex justify-between">
                      <span>{lang === "ar" ? "الإجمالي قبل خصم الكوينات" : "Total Before Coins"}</span>
                      <span>{totalWithVatFinal.toFixed(2)} د.إ</span>
                    </div>

                    <div className="flex justify-between">
                      <span>{lang === "ar" ? "رسوم الطباعة" : "Printing"}</span>
                      <span>
                        {effectivePrintingTotal > 0 ? (
                          `${effectivePrintingTotal.toFixed(2)} د.إ`
                        ) : (
                          <span className="text-emerald-700 font-black">
                            {lang === "ar" ? "0 (مجانًا)" : "0 (Waived)"}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>{lang === "ar" ? "VAT على الطباعة" : "VAT on Printing"}</span>
                      <span>
                        {effectiveVatTotal > 0 ? (
                          `${effectiveVatTotal.toFixed(2)} د.إ`
                        ) : (
                          <span className="text-emerald-700 font-black">
                            {lang === "ar" ? "0 (مجانًا)" : "0 (Waived)"}
                          </span>
                        )}
                      </span>
                    </div>

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

                {/* Pay button */}
                <button
                  onClick={onPayClick}
                  disabled={isPaying}
                  className={`w-full py-3 rounded-full font-black text-[14px] text-white shadow-lg transition bg-gradient-to-r ${payBtnTheme}
                    ${isPaying ? "opacity-50 cursor-wait" : "cursor-pointer hover:scale-[1.01]"}
                  `}
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
                    className={`text-center font-black text-xs flex items-center justify-center gap-2 ${
                      msgSuccess ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {msgSuccess ? <FaCheckCircle /> : <FaExclamationCircle />}
                    <span>{payMsg}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
