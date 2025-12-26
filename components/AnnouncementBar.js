"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setOs(detectOS());

    // Respect reduced motion
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const apply = () => setReduceMotion(!!mq.matches);
      apply();
      mq.addEventListener?.("change", apply);
      return () => mq.removeEventListener?.("change", apply);
    }
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
        setTimeout(() => setVisible(true), 120);
      })
      .catch(() => {});
  }, []);

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

  if (!ann || !current) return null;

  // smart CTA link by OS
  const play =
    ann.links?.play ||
    "https://play.google.com/store/apps/details?id=ae.taheel.app";
  const ios =
    ann.links?.ios ||
    "https://apps.apple.com/ae/app/taheel-government-services/id6755335579";
  const fallback = ann.links?.fallback || "/app";

  const smartLink = os === "android" ? play : os === "ios" ? ios : fallback;

  const title = isArabic ? current.title_ar : current.title_en;
  const desc = isArabic ? current.desc_ar : current.desc_en;

  const ctaLabel =
    os === "android"
      ? isArabic
        ? "حمّل من Google Play"
        : "Get on Google Play"
      : os === "ios"
      ? isArabic
        ? "حمّل من App Store"
        : "Download on App Store"
      : isArabic
      ? "افتح صفحة التحميل"
      : "Open download page";

  const badgeText = isArabic
    ? ann.badge_ar || "🎆 رأس السنة 2026"
    : ann.badge_en || "🎆 New Year 2026";

  const close = () => {
    localStorage.setItem("ann-dismissed", ann.id);
    setVisible(false);
    setTimeout(() => setAnn(null), 260);
  };

  // When not visible yet, don't render spacer to avoid initial jump (optional)
  if (!visible) return null;

  return (
    <>
      <div className="fixed top-0 inset-x-0 z-[999]">
        <div
          dir={dir}
          className={`relative overflow-hidden transition-all duration-700 ease-out ${
            visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
          }`}
        >
          {/* 🎆 New Year 2026: Confetti (lightweight, CSS only) */}
          {!reduceMotion && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="ann-confetti c1" />
              <span className="ann-confetti c2" />
              <span className="ann-confetti c3" />
              <span className="ann-confetti c4" />
              <span className="ann-confetti c5" />
              <span className="ann-confetti c6" />
            </div>
          )}

          {/* ✨ Sparkle overlay */}
          {!reduceMotion && (
            <div className="pointer-events-none absolute inset-0 opacity-80">
              <span className="ann-spark s1" />
              <span className="ann-spark s2" />
              <span className="ann-spark s3" />
              <span className="ann-spark s4" />
            </div>
          )}

          {/* premium ambient glow */}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-300/10 via-emerald-300/10 to-cyan-300/10 animate-[annGlow_6s_ease-in-out_infinite]" />

          {/* thin top highlight */}
          <span className="pointer-events-none absolute top-0 inset-x-0 h-[1px] bg-white/25" />

          <div className="relative bg-gradient-to-r from-[#0b1220] via-[#0f766e] to-[#14532d] text-white shadow-[0_18px_60px_-25px_rgba(0,0,0,0.9)] border-b border-white/10">
            <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              {/* Left: badge + text */}
              <div className={`flex-1 ${isArabic ? "text-right" : "text-left"}`}>
                <div className="flex items-center gap-2">
                  {/* 🎆 Badge */}
                  <span className="relative text-[10px] px-2.5 py-1 rounded-full font-extrabold tracking-wide bg-white/10 border border-white/15">
                    <span className="mr-1">🥂</span>
                    {badgeText}
                    {/* glow ring */}
                    <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/20 shadow-[0_0_22px_rgba(255,255,255,0.16)]" />
                  </span>

                  {/* live dot */}
                  <span className="relative inline-flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60 opacity-70" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white/85" />
                  </span>

                  <span className="text-[12px] sm:text-sm font-extrabold">
                    TAHEEL ✦ Dubai
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

                {/* progress bar for rotation */}
                <div className="mt-2 h-[3px] w-full bg-black/25 rounded-full overflow-hidden">
                  <div
                    key={idx}
                    className={`h-full w-full origin-left bg-gradient-to-r from-amber-100/80 via-white/40 to-emerald-100/80 ${
                      reduceMotion
                        ? ""
                        : "animate-[annProgress_var(--annms)_linear_1]"
                    }`}
                    style={{
                      ["--annms"]: `${ann.rotateMs ?? 4200}ms`,
                    }}
                  />
                </div>
              </div>

              {/* Right: CTA + close */}
              <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-center">
                <Link
                  href={smartLink}
                  className="relative overflow-hidden px-4 py-2 rounded-full bg-white text-emerald-900 font-extrabold text-xs sm:text-sm shadow-md hover:scale-[1.03] active:scale-[0.99] transition-transform"
                  aria-label={ctaLabel}
                >
                  <span className="relative z-10">
                    {ctaLabel} <span className="ml-1">→</span>
                  </span>
                  {!reduceMotion && (
                    <span className="pointer-events-none absolute inset-0 -translate-x-[120%] animate-[annShimmer_3.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  )}
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

            {/* tiny New Year ribbon line */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-200/50 to-transparent" />
          </div>

          <style jsx>{`
            @keyframes annGlow {
              0% {
                opacity: 0.45;
                transform: translateX(-8%);
              }
              50% {
                opacity: 0.85;
                transform: translateX(8%);
              }
              100% {
                opacity: 0.45;
                transform: translateX(-8%);
              }
            }
            @keyframes annShimmer {
              0% {
                transform: translateX(-130%);
                opacity: 0;
              }
              15% {
                opacity: 1;
              }
              50% {
                opacity: 1;
              }
              85% {
                opacity: 0.6;
              }
              100% {
                transform: translateX(130%);
                opacity: 0;
              }
            }
            @keyframes annProgress {
              from {
                transform: scaleX(0);
              }
              to {
                transform: scaleX(1);
              }
            }

            /* Confetti */
            .ann-confetti {
              position: absolute;
              top: -14px;
              width: 10px;
              height: 10px;
              border-radius: 2px;
              opacity: 0.9;
              filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
              animation: confFall 3.9s linear infinite;
            }
            .c1 {
              left: 8%;
              background: rgba(251, 191, 36, 0.9);
              animation-duration: 4.2s;
            }
            .c2 {
              left: 18%;
              background: rgba(16, 185, 129, 0.9);
              animation-duration: 3.6s;
              width: 8px;
              height: 14px;
            }
            .c3 {
              left: 45%;
              background: rgba(56, 189, 248, 0.9);
              animation-duration: 4.6s;
              width: 7px;
              height: 7px;
              border-radius: 99px;
            }
            .c4 {
              left: 62%;
              background: rgba(244, 63, 94, 0.85);
              animation-duration: 3.8s;
              width: 12px;
              height: 8px;
            }
            .c5 {
              left: 78%;
              background: rgba(255, 255, 255, 0.85);
              animation-duration: 4.9s;
              width: 9px;
              height: 9px;
              border-radius: 99px;
            }
            .c6 {
              left: 92%;
              background: rgba(167, 139, 250, 0.9);
              animation-duration: 4.1s;
              width: 8px;
              height: 12px;
            }
            @keyframes confFall {
              0% {
                transform: translateY(0) rotate(0deg);
                opacity: 0.0;
              }
              10% {
                opacity: 1;
              }
              100% {
                transform: translateY(90px) rotate(220deg);
                opacity: 0.0;
              }
            }

            /* Sparkles */
            .ann-spark {
              position: absolute;
              width: 10px;
              height: 10px;
              border-radius: 999px;
              background: radial-gradient(
                circle,
                rgba(255, 255, 255, 0.95),
                rgba(255, 255, 255, 0) 70%
              );
              opacity: 0.9;
              animation: sparkle 2.8s ease-in-out infinite;
            }
            .s1 {
              top: 20%;
              left: 12%;
              animation-duration: 2.4s;
            }
            .s2 {
              top: 35%;
              left: 48%;
              animation-duration: 3.1s;
            }
            .s3 {
              top: 55%;
              left: 74%;
              animation-duration: 2.7s;
            }
            .s4 {
              top: 18%;
              left: 86%;
              animation-duration: 3.4s;
            }
            @keyframes sparkle {
              0% {
                transform: scale(0.6);
                opacity: 0.25;
              }
              50% {
                transform: scale(1.2);
                opacity: 0.95;
              }
              100% {
                transform: scale(0.6);
                opacity: 0.25;
              }
            }
          `}</style>
        </div>
      </div>

      {/* spacer so your sticky header isn't covered */}
      <div className="h-[92px] sm:h-[80px]" />
    </>
  );
}
