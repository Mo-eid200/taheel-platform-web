"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/**
 * Announcement JSON expected at /public/announcement.json
 * See example below.
 */

function detectOS() {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if (isAndroid) return "android";
  if (isIOS) return "ios";
  return "web";
}

export default function AnnouncementBar({ lang = "en" }) {
  const [ann, setAnn] = useState(null);
  const [visible, setVisible] = useState(false);
  const [idx, setIdx] = useState(0);
  const [os, setOs] = useState("web");

  useEffect(() => {
    setOs(detectOS());
  }, []);

  useEffect(() => {
    fetch("/announcement.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data?.enabled) return;

        const now = Date.now();
        if (data.startAt && now < new Date(data.startAt).getTime()) return;
        if (data.endAt && now > new Date(data.endAt).getTime()) return;

        const dismissed = localStorage.getItem("ann-dismissed");
        if (dismissed === data.id) return;

        setAnn(data);
        // cinematic entrance
        setTimeout(() => setVisible(true), 120);
      })
      .catch(() => {});
  }, []);

  // auto-rotate messages
  useEffect(() => {
    if (!ann?.messages?.length) return;
    const intervalMs = ann.rotateMs ?? 4200;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % ann.messages.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [ann]);

  const isArabic = lang === "ar";
  const dir = isArabic ? "rtl" : "ltr";

  const current = useMemo(() => {
    if (!ann?.messages?.length) return null;
    return ann.messages[idx] || ann.messages[0];
  }, [ann, idx]);

  if (!ann || !current || !visible) {
    // NOTE: keep spacer only after visible; otherwise header won't jump on initial paint
  }

  if (!ann || !current) return null;

  // smart CTA link by OS
  const play = ann.links?.play || "https://play.google.com/store/apps/details?id=ae.taheel.app";
  const ios = ann.links?.ios || "https://apps.apple.com/ae/app/taheel-government-services/id6755335579";
  const fallback = ann.links?.fallback || "/app";

  const smartLink = os === "android" ? play : os === "ios" ? ios : fallback;

  const title = isArabic ? current.title_ar : current.title_en;
  const desc = isArabic ? current.desc_ar : current.desc_en;

  const ctaLabel =
    os === "android"
      ? (isArabic ? "حمّل من Google Play" : "Get on Google Play")
      : os === "ios"
      ? (isArabic ? "حمّل من App Store" : "Download on App Store")
      : (isArabic ? "افتح صفحة التحميل" : "Open download page");

  const badgeText = isArabic ? (ann.badge_ar || "عرض رأس السنة 2026") : (ann.badge_en || "New Year 2026");

  const close = () => {
    localStorage.setItem("ann-dismissed", ann.id);
    setVisible(false);
    // optional: remove completely after animation
    setTimeout(() => setAnn(null), 260);
  };

  return (
    <>
      <div className="fixed top-0 inset-x-0 z-[999]">
        <div
          dir={dir}
          className={`relative overflow-hidden transition-all duration-700 ease-out ${
            visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
          }`}
        >
          {/* premium ambient glow */}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-500/25 via-cyan-300/15 to-emerald-500/25 animate-[annGlow_6s_ease-in-out_infinite]" />

          {/* thin top highlight */}
          <span className="pointer-events-none absolute top-0 inset-x-0 h-[1px] bg-white/25" />

          <div className="relative bg-gradient-to-r from-[#064e3b] via-[#0f766e] to-[#065f46] text-white shadow-[0_18px_60px_-25px_rgba(0,0,0,0.9)] border-b border-white/10">
            <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              {/* Left: badge + text */}
              <div className={`flex-1 ${isArabic ? "text-right" : "text-left"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/25 border border-white/15 font-extrabold tracking-wide">
                    {badgeText}
                  </span>

                  {/* live dot */}
                  <span className="relative inline-flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60 opacity-70" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white/80" />
                  </span>

                  <span className="text-[12px] sm:text-sm font-extrabold">
                    TAHEEL
                  </span>
                </div>

                {/* rotating message */}
                <div className="mt-1">
                  <div className="font-extrabold text-sm sm:text-base leading-snug">
                    <span className="inline-block align-middle">{title}</span>
                  </div>
                  <div className="text-[12px] sm:text-sm text-white/85 leading-snug">
                    {desc}
                  </div>
                </div>

                {/* progress bar for rotation (premium touch) */}
                <div className="mt-2 h-[3px] w-full bg-black/20 rounded-full overflow-hidden">
                  <div
                    key={idx}
                    className="h-full w-full origin-left bg-gradient-to-r from-white/70 via-white/40 to-white/70 animate-[annProgress_var(--annms)_linear_1]"
                    style={{
                      // CSS variable duration
                      ["--annms"]: `${ann.rotateMs ?? 4200}ms`,
                    }}
                  />
                </div>
              </div>

              {/* Right: CTA + close */}
              <div className={`flex items-center gap-2 sm:gap-3 ${isArabic ? "self-start sm:self-center" : "self-start sm:self-center"}`}>
                <Link
                  href={smartLink}
                  className="relative overflow-hidden px-4 py-2 rounded-full bg-white text-emerald-900 font-extrabold text-xs sm:text-sm shadow-md hover:scale-[1.03] active:scale-[0.99] transition-transform"
                  aria-label={ctaLabel}
                >
                  <span className="relative z-10">{ctaLabel}</span>
                  {/* shimmer pass */}
                  <span className="pointer-events-none absolute inset-0 -translate-x-[120%] animate-[annShimmer_3.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/55 to-transparent" />
                </Link>

                <button
                  onClick={close}
                  className="w-9 h-9 rounded-full bg-black/25 border border-white/10 text-white/85 hover:text-white hover:bg-black/35 transition flex items-center justify-center"
                  aria-label={isArabic ? "إغلاق" : "Close"}
                  type="button"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
            </div>
          </div>

          {/* keyframes */}
          <style jsx>{`
            @keyframes annGlow {
              0% { opacity: 0.45; transform: translateX(-8%); }
              50% { opacity: 0.75; transform: translateX(8%); }
              100% { opacity: 0.45; transform: translateX(-8%); }
            }
            @keyframes annShimmer {
              0% { transform: translateX(-130%); opacity: 0.0; }
              15% { opacity: 1; }
              50% { opacity: 1; }
              85% { opacity: 0.6; }
              100% { transform: translateX(130%); opacity: 0.0; }
            }
            @keyframes annProgress {
              from { transform: scaleX(0); }
              to { transform: scaleX(1); }
            }
          `}</style>
        </div>
      </div>

      {/* spacer so your sticky header isn't covered */}
      <div className="h-[86px] sm:h-[76px]" />
    </>
  );
}
