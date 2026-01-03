"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import CompanyPlanCard from "./CompanyPlanCard";

export default function CompanySubscriptionsSection({ lang = "ar", darkMode = false }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(firestore, "companySubscriptionPlans"));
        const arr = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => p.isActive !== false)
          .sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0));

        if (alive) setPlans(arr);
      } catch {
        if (alive) setPlans([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className={`w-full rounded-2xl p-6 text-center ${darkMode ? "bg-gray-800" : "bg-white/90"}`}>
        <div className="font-extrabold text-lg">{lang === "ar" ? "جاري تحميل الاشتراكات..." : "Loading plans..."}</div>
      </div>
    );
  }

  if (!plans.length) {
    return (
      <div className={`w-full rounded-2xl p-6 text-center ${darkMode ? "bg-gray-800" : "bg-white/90"}`}>
        <div className="font-extrabold text-lg text-red-500">
          {lang === "ar" ? "لا توجد باقات متاحة حالياً" : "No plans available"}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {plans.map((p) => (
          <CompanyPlanCard key={p.id} plan={p} lang={lang} darkMode={darkMode} />
        ))}
      </div>
    </div>
  );
}
