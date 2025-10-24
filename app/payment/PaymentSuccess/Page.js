"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import ErrorBoundary from "@/components/ErrorBoundary";

/* صفحة نجاح الدفع — نسخة مُحسّنة بحراسة إضافية وعرض لوج واضح */
const clientDashboardPath = "/dashboard/client/profile";

function safeNumber(v) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function fmtAmount(v) {
  return safeNumber(v).toFixed(2);
}

function PaymentSuccessInner({ langParam, search, router }) {
  const order = search.get("order");
  const pi = search.get("pi");

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(6);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (order) {
          const ref = doc(firestore, "requests", order);
          const snap = await getDoc(ref);
          if (!mounted) return;
          if (!snap.exists()) {
            setError(langParam === "ar" ? "لم يتم العثور على الطلب." : "Order not found.");
            setPayment(null);
          } else {
            setPayment({ id: snap.id, ...snap.data() });
          }
        } else if (pi) {
          const q = query(collection(firestore, "requests"), where("paymentIntentId", "==", pi));
          const qs = await getDocs(q);
          if (!mounted) return;
          if (qs.empty) {
            setError(langParam === "ar" ? "لا يوجد طلب مرتبط بمعرف الدفع هذا." : "No request found for this payment id.");
            setPayment(null);
          } else {
            const docSnap = qs.docs[0];
            setPayment({ id: docSnap.id, ...docSnap.data() });
          }
        } else {
          setError(langParam === "ar" ? "لم يتم استدعاء الصفحة مع رقم الطلب." : "No order or payment id provided.");
          setPayment(null);
        }
      } catch (e) {
        console.error("PaymentSuccess load error:", e);
        if (!mounted) return;
        setError(langParam === "ar" ? "فشل في جلب بيانات الطلب." : "Failed to load payment data.");
        setPayment(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [order, pi, langParam]);

  // countdown redirect
  useEffect(() => {
    if (!payment) return;
    let mounted = true;
    let t = setInterval(() => {
      setCountdown((c) => {
        if (!mounted) return 0;
        if (c <= 1) {
          clearInterval(t);
          try {
            const redirectBase = payment.redirectTo || clientDashboardPath;
            const orderId = payment.requestId || payment.orderNumber || payment.id || null;
            const target = orderId ? `${redirectBase}?order=${encodeURIComponent(orderId)}` : redirectBase;
            router.push(target);
          } catch (err) {
            console.error("Redirect error:", err);
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { mounted = false; if (t) clearInterval(t); };
  }, [payment, router]);

  const t = (ar, en) => (langParam === "ar" ? ar : en);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-emerald-900 text-white p-6">
        <div className="text-center space-y-3">
          <div className="animate-pulse text-2xl font-bold">{t("جارٍ استرجاع بيانات الدفع...", "Loading payment data...")}</div>
          <div className="text-sm text-white/75">{t("يرجى الانتظار لحظة.", "Please wait a moment.")}</div>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-emerald-900 text-white p-6">
        <div className="max-w-lg w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
          <h2 className="text-xl font-bold mb-2">{t("تعذر عرض تفاصيل الدفع", "Unable to show payment details")}</h2>
          <p className="mb-4 text-sm text-white/80">{error || t("الطلب غير موجود.", "Order not found.")}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => router.push("/")} className="px-4 py-2 bg-emerald-500 rounded text-white font-semibold">{t("العودة للرئيسية","Back to home")}</button>
            <button onClick={() => router.push(clientDashboardPath)} className="px-4 py-2 border rounded text-white border-white/20">{t("الذهاب للوحة التحكم","Go to dashboard")}</button>
          </div>
        </div>
      </div>
    );
  }

  // safe access to fields (prevent rendering objects)
  const service = (payment.service && typeof payment.service === "object") ? payment.service : {};
  const tracking = String(payment.requestId || payment.orderNumber || payment.id || "");
  const paidAmount = safeNumber(payment.paidAmount ?? payment.finalPrice ?? 0);
  const printingFee = safeNumber(payment.printingFee ?? 0);
  const vat = safeNumber(payment.tax ?? payment.vat ?? 0);
  const processingFee = safeNumber(payment.processingFee ?? 0);
  let paidAtStr = "-";
  try { if (payment.paidAt) paidAtStr = new Date(payment.paidAt).toLocaleString(); } catch(e){ paidAtStr = String(payment.paidAt || "-"); }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-emerald-900 p-6">
      <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-lg text-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white text-3xl font-extrabold shadow">✓</div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">{t("تم استلام الدفع","Payment received")}</h1>
            <p className="text-sm text-white/80">{t("شكراً لثقتك في تأهيل — جارٍ العمل على طلبك الآن.","Thanks for trusting Taheel — we are processing your order now.")}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="bg-white/3 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">{t("تفاصيل الطلب","Order details")}</h3>
            <dl className="text-sm text-white/90 space-y-2">
              <div><span className="font-semibold">{t("رقم التتبع","Tracking No.")}:</span> <span className="font-mono ml-2">{tracking}</span></div>
              <div><span className="font-semibold">{t("الخدمة","Service")}:</span> <span className="ml-2">{service.name || payment.serviceName || t("غير محدد","Not specified")}</span></div>
              <div><span className="font-semibold">{t("حالة الطلب","Status")}:</span> <span className="ml-2">{payment.status || "paid"}</span></div>
              <div><span className="font-semibold">{t("المسؤول/الموظف","Assigned to")}:</span> <span className="ml-2">{payment.assignedToName || payment.assignedTo || t("سيتم التعيين لاحقاً","Will be assigned")}</span></div>
            </dl>
          </section>

          <section className="bg-white/3 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">{t("ملخص الدفع","Payment summary")}</h3>
            <dl className="text-sm text-white/90 space-y-2">
              <div><span className="font-semibold">{t("المبلغ المدفوع","Paid")}:</span> <span className="ml-2">{fmtAmount(paidAmount)} د.إ</span></div>
              <div><span className="font-semibold">{t("رسوم الطباعة","Printing fee")}:</span> <span className="ml-2">{fmtAmount(printingFee)} د.إ</span></div>
              <div><span className="font-semibold">{t("الضريبة","VAT")}:</span> <span className="ml-2">{fmtAmount(vat)} د.إ</span></div>
              <div><span className="font-semibold">{t("رسوم المعالجة","Processing fee")}:</span> <span className="ml-2">{fmtAmount(processingFee)} د.إ</span></div>
              <div><span className="font-semibold">{t("تاريخ الدفع","Paid at")}:</span> <span className="ml-2">{paidAtStr}</span></div>
            </dl>
          </section>
        </div>

        <div className="mt-6 bg-white/3 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-2">{t("ملاحظات","Notes")}</h3>
          <p className="text-sm text-white/80">{t("جاري العمل على طلبكم. سنوافيكم بالتحديثات عبر لوحة التحكم والإشعارات. شكراً لثقتكم في تأهيل.","We are working on your order. We'll update you via your dashboard and notifications. Thanks for choosing Taheel.")}</p>
        </div>

        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm text-white/80">{t("سيتم تحويلك تلقائيًا إلى صفحة حسابك خلال","You will be redirected to your account in")} <span className="font-bold text-emerald-300">{countdown}</span> {t("ثوانٍ","s")}</div>

          <div className="flex gap-2">
            <button onClick={() => {
              const redirectBase = payment.redirectTo || clientDashboardPath;
              const orderId = payment.requestId || payment.orderNumber || payment.id || null;
              const target = orderId ? `${redirectBase}?order=${encodeURIComponent(orderId)}` : redirectBase;
              router.push(target);
            }} className="px-4 py-2 bg-emerald-500 rounded text-white font-semibold">{t("اذهب الآن","Go now")}</button>

            <button onClick={() => router.push("/")} className="px-4 py-2 border rounded text-white border-white/20">{t("العودة للرئيسية","Back to home")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessRouteWrapper() {
  const router = useRouter();
  const search = useSearchParams();
  const langParam = search.get("lang") || "ar";

  return (
    <ErrorBoundary>
      <PaymentSuccessInner langParam={langParam} search={search} router={router} />
    </ErrorBoundary>
  );
}