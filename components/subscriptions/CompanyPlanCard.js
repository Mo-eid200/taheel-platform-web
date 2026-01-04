"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Check } from "lucide-react";
import { FaCrown, FaRocket, FaChartLine, FaBuilding } from "react-icons/fa";

/* =========================
   BRAND
========================= */
const BRAND = {
  starter: {
    bar: "from-emerald-400 to-emerald-600",
    ring: "border-emerald-400/25 hover:border-emerald-400/70",
    dot: "bg-emerald-400",
    btn: "from-emerald-700 via-emerald-500 to-green-700",
    glow: "rgba(16,185,129,0.40)",
    icon: FaRocket,
    offerChip: "bg-emerald-500 text-white border-emerald-200",
  },
  growth: {
    bar: "from-sky-400 to-sky-600",
    ring: "border-sky-400/25 hover:border-sky-400/70",
    dot: "bg-sky-400",
    btn: "from-sky-700 via-sky-500 to-indigo-600",
    glow: "rgba(56,189,248,0.36)",
    icon: FaChartLine,
    offerChip: "bg-sky-500 text-white border-sky-200",
  },
  scale: {
    bar: "from-purple-400 to-purple-600",
    ring: "border-purple-400/25 hover:border-purple-400/75",
    dot: "bg-purple-400",
    btn: "from-purple-700 via-fuchsia-600 to-pink-600",
    glow: "rgba(168,85,247,0.36)",
    icon: FaCrown,
    offerChip: "bg-purple-500 text-white border-purple-200",
  },
  enterprise: {
    bar: "from-yellow-400 to-orange-500",
    ring: "border-yellow-400/25 hover:border-yellow-400/75",
    dot: "bg-yellow-300",
    btn: "from-yellow-500 via-amber-400 to-orange-500 text-black",
    glow: "rgba(245,158,11,0.35)",
    icon: FaBuilding,
    offerChip: "bg-amber-400 text-black border-yellow-100",
  },
};

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

/* =========================
   Safe helpers
========================= */
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function pickText(v, lang) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (isPlainObject(v)) return String(lang === "ar" ? v.ar || "" : v.en || "");
  return "";
}
function pricingEntries(pricing) {
  if (!isPlainObject(pricing)) return [];
  return Object.entries(pricing)
    .filter(([_, val]) => isPlainObject(val))
    .map(([key, val]) => ({
      key,
      price: Number(val?.price ?? 0) || 0,
      monthsShown: Number(val?.monthsShown ?? 0) || 0,
      paidMonths: Number(val?.paidMonths ?? 0) || 0,
      bonus: Number(val?.bonus ?? 0) || 0,
      best: !!val?.best,
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

/** ✅ "Offer" means bonus > 0 (truth source) */
function isOffer(p) {
  return Number(p?.bonus || 0) > 0;
}

/* =========================
   Glow wrapper
========================= */
function GlowWrap({ active = false, radius = "rounded-3xl", glow = "rgba(16,185,129,0.35)", children }) {
  return (
    <div className={cn("relative group", radius)}>
      <div
        className={cn("absolute -inset-[2px] z-0", radius, "transition-opacity duration-300")}
        style={{
          background: `linear-gradient(90deg, ${glow}, rgba(56,189,248,0.20), rgba(168,85,247,0.16))`,
          filter: "blur(14px)",
          opacity: active ? 0.55 : 0,
        }}
      />
      <div
        className={cn("absolute -inset-[2px] z-0 opacity-0 group-hover:opacity-55 transition-opacity duration-300", radius)}
        style={{
          background: `linear-gradient(90deg, ${glow}, rgba(56,189,248,0.20), rgba(168,85,247,0.16))`,
          filter: "blur(14px)",
        }}
      />
      <div className={cn("relative z-10", radius)}>{children}</div>
    </div>
  );
}

/* =========================
   Component
========================= */
export default function CompanyPlanCard({
  plan,
  lang = "ar",
  darkMode = true,
  onSubscribe,
}) {
  const dir = lang === "ar" ? "rtl" : "ltr";

  const planKey = (plan?.key || plan?.id || "starter").toString();
  const theme = BRAND[planKey] || BRAND.starter;
  const Icon = theme.icon;

  const pricingList = useMemo(() => pricingEntries(plan?.pricing), [plan?.pricing]);

  // default: best OR yearly OR last
  const defaultKey =
    pricingList.find((x) => x?.best)?.key ||
    pricingList.find((x) => x?.key === "yearly")?.key ||
    pricingList[pricingList.length - 1]?.key ||
    pricingList[0]?.key ||
    "";

  const [selectedKey, setSelectedKey] = useState(defaultKey);

  useEffect(() => {
    if (!pricingList.length) return;
    const ok = pricingList.some((x) => x.key === selectedKey);
    if (!ok) setSelectedKey(defaultKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingList.length, defaultKey]);

  const selected =
    pricingList.find((x) => x.key === selectedKey) ||
    pricingList[pricingList.length - 1] ||
    pricingList[0] ||
    null;

  const title = pickText(plan?.name, lang) || (lang === "ar" ? "باقة" : "Plan");
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

  const price = Number(selected?.price ?? 0);
  const monthsShown = Number(selected?.monthsShown ?? 0);
  const paidMonths = Number(selected?.paidMonths ?? 0);
  const bonus = Number(selected?.bonus ?? 0);

  const canSubscribe = !!selectedKey && price > 0;

  return (
    <div dir={dir} className="w-full">
      <GlowWrap glow={theme.glow} radius="rounded-3xl" active={selected?.best || isOffer(selected)}>
        <div
          className={cn(
            "relative rounded-3xl border bg-white/5 backdrop-blur-xl overflow-hidden",
            theme.ring,
            darkMode ? "" : "bg-black/5"
          )}
        >
          {/* top gradient bar */}
          <div className={cn("absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r", theme.bar)} />

          <div className={cn("p-6", lang === "ar" ? "text-right" : "text-left")}>
            {/* header */}
            <div className={cn("flex items-start justify-between gap-4", lang === "ar" && "flex-row-reverse")}>
              <div className={cn("flex items-center gap-3 min-w-0", lang === "ar" && "flex-row-reverse")}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/10 border border-white/10">
                  <Icon className="text-white text-xl" />
                </div>

                <div className="min-w-0">
                  <div className={cn("flex items-center gap-2", lang === "ar" && "flex-row-reverse")}>
                    <span className={cn("w-2 h-2 rounded-full", theme.dot)} />
                    <div className="text-white font-extrabold text-xl truncate">{title}</div>
                  </div>
                  {fit ? <div className="mt-1 text-[12px] text-white/60 font-semibold">{fit}</div> : null}
                </div>
              </div>
            </div>

            {/* price row */}
            <div className={cn("mt-5 flex items-end gap-2 flex-wrap", lang === "ar" && "flex-row-reverse")}>
              <div className="text-4xl font-black text-white">{price.toLocaleString()}</div>
              <div className="text-sm text-white/75 font-bold">{lang === "ar" ? "درهم" : "AED"}</div>

              {monthsShown > 0 ? (
                <div className="text-xs text-white/55 font-semibold">
                  {lang === "ar" ? `(${monthsShown} شهر)` : `(${monthsShown} months)`}
                </div>
              ) : null}

              {/* ✅ show offer pill only when selected has bonus */}
              {isOffer(selected) ? (
                <div className={cn("text-xs px-2 py-1 rounded-full border font-extrabold", theme.offerChip)}>
                  {lang === "ar" ? "عرض خاص" : "Special Offer"}
                </div>
              ) : null}
            </div>

            {/* ✅ Offer line EXACT format */}
            <div className="mt-3 text-[12px] text-white/70 font-semibold">
              {isOffer(selected) ? (
                lang === "ar" ? (
                  <span>
                    تدفع <b className="text-white">{paidMonths}</b> أشهر +{" "}
                    <b className="text-emerald-200">{bonus}</b> شهر مجاني ={" "}
                    <b className="text-white">{monthsShown}</b> أشهر
                  </span>
                ) : (
                  <span>
                    Pay <b className="text-white">{paidMonths}</b> months +{" "}
                    <b className="text-emerald-200">{bonus}</b> free month ={" "}
                    <b className="text-white">{monthsShown}</b> months
                  </span>
                )
              ) : (
                <span className="text-white/55">
                  {lang === "ar"
                    ? "بدون عرض — تدفع نفس مدة الاشتراك"
                    : "No offer — pay equals subscription duration"}
                </span>
              )}
            </div>

            {/* duration selector */}
            <div className="mt-4">
              <div className="text-xs text-white/55 font-extrabold mb-2">
                {lang === "ar" ? "اختر المدة" : "Choose duration"}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {pricingList.map((p) => {
                  const active = p.key === selectedKey;
                  const label = pricingLabel(p, lang) || p.key;

                  const offer = isOffer(p);

                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setSelectedKey(p.key)}
                      className={cn(
                        "relative cursor-pointer rounded-2xl border p-3 bg-white/6 backdrop-blur-xl transition",
                        lang === "ar" ? "text-right" : "text-left",
                        active
                          ? "border-emerald-400/60 bg-white/8"
                          : "border-white/10 hover:border-white/20 hover:bg-white/7",
                        offer && active ? "shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_40px_-26px_rgba(16,185,129,0.55)]" : ""
                      )}
                    >
                      {/* ✅ show "عرض" ONLY for offers + only inside duration */}
                      {offer ? (
                        <span
                          className={cn(
                            "absolute -top-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold border",
                            lang === "ar" ? "left-3" : "right-3",
                            "bg-white/10 text-white border-white/10"
                          )}
                        >
                          {lang === "ar" ? "عرض" : "Offer"}
                        </span>
                      ) : null}

                      <div className="text-white font-extrabold text-sm">{label}</div>

                      <div className="mt-1 text-[11px] text-white/60 font-semibold">
                        {Number(p.monthsShown || 1)} {lang === "ar" ? "شهر" : "mo"} •{" "}
                        {Number(p.price || 0).toLocaleString()}{" "}
                        <span className="text-white/50">{lang === "ar" ? "درهم" : "AED"}</span>
                      </div>

                      {/* ✅ offer micro line for clarity */}
                      {offer ? (
                        <div className="mt-2 text-[11px] font-extrabold text-emerald-200">
                          {lang === "ar"
                            ? `تدفع ${p.paidMonths} + ${p.bonus} مجاني = ${p.monthsShown}`
                            : `Pay ${p.paidMonths} + ${p.bonus} free = ${p.monthsShown}`}
                        </div>
                      ) : null}

                      {active ? (
                        <div className="mt-2 inline-flex items-center gap-2 text-emerald-200 text-[11px] font-extrabold">
                          <Check className="w-4 h-4" />
                          {lang === "ar" ? "تم الاختيار" : "Selected"}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* perks */}
            {perks?.length > 0 ? (
              <>
                <div className="h-px w-full bg-white/10 my-5" />
                <div className="text-white font-extrabold mb-3">{lang === "ar" ? "المميزات" : "Perks"}</div>
                <div className="space-y-2 text-sm text-white/80">
                  {perks.slice(0, 6).map((x, i) => (
                    <div key={i} className={cn("flex items-start gap-2", lang === "ar" && "flex-row-reverse text-right")}>
                      <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                      <span className="break-words">{String(x)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

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
                  isOffer: isOffer(selected),
                })
              }
              className={cn(
                "mt-6 w-full py-3 rounded-full font-extrabold shadow-lg transition hover:scale-[1.02] active:scale-[0.99]",
                canSubscribe
                  ? `bg-gradient-to-r ${theme.btn}`
                  : "bg-gray-500/40 text-white/60 cursor-not-allowed"
              )}
            >
              {lang === "ar" ? "اشترك الآن" : "Subscribe Now"}
            </button>
          </div>
        </div>
      </GlowWrap>
    </div>
  );
}
