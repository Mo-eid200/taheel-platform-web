"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import { FaCrown } from "react-icons/fa";

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function monthName(key, lang) {
  if (!key) return "—";
  const [y, m] = key.split("-").map((x) => Number(x));
  const d = new Date(y, (m || 1) - 1, 1);
  try {
    return d.toLocaleDateString(lang === "en" ? "en-US" : "ar-EG", {
      year: "numeric",
      month: "long",
    });
  } catch {
    return key;
  }
}

export default function MonthlyCreditsFloatingCounter({
  companyDocId,
  lang = "ar",
  compact = false,
}) {
  const [mtc, setMtc] = useState(null);
  const [sub, setSub] = useState(null);

  useEffect(() => {
    if (!companyDocId) return;

    const userRef = doc(firestore, "users", String(companyDocId));
    const unsubUser = onSnapshot(userRef, (snap) => {
      const d = snap.data() || {};
      setMtc(d.monthlyTxCredits || null);
    });

    const subRef = doc(firestore, "companySubscriptions", String(companyDocId));
    const unsubSub = onSnapshot(subRef, (snap) => {
      setSub(snap.exists() ? snap.data() : null);
    });

    return () => {
      unsubUser?.();
      unsubSub?.();
    };
  }, [companyDocId]);

  const view = useMemo(() => {
    const monthKey = mtc?.monthKey || "";
    const baseLimit = safeNum(mtc?.baseLimit);
    const baseRemaining = safeNum(mtc?.baseRemaining);
    const addonsRemaining = safeNum(mtc?.addonsRemaining);
    const totalRemaining = baseRemaining + addonsRemaining;

    const isActive = !!sub?.isActive;
    const planName = sub?.planName || sub?.planKey || "";

    return {
      monthKey,
      baseLimit,
      baseRemaining,
      addonsRemaining,
      totalRemaining,
      isActive,
      planName,
    };
  }, [mtc, sub]);

  const t = {
    ar: {
      topLabel: "الطلبات الشهرية المتاحة",
      bottomLabel: "الإضافات (Add-ons)",
      month: "شهر الرصيد",
      active: "اشتراك فعّال",
      inactive: "غير فعّال",
    },
    en: {
      topLabel: "Monthly requests",
      bottomLabel: "Add-ons",
      month: "Billing month",
      active: "Active",
      inactive: "Inactive",
    },
  }[lang === "en" ? "en" : "ar"];

  // لو مفيش بيانات
  if (!mtc) return null;

  return (
    <div className="fixed right-5 top-32 z-[80] hidden xl:block">
      <div
        className={[
          "relative",
          "w-[270px]",
          "select-none",
          "animate-[mercFloat_4.8s_ease-in-out_infinite]",
          compact ? "scale-95" : "",
        ].join(" ")}
        style={{
          filter: "drop-shadow(0 24px 60px rgba(0,0,0,0.55))",
        }}
      >
        {/* Frame */}
        <div className="relative rounded-[22px] p-[10px] bg-gradient-to-b from-white/15 via-white/5 to-black/30 border border-white/15 backdrop-blur-xl">
          {/* Inner screen */}
          <div className="relative rounded-[16px] overflow-hidden bg-gradient-to-b from-[#0a1b3a]/95 via-[#08142a]/95 to-[#050a12]/95 border border-white/10">
            {/* Top small header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <div className="text-white/70 text-[11px] font-bold">
                {t.month}:{" "}
                <span className="text-white/90 font-extrabold">
                  {monthName(view.monthKey, lang)}
                </span>
              </div>

              <div
                className={[
                  "text-[10px] font-extrabold px-2 py-1 rounded-full border",
                  view.isActive
                    ? "text-emerald-200 border-emerald-300/20 bg-emerald-400/10"
                    : "text-rose-200 border-rose-300/20 bg-rose-400/10",
                ].join(" ")}
              >
                {view.isActive ? t.active : t.inactive}
              </div>
            </div>

            {/* Odometer body */}
            <div className="px-4 pb-4">
              {/* TOP number */}
              <div className="text-white/75 text-[11px] font-bold mb-1">
                {t.topLabel}
              </div>

              <div className="flex items-end justify-between">
                <div
                  className="text-white font-black tracking-[0.08em] text-[44px] leading-none"
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    textShadow: "0 2px 10px rgba(0,0,0,0.35)",
                  }}
                >
                  {view.baseRemaining}
                </div>

                <div className="text-white/55 text-[13px] font-extrabold pb-1">
                  / {view.baseLimit || 0}
                </div>
              </div>

              {/* Red divider line (like Mercedes) */}
              <div className="relative my-3">
                <div className="h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent" />
              </div>

              {/* BOTTOM number */}
              <div className="text-white/75 text-[11px] font-bold mb-1 flex items-center justify-between">
                <span>{t.bottomLabel}</span>
                {view.planName ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-yellow-200/90 font-extrabold">
                    <FaCrown className="text-yellow-300" /> {view.planName}
                  </span>
                ) : null}
              </div>

              <div className="flex items-end justify-between">
                <div
                  className="text-white font-black tracking-[0.08em] text-[40px] leading-none"
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    textShadow: "0 2px 10px rgba(0,0,0,0.35)",
                  }}
                >
                  {view.addonsRemaining}
                </div>

                <div className="text-white/55 text-[12px] font-extrabold pb-1">
                  TX
                </div>
              </div>

              {/* tiny hint */}
              <div className="mt-3 text-[10px] text-white/45">
                {lang === "en"
                  ? "Updates automatically after each order."
                  : "يتحدث تلقائيًا بعد كل طلب."}
              </div>
            </div>

            {/* soft scanline effect */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, rgba(0,0,0,0) 1px)",
                backgroundSize: "100% 4px",
                mixBlendMode: "overlay",
              }}
            />
          </div>
        </div>

        {/* floating glow */}
        <div
          className="pointer-events-none absolute -inset-1 rounded-[26px]"
          style={{
            boxShadow: "0 0 0 1px rgba(59,130,246,0.18), 0 0 30px rgba(59,130,246,0.12)",
          }}
        />
      </div>

      {/* Keyframes */}
      <style jsx>{`
        @keyframes mercFloat {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
          100% {
            transform: translateY(0px);
          }
        }
      `}</style>
    </div>
  );
}
