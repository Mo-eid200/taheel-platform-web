"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Zap, Sparkles, BadgeCheck } from "lucide-react";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function pickText(v, lang) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (isPlainObject(v)) return String(lang === "ar" ? v.ar || "" : v.en || "");
  return "";
}
function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : "";
}

// 🎨 Color themes for cards (cycled)
const THEMES = [
  {
    ring: "ring-emerald-400/25",
    border: "border-emerald-300/15",
    bg: "bg-gradient-to-br from-emerald-500/14 via-white/6 to-sky-500/10",
    glow: "from-emerald-400/25 via-sky-400/20 to-purple-500/15",
    chip: "bg-emerald-400/15 text-emerald-100 border-emerald-300/20",
    iconBg: "bg-emerald-400/12 border-emerald-300/20",
    btn: "from-emerald-600 via-teal-600 to-sky-700",
  },
  {
    ring: "ring-sky-400/25",
    border: "border-sky-300/15",
    bg: "bg-gradient-to-br from-sky-500/14 via-white/6 to-indigo-500/12",
    glow: "from-sky-400/25 via-indigo-400/18 to-fuchsia-500/14",
    chip: "bg-sky-400/15 text-sky-100 border-sky-300/20",
    iconBg: "bg-sky-400/12 border-sky-300/20",
    btn: "from-sky-600 via-indigo-600 to-fuchsia-700",
  },
  {
    ring: "ring-violet-400/25",
    border: "border-violet-300/15",
    bg: "bg-gradient-to-br from-violet-500/14 via-white/6 to-amber-500/10",
    glow: "from-violet-400/22 via-fuchsia-400/18 to-amber-400/14",
    chip: "bg-violet-400/15 text-violet-100 border-violet-300/20",
    iconBg: "bg-violet-400/12 border-violet-300/20",
    btn: "from-violet-600 via-fuchsia-600 to-amber-600",
  },
  {
    ring: "ring-amber-400/25",
    border: "border-amber-300/15",
    bg: "bg-gradient-to-br from-amber-500/14 via-white/6 to-rose-500/10",
    glow: "from-amber-400/22 via-rose-400/18 to-purple-400/14",
    chip: "bg-amber-400/15 text-amber-100 border-amber-300/20",
    iconBg: "bg-amber-400/12 border-amber-300/20",
    btn: "from-amber-600 via-orange-600 to-rose-700",
  },
];

// 🎗️ Corner ribbons
const RIBBONS = [
  { bg: "from-emerald-300 via-sky-400 to-indigo-500", text: "text-emerald-950" },
  { bg: "from-sky-300 via-indigo-400 to-fuchsia-500", text: "text-sky-950" },
  { bg: "from-violet-300 via-fuchsia-400 to-amber-400", text: "text-violet-950" },
  { bg: "from-amber-300 via-orange-400 to-rose-500", text: "text-amber-950" },
];

const POPULAR_RIBBON = {
  bg: "from-yellow-300 via-amber-400 to-orange-500",
  text: "text-black",
};

function Ribbon({ lang, isPopular, palette, dir }) {
  const isAr = lang === "ar";
  const sideClass = isAr ? "left-0" : "right-0";
  const translateClass = isAr ? "-translate-x-10" : "translate-x-10";

  return (
    <div className={cn("absolute top-0 z-20", sideClass)} dir={dir}>
      <div
        className={cn(
          "select-none",
          translateClass,
          "-translate-y-2 rotate-45",
          "px-14 py-2",
          "bg-gradient-to-r",
          palette.bg,
          "shadow-lg shadow-black/25",
          "border border-white/20"
        )}
      >
        <div className={cn("flex items-center gap-2 text-[11px] font-black tracking-wide", palette.text)}>
          {isPopular ? <BadgeCheck className="w-4 h-4" /> : null}
          <span>
            {isPopular
              ? isAr
                ? "الأكثر طلبًا"
                : "POPULAR"
              : isAr
              ? "إضافة"
              : "ADD-ON"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CompanyAddonsSection({
  lang = "ar",
  addons = [],
  loading = false,
  disabled = false,
  onBuyAddon,
}) {
  const dir = lang === "ar" ? "rtl" : "ltr";

  const bundles = useMemo(() => {
    const list = Array.isArray(addons) ? addons : [];

    // ✅ keep bundles only + sort from smaller to larger (qty then price)
    return list
      .filter((a) => String(a?.type || "").toLowerCase() === "bundle")
      .sort((a, b) => {
        const qa = Number(a?.qty || 0);
        const qb = Number(b?.qty || 0);
        if (qa !== qb) return qa - qb;
        const pa = Number(a?.price || 0);
        const pb = Number(b?.price || 0);
        return pa - pb;
      });
  }, [addons]);

  return (
    <div dir={dir} className="mt-10">
      {/* Header */}
      <div className={cn("flex items-center justify-between gap-3 mb-4", lang === "ar" && "flex-row-reverse")}>
        <div className={cn("flex items-center gap-3", lang === "ar" && "flex-row-reverse")}>
          <div className="w-10 h-10 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white/90" />
          </div>

          <div className={cn(lang === "ar" ? "text-right" : "text-left")}>
            <div className="text-white font-extrabold text-lg">
              {lang === "ar" ? "إضافات المعاملات (Add-ons)" : "Transaction Add-ons"}
            </div>
            <div className="text-[12px] text-white/60 font-semibold">
              {lang === "ar"
                ? "اختر الباقة المناسبة… الرصيد يضاف تلقائيًا بعد الدفع"
                : "Pick the right bundle… credits are added automatically after payment"}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-white/60 text-sm font-semibold">{lang === "ar" ? "تحميل..." : "Loading..."}</div>
        ) : null}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-5 animate-pulse">
              <div className="h-3 w-44 bg-white/10 rounded mb-2" />
              <div className="h-2 w-28 bg-white/10 rounded mb-5" />
              <div className="h-10 w-32 bg-white/10 rounded-2xl mb-4" />
              <div className="h-12 w-full bg-white/10 rounded-2xl" />
            </div>
          ))
        ) : bundles.length ? (
          bundles.map((a, idx) => {
            const t = THEMES[idx % THEMES.length];
            const qty = Number(a?.qty || 0);
            const price = Number(a?.price || 0);
            const title = pickText(a?.title, lang);

            const palette = a?.popular ? POPULAR_RIBBON : RIBBONS[idx % RIBBONS.length];

            return (
              <motion.div
                key={a?.id || a?.addonKey || idx}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className={cn(
                  "relative rounded-3xl overflow-hidden p-5 backdrop-blur-xl",
                  "border",
                  t.border,
                  "ring-1",
                  t.ring,
                  t.bg
                )}
              >
                {/* Corner Ribbon */}
                <Ribbon lang={lang} dir={dir} isPopular={!!a?.popular} palette={palette} />

                {/* glow */}
                <div
                  className="pointer-events-none absolute -inset-1 opacity-40"
                  style={{
                    background: `linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))`,
                  }}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute -inset-[2px] opacity-0 hover:opacity-80 transition-opacity duration-300",
                    "blur-2xl"
                  )}
                  style={{
                    background: `linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0))`,
                  }}
                />
                <div
                  className={cn("pointer-events-none absolute -inset-[2px] opacity-0 hover:opacity-70 transition-opacity duration-300")}
                  style={{
                    background: `linear-gradient(90deg, ${
                      t.glow.includes("emerald") ? "rgba(16,185,129,0.22)" : "rgba(56,189,248,0.22)"
                    }, rgba(168,85,247,0.16), rgba(245,158,11,0.12))`,
                    filter: "blur(18px)",
                  }}
                />

                {/* content */}
                <div className="relative">
                  <div className={cn("flex items-start justify-between gap-3", lang === "ar" && "flex-row-reverse")}>
                    <div className={cn("min-w-0", lang === "ar" ? "text-right" : "text-left")}>
                      <div className="text-white font-extrabold truncate">{title}</div>

                      <div
                        className={cn(
                          "mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[12px] font-extrabold",
                          t.chip
                        )}
                      >
                        <span>{lang === "ar" ? "معاملات" : "TX"}</span>
                        <span className="text-white">•</span>
                        <span>{qty}</span>
                      </div>
                    </div>

                    <div className={cn("flex flex-col items-end gap-2", lang === "ar" && "items-start")}>
                      <div className={cn("w-10 h-10 rounded-2xl border flex items-center justify-center", t.iconBg)}>
                        <Zap className="w-5 h-5 text-white/90" />
                      </div>
                    </div>
                  </div>

                  {/* price */}
                  <div className={cn("mt-5 flex items-end justify-between", lang === "ar" && "flex-row-reverse")}>
                    <div className="leading-none">
                      <div className="text-white/70 text-[12px] font-bold">{lang === "ar" ? "السعر" : "Price"}</div>
                      <div className="text-white text-4xl font-black tracking-tight">{money(price)}</div>
                    </div>
                    <div className="text-white/60 text-sm font-bold pb-1">{lang === "ar" ? "درهم" : "AED"}</div>
                  </div>

                  {/* footer note */}
                  <div className={cn("mt-3 text-[12px] text-white/60 font-semibold", lang === "ar" ? "text-right" : "text-left")}>
                    {lang === "ar" ? "تشمل: طباعة + ضريبة + معالجة" : "Includes: printing + VAT + processing"}
                  </div>

                  {/* CTA */}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onBuyAddon?.(a)}
                    className={cn(
                      "mt-4 w-full py-3.5 rounded-2xl font-extrabold transition",
                      "text-white shadow-lg shadow-black/20",
                      "bg-gradient-to-r",
                      t.btn,
                      "hover:scale-[1.01] active:scale-[0.99]",
                      disabled && "opacity-60 cursor-not-allowed hover:scale-100"
                    )}
                  >
                    {lang === "ar" ? "شراء وإضافة الرصيد" : "Buy & Add Credits"}
                  </button>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="lg:col-span-3 rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70 font-semibold">
            {lang === "ar" ? "لا توجد إضافات متاحة حاليًا." : "No add-ons available right now."}
          </div>
        )}
      </div>
    </div>
  );
}
