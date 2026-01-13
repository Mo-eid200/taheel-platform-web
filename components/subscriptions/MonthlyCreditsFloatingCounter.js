"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import {
  FaCrown,
  FaChartBar,
  FaBolt,
  FaCheckCircle,
  FaSyncAlt,
} from "react-icons/fa";

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function monthName(key, lang) {
  // key = "YYYY-MM"
  if (!key) return lang === "en" ? "—" : "—";
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
  companyDocId, // مثال: "COM-400-0106"
  lang = "ar",
  compact = false, // لو حابب نسخة أصغر للموبايل
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

    // (اختياري) لو عايز تعرض حالة الاشتراك isActive / endAt
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

    const isActive = !!sub?.isActive; // منطقك الجديد (وقت + رصيد)
    const endAtISO = sub?.endAtISO || "";
    const planName = sub?.planName || sub?.planKey || "";

    return {
      monthKey,
      baseLimit,
      baseRemaining,
      addonsRemaining,
      totalRemaining,
      isActive,
      endAtISO,
      planName,
    };
  }, [mtc, sub]);

  const t = {
    ar: {
      title: "رصيدك",
      month: "شهر الرصيد:",
      monthly: "الطلبات الشهرية المتاحة",
      addons: "الباقات الإضافية (Add-ons)",
      total: "الإجمالي المتبقي",
      active: "اشتراك فعّال",
      inactive: "غير فعّال",
      until: "حتى",
      noData: "لا توجد بيانات رصيد",
    },
    en: {
      title: "Your Credits",
      month: "Billing month:",
      monthly: "Monthly available requests",
      addons: "Add-ons balance",
      total: "Total remaining",
      active: "Active",
      inactive: "Inactive",
      until: "until",
      noData: "No credits data",
    },
  }[lang === "en" ? "en" : "ar"];

  // لو مفيش بيانات نهائي
  if (!mtc) {
    return (
      <div className="fixed right-4 top-28 z-[60] hidden xl:block">
        <div className="w-[280px] rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-2xl p-4">
          <div className="text-white/90 font-extrabold text-sm flex items-center gap-2">
            <FaChartBar className="text-sky-300" />
            {t.title}
          </div>
          <div className="mt-3 text-white/60 text-xs">{t.noData}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-24 z-[60] hidden xl:block">
      <div
        className={[
          "w-[300px] rounded-3xl overflow-hidden",
          "border border-white/10",
          "bg-gradient-to-b from-[#061a3a]/85 via-[#07142b]/80 to-slate-950/70",
          "backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
          compact ? "scale-95" : "",
        ].join(" ")}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-white/10 flex items-center justify-center">
                <FaChartBar className="text-sky-300" />
              </div>
              <div>
                <div className="text-white font-extrabold text-[14px] leading-tight">
                  {t.title}
                </div>
                <div className="text-white/60 text-[11px] mt-0.5">
                  {t.month}{" "}
                  <span className="text-white/85 font-bold">
                    {monthName(view.monthKey, lang)}
                  </span>
                </div>
              </div>
            </div>

            {/* Status pill */}
            <div
              className={[
                "px-2.5 py-1 rounded-full text-[10px] font-extrabold",
                view.isActive
                  ? "bg-emerald-400/15 text-emerald-200 border border-emerald-300/20"
                  : "bg-rose-400/15 text-rose-200 border border-rose-300/20",
              ].join(" ")}
              title={view.endAtISO ? `${t.until} ${view.endAtISO}` : ""}
            >
              <span className="inline-flex items-center gap-1">
                {view.isActive ? <FaCheckCircle /> : <FaSyncAlt />}
                {view.isActive ? t.active : t.inactive}
              </span>
            </div>
          </div>

          {view.planName ? (
            <div className="mt-2 text-[11px] text-white/70 flex items-center gap-2">
              <FaCrown className="text-yellow-300" />
              <span className="font-bold text-white/85">{view.planName}</span>
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div className="p-4">
          {/* Total Gauge */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center justify-between">
              <div className="text-white/80 text-[12px] font-bold">
                {t.total}
              </div>
              <div className="text-white font-extrabold text-[16px]">
                {view.totalRemaining}
              </div>
            </div>

            {/* progress bar */}
            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                style={{
                  width:
                    view.baseLimit > 0
                      ? `${Math.min(
                          100,
                          Math.round((view.totalRemaining / (view.baseLimit + 0.0001)) * 100)
                        )}%`
                      : view.totalRemaining > 0
                      ? "100%"
                      : "0%",
                }}
              />
            </div>
            <div className="mt-2 text-[10px] text-white/55">
              {lang === "en"
                ? "Updates in real-time after every order."
                : "يتحدث تلقائيًا بعد كل طلب."}
            </div>
          </div>

          {/* Two counters */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            {/* Monthly */}
            <div className="rounded-2xl bg-gradient-to-b from-sky-500/15 to-white/5 border border-sky-300/15 p-3">
              <div className="text-[11px] text-white/80 font-bold leading-snug">
                {t.monthly}
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div className="text-white font-extrabold text-[22px]">
                  {view.baseRemaining}
                </div>
                <div className="text-white/50 text-[11px] font-bold">
                  / {view.baseLimit}
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300"
                  style={{
                    width:
                      view.baseLimit > 0
                        ? `${Math.min(100, Math.round((view.baseRemaining / view.baseLimit) * 100))}%`
                        : "0%",
                  }}
                />
              </div>
            </div>

            {/* Add-ons */}
            <div className="rounded-2xl bg-gradient-to-b from-violet-500/15 to-white/5 border border-violet-300/15 p-3">
              <div className="text-[11px] text-white/80 font-bold leading-snug flex items-center gap-1">
                <FaBolt className="text-violet-200" />
                {t.addons}
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div className="text-white font-extrabold text-[22px]">
                  {view.addonsRemaining}
                </div>
                <div className="text-white/50 text-[11px] font-bold">TX</div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-300"
                  style={{
                    width: view.addonsRemaining > 0 ? "100%" : "0%",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Foot note */}
          <div className="mt-3 text-[10px] text-white/55 leading-relaxed">
            {lang === "en"
              ? "Monthly credits reset automatically each new month. Add-ons follow their usable month rules."
              : "الرصيد الشهري يتصفّر تلقائيًا أول كل شهر. والإضافات تُحسب حسب شهر الاستخدام (usableMonthKey)."}
          </div>
        </div>
      </div>
    </div>
  );
}
