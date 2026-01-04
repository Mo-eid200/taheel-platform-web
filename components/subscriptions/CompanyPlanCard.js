"use client";

import React, { useMemo, useState } from "react";
import { FaCrown, FaRocket, FaChartLine, FaBuilding } from "react-icons/fa";

const BRAND = {
  starter: {
    accent: "from-emerald-500 via-emerald-400 to-teal-500",
    ring: "ring-emerald-300/40",
    btn: "bg-emerald-600 hover:bg-emerald-700",
    chipActive: "bg-emerald-600 text-white border-emerald-200",
    chipIdle: "bg-white/5 text-white/80 border-white/10 hover:border-emerald-200/60",
    icon: FaRocket,
  },
  growth: {
    accent: "from-sky-500 via-blue-500 to-indigo-500",
    ring: "ring-blue-300/40",
    btn: "bg-blue-600 hover:bg-blue-700",
    chipActive: "bg-blue-600 text-white border-blue-200",
    chipIdle: "bg-white/5 text-white/80 border-white/10 hover:border-blue-200/60",
    icon: FaChartLine,
  },
  scale: {
    accent: "from-purple-500 via-fuchsia-500 to-pink-500",
    ring: "ring-purple-300/40",
    btn: "bg-purple-600 hover:bg-purple-700",
    chipActive: "bg-purple-600 text-white border-purple-200",
    chipIdle: "bg-white/5 text-white/80 border-white/10 hover:border-purple-200/60",
    icon: FaCrown,
  },
  enterprise: {
    accent: "from-yellow-400 via-amber-400 to-orange-500",
    ring: "ring-yellow-300/40",
    btn: "bg-yellow-400 hover:bg-yellow-300 text-black",
    chipActive: "bg-yellow-400 text-black border-yellow-100",
    chipIdle: "bg-white/5 text-white/80 border-white/10 hover:border-yellow-200/60",
    icon: FaBuilding,
  },
};

function pricingEntries(pricing) {
  if (!pricing || typeof pricing !== "object") return [];
  // pricing = { monthly: {...}, quarterly: {...} }
  return Object.entries(pricing)
    .map(([key, val]) => ({ key, ...(val || {}) }))
    .sort((a, b) => (a?.monthsShown ?? 999) - (b?.monthsShown ?? 999));
}

function tagLabel(tag, lang) {
  if (!tag) return null;
  if (tag === "most") return lang === "ar" ? "الأكثر طلباً" : "Most Popular";
  if (tag === "offer") return lang === "ar" ? "عرض" : "Offer";
  return String(tag);
}

export default function CompanyPlanCard({ plan, lang = "ar", darkMode = false, onSubscribe }) {
  const dir = lang === "ar" ? "rtl" : "ltr";

  const key = plan?.key || plan?.id || "starter";
  const theme = BRAND[key] || BRAND.starter;
  const Icon = theme.icon;

  const pricingList = useMemo(() => pricingEntries(plan?.pricing), [plan?.pricing]);
  const defaultPriceKey = pricingList?.find((x) => x?.best)?.key || pricingList?.[0]?.key || "";
  const [selectedKey, setSelectedKey] = useState(defaultPriceKey);

  const selected = useMemo(() => pricingList.find((x) => x.key === selectedKey) || pricingList[0], [pricingList, selectedKey]);

  const title = plan?.name || (lang === "ar" ? "باقة" : "Plan");
  const fit = lang === "ar" ? plan?.fit?.ar : plan?.fit?.en;
  const perks = lang === "ar" ? (plan?.perks?.ar || []) : (plan?.perks?.en || []);

  const tag = selected?.tag || (selected?.best ? "most" : null);
  const tagText = tagLabel(tag, lang);

  const price = selected?.price ?? 0;
  const monthsShown = selected?.monthsShown ?? 0;
  const paidMonths = selected?.paidMonths ?? 0;
  const bonus = selected?.bonus ?? 0;

  const canSubscribe = !!selectedKey && price > 0;

  return (
    <div
      dir={dir}
      className={`relative w-full rounded-2xl p-6 shadow-2xl ring-1 ${theme.ring} ${
        darkMode ? "bg-gray-900/80 text-white" : "bg-white/10 text-white"
      } backdrop-blur overflow-hidden`}
    >
      {/* glow header */}
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${theme.accent} opacity-25`} />

      {/* tag */}
      {tagText && (
        <div className={`absolute top-4 ${lang === "ar" ? "left-4" : "right-4"} px-3 py-1 rounded-full text-xs font-black bg-white/15 border border-white/10`}>
          {tagText}
        </div>
      )}

      {/* header */}
      <div className="relative flex items-start gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-white/10 border border-white/10 shadow`}>
          <Icon className="text-white text-xl" />
        </div>

        <div className="flex-1">
          <div className="text-xl font-black text-white">{title}</div>
          {fit && <div className="text-sm text-white/70 mt-1">{fit}</div>}
        </div>
      </div>

      {/* price */}
      <div className="relative mt-5 flex items-end gap-2">
        <div className="text-4xl font-black text-white">{price}</div>
        <div className="text-sm text-white/80">{lang === "ar" ? "درهم" : "AED"}</div>
        <div className="text-xs text-white/60">
          {lang === "ar" ? `(${monthsShown} شهر عرض)` : `(${monthsShown} months shown)`}
        </div>
        {bonus > 0 && (
          <div className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">
            {lang === "ar" ? `+${bonus} شهر مجاني` : `+${bonus} bonus month`}
          </div>
        )}
      </div>

      {/* duration selector */}
      <div className="relative mt-4">
        <div className="text-xs text-white/60 mb-2">{lang === "ar" ? "اختر المدة" : "Choose duration"}</div>
        <div className="flex flex-wrap gap-2">
          {pricingList.map((p) => {
            const label = lang === "ar" ? p?.title?.ar : p?.title?.en;
            const active = p.key === selectedKey;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelectedKey(p.key)}
                className={`px-3 py-2 rounded-xl border text-xs font-extrabold transition ${
                  active ? theme.chipActive : theme.chipIdle
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* small details row */}
        <div className="mt-3 text-xs text-white/65">
          {lang === "ar" ? (
            <span>
              تدفع <b className="text-white">{paidMonths}</b> شهر • يظهر <b className="text-white">{monthsShown}</b> شهر
            </span>
          ) : (
            <span>
              Pay <b className="text-white">{paidMonths}</b> months • shown <b className="text-white">{monthsShown}</b> months
            </span>
          )}
        </div>
      </div>

      {/* perks */}
      {perks?.length > 0 && (
        <>
          <div className="h-px w-full bg-white/10 my-4" />
          <ul className="space-y-2 text-sm text-white/90">
            {perks.slice(0, 6).map((perk, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-[7px] inline-block w-2.5 h-2.5 rounded-full bg-white/60" />
                <span className="leading-6">{perk}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* subscribe */}
      <button
        type="button"
        disabled={!canSubscribe}
        onClick={() =>
          onSubscribe?.({
            planKey: plan.key || plan.id,
            pricingKey: selectedKey,
            price,
            monthsShown,
            paidMonths,
            bonus,
            tag: selected?.tag || (selected?.best ? "most" : null),
          })
        }
        className={`mt-5 w-full py-3 rounded-xl font-black shadow-lg transition ${
          canSubscribe ? theme.btn : "bg-gray-500/40 text-white/60 cursor-not-allowed"
        }`}
      >
        {lang === "ar" ? "اشترك الآن" : "Subscribe Now"}
      </button>
    </div>
  );
}
