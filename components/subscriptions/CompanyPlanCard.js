"use client";

import React, { useMemo, useState, useEffect } from "react";
import { FaCrown, FaRocket, FaChartLine, FaBuilding } from "react-icons/fa";

/* =========================
   Theme map
========================= */
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

/* =========================
   Helpers (safe)
========================= */
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pickText(v, lang) {
  // supports: string | number | {ar,en} | null
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (isPlainObject(v)) return String(lang === "ar" ? v.ar || "" : v.en || "");
  return "";
}

function normalizeTag(tag) {
  const t = (tag || "").toString().trim();
  return t.length ? t : null;
}

function tagLabel(tag, lang) {
  const t = normalizeTag(tag);
  if (!t) return null;
  if (t === "most") return lang === "ar" ? "الأكثر طلباً" : "Most Popular";
  if (t === "offer") return lang === "ar" ? "عرض" : "Offer";
  return t;
}

function pricingEntries(pricing) {
  if (!isPlainObject(pricing)) return [];

  // pricing should be an object of objects: { monthly: {...}, quarterly: {...} }
  return Object.entries(pricing)
    .filter(([_, val]) => isPlainObject(val)) // ✅ ignore junk fields like en:"Monthly"
    .map(([key, val]) => ({
      key,
      ...val,
      // normalize numbers
      price: Number(val?.price ?? 0) || 0,
      monthsShown: Number(val?.monthsShown ?? 0) || 0,
      paidMonths: Number(val?.paidMonths ?? 0) || 0,
      bonus: Number(val?.bonus ?? 0) || 0,
      best: !!val?.best,
      tag: normalizeTag(val?.tag),
      title: isPlainObject(val?.title) ? val.title : { ar: "", en: "" },
    }))
    .sort((a, b) => (a.monthsShown ?? 999) - (b.monthsShown ?? 999));
}

function pricingLabel(p, lang) {
  const t = p?.title;
  if (typeof t === "string") return t;
  if (isPlainObject(t)) return lang === "ar" ? t.ar || "" : t.en || "";
  return "";
}

/* =========================
   Component
========================= */
export default function CompanyPlanCard({
  plan,
  lang = "ar",
  darkMode = false,
  onSubscribe,
}) {
  const dir = lang === "ar" ? "rtl" : "ltr";

  const planKey = (plan?.key || plan?.id || "starter").toString();
  const theme = BRAND[planKey] || BRAND.starter;
  const Icon = theme.icon;

  const pricingList = useMemo(() => pricingEntries(plan?.pricing), [plan?.pricing]);

  // choose default
  const defaultPriceKey =
    pricingList.find((x) => x?.best)?.key || pricingList[0]?.key || "";

  const [selectedKey, setSelectedKey] = useState(defaultPriceKey);

  // ✅ keep selection valid when pricing loads/changes
  useEffect(() => {
    if (!pricingList.length) return;
    const stillExists = pricingList.some((x) => x.key === selectedKey);
    if (!stillExists) setSelectedKey(defaultPriceKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingList.length, defaultPriceKey]);

  const selected =
    pricingList.find((x) => x.key === selectedKey) || pricingList[0] || null;

  // ✅ SAFE: name could be string OR map {ar,en}
  const title =
    pickText(plan?.name, lang) || (lang === "ar" ? "باقة" : "Plan");

  const fit = pickText(plan?.fit, lang);

  const perks = useMemo(() => {
    const p = plan?.perks;
    if (!p) return [];
    if (Array.isArray(p)) return p.filter(Boolean).map(String);
    if (isPlainObject(p)) {
      const arr = lang === "ar" ? p.ar : p.en;
      return Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
    }
    return [];
  }, [plan?.perks, lang]);

  const price = selected?.price ?? 0;
  const monthsShown = selected?.monthsShown ?? 0;
  const paidMonths = selected?.paidMonths ?? 0;
  const bonus = selected?.bonus ?? 0;

  const tag = selected?.tag || (selected?.best ? "most" : null);
  const tagText = tagLabel(tag, lang);

  const canSubscribe = !!selectedKey && Number(price) > 0;

  return (
    <div
      dir={dir}
      className={`relative w-full rounded-2xl p-6 shadow-2xl ring-1 ${theme.ring} ${
        darkMode ? "bg-gray-900/80 text-white" : "bg-white/10 text-white"
      } backdrop-blur overflow-hidden`}
    >
      {/* glow header */}
      <div
        className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${theme.accent} opacity-25`}
      />

      {/* tag */}
      {tagText && (
        <div
          className={`absolute top-4 ${
            lang === "ar" ? "left-4" : "right-4"
          } px-3 py-1 rounded-full text-xs font-black bg-white/15 border border-white/10`}
        >
          {tagText}
        </div>
      )}

      {/* header */}
      <div className="relative flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/10 border border-white/10 shadow">
          <Icon className="text-white text-xl" />
        </div>

        <div className="flex-1">
          <div className="text-xl font-black text-white">{title}</div>
          {fit ? <div className="text-sm text-white/70 mt-1">{fit}</div> : null}
        </div>
      </div>

      {/* price */}
      <div className="relative mt-5 flex items-end gap-2">
        <div className="text-4xl font-black text-white">{price}</div>
        <div className="text-sm text-white/80">{lang === "ar" ? "درهم" : "AED"}</div>

        {monthsShown > 0 && (
          <div className="text-xs text-white/60">
            {lang === "ar"
              ? `(${monthsShown} شهر عرض)`
              : `(${monthsShown} months shown)`}
          </div>
        )}

        {bonus > 0 && (
          <div className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">
            {lang === "ar" ? `+${bonus} شهر مجاني` : `+${bonus} bonus month`}
          </div>
        )}
      </div>

      {/* duration selector */}
      <div className="relative mt-4">
        <div className="text-xs text-white/60 mb-2">
          {lang === "ar" ? "اختر المدة" : "Choose duration"}
        </div>

        <div className="flex flex-wrap gap-2">
          {pricingList.map((p) => {
            const label = pricingLabel(p, lang) || p.key;
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
        {selected && (
          <div className="mt-3 text-xs text-white/65">
            {lang === "ar" ? (
              <span>
                تدفع <b className="text-white">{paidMonths}</b> شهر • يظهر{" "}
                <b className="text-white">{monthsShown}</b> شهر
              </span>
            ) : (
              <span>
                Pay <b className="text-white">{paidMonths}</b> months • shown{" "}
                <b className="text-white">{monthsShown}</b> months
              </span>
            )}
          </div>
        )}
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
            planKey: plan?.key || plan?.id || planKey,
            pricingKey: selectedKey,
            price,
            monthsShown,
            paidMonths,
            bonus,
            tag: tag || null,
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
