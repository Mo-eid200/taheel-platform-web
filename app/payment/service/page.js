"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Image from "next/image";
import { useRouter } from "next/navigation";
import PaymentSuccessPage from "../PaymentSuccess/Page";
import { doc, setDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const LANG = {
  en: {
    title: "Pay for Service",
    subtitle: "Your payment is secure and encrypted.",
    cardLabel: "Card Information",
    payBtn: "Pay Now",
    success: "Payment successful!",
    error: "Payment failed.",
    service: "Service",
    amount: "Amount",
    vat: "VAT",
    print: "Printing Fee",
    coinDiscount: "Coins Discount",
    processingFee: "Processing Fee",
    totalBeforeDiscount: "Total Before Discount",
    total: "Total",
    back: "Back to Home",
    processing: "Processing..."
  },
  ar: {
    title: "دفع الخدمة",
    subtitle: "مدفوعاتك محمية ومشفرة بالكامل.",
    cardLabel: "بيانات البطاقة",
    payBtn: "ادفع الآن",
    success: "تم الدفع بنجاح!",
    error: "فشل الدفع.",
    service: "الخدمة",
    amount: "المبلغ",
    vat: "ضريبة القيمة المضافة",
    print: "رسوم الطباعة",
    coinDiscount: "خصم الكوينات",
    processingFee: "رسوم معالجة الدفع الإلكتروني",
    totalBeforeDiscount: "الإجمالي قبل الخصم",
    total: "الإجمالي",
    back: "العودة للرئيسية",
    processing: "جارٍ الدفع..."
  }
};

// NOTE: this is still a client-side fallback for quick testing.
// Recommended: move this logic server-side (/api/createOrder) for production.
async function createOrderAfterPayment(paymentData, paymentId) {
  try {
    const {
      service,
      orderNumber,
      finalPrice,
      totalPrice,
      printingFee,
      vat,
      coinDiscount,
      userEmail,
      processingFee,
      lang,
      customerId,
      uploadedDocs
    } = paymentData || {};

    const employeeData = service?.employeeData || {};

    const serviceProviders = Array.isArray(service?.providers) ? service.providers : [];
    const isSpecialist =
      serviceProviders.some(
        p =>
          p === employeeData?.providerName ||
          p === employeeData?.speciality ||
          p === employeeData?.id ||
          p === employeeData?.name
      );

    const assignedTo = isSpecialist ? employeeData?.id : "";
    const assignedToName = isSpecialist ? employeeData?.name : "";

    // Decide doc id: prefer orderNumber if available, else use paymentId
    const docId = orderNumber || paymentId;

    const orderDoc = {
      orderNumber: orderNumber || paymentId,
      clientId: customerId || service?.userId,
      clientName: service?.userName,
      serviceId: service?.id,
      serviceName: service?.name,
      price: Number(service?.price) || 0,
      printingFee: Number(service?.printingFee) || Number(printingFee) || 0,
      vat: Number(service?.vat) || Number(vat) || 0,
      coinDiscount: Number(service?.coinDiscount) || Number(coinDiscount) || 0,
      processingFee: Number(processingFee) || 0,
      finalPrice: Number(finalPrice) || Number(totalPrice) || 0,
      status: "paid",
      providers: serviceProviders,
      assignedTo,
      assignedToName,
      createdAt: new Date().toISOString(),
      paymentId,
      userEmail,
      lang,
      uploadedDocs: uploadedDocs || {}
    };

    // Use setDoc with merge:true so existing server-written fields (clientSecret, metadata, etc.) are preserved
    await setDoc(doc(firestore, "requests", String(docId)), orderDoc, { merge: true });

    // Add commission doc if needed (still client-side here)
    if (isSpecialist && Number(service?.printingFee) > 0) {
      const commission = +(Number(service?.printingFee) * 0.2).toFixed(2);
      await setDoc(doc(firestore, "commissions", `${docId}-creation`), {
        employeeId: employeeData?.id,
        orderId: orderNumber || paymentId,
        type: "creation",
        amount: commission,
        timestamp: new Date().toISOString()
      }, { merge: true });
    }

    return docId;
  } catch (error) {
    console.error("خطأ في إنشاء الطلب بعد الدفع:", error);
    throw error;
  }
}

function CardForm({ paymentData, lang = "ar", onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [msgSuccess, setMsgSuccess] = useState(false);

  // استخراج البيانات بأمان
  const serviceName = paymentData?.service?.name || paymentData?.serviceName || "اسم غير متوفر";
  const servicePrice = paymentData?.service?.price || paymentData?.price || 0;
  const printingFee = paymentData?.service?.printingFee || paymentData?.printingFee || 0;
  const vat = paymentData?.service?.vat || paymentData?.vat || 0;
  const coinDiscount = paymentData?.service?.coinDiscount || paymentData?.coinDiscount || 0;
  const totalPrice = paymentData?.totalPrice || paymentData?.price || 0;
  const finalPrice = paymentData?.finalPrice || paymentData?.price || 0;
  const processingFee = paymentData?.processingFee || 0;
  const orderNumber = paymentData?.orderNumber;
  const clientSecret = paymentData?.clientSecret;
  const userEmail = paymentData?.userEmail || paymentData?.service?.userEmail || "";
  const dir = lang === "ar" ? "rtl" : "ltr";

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
      // confirm card payment
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)
        }
      });

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

      // non-blocking: notify server to create/update canonical request (confirmPayment endpoint)
      (async () => {
        try {
          await fetch("/api/confirmPayment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId: paymentIntent.id, requestId: orderNumber ?? null })
          });
        } catch (e) {
          console.warn("confirmPayment call failed:", e);
        }
      })();

      // fire-and-forget send email
      (async () => {
        try {
          await fetch("/api/sendOrderEmail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: userEmail,
              orderNumber,
              serviceName,
              price: servicePrice,
              printingFee,
              vat,
              coinDiscount,
              processingFee,
              finalPrice,
              paymentId: paymentIntent.id,
              paymentMethod: "gateway",
              lang
            })
          });
        } catch (e) {
          console.warn("sendOrderEmail failed:", e);
        }
      })();

      // create/update request locally (merge) — returns doc id used
      let docId = null;
      try {
        docId = await createOrderAfterPayment(paymentData, paymentIntent.id);
      } catch (err) {
        console.warn("createOrderAfterPayment failed:", err);
      }

      // success feedback
      setMsgSuccess(true);
      setPayMsg(LANG[lang].success);

      // redirect to PaymentSuccess route (prefer docId/orderNumber)
      const orderForRedirect = orderNumber || docId || null;
      setTimeout(() => {
        if (orderForRedirect) {
          router.push(`/payment/PaymentSuccess?order=${encodeURIComponent(orderForRedirect)}`);
        } else {
          router.push(`/payment/PaymentSuccess?pi=${encodeURIComponent(paymentIntent.id)}`);
        }
        if (typeof onSuccess === "function") onSuccess(paymentIntent.id, orderForRedirect);
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
        background: "linear-gradient(180deg,#0b131e 0%,#22304a 30%,#122024 60%,#1d4d40 100%)"
      }}
    >
      <Image src="/logo-transparent-large.png" width={70} height={70} alt="Logo" className="mx-auto mb-2 rounded-full bg-white shadow-lg ring-2 ring-emerald-500" />
      <div className="text-emerald-300 font-black text-xl mb-1 text-center">{LANG[lang].title}</div>
      <div className="text-gray-200 text-sm mb-4 text-center">{LANG[lang].subtitle}</div>

      <div className="bg-[#22304a]/70 rounded-xl p-4 mb-3 w-full text-center shadow">
        <table className="w-full text-sm text-right mb-2 border-separate border-spacing-y-1">
          <tbody>
            <tr>
              <td className="text-gray-300">{LANG[lang].service}:</td>
              <td className="text-emerald-200 font-bold">{serviceName}</td>
            </tr>
            <tr>
              <td className="text-gray-300">{LANG[lang].amount}:</td>
              <td>{Number(servicePrice).toFixed(2)} د.إ</td>
            </tr>
            {printingFee > 0 && (
              <tr>
                <td className="text-gray-300">{LANG[lang].print}:</td>
                <td>{Number(printingFee).toFixed(2)} د.إ</td>
              </tr>
            )}
            {vat > 0 && (
              <tr>
                <td className="text-gray-300">{LANG[lang].vat}:</td>
                <td>{Number(vat).toFixed(2)} د.إ</td>
              </tr>
            )}
            <tr>
              <td className="text-gray-300">{LANG[lang].coinDiscount}:</td>
              <td>
                {coinDiscount && Number(coinDiscount) > 0 ? `-${Number(coinDiscount).toFixed(2)} د.إ` : "0 د.إ"}
              </td>
            </tr>
            <tr>
              <td className="text-gray-300">{LANG[lang].processingFee}:</td>
              <td>{processingFee ? `${Number(processingFee).toFixed(2)} د.إ` : "0 د.إ"}</td>
            </tr>
            <tr>
              <td className="text-gray-300">{LANG[lang].totalBeforeDiscount}:</td>
              <td>{Number(totalPrice).toFixed(2)} د.إ</td>
            </tr>
            <tr>
              <td className="font-bold text-emerald-400">{LANG[lang].total}:</td>
              <td className="font-bold text-emerald-300">{Number(finalPrice).toFixed(2)} د.إ</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="w-full mb-3">
        <label className="text-emerald-200 font-bold text-sm mb-1 block">{LANG[lang].cardLabel}</label>
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
                  "::placeholder": { color: "#94a3b8" }
                },
                invalid: { color: "#dc2626", iconColor: "#dc2626" }
              }
            }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className={`w-full py-3 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-700 text-white font-black text-lg mt-3 shadow-lg transition hover:scale-105 hover:brightness-110 ${loading ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {loading ? LANG[lang].processing : `${LANG[lang].payBtn} (${Number(finalPrice).toFixed(2)} د.إ)`}
      </button>

      {payMsg && (
        <div className={`mt-3 text-center font-bold text-xs flex flex-row items-center justify-center gap-1 ${msgSuccess ? "text-emerald-400" : "text-red-600"}`}>
          {msgSuccess ? <span>✅</span> : <span>⚠️</span>}
          <span>{payMsg}</span>
        </div>
      )}

      <div className="w-full text-center mt-6 text-xs text-gray-400 font-semibold flex items-center justify-center gap-2">
        <span>🔒</span>
        {lang === "ar" ? "جميع بيانات الدفع مشفرة ومحمية عبر Stripe" : "All payment data is encrypted and protected via Stripe"}
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
    const data = JSON.parse(localStorage.getItem("paymentData"));
    setPaymentData(data);
  }, []);

  if (!paymentData || !paymentData.clientSecret) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-sans bg-black text-white">
        <div className="text-xl font-bold">لم يتم العثور على بيانات الدفع. يرجى العودة للمحفظة أو إعادة المحاولة.</div>
      </div>
    );
  }

  if (success) {
    return (
      <PaymentSuccessPage
        paymentId={paymentId}
        amount={paymentData.finalPrice || paymentData.price || 0}
        serviceName={paymentData.service?.name || paymentData.serviceName || "اسم غير متوفر"}
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
      style={{ background: "linear-gradient(180deg, #0b131e 0%, #22304a 30%, #122024 60%, #1d4d40 100%)" }}
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