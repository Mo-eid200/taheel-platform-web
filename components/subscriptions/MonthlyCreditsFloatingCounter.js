"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import { FaCrown, FaPlusCircle } from "react-icons/fa";
import { useRouter } from "next/navigation";

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v === "object" && typeof v.toDate === "function") return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d, lang) {
  if (!d) return "—";
  try {
    return d.toLocaleString(lang === "en" ? "en-US" : "ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
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
  subscriptionsPath = "/subscriptions",
}) {
  const router = useRouter();

  const [userDoc, setUserDoc] = useState(null);
  const [sub, setSub] = useState(null);
  const [loaded, setLoaded] = useState({ user: false, sub: false });

  useEffect(() => {
    if (!companyDocId) return;

    const userRef = doc(firestore, "users", String(companyDocId));
    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        setLoaded((p) => ({ ...p, user: true }));
        setUserDoc(snap.exists() ? snap.data() : null);
      },
      () => setLoaded((p) => ({ ...p, user: true }))
    );

    const subRef = doc(firestore, "companySubscriptions", String(companyDocId));
    const unsubSub = onSnapshot(
      subRef,
      (snap) => {
        setLoaded((p) => ({ ...p, sub: true }));
        setSub(snap.exists() ? snap.data() : null);
      },
      () => setLoaded((p) => ({ ...p, sub: true }))
    );

    return () => {
      unsubUser?.();
      unsubSub?.();
    };
  }, [companyDocId]);

  const view = useMemo(() => {
    const mtc = userDoc?.monthlyTxCredits || null;
    const mtcSafe = mtc || { monthKey: "", baseLimit: 0, baseRemaining: 0, addonsRemaining: 0 };

    const monthKey = mtcSafe?.monthKey || "";
    const baseLimit = safeNum(mtcSafe?.baseLimit);
    const baseRemaining = safeNum(mtcSafe?.baseRemaining);
    const addonsRemaining = safeNum(mtcSafe?.addonsRemaining);

    // =========================================================
    // ✅ (A) timeActive = وقت الاشتراك فقط (لا علاقة بـ isActive ولا subscriptionActive)
    // مصدر الوقت: users أولًا، ولو ناقص fallback من companySubscriptions
    // =========================================================
    const now = new Date();

    const startAtUsers =
      toDateSafe(userDoc?.subscriptionStartAtISO || userDoc?.subscriptionStartAt) || null;
    const endAtUsers =
      toDateSafe(userDoc?.subscriptionEndAtISO || userDoc?.subscriptionEndAt) || null;

    const startAtSub = toDateSafe(sub?.startAt) || null;
    const endAtSub = toDateSafe(sub?.endAt) || null;

    const startAt = startAtUsers || startAtSub; // للعرض + للحكم
    const endAt = endAtUsers || endAtSub;       // للعرض + للحكم

    const startOk = !startAt || startAt.getTime() <= now.getTime();
    const endOk = !endAt || endAt.getTime() > now.getTime();

    // ✅ العداد يظهر طالما الوقت شغال
    const timeActive = startOk && endOk;

    // =========================================================
    // ✅ (B) benefitsActive = isActive من companySubscriptions فقط (رصيد/مميزات)
    // =========================================================
    const benefitsActive = Boolean(sub?.isActive);

    const planName = sub?.planName || sub?.planKey || "";

    const monthlyExhausted = baseLimit > 0 && baseRemaining <= 0;
    const addonsEmpty = addonsRemaining <= 0;

    return {
      monthKey,
      baseLimit,
      baseRemaining,
      addonsRemaining,
      planName,
      startAt,
      endAt,
      timeActive,      // ✅ يتحكم في ظهور/اختفاء العداد فقط
      benefitsActive,  // ✅ يتحكم في البادچ فقط (مميزات ON/OFF)
      monthlyExhausted,
      addonsEmpty,
    };
  }, [userDoc, sub]);

  const t = {
    ar: {
      topLabel: "المعاملات الشهرية",
      bottomLabel: "الإضافات (Add-ons)",
      month: "شهر الرصيد",
      active: "مميزات فعّالة",
      inactive: "انتهت المعاملات (رصيد 0)",
      start: "بداية الاشتراك",
      end: "انتهاء الاشتراك",
      exhausted: "لقد استهلكت معاملاتك الشهرية كاملة",
      addMore: "إضافة معاملات +",
      hint: "يتحدث تلقائيًا بعد كل طلب.",
    },
    en: {
      topLabel: "Monthly requests",
      bottomLabel: "Add-ons",
      month: "Billing month",
      active: "Benefits ON",
      inactive: "0 credits (Benefits OFF)",
      start: "Start",
      end: "End",
      exhausted: "You have used all your monthly transactions.",
      addMore: "Add transactions +",
      hint: "Updates automatically after each order.",
    },
  }[lang === "en" ? "en" : "ar"];

  // ✅ استنى الاتنين
  if (!loaded.user || !loaded.sub) return null;

  // ✅ العداد يختفي فقط لما وقت الاشتراك يخلص
  if (!view.timeActive) return null;

  const baseNumberCls = view.monthlyExhausted ? "text-rose-300" : "text-white";
  const addOnNumberCls = view.addonsEmpty ? "text-rose-300" : "text-white";

  return (
    <div className="fixed right-5 top-40 z-[80] hidden xl:block">
      <div
        className={[
          "relative",
          "w-[270px]",
          "select-none",
          "animate-[mercFloat_4.8s_ease-in-out_infinite]",
          compact ? "scale-95" : "",
        ].join(" ")}
        style={{ filter: "drop-shadow(0 24px 60px rgba(0,0,0,0.55))" }}
      >
        <div className="relative rounded-[22px] p-[10px] bg-gradient-to-b from-white/15 via-white/5 to-black/30 border border-white/15 backdrop-blur-xl">
          <div className="relative rounded-[16px] overflow-hidden bg-gradient-to-b from-[#0a1b3a]/95 via-[#08142a]/95 to-[#050a12]/95 border border-white/10">
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center justify-between">
                <div className="text-white/70 text-[11px] font-bold">
                  {t.month}:{" "}
                  <span className="text-white/90 font-extrabold">
                    {monthName(view.monthKey, lang)}
                  </span>
                </div>

                {/* ✅ البادچ يعتمد على benefitsActive فقط */}
                <div
                  className={[
                    "text-[10px] font-extrabold px-2 py-1 rounded-full border",
                    view.benefitsActive
                      ? "text-emerald-200 border-emerald-300/20 bg-emerald-400/10"
                      : "text-rose-200 border-rose-300/25 bg-rose-400/10",
                  ].join(" ")}
                >
                  {view.benefitsActive ? t.active : t.inactive}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-1">
                  <div className="text-[10px] text-white/60 font-bold">{t.start}</div>
                  <div className="text-[10px] text-white/90 font-extrabold">
                    {fmtDate(view.startAt, lang)}
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-1">
                  <div className="text-[10px] text-white/60 font-bold">{t.end}</div>
                  <div className="text-[10px] text-white/90 font-extrabold">
                    {fmtDate(view.endAt, lang)}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 pb-4">
              <div className="text-white/75 text-[11px] font-bold mb-1 flex items-center justify-between">
                <span>{t.topLabel}</span>
                {view.planName ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-yellow-200/90 font-extrabold">
                    <FaCrown className="text-yellow-300" /> {view.planName}
                  </span>
                ) : null}
              </div>

              <div className="flex items-end justify-between">
                <div
                  className={`${baseNumberCls} font-black tracking-[0.08em] text-[44px] leading-none`}
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    textShadow: "0 2px 10px rgba(0,0,0,0.35)",
                  }}
                >
                  {Math.max(0, view.baseRemaining)}
                </div>

                <div className="text-white/55 text-[13px] font-extrabold pb-1">
                  / {view.baseLimit || 0}
                </div>
              </div>

              {view.monthlyExhausted && (
                <div className="mt-2 text-[11px] font-black text-rose-300">{t.exhausted}</div>
              )}

              <div className="relative my-3">
                <div className="h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent" />
              </div>

              <div className="text-white/75 text-[11px] font-bold mb-1 flex items-center justify-between">
                <span>{t.bottomLabel}</span>
                {view.addonsEmpty ? (
                  <button
                    type="button"
                    onClick={() => router.push(subscriptionsPath)}
                    className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-1 rounded-full border border-rose-300/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15 transition cursor-pointer"
                    title={t.addMore}
                  >
                    <FaPlusCircle className="text-rose-200" />
                    {t.addMore}
                  </button>
                ) : null}
              </div>

              <div className="flex items-end justify-between">
                <div
                  className={`${addOnNumberCls} font-black tracking-[0.08em] text-[40px] leading-none`}
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    textShadow: "0 2px 10px rgba(0,0,0,0.35)",
                  }}
                >
                  {Math.max(0, view.addonsRemaining)}
                </div>

                <div className="text-white/55 text-[12px] font-extrabold pb-1">TX</div>
              </div>

              <div className="mt-3 text-[10px] text-white/45">{t.hint}</div>
            </div>

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

        <div
          className="pointer-events-none absolute -inset-1 rounded-[26px]"
          style={{
            boxShadow: "0 0 0 1px rgba(59,130,246,0.18), 0 0 30px rgba(59,130,246,0.12)",
          }}
        />
      </div>

      <style jsx>{`
        @keyframes mercFloat {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </div>
  );
}
