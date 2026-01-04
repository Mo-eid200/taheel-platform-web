"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import CompanyPlanCard from "./CompanyPlanCard";

export default function CompanySubscriptionsSection({
  lang = "ar",
  darkMode = false,
  onSubscribe, // optional callback
}) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(firestore, "companySubscriptionPlans"));
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // ✅ only active + sort
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
            onSubscribe={onSubscribe}
          />
        ))}
      </div>
    </div>
  );
}
