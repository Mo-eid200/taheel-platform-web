"use client";

import React from "react";

export default function CompanyPlanCard({ plan, lang = "ar", darkMode = false, onSelect }) {
  const dir = lang === "ar" ? "rtl" : "ltr";

  const theme = {
    emerald: {
      ring: "ring-emerald-300/40",
      badge: "bg-emerald-500 text-white",
      btn: "bg-emerald-600 hover:bg-emerald-700",
      title: "text-emerald-200",
      price: "text-emerald-300",
    },
    blue: {
      ring: "ring-blue-300/40",
      badge: "bg-blue-500 text-white",
      btn: "bg-blue-600 hover:bg-blue-700",
      title: "text-blue-200",
      price: "text-blue-300",
    },
  }[plan.color || "emerald"];

  return (
    <div
      dir={dir}
      className={`relative w-full rounded-2xl p-6 shadow-2xl ring-1 ${theme.ring} ${
        darkMode ? "bg-gray-900/80 text-white" : "bg-white/10 text-white"
      } backdrop-blur`}
    >
      {/* Badge */}
      {plan.badge && (
        <div className={`absolute top-4 ${lang === "ar" ? "left-4" : "right-4"} px-3 py-1 rounded-full text-xs font-bold ${theme.badge}`}>
          {plan.badge}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className={`text-xl font-black ${theme.title}`}>{plan.title}</div>

        <div className="flex items-end gap-2">
          <div className={`text-4xl font-black ${theme.price}`}>{plan.price}</div>
          <div className="text-sm text-white/80">{lang === "ar" ? "درهم" : "AED"}</div>
          <div className="text-sm text-white/60">{plan.period}</div>
        </div>

        <div className="h-px w-full bg-white/10 my-2" />

        <ul className="space-y-2 text-sm text-white/90">
          {Array.isArray(plan.features) &&
            plan.features.map((f, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-[3px] inline-block w-2.5 h-2.5 rounded-full bg-white/60" />
                <span className="leading-6">{f}</span>
              </li>
            ))}
        </ul>

        <button
          onClick={onSelect}
          className={`mt-5 w-full py-3 rounded-xl font-extrabold shadow-lg transition ${theme.btn}`}
        >
          {lang === "ar" ? "اشترك الآن" : "Subscribe Now"}
        </button>
      </div>
    </div>
  );
}
