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

// 🎨 Card Themes (cycled)
const THEMES = [
  {
    ring: "ring-emerald-400/25",
    border: "border-emerald-300/15",
    bg: "bg-gradient-to-br from-emerald-500/14 via-white/6 to-sky-500/10",
    chip: "bg-emerald-400/14 text-emerald-100 border-emerald-300/20",
    iconBg: "bg-emerald-400/12 border-emerald-300/20",
    btn: "from-emerald-600 via-teal-600 to-sky-700",
    tag: "from-emerald-300/90 via-sky-300/90 to-indigo-300/90",
    tagText: "text-emerald-950",
  },
  {
    ring: "ring-sky-400/25",
    border: "border-sky-300/15",
    bg: "bg-gradient-to-br from-sky-500/14 via-white/6 to-indigo-500/12",
    chip: "bg-sky-400/14 text-sky-100 border-sky-300/20",
    iconBg: "bg-sky-400/12 border-sky-300/20",
    btn: "from-sky-600 via-indigo-600 to-fuchsia-700",
    tag: "from-sky-300/90 via-indigo-300/90 to-fuchsia-300/90",
    tagText: "text-sky-950",
  },
  {
    ring: "ring-violet-400/25",
    border: "border-violet-300/15",
    bg: "bg-gradient-to-br from-violet-500/14 via-white/6 to-amber-500/10",
    chip: "bg-violet-400/14 text-violet-100 border-violet-300/20",
    iconBg: "bg-violet-400/12 border-violet-300/20",
    btn: "from-violet-600 via-fuchsia-600 to-amber-600",
    tag: "from-violet-300/90 via-fuchsia-300/90 to-amber-300/90",
    tagText: "text-violet-950",
  },
  {
    ring: "ring-amber-400/25",
    border: "border-amber-300/15",
    bg: "bg-gradient-to-br from-amber-500/14 via-white/6 to-rose-500/10",
    chip: "bg-amber-400/14 text-amber-100 border-amber-300/20",
    iconBg: "bg-amber-400/12 border-amber-300/20",
    btn: "from-amber-600 via-orange-600 to-rose-700",
    tag: "from-amber-300/90 via-orange-300/90 to-rose-300/90",
    tagText: "text-amber-950",
  },
];

// 🏷️ Small corner tag (not diagonal / not intrusive)
function CornerTag({ lang, dir, popular, themeTag, themeText }) {
  const isAr = lang === "ar";
  const pos = isAr ? "left-4" : "right-4"; // in RTL put it on the visual top-left
  const label = popular ? (isAr ? "الأكثر طلبًا" : "Popular") : (isAr ? "إضافة" : "Add-on");

  return (
    <div className={cn("absolute top-4 z-20", pos)} dir={dir}>
      <div
        className={cn(
          "inline-flex items-center gap-1.5",
          "px-3 py-1.5 rounded-full",
          "border border-white/25",
          "bg-gradient-to-r",
          popular ? "from-yellow-300/95 via-amber-300/95 to-orange-300/95" : themeTag,
          popular ? "text-black" : themeText,
          "shadow-lg shadow-black/25"
        )}
      >
        {popular ? <BadgeCheck className="w-4 h-4" /> : null}
        <span className="text-[11px] font-black tracking-wide">{label}</span>
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

    // ✅ keep bundles only + sort by qty then price
    const sorted = list
      .filter((a) => String(a?.type || "").toLowerCase() === "bundle")
      .sort((a, b) => {
        const qa = Number(a?.qty || 0);
        const qb = Number(b?.qty || 0);
        if (qa !== qb) return qa - qb;
        const pa = Number(a?.price || 0);
        const pb = Number(b?.price || 0);
        return pa - pb;
      });

    // ✅ In RTL, visual flow is right->left (so keep smallest on the "right"):
    // grid renders LTR columns, so reverse list to look correct in RTL
    return lang === "ar" ? [...sorted].reverse() : sorted;
  }, [addons, lang]);

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
                ? "اختر الباقة المناسبة…"
                : "Pick the right bundle… "}
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
          Array.from({ length: 3 }).map((_, i) => (
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

            return (
              <motion.div
                key={a?.id || a?.addonKey || idx}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className={cn(
                  "relative rounded-3xl overflow-hidden p-5 backdrop-blur-xl",
                  "border ring-1",
                  t.border,
                  t.ring,
                  t.bg
                )}
              >
                {/* corner tag */}
                <CornerTag
                  lang={lang}
                  dir={dir}
                  popular={!!a?.popular}
                  themeTag={t.tag}
                  themeText={t.tagText}
                />

                {/* soft highlight */}
                <div
                  className="pointer-events-none absolute -inset-1 opacity-40"
                  style={{
                    background: "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                  }}
                />

                {/* content */}
                <div className="relative">
                  {/* title + icon */}
                  <div className={cn("flex items-start justify-between gap-3 pt-7", lang === "ar" && "flex-row-reverse")}>
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

                    <div className={cn("w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0", t.iconBg)}>
                      <Zap className="w-5 h-5 text-white/90" />
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

                  {/* note */}
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
