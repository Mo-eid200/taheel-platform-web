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
import { firestore } from "@/lib/firebase.client";
import {
  doc,
  updateDoc,
  getDoc,
  collection,
  addDoc,
} from "firebase/firestore";
import calcStripeFees from "@/utils/calcStripeFees";

// Stripe publishable key
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

// ================== Language strings ==================
const LANG = {
  en: {
    title: "Recharge Wallet",
    subtitle: "Your payment is secure and encrypted.",
    cardLabel: "Card Information",
    payBtn: "Recharge",
    success: "Wallet recharge successful!",
    thanks:
      "Thank you for your trust! Your wallet has been recharged.",
    error: "Payment failed.",
    amount: "Amount",
    coins: "Bonus Coins",
    total: "Total Recharge",
    processing: "Processing...",
    redirectMsg: "Redirecting to your account...",
    processingFee: "Processing Fee",
    totalAfterFee: "Total After Fees",
    txnId: "Transaction ID",
  },
  ar: {
    title: "شحن المحفظة",
    subtitle: "مدفوعاتك محمية ومشفرة بالكامل.",
    cardLabel: "بيانات البطاقة",
    payBtn: "شحن الآن",
    success: "تم شحن المحفظة بنجاح!",
    thanks: "شكرًا على ثقتكم! تم شحن محفظتكم بنجاح.",
    error: "فشل الدفع.",
    amount: "المبلغ",
    coins: "كوينات مجانية",
    total: "إجمالي الشحن",
    processing: "جارٍ الدفع...",
    redirectMsg: "يتم تحويلك إلى حسابك...",
    processingFee: "رسوم معالجة الدفع الإلكتروني",
    totalAfterFee: "الإجمالي بعد الرسوم",
    txnId: "رقم العملية",
  },
};

// ================== Form component ==================
function WalletCardForm({ paymentData, lang = "ar", onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [msgSuccess, setMsgSuccess] = useState(false);

  const { amount, coinsBonus, clientSecret, customerId, userEmail } =
    paymentData;

  const dir = lang === "ar" ? "rtl" : "ltr";

  // احسب رسوم Stripe عشان نعرضها للزبون
  const { stripeFee: processingFee, totalAmount: finalAmount } =
    calcStripeFees(amount || 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setMsgSuccess(false);
    setPayMsg("");

    // 1) تأكيد الدفع مع Stripe
    const card = elements.getElement(CardElement);
    const { error: stripeError, paymentIntent } =
      await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
        },
      });

    if (stripeError) {
      setPayMsg(stripeError.message || LANG[lang].error);
      setLoading(false);
      return;
    }

    // safety: لازم الدفع يكون ناجح فعلاً
    if (!paymentIntent || paymentIntent.status !== "succeeded") {
      setPayMsg(LANG[lang].error);
      setLoading(false);
      return;
    }

    // 2) حدّث رصيد العميل والكوينز
    const userRef = doc(firestore, "users", customerId);
    const userSnap = await getDoc(userRef);

    let currentWallet = 0;
    let currentCoins = 0;

    if (userSnap.exists()) {
      const data = userSnap.data();
      currentWallet = Number(data.walletBalance ?? 0);
      currentCoins = Number(data.coins ?? 0);
    }

    const newWalletBalance = currentWallet + Number(amount || 0);
    const newCoinsBalance = currentCoins + Number(coinsBonus || 0);

    await updateDoc(userRef, {
      walletBalance: newWalletBalance,
      coins: newCoinsBalance,
    });

    // 3) سجل Notification للعميل (هيبان في NotificationWidget)
    await addDoc(collection(firestore, "notifications"), {
      targetId: customerId,
      title: lang === "ar" ? "تم شحن المحفظة" : "Wallet Recharged",
      body:
        lang === "ar"
          ? `تم شحن محفظتك بـ${Number(amount).toFixed(
              2
            )} درهم، وتم إضافة ${Number(
              coinsBonus
            )} كوين!`
          : `Wallet recharged with ${Number(amount).toFixed(
              2
            )} AED, plus ${Number(coinsBonus)} bonus coins!`,
      timestamp: new Date().toISOString(),
      isRead: false,
      type: "wallet_recharge",
      paymentIntentId: paymentIntent.id,
      amountAED: Number(amount),
      coinsBonus: Number(coinsBonus),
    });

    // 4) ابعت إيميل تأكيد (API عندك مسؤول يرسل الإيميل)
    try {
      await fetch("/api/sendWalletEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: userEmail,
          amount: Number(amount),
          coinsBonus: Number(coinsBonus),
          walletTotal: newWalletBalance,
          coinsTotal: newCoinsBalance,
          lang,
          processingFee,
          finalAmount,
          paymentIntentId: paymentIntent.id,
        }),
      });
    } catch (err) {
      // لو الميل فشل، مش هنكسّر التجربة. بنطنّش الغلط هنا.
      console.warn("sendWalletEmail failed:", err);
    }

    // 5) اعلّم الواجهة انه النجاح تم
    setMsgSuccess(true);
    setPayMsg(LANG[lang].success);

    // رجّع الـ paymentIntent.id للأب عشان يعرضه في شاشة الـ success
    onSuccess(paymentIntent.id);

    setLoading(false);
  }

  return (
    <form
      dir={dir}
      lang={lang}
      onSubmit={handleSubmit}
      className="max-w-md mx-auto rounded-3xl shadow-2xl border border-emerald-200 p-7 flex flex-col items-center"
      style={{
        background:
          "linear-gradient(180deg,#0b131e 0%,#22304a 30%,#122024 60%,#1d4d40 100%)",
      }}
    >
      {/* Logo + Heading */}
      <Image
        src="/logo-transparent-large.png"
        width={70}
        height={70}
        alt="Logo"
        className="mx-auto mb-2 rounded-full bg-white shadow-lg ring-2 ring-emerald-500"
      />

      <div className="text-emerald-300 font-black text-xl mb-1 text-center">
        {LANG[lang].title}
      </div>
      <div className="text-gray-200 text-sm mb-4 text-center">
        {LANG[lang].subtitle}
      </div>

      {/* Summary box */}
      <div className="bg-[#22304a]/70 rounded-xl p-4 mb-3 w-full text-center shadow">
        <table className="w-full text-sm text-right mb-2 border-separate border-spacing-y-1">
          <tbody>
            <tr>
              <td className="text-gray-300">{LANG[lang].amount}:</td>
              <td className="text-emerald-200 font-bold">
                {Number(amount).toFixed(2)} د.إ
              </td>
            </tr>
            <tr>
              <td className="text-gray-300">{LANG[lang].coins}:</td>
              <td className="text-yellow-400 font-bold">
                {Number(coinsBonus)} كوين
              </td>
            </tr>
            <tr>
              <td className="text-gray-300">{LANG[lang].processingFee}:</td>
              <td className="text-emerald-200 font-bold">
                {processingFee.toFixed(2)} د.إ
              </td>
            </tr>
            <tr>
              <td className="font-bold text-emerald-400">
                {LANG[lang].total}:
              </td>
              <td className="font-bold text-emerald-300">
                {Number(amount).toFixed(2)} د.إ
              </td>
            </tr>
            <tr>
              <td className="font-bold text-emerald-400">
                {LANG[lang].totalAfterFee}:
              </td>
              <td className="font-bold text-emerald-300">
                {finalAmount.toFixed(2)} د.إ
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Card input */}
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
                  "::placeholder": {
                    color: "#94a3b8",
                  },
                },
                invalid: {
                  color: "#dc2626",
                  iconColor: "#dc2626",
                },
              },
            }}
          />
        </div>
      </div>

      {/* Pay button */}
      <button
        type="submit"
        disabled={!stripe || loading}
        className={`w-full py-3 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-700 text-white font-black text-lg mt-3 shadow-lg transition hover:scale-105 hover:brightness-110 ${
          loading
            ? "opacity-40 cursor-not-allowed"
            : "cursor-pointer"
        }`}
      >
        {loading
          ? LANG[lang].processing
          : `${LANG[lang].payBtn} (${finalAmount.toFixed(
              2
            )} د.إ)`}
      </button>

      {/* Status / error */}
      {payMsg && (
        <div
          className={`mt-3 text-center font-bold text-xs flex flex-row items-center justify-center gap-1 ${
            msgSuccess ? "text-emerald-400" : "text-red-600"
          }`}
        >
          <span>{msgSuccess ? "✅" : "⚠️"}</span>
          <span>{payMsg}</span>
        </div>
      )}

      {/* Stripe safety text */}
      <div className="w-full text-center mt-6 text-xs text-gray-400 font-semibold flex items-center justify-center gap-2">
        <span>🔒</span>
        {lang === "ar"
          ? "جميع بيانات الدفع مشفرة ومحمية عبر Stripe"
          : "All payment data is encrypted and protected via Stripe"}
      </div>
    </form>
  );
}

// ================== Page wrapper ==================
export default function WalletRechargePage() {
  const [success, setSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [paymentData, setPaymentData] = useState(null);

  const router = useRouter();

  // ناخد بيانات الدفع اللي اتحضرت قبل الشحن (amount, coinsBonus, clientSecret, customerId, userEmail, lang...)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("walletRechargeData");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setPaymentData(parsed || null);
    } catch (err) {
      console.warn("walletRechargeData parse failed:", err);
      setPaymentData(null);
    }
  }, []);

  // بعد النجاح: نعرض شاشة success ثُم نحوله على صفحة البروفايل بتاعته
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => {
      // لو عندك صفحة البروفايل هي /dashboard/client/profile?userId=...
      // وقدرنا نستنتج الـ customerId من paymentData:
      if (paymentData?.customerId) {
        router.push(
          `/dashboard/client/profile?userId=${encodeURIComponent(
            paymentData.customerId
          )}&lang=${encodeURIComponent(
            paymentData.lang || "ar"
          )}`
        );
      } else {
        // fallback عام
        router.push("/dashboard/client/profile");
      }
    }, 3000);

    return () => clearTimeout(t);
  }, [success, paymentData, router]);

  // لو مافيش بيانات أصلاً (حد دخل الصفحة دي يدوي)
  if (!paymentData || !paymentData.clientSecret) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-sans bg-black text-white p-6 text-center">
        <div className="text-xl font-bold mb-3">
          لم يتم العثور على بيانات الشحن.
        </div>
        <div className="text-sm text-gray-300 mb-6">
          يرجى العودة للمحفظة أو إعادة المحاولة.
        </div>
        <button
          onClick={() => router.push("/dashboard/client/profile")}
          className="px-4 py-2 rounded-full bg-emerald-600 text-white font-bold shadow"
        >
          العودة للوحة التحكم
        </button>
      </div>
    );
  }

  // شاشة النجاح بعد الدفع
  if (success) {
    const lang = paymentData.lang || "ar";
    const { stripeFee, totalAmount } = calcStripeFees(
      paymentData.amount || 0
    );

    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-sans bg-black text-white animate-fade-in p-6 text-center">
        <Image
          src="/logo-transparent-large.png"
          width={90}
          height={90}
          alt="Logo"
          className="mb-6 rounded-full shadow-lg ring-2 ring-emerald-500 bg-white"
        />

        <div className="text-emerald-400 text-2xl font-black mb-4">
          {LANG[lang].success}
        </div>

        <div className="text-lg mb-3">
          {LANG[lang].amount}:{" "}
          {Number(paymentData.amount).toFixed(2)} د.إ
        </div>

        <div className="text-lg mb-3">
          {LANG[lang].coins}: {Number(paymentData.coinsBonus)} كوين
        </div>

        <div className="text-lg mb-3">
          {LANG[lang].processingFee}: {stripeFee.toFixed(2)} د.إ
        </div>

        <div className="text-lg mb-3">
          {LANG[lang].totalAfterFee}:{" "}
          {totalAmount.toFixed(2)} د.إ
        </div>

        <div className="text-lg mb-3">
          {LANG[lang].txnId}: {paymentId}
        </div>

        <div className="mt-8 text-xl font-bold text-emerald-300 animate-bounce">
          {LANG[lang].thanks}
        </div>

        <div className="flex flex-col items-center justify-center mt-6 gap-2">
          <div
            className="loader"
            style={{
              border: "6px solid #22304a",
              borderTop: "6px solid #34d399",
              borderRadius: "50%",
              width: "45px",
              height: "45px",
              animation: "spin 1s linear infinite",
            }}
          />
          <div className="mt-2 text-gray-300">
            {LANG[lang].redirectMsg}
          </div>
        </div>

        <style jsx>{`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // شاشة الـ form (الدفع لسه ماحصلش)
  return (
    <div
      dir={paymentData.lang === "ar" ? "rtl" : "ltr"}
      lang={paymentData.lang}
      className="min-h-screen flex flex-col items-center justify-center font-sans"
      style={{
        background:
          "linear-gradient(180deg, #0b131e 0%, #22304a 30%, #122024 60%, #1d4d40 100%)",
      }}
    >
      <Elements
        stripe={stripePromise}
        options={{ clientSecret: paymentData.clientSecret }}
      >
        <WalletCardForm
          paymentData={paymentData}
          lang={paymentData.lang}
          onSuccess={(id) => {
            setSuccess(true);
            setPaymentId(id);
          }}
        />
      </Elements>
    </div>
  );
}
