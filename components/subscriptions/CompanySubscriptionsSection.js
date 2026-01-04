"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore, auth } from "@/lib/firebase.client";
import { useRouter } from "next/navigation";
import CompanyPlanCard from "./CompanyPlanCard";

export default function CompanySubscriptionsSection({
  lang = "ar",
  darkMode = false,
  onSubscribe, // optional external callback (لو عايز تتحكم من برّه)
}) {
  const router = useRouter();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // ✅ ده اللي هيتنفّذ لما المستخدم يضغط "اشترك الآن"
  const handleSubscribe = useCallback(
    async ({ planKey, pricingKey, price, monthsShown, paidMonths, bonus, isOffer, isMost }) => {
      // لو الأب باعت onSubscribe (من برّه) سيبه هو يتحكم
      if (typeof onSubscribe === "function") {
        return onSubscribe({ planKey, pricingKey, price, monthsShown, paidMonths, bonus, isOffer, isMost });
      }

      try {
        const user = auth.currentUser;
        if (!user) {
          alert(lang === "ar" ? "لازم تسجل دخول الأول" : "Please login first");
          router.push("/login");
          return;
        }

        // ✅ نفس ستايل دفع الخدمات: create payment intent
        const payload = {
          amount: Number(price), // AED
          serviceId: `subscription_${planKey}`, // ✅ خليها underscore عشان detect يبقى ثابت
          serviceName: lang === "ar" ? `اشتراك ${planKey}` : `Subscription ${planKey}`,
          customerId: user.uid, // نفس doc id في users
          userEmail: user.email,
          clientType: "company",
          attachments: {},
          providers: [],
          requestType: "subscription",

          coinsUsed: 0,
          coinsGiven: 0,
          printingFee: 0,
          processingFee: 0,

          assignedTo: "",
          assignedToName: "",
          status: "pending",
          employeeData: {},

          // ✅ مهم للاشتراك (هتحتاجه في الويبهوك/confirm)
          planKey,
          pricingKey,
          monthsShown,
          paidMonths,
          bonus,
          isOffer,
          isMost,
          lang,
        };

        const r = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await r.json();
        if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed to create payment intent");

        // ✅ جهّز paymentData لصفحة /payment/service (نفس منطق الخدمات)
        const subscriptionDays = Math.round(Number(monthsShown || 0) * 30); // باليوم

        const paymentData = {
          clientSecret: data.clientSecret,
          orderNumber: data.orderNumber,
          userEmail: user.email,
          lang,

          requestType: "subscription",
          planKey,
          pricingKey,
          subscriptionName: lang === "ar" ? `اشتراك ${planKey}` : `Subscription ${planKey}`,
          subscriptionDays,

          // مبالغ
          price: Number(price),
          totalPrice: Number(price),
          finalPrice: Number(price),

          // رسوم
          processingFee: 0,
          printingFee: 0,
          vat: 0,
          coinDiscount: 0,
        };

        localStorage.setItem("paymentData", JSON.stringify(paymentData));

        // ✅ روح لنفس صفحة دفع الخدمات
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
            onSubscribe={handleSubscribe} // ✅ هنا الربط الحقيقي
          />
        ))}
      </div>
    </div>
  );
}
