"use client";

import React from "react";
import CompanyPlanCard from "./CompanyPlanCard";

export default function CompanySubscriptionsSection({ lang = "ar", darkMode = false, router }) {
  const plans = [
    {
      id: "pro",
      badge: lang === "ar" ? "الأكثر طلبًا" : "Most Popular",
      title: lang === "ar" ? "اشتراك PRO" : "PRO Plan",
      price: 499,
      period: lang === "ar" ? "شهريًا" : "Monthly",
      color: "emerald",
      features:
        lang === "ar"
          ? ["لوحة تحكم احترافية", "أولوية في الدعم", "خصومات على الخدمات", "إدارة موظفين/طلبات"]
          : ["Pro dashboard", "Priority support", "Service discounts", "Staff/Orders management"],
    },
    {
      id: "business",
      badge: lang === "ar" ? "للشركات" : "For Companies",
      title: lang === "ar" ? "اشتراك BUSINESS" : "BUSINESS Plan",
      price: 999,
      period: lang === "ar" ? "شهريًا" : "Monthly",
      color: "blue",
      features:
        lang === "ar"
          ? ["كل مزايا PRO", "تقارير شهرية", "حسابات متعددة", "تخصيص أسعار أكثر"]
          : ["Everything in PRO", "Monthly reports", "Multi accounts", "More pricing controls"],
    },
  ];

  const onSelectPlan = (planId) => {
    // عدّل المسار حسب صفحة الدفع عندك
    if (router?.push) router.push(`/checkout?plan=${planId}`);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((p) => (
          <CompanyPlanCard
            key={p.id}
            plan={p}
            lang={lang}
            darkMode={darkMode}
            onSelect={() => onSelectPlan(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
