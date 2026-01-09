"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Zap, ShieldAlert, Sparkles } from "lucide-react";

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

export default function CompanyAddonsSection({
  lang = "ar",
  addons = [],
  loading = false,
  disabled = false,
  onBuyAddon,
}) {
  const dir = lang === "ar" ? "rtl" : "ltr";

  const { emergency, bundles } = useMemo(() => {
    const list = Array.isArray(addons) ? addons : [];
    const emergency = list.find((a) => String(a?.type || "").toLowerCase() === "emergency") || null;

    const bundles = list
      .filter((a) => String(a?.type || "").toLowerCase() !== "emergency")
      .sort((a, b) => (b?.popular === true ? 1 : 0) - (a?.popular === true ? 1 : 0));

    return { emergency, bundles };
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
                ? "اشتري معاملات إضافية… الرصيد يتضاف تلقائيًا بعد الدفع"
                : "Buy extra transactions… credits are added automatically after payment"}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-white/60 text-sm font-semibold">
            {lang === "ar" ? "تحميل..." : "Loading..."}
          </div>
        ) : null}
      </div>

      {/* Emergency Highlight */}
      {emergency ? (
        <motion.div
          className="relative rounded-3xl overflow-hidden border border-white/12 bg-gradient-to-r from-rose-600/20 via-red-500/15 to-amber-400/10 p-4 mb-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Pulse */}
          <div className="absolute inset-0 rounded-3xl border border-rose-300/25 animate-pulse" />

          <div className={cn("flex items-center justify-between gap-4", lang === "ar" && "flex-row-reverse")}>
            <div className={cn("flex items-center gap-3", lang === "ar" && "flex-row-reverse")}>
              <div className="w-12 h-12 rounded-2xl bg-black/25 border border-white/10 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>

              <div className={cn("min-w-0", lang === "ar" ? "text-right" : "text-left")}>
                <div className="text-white font-extrabold">
                  {lang === "ar" ? "الحالات الطارئة" : "Emergency"}
                </div>
                <div className="text-[12px] text-white/75 font-semibold">
                  {pickText(emergency?.title, lang)}
                </div>
                <div className="text-[12px] text-white/80 font-bold mt-1">
                  {lang === "ar"
                    ? `من ${money(emergency?.priceMin)} إلى ${money(emergency?.priceMax)} درهم`
                    : `From ${money(emergency?.priceMin)} to ${money(emergency?.priceMax)} AED`}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onBuyAddon?.(emergency)}
              className={cn(
                "px-5 py-3 rounded-2xl font-extrabold transition",
                "bg-white text-black hover:scale-[1.02] active:scale-[0.99]",
                disabled && "opacity-60 cursor-not-allowed hover:scale-100"
              )}
            >
              {lang === "ar" ? "شراء طوارئ" : "Buy Emergency"}
            </button>
          </div>
        </motion.div>
      ) : null}

      {/* Bundles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-4 animate-pulse">
                <div className="h-3 w-40 bg-white/10 rounded mb-2" />
                <div className="h-2 w-24 bg-white/10 rounded mb-4" />
                <div className="h-8 w-24 bg-white/10 rounded" />
                <div className="h-10 w-full bg-white/10 rounded-2xl mt-4" />
              </div>
            ))
          : bundles.map((a) => (
              <motion.div
                key={a?.id || a?.addonKey}
                whileHover={{ y: -3 }}
                className="rounded-3xl border border-white/12 bg-white/6 backdrop-blur-xl p-4 overflow-hidden relative"
              >
                {/* glow */}
                <div
                  className="absolute -inset-[2px] opacity-0 hover:opacity-60 transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(56,189,248,0.18), rgba(168,85,247,0.16), rgba(16,185,129,0.14))",
                    filter: "blur(16px)",
                  }}
                />

                <div className="relative">
                  <div className={cn("flex items-start justify-between gap-2", lang === "ar" && "flex-row-reverse")}>
                    <div className={cn("min-w-0", lang === "ar" ? "text-right" : "text-left")}>
                      <div className="text-white font-extrabold truncate">
                        {pickText(a?.title, lang)}
                      </div>
                      <div className="text-[12px] text-white/60 font-semibold mt-1">
                        {lang === "ar"
                          ? `${Number(a?.qty || 0)} معاملات إضافية`
                          : `${Number(a?.qty || 0)} extra transactions`}
                      </div>
                    </div>

                    {a?.popular ? (
                      <span className="px-2 py-1 rounded-full text-[11px] font-extrabold bg-white text-black border border-white/50">
                        {lang === "ar" ? "الأكثر طلبًا" : "Popular"}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-[11px] font-extrabold bg-black/30 text-white/70 border border-white/10">
                        Add-on
                      </span>
                    )}
                  </div>

                  <div className={cn("mt-4 flex items-end justify-between", lang === "ar" && "flex-row-reverse")}>
                    <div className="text-white text-3xl font-black">{money(a?.price)}</div>
                    <div className="text-white/60 text-sm font-bold">{lang === "ar" ? "درهم" : "AED"}</div>
                  </div>

                  <div className={cn("mt-3 flex items-center justify-between", lang === "ar" && "flex-row-reverse")}>
                    <div className="text-[12px] text-white/60 font-semibold">
                      {lang === "ar" ? "تغطية: طباعة + ضريبة + معالجة" : "Covers: printing + VAT + processing"}
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white/85" />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onBuyAddon?.(a)}
                    className={cn(
                      "mt-4 w-full py-3 rounded-2xl font-extrabold transition",
                      "bg-gradient-to-r from-emerald-600 via-sky-600 to-purple-700 text-white",
                      "hover:scale-[1.01] active:scale-[0.99]",
                      disabled && "opacity-60 cursor-not-allowed hover:scale-100"
                    )}
                  >
                    {lang === "ar" ? "شراء وإضافة الرصيد" : "Buy & Add Credits"}
                  </button>
                </div>
              </motion.div>
            ))}
      </div>
    </div>
  );
}
