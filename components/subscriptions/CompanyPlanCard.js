"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import CompanyPlanCardPro from "./CompanyPlanCardPro";

const PACKAGE_ORDER = { starter: 1, growth: 2, scale: 3, enterprise: 4 };

export default function CompanySubscriptionsSection({ lang = "ar", darkMode = true, router }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(firestore, "companySubscriptionPlans"));
        const arr = snap.docs
          .map((d) => ({ id: d.id, key: d.id, ...d.data() }))
          .filter((p) => p.isActive !== false);

        arr.sort((a, b) => (PACKAGE_ORDER[a.key] || 99) - (PACKAGE_ORDER[b.key] || 99));

        if (alive) setPlans(arr);
      } catch (e) {
        console.error("Failed to load companySubscriptionPlans:", e);
        if (alive) setPlans([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => (alive = false);
  }, []);

  const onSubscribe = (payload) => {
    // هنا هنحوّل المستخدم لفلو الدفع أو صفحة الاشتراك
    // انت ممكن تخليه يروح /company-subscriptions?package=...&lang=...
    const qs = new URLSearchParams();
    qs.set("lang", lang);
    qs.set("package", payload.package);
    qs.set("duration", payload.duration);
    qs.set("price", String(payload.price));
    qs.set("months", String(payload.months));
    // لو عندك راوتر جاهز من البروفايل: مرره props أو استعمل useRouter هنا
    if (router?.push) router.push(`/company-subscriptions?${qs.toString()}`);
    else window.location.href = `/company-subscriptions?${qs.toString()}`;
  };

  if (loading) {
    return (
      <div className={`w-full rounded-2xl p-6 text-center ${darkMode ? "bg-white/5 text-white" : "bg-white text-gray-800"}`}>
        <div className="font-extrabold text-lg">{lang === "ar" ? "جاري تحميل الاشتراكات..." : "Loading plans..."}</div>
      </div>
    );
  }

  if (!plans.length) {
    return (
      <div className={`w-full rounded-2xl p-6 text-center ${darkMode ? "bg-white/5 text-white" : "bg-white text-gray-800"}`}>
        <div className="font-extrabold text-lg text-red-400">
          {lang === "ar" ? "لا توجد باقات متاحة حالياً" : "No plans available"}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* top premium grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((p) => (
          <CompanyPlanCardPro key={p.id} plan={p} lang={lang} darkMode={darkMode} onSubscribe={onSubscribe} />
        ))}
      </div>

      {/* small hint */}
      <div className="mt-6 text-center text-xs text-white/55">
        {lang === "ar"
          ? "اختر الباقة والمدة ثم تابع الاشتراك."
          : "Pick a plan and duration, then continue to subscribe."}
      </div>
    </div>
  );
}
