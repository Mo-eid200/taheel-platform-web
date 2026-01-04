"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore, auth } from "@/lib/firebase.client";
import { useRouter } from "next/navigation";
import CompanyPlanCard from "./CompanyPlanCard";

// ✅ لو Stripe API عندك بيتوقع amount بالـ fils/cents (AED * 100) خليها true
const SEND_AMOUNT_IN_SMALLEST_UNIT = false;

// ✅ لو عايز تفصل بين دفع الاشتراكات والخدمات (اختياري)
const PAYMENT_STORAGE_KEY = "paymentData"; // أو: "paymentData_subscription"

function toNumberSafe(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function calcDays(subscriptionDays, monthsShown) {
  const sd = toNumberSafe(subscriptionDays || 0);
  if (Number.isFinite(sd) && sd > 0) return Math.max(0, Math.round(sd));

  const m = toNumberSafe(monthsShown || 0);
  if (Number.isFinite(m) && m > 0) return Math.max(0, Math.round(m * 30));

  return 0;
}

export default function CompanySubscriptionsSection({
  lang = "ar",
  darkMode = false,
  onSubscribe, // optional external callback
}) {
  const router = useRouter();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false); // ✅ منع دبل كليك

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(firestore, "companySubscriptionPlans"));
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const filtered = arr
          .filter((p) => p?.isActive !== false)
          .sort((a, b) => (a?.sortIndex ?? 999) - (b?.sortIndex ?? 999));

        if (alive) setPlans(filtered);
      } catch (e) {
        console.error("load plans failed:", e);
        if (alive) setPlans([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const handleSubscribe = useCallback(
    async ({
      planKey,
      pricingKey,
      price,
      monthsShown,
      paidMonths,
      bonus,
      isOffer,
      isMost,
      subscriptionName,
      subscriptionDays,
    }) => {
      // ✅ لو الأب متحكم
      if (typeof onSubscribe === "function") {
        return onSubscribe({
          planKey,
          pricingKey,
          price,
          monthsShown,
          paidMonths,
          bonus,
          isOffer,
          isMost,
          subscriptionName,
          subscriptionDays,
        });
      }

      if (submitting) return; // ✅ safety
      setSubmitting(true);

      try {
        const user = auth.currentUser;
        if (!user) {
          alert(lang === "ar" ? "لازم تسجل دخول الأول" : "Please login first");
          router.push("/login");
          return;
        }

        // ✅ سعر آمن
        const basePrice = toNumberSafe(price);
        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          alert(lang === "ar" ? "السعر غير صالح" : "Invalid price");
          return;
        }

        // ✅ أيام آمنة
        const days = calcDays(subscriptionDays, monthsShown);

        const subName =
          subscriptionName?.trim?.() ||
          (lang === "ar" ? `اشتراك ${planKey}` : `Subscription ${planKey}`);

        // ✅ amount حسب نظام السيرفر
        const amountForServer = SEND_AMOUNT_IN_SMALLEST_UNIT
          ? Math.round(basePrice * 100)
          : basePrice;

        const payload = {
          amount: amountForServer,
          serviceId: `subscription_${planKey}`,
          serviceName: subName,

          customerId: user.uid,
          userEmail: user.email,
          clientType: "company",
          attachments: {},
          providers: [],
          requestType: "subscription",

          coinsUsed: 0,
          coinsGiven: 0,
          printingFee: 0,
          vat: 0,
          processingFee: 0,

          assignedTo: "",
          assignedToName: "",
          status: "pending",
          employeeData: {},

          planKey,
          pricingKey,
          monthsShown,
          paidMonths,
          bonus,
          isOffer,
          isMost,
          subscriptionDays: days,
          subscriptionName: subName,
          lang,
        };

        const r = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) {
          throw new Error(data?.error || "Failed to create payment intent");
        }

        // ✅ رسوم Stripe + final
        const processingFeeFromServer = toNumberSafe(data?.processingFee ?? 0);
        const finalFromServer = toNumberSafe(data?.finalPrice);

        const processingFeeSafe = Number.isFinite(processingFeeFromServer)
          ? processingFeeFromServer
          : 0;

        // هنا العرض في الواجهة بالدرهم دائمًا
        const totalBefore = basePrice;
        const final = Number.isFinite(finalFromServer)
          ? finalFromServer
          : totalBefore + processingFeeSafe;

        const paymentDataForUI = {
          lang,
          requestType: "subscription",

          clientSecret: data.clientSecret,
          orderNumber: data.orderNumber,

          serviceId: `subscription_${planKey}`,
          serviceName: subName,
          subscriptionName: subName,
          planKey,
          pricingKey,
          subscriptionDays: days,

          price: totalBefore,
          totalPrice: totalBefore,
          finalPrice: final,

          printingFee: 0,
          vat: 0,
          coinDiscount: 0,
          processingFee: processingFeeSafe,

          userEmail: user.email,
        };

        localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(paymentDataForUI));
        router.push("/payment/service");
      } catch (e) {
        console.error("subscribe failed:", e);
        alert(lang === "ar" ? "حصل خطأ أثناء بدء الدفع" : "Failed to start payment");
      } finally {
        setSubmitting(false);
      }
    },
    [onSubscribe, lang, router, submitting]
  );

  const emptyText = useMemo(
    () => (lang === "ar" ? "لا توجد باقات متاحة حالياً." : "No plans available right now."),
    [lang]
  );

  if (loading) {
    return (
      <div className="w-full flex justify-center py-10 text-white/80">
        {lang === "ar" ? "جاري تحميل الباقات..." : "Loading plans..."}
      </div>
    );
  }

  if (!plans.length) {
    return <div className="w-full text-center py-10 text-white/70">{emptyText}</div>;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <CompanyPlanCard
            key={plan.id}
            plan={plan}
            lang={lang}
            darkMode={darkMode}
            onSubscribe={handleSubscribe}
            disabled={submitting} // ✅ لو الكارد بيدعمها
          />
        ))}
      </div>
    </div>
  );
}
