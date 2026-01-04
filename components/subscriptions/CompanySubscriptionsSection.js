"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore, auth } from "@/lib/firebase.client";
import { useRouter } from "next/navigation";
import CompanyPlanCard from "./CompanyPlanCard";

export default function CompanySubscriptionsSection({
  lang = "ar",
  darkMode = false,
  onSubscribe, // optional external callback
}) {
  const router = useRouter();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(
          collection(firestore, "companySubscriptionPlans")
        );
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

  // ✅ ده اللي هيتنفّذ لما المستخدم يضغط "اشترك الآن"
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

      // ✅ optional values from card (لو ضفناهم)
      subscriptionName,
      subscriptionDays,
    }) => {
      // لو الأب باعت onSubscribe سيبه هو يتحكم
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

      try {
        const user = auth.currentUser;
        if (!user) {
          alert(lang === "ar" ? "لازم تسجل دخول الأول" : "Please login first");
          router.push("/login");
          return;
        }

        // ✅ مدة الاشتراك بالأيام (لو مش مبعوتة نحسبها من monthsShown)
        const days =
          Number(subscriptionDays || 0) > 0
            ? Number(subscriptionDays)
            : Number(monthsShown || 0) > 0
            ? Number(monthsShown) * 30
            : 0;

        const subName =
          subscriptionName ||
          (lang === "ar" ? `اشتراك ${planKey}` : `Subscription ${planKey}`);

        // ✅ نفس ستايل دفع الخدمات: create payment intent
        const payload = {
          amount: Number(price), // AED (قيمة الاشتراك فقط)
          serviceId: `subscription_${planKey}`, // ✅ underscore
          serviceName: subName,

          customerId: user.uid,
          userEmail: user.email,
          clientType: "company",
          attachments: {},
          providers: [],
          requestType: "subscription",

          // ✅ لا VAT ولا طباعة ولا كوينز في الاشتراك
          coinsUsed: 0,
          coinsGiven: 0,
          printingFee: 0,
          vat: 0,

          // ✅ رسوم Stripe هتيجي من السيرفر (processingFee)
          processingFee: 0,

          assignedTo: "",
          assignedToName: "",
          status: "pending",
          employeeData: {},

          // ✅ بيانات الاشتراك
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

        const data = await r.json();
        if (!r.ok || !data?.ok)
          throw new Error(data?.error || "Failed to create payment intent");

        // ✅ هنا التعديل المهم:
        // نخزن paymentData ونروح لنفس بوابة دفع الخدمات: /payment/service
        const processingFeeFromServer = Number(data?.processingFee ?? 0);
        const totalBefore = Number(price);
        const final = Number(data?.finalPrice ?? totalBefore + processingFeeFromServer);

        const paymentDataForUI = {
          lang,
          requestType: "subscription",

          // required by payment page:
          clientSecret: data.clientSecret,
          orderNumber: data.orderNumber,

          // display:
          serviceId: `subscription_${planKey}`,
          serviceName: subName,
          subscriptionName: subName,
          planKey,
          pricingKey,
          subscriptionDays: days,

          price: totalBefore, // قيمة الاشتراك
          totalPrice: totalBefore, // قبل رسوم Stripe
          finalPrice: final, // بعد رسوم Stripe

          printingFee: 0,
          vat: 0,
          coinDiscount: 0,
          processingFee: processingFeeFromServer,

          userEmail: user.email,
        };

        localStorage.setItem("paymentData", JSON.stringify(paymentDataForUI));

        // ✅ نفس صفحة الخدمات بالظبط
        router.push("/payment/service");
      } catch (e) {
        console.error("subscribe failed:", e);
        alert(lang === "ar" ? "حصل خطأ أثناء بدء الدفع" : "Failed to start payment");
      }
    },
    [onSubscribe, lang, router]
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
            onSubscribe={handleSubscribe} // ✅ الربط الحقيقي
          />
        ))}
      </div>
    </div>
  );
}
