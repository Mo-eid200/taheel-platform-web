"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import Image from "next/image";
import { useRouter } from "next/navigation";
import PaymentSuccessPage from "../PaymentSuccess/page";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// النصوص (عربي / إنجليزي)
const LANG = {
  en: {
    title: "Pay for Service",
    subtitle: "Your payment is secure and encrypted.",
    cardLabel: "Card Information",
    payBtn: "Pay Now",
    success: "Payment successful!",
    error: "Payment failed.",
    service: "Service",
    amount: "Service Fee",
    vat: "VAT",
    print: "Printing Fee",
    coinDiscount: "Coins Discount",
    processingFee: "Processing Fee",
    totalBeforeDiscount: "Total Before Discount",
    total: "Total",
    processing: "Processing...",

    // ✅ Subscription labels
    subTitle: "Pay for Subscription",
    subName: "Subscription",
    subDays: "Duration (Days)",
  },
  ar: {
    title: "دفع الخدمة",
    subtitle: "مدفوعاتك محمية ومشفرة بالكامل.",
    cardLabel: "بيانات البطاقة",
    payBtn: "ادفع الآن",
    success: "تم الدفع بنجاح!",
    error: "فشل الدفع.",
    service: "الخدمة",
    amount: "رسوم الخدمة",
    vat: "ضريبة القيمة المضافة",
    print: "رسوم الطباعة",
    coinDiscount: "خصم الكوينات",
    processingFee: "رسوم معالجة الدفع الإلكتروني",
    totalBeforeDiscount: "الإجمالي قبل الخصم",
    total: "الإجمالي",
    processing: "جارٍ الدفع...",

    // ✅ Subscription labels
    subTitle: "دفع الاشتراك",
    subName: "الاشتراك",
    subDays: "المدة (بالأيام)",
  },
};

function CardForm({ paymentData, lang = "ar", onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [msgSuccess, setMsgSuccess] = useState(false);

  // ✅ اسم الخدمة/الاشتراك
  const serviceName =
    paymentData?.subscriptionName ||
    paymentData?.service?.name ||
    paymentData?.serviceName ||
    "اسم غير متوفر";

  const userEmail = paymentData?.userEmail || paymentData?.service?.userEmail || "";
  const orderNumber = paymentData?.orderNumber;
  const clientSecret = paymentData?.clientSecret;

  const dir = lang === "ar" ? "rtl" : "ltr";

  // ✅ Detect subscription + fields (same logic you had)
  const isSubscription =
    String(paymentData?.requestType || "").toLowerCase() === "subscription" ||
    !!paymentData?.planKey ||
    String(paymentData?.serviceId || "").startsWith("subscription-") ||
    String(paymentData?.serviceId || "").startsWith("subscription_") ||
    String(paymentData?.serviceName || "").includes("اشتراك") ||
    String(paymentData?.serviceName || "").toLowerCase().includes("subscription");

  const planKey = paymentData?.planKey || paymentData?.subscriptionName || "";

  // مدة الاشتراك بالأيام (الأولوية: subscriptionDays)
  const subscriptionDays = Number(paymentData?.subscriptionDays ?? paymentData?.days ?? 0);

  // fallback: لو عندك monthsShown نعتبر الشهر 30 يوم
  const monthsShown = Number(paymentData?.monthsShown ?? 0);
  const fallbackDays = monthsShown > 0 ? monthsShown * 30 : 0;
  const subDaysToShow = subscriptionDays > 0 ? subscriptionDays : fallbackDays;

  // ✅ NEW (SAFE): server/client breakdown support (for subscriptions/addons)
  const bd = paymentData?.breakdown || null;

  const serverBase = bd ? Number(bd.baseAmountAED ?? bd.baseAmount ?? 0) : 0;
  const serverVat = bd ? Number(bd.vatAED ?? bd.vat ?? 0) : 0;
  const serverProc = bd ? Number(bd.processingFeeAED ?? bd.processingFee ?? 0) : 0;
  const serverTotal = bd ? Number(bd.totalAED ?? bd.total ?? 0) : 0;

  const hasServerBreakdown =
    !!bd &&
    Number.isFinite(serverBase) &&
    serverBase >= 0 &&
    Number.isFinite(serverVat) &&
    serverVat >= 0 &&
    Number.isFinite(serverProc) &&
    serverProc >= 0 &&
    Number.isFinite(serverTotal) &&
    serverTotal > 0;

  // ✅ basics (keep old behavior for services, but if breakdown exists use it)
  const printingFee = hasServerBreakdown
    ? 0
    : Number(paymentData?.service?.printingFee ?? paymentData?.printingFee ?? 0);

  const vat = hasServerBreakdown
    ? serverVat
    : Number(paymentData?.service?.vat ?? paymentData?.vat ?? 0);

  const coinDiscount = Number(
    paymentData?.service?.coinDiscount ?? paymentData?.coinDiscount ?? 0
  );

  const processingFee = hasServerBreakdown
    ? serverProc
    : Number(paymentData?.processingFee ?? 0);

  const totalPrice = Number(paymentData?.totalPrice ?? paymentData?.price ?? 0);

  const finalPrice = hasServerBreakdown
    ? serverTotal
    : Number(paymentData?.finalPrice ?? paymentData?.price ?? 0);

  // ✅ Service Fee (robust + fallback derived from total)
  let servicePrice = Number(
    (hasServerBreakdown ? serverBase : 0) ||
      paymentData?.breakdown?.baseAmountAED ??
      paymentData?.baseAmountAED ??
      paymentData?.metadata?.baseAmountAED ??
      0
  );

  if (!Number.isFinite(servicePrice) || servicePrice <= 0) {
    const fp = Number(paymentData?.finalPrice ?? paymentData?.price ?? 0);
    const pf = Number(paymentData?.processingFee ?? 0);
    const pr = Number(paymentData?.service?.printingFee ?? paymentData?.printingFee ?? 0);
    const v = Number(paymentData?.service?.vat ?? paymentData?.vat ?? 0);

    // اشتقاق رسوم الخدمة/الاشتراك من النهائي (بدون processing)
    servicePrice = Math.max(0, Number((fp - pf - pr - v).toFixed(2)));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPayMsg("");
    setMsgSuccess(false);

    if (!stripe || !elements) {
      setPayMsg("Stripe is not loaded.");
      setLoading(false);
      return;
    }
    if (!clientSecret) {
      setPayMsg(lang === "ar" ? "بيانات الدفع ناقصة." : "Missing payment data.");
      setLoading(false);
      return;
    }

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: { card: elements.getElement(CardElement) },
        }
      );

      if (stripeError) {
        setPayMsg(stripeError.message || (lang === "ar" ? "فشل الدفع." : "Payment failed."));
        setLoading(false);
        return;
      }

      if (!paymentIntent) {
        setPayMsg(lang === "ar" ? "لم يتم استلام نتيجة الدفع." : "No payment result.");
        setLoading(false);
        return;
      }

      if (String(paymentIntent.status).toLowerCase() !== "succeeded") {
        setPayMsg((lang === "ar" ? "الحالة: " : "Status: ") + paymentIntent.status);
        setLoading(false);
        return;
      }

      // 1) confirmPayment (await)
      try {
        await fetch("/api/confirmPayment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            requestId: orderNumber ?? null,
          }),
        });
      } catch (err) {
        console.warn("confirmPayment call failed:", err);
      }

      // 2) send email
      (async () => {
        try {
          await fetch("/api/sendOrderEmail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: userEmail,
              orderNumber,
              serviceName,
              price: servicePrice, // ✅ رسوم الخدمة/الاشتراك
              printingFee,
              vat,
              coinDiscount,
              processingFee,
              finalPrice,
              paymentId: paymentIntent.id,
              paymentMethod: "gateway",
              lang,

              // ✅ Subscription info (non-breaking)
              requestType: isSubscription ? "subscription" : "service",
              planKey: planKey || "",
              subscriptionDays: subDaysToShow || 0,
            }),
          });
        } catch (err) {
          console.warn("sendOrderEmail failed:", err);
        }
      })();

      // 3) UI
      setMsgSuccess(true);
      setPayMsg(LANG[lang].success);

      setTimeout(() => {
        const orderForRedirect = orderNumber || null;

        if (orderForRedirect) {
          router.push(
            `/payment/PaymentSuccess?order=${encodeURIComponent(orderForRedirect)}&lang=${encodeURIComponent(
              lang
            )}`
          );
        } else {
          router.push(`/payment/PaymentSuccess?pi=${encodeURIComponent(paymentIntent.id)}`);
        }

        if (typeof onSuccess === "function") {
          onSuccess(paymentIntent.id, orderForRedirect);
        }
      }, 700);
    } catch (err) {
      console.error("Payment flow error:", err);
      setPayMsg(lang === "ar" ? "حدث خطأ أثناء معالجة الدفع." : "Unexpected payment error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      dir={dir}
      lang={lang}
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl border border-emerald-200 p-7 flex flex-col items-center"
      style={{
        background: "linear-gradient(180deg,#0b131e 0%,#22304a 30%,#122024 60%,#1d4d40 100%)",
      }}
    >
      <Image
        src="/logo-transparent-large.png"
        width={70}
        height={70}
        alt="Logo"
        className="mx-auto mb-2 rounded-full bg-white shadow-lg ring-2 ring-emerald-500"
      />

      <div className="text-emerald-300 font-black text-xl mb-1 text-center">
        {isSubscription ? LANG[lang].subTitle : LANG[lang].title}
      </div>

      <div className="text-gray-200 text-sm mb-4 text-center">{LANG[lang].subtitle}</div>

      <div className="bg-[#22304a]/70 rounded-xl p-4 mb-3 w-full text-center shadow">
        <table className="w-full text-sm text-right mb-2 border-separate border-spacing-y-1">
          <tbody>
            <tr>
              <td className="text-gray-300">{LANG[lang].service}:</td>
              <td className="text-emerald-200 font-bold">{serviceName}</td>
            </tr>

            {isSubscription && (
              <>
                <tr>
                  <td className="text-gray-300">{LANG[lang].subName}:</td>
                  <td className="text-emerald-200 font-bold">{planKey || serviceName}</td>
                </tr>
                <tr>
                  <td className="text-gray-300">{LANG[lang].subDays}:</td>
                  <td className="text-white">
                    {subDaysToShow > 0 ? `${subDaysToShow} ${lang === "ar" ? "يوم" : "days"}` : "-"}
                  </td>
                </tr>
              </>
            )}

            <tr>
              <td className="text-gray-300">{LANG[lang].amount}:</td>
              <td>{servicePrice.toFixed(2)} د.إ</td>
            </tr>

            {printingFee > 0 && (
              <tr>
                <td className="text-gray-300">{LANG[lang].print}:</td>
                <td>{printingFee.toFixed(2)} د.إ</td>
              </tr>
            )}

            {vat > 0 && (
              <tr>
                <td className="text-gray-300">{LANG[lang].vat}:</td>
                <td>{vat.toFixed(2)} د.إ</td>
              </tr>
            )}

            <tr>
              <td className="text-gray-300">{LANG[lang].coinDiscount}:</td>
              <td>
                {coinDiscount && Number(coinDiscount) > 0
                  ? `-${Number(coinDiscount).toFixed(2)} د.إ`
                  : "0 د.إ"}
              </td>
            </tr>

            <tr>
              <td className="text-gray-300">{LANG[lang].processingFee}:</td>
              <td>{processingFee ? `${processingFee.toFixed(2)} د.إ` : "0 د.إ"}</td>
            </tr>

            <tr>
              <td className="text-gray-300">{LANG[lang].totalBeforeDiscount}:</td>
              <td>{totalPrice.toFixed(2)} د.إ</td>
            </tr>

            <tr>
              <td className="font-bold text-emerald-400">{LANG[lang].total}:</td>
              <td className="font-bold text-emerald-300">{finalPrice.toFixed(2)} د.إ</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="w-full mb-3">
        <label className="text-emerald-200 font-bold text-sm mb-1 block">
          {LANG[lang].cardLabel}
        </label>
        <div className="bg-white rounded-lg shadow p-2 border border-emerald-200">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "18px",
                  color: "#22304a",
                  fontFamily: "inherit",
                  direction: dir,
                  letterSpacing: "0.8px",
                  "::placeholder": { color: "#94a3b8" },
                },
                invalid: { color: "#dc2626", iconColor: "#dc2626" },
              },
            }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className={`w-full py-3 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-700 text-white font-black text-lg mt-3 shadow-lg transition hover:scale-105 hover:brightness-110 ${
          loading ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        {loading ? LANG[lang].processing : `${LANG[lang].payBtn} (${finalPrice.toFixed(2)} د.إ)`}
      </button>

      {payMsg && (
        <div
          className={`mt-3 text-center font-bold text-xs flex items-center justify-center gap-1 ${
            msgSuccess ? "text-emerald-400" : "text-red-600"
          }`}
        >
          {msgSuccess ? <span>✅</span> : <span>⚠️</span>}
          <span>{payMsg}</span>
        </div>
      )}

      <div className="w-full text-center mt-6 text-xs text-gray-400 font-semibold flex items-center justify-center gap-2">
        <span>🔒</span>
        {lang === "ar"
          ? "جميع بيانات الدفع مشفرة ومحمية عبر Stripe"
          : "All payment data is encrypted and protected via Stripe"}
      </div>
    </form>
  );
}

export default function CardPaymentPage() {
  const [success, setSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [paymentData, setPaymentData] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("paymentData");
      if (raw) setPaymentData(JSON.parse(raw));
    } catch {
      setPaymentData(null);
    }
  }, []);

  if (!paymentData || !paymentData.clientSecret) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-sans bg-black text-white">
        <div className="text-xl font-bold">
          لم يتم العثور على بيانات الدفع. يرجى العودة للمحفظة أو إعادة المحاولة.
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <PaymentSuccessPage
        paymentId={paymentId}
        amount={paymentData.finalPrice || paymentData.price || 0}
        serviceName={
          paymentData.subscriptionName ||
          paymentData.service?.name ||
          paymentData.serviceName ||
          "اسم غير متوفر"
        }
        orderNumber={orderNumber}
        printingFee={paymentData.service?.printingFee || paymentData.printingFee || 0}
        vat={paymentData.service?.vat || paymentData.vat || 0}
        processingFee={paymentData.processingFee || 0}
        lang={paymentData.lang}
      />
    );
  }

  return (
    <div
      dir={paymentData.lang === "ar" ? "rtl" : "ltr"}
      lang={paymentData.lang}
      className="min-h-screen flex flex-col items-center justify-center font-sans"
      style={{
        background: "linear-gradient(180deg, #0b131e 0%, #22304a 30%, #122024 60%, #1d4d40 100%)",
      }}
    >
      <Elements stripe={stripePromise} options={{ clientSecret: paymentData.clientSecret }}>
        <CardForm
          paymentData={paymentData}
          lang={paymentData.lang}
          onSuccess={(id, orderNum) => {
            setSuccess(true);
            setPaymentId(id);
            setOrderNumber(orderNum);
          }}
        />
      </Elements>
    </div>
  );
}
