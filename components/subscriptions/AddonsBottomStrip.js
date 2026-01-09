"use client";

import React, { useEffect, useMemo, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { FaBolt, FaPlus, FaCrown, FaRocket, FaChartLine, FaBuilding } from "react-icons/fa";
import { Check } from "lucide-react";

/* =========================
   ✅ Firebase (Client)
========================= */
// لو عندك firebase.client.js جاهز في المشروع استبدل الجزء ده واستورد db منه بدل ما تكرر config.
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "taheel-platform-v2",
};

function getDb() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
}

const PLANS_COLLECTION = "companySubscriptionPlans";
const ADDONS_COLLECTION = "companyAddonsCatalog";

/* =========================
   ✅ Helpers
========================= */
function cn(...a) {
  return a.filter(Boolean).join(" ");
}
function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function pickText(v, lang) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (isObj(v)) return String(lang === "ar" ? v.ar || "" : v.en || "");
  return "";
}
function fmtAED(x) {
  const n = Number(x || 0);
  return Number.isFinite(n) ? n.toLocaleString() : "0";
}

/* =========================
   ✅ Brand mini themes
========================= */
const PLAN_THEME = {
  starter: {
    bar: "from-emerald-400 to-emerald-600",
    ring: "border-emerald-400/25 hover:border-emerald-400/60",
    chip: "bg-emerald-500/15 text-emerald-200 border-emerald-400/25",
    Icon: FaRocket,
  },
  growth: {
    bar: "from-sky-400 to-sky-600",
    ring: "border-sky-400/25 hover:border-sky-400/60",
    chip: "bg-sky-500/15 text-sky-200 border-sky-400/25",
    Icon: FaChartLine,
  },
  scale: {
    bar: "from-purple-400 to-purple-600",
    ring: "border-purple-400/25 hover:border-purple-400/70",
    chip: "bg-purple-500/15 text-purple-200 border-purple-400/25",
    Icon: FaCrown,
  },
  enterprise: {
    bar: "from-yellow-400 to-orange-500",
    ring: "border-amber-300/25 hover:border-amber-300/70",
    chip: "bg-amber-400/20 text-amber-200 border-amber-300/25",
    Icon: FaBuilding,
  },
};

const ADDON_THEME = {
  bundle: {
    bar: "from-white/20 to-white/5",
    ring: "border-white/10 hover:border-white/20",
    chip: "bg-white/10 text-white border-white/10",
    icon: FaPlus,
  },
  emergency: {
    bar: "from-red-500/80 to-orange-400/70",
    ring: "border-red-400/30 hover:border-red-300/60",
    chip: "bg-red-500/15 text-red-100 border-red-300/20",
    icon: FaBolt,
  },
};

/* =========================
   ✅ Pick first valid price
   (semiannual/yearly only for your rules)
========================= */
function pickPlanPrice(plan) {
  const p = plan?.pricing || {};
  const yearly = p?.yearly?.price || 0;
  const semi = p?.semiannual?.price || 0;

  // starter: yearly only
  if ((plan?.key || "").toLowerCase() === "starter") return yearly || 0;

  // others: prefer yearly if exists else semiannual
  return yearly || semi || 0;
}

/* =========================
   ✅ Component
========================= */
export default function AddonsBottomStrip({
  lang = "ar",
  darkMode = true,
  // 🔥 hooks to your existing flow:
  onSelectPlan,   // (planDoc) => void
  onBuyAddon,     // (addonDoc) => void
  className = "",
}) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const db = useMemo(() => getDb(), []);

  const [plans, setPlans] = useState([]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);

  // fetch once (bottom strip)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const plansQ = query(
          collection(db, PLANS_COLLECTION),
          where("isActive", "==", true),
          orderBy("sortIndex", "asc")
        );

        const addonsQ = query(
          collection(db, ADDONS_COLLECTION),
          where("isActive", "==", true)
        );

        const [plansSnap, addonsSnap] = await Promise.all([getDocs(plansQ), getDocs(addonsQ)]);

        const plansList = plansSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const addonsList = addonsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Separate emergency + bundles
        const emergency = addonsList.filter((a) => String(a.type || "") === "emergency");
        const bundles = addonsList
          .filter((a) => String(a.type || "bundle") !== "emergency")
          .sort((a, b) => (b?.popular ? 1 : 0) - (a?.popular ? 1 : 0));

        const mergedAddons = [...emergency, ...bundles];

        if (mounted) {
          setPlans(plansList);
          setAddons(mergedAddons);
        }
      } catch (e) {
        console.error("AddonsBottomStrip fetch error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [db]);

  const emergencyAddon = useMemo(
    () => addons.find((a) => String(a.type || "") === "emergency") || null,
    [addons]
  );

  const bundles = useMemo(
    () => addons.filter((a) => String(a.type || "bundle") !== "emergency"),
    [addons]
  );

  return (
    <div dir={dir} className={cn("w-full", className)}>
      {/* ✅ global keyframes for crazy glow */}
      <style jsx global>{`
        @keyframes emergencyGlow {
          0% { box-shadow: 0 0 0 rgba(239,68,68,0.0), 0 0 0 rgba(245,158,11,0.0); transform: translateY(0); }
          35% { box-shadow: 0 0 35px rgba(239,68,68,0.35), 0 0 60px rgba(245,158,11,0.22); transform: translateY(-1px); }
          70% { box-shadow: 0 0 18px rgba(239,68,68,0.18), 0 0 40px rgba(245,158,11,0.16); transform: translateY(0); }
          100% { box-shadow: 0 0 0 rgba(239,68,68,0.0), 0 0 0 rgba(245,158,11,0.0); transform: translateY(0); }
        }
      `}</style>

      {/* ✅ Sticky strip */}
      <div className="fixed left-0 right-0 bottom-0 z-[60]">
        {/* soft top fade */}
        <div className="h-8 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />

        <div
          className={cn(
            "mx-auto w-full",
            "border-t border-white/10",
            "bg-black/60 backdrop-blur-2xl"
          )}
        >
          <div className="mx-auto max-w-7xl px-4 py-3">
            {/* header row */}
            <div className={cn("flex items-center justify-between gap-3 mb-2", lang === "ar" && "flex-row-reverse")}>
              <div className={cn("flex items-center gap-2", lang === "ar" && "flex-row-reverse")}>
                <div className="w-2 h-2 rounded-full bg-white/60" />
                <div className="text-white font-extrabold text-sm">
                  {lang === "ar" ? "إضافات وباقات — جاهزة للشراء" : "Add-ons & Plans — Ready to buy"}
                </div>
                {loading ? <div className="text-xs text-white/45 font-semibold">…</div> : null}
              </div>

              {/* Emergency button */}
              {emergencyAddon ? (
                <button
                  type="button"
                  onClick={() => onBuyAddon?.(emergencyAddon)}
                  className={cn(
                    "relative px-4 py-2 rounded-full font-extrabold text-sm",
                    "text-white border border-red-300/30",
                    "bg-gradient-to-r from-red-500/70 via-orange-400/50 to-red-500/70",
                    "hover:brightness-110 active:scale-[0.99] transition",
                    "animate-[emergencyGlow_1.2s_ease-in-out_infinite]"
                  )}
                  title={pickText(emergencyAddon?.title, lang)}
                >
                  <span className={cn("inline-flex items-center gap-2", lang === "ar" && "flex-row-reverse")}>
                    <FaBolt />
                    {lang === "ar" ? "حالات طارئة" : "Emergency"}
                  </span>
                </button>
              ) : (
                <div className="text-xs text-white/40 font-semibold">
                  {lang === "ar" ? "لا يوجد طوارئ" : "No emergency"}
                </div>
              )}
            </div>

            {/* horizontal scroller */}
            <div className="relative">
              <div
                className={cn(
                  "flex gap-3 overflow-x-auto pb-2",
                  "scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                )}
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {/* ✅ Plans group */}
                <div className={cn("flex items-center gap-3 shrink-0", lang === "ar" && "flex-row-reverse")}>
                  {plans.map((p) => {
                    const key = String(p.key || p.id || "").toLowerCase();
                    const th = PLAN_THEME[key] || PLAN_THEME.starter;
                    const Icon = th.Icon;

                    const name = pickText(p?.name, lang) || (lang === "ar" ? "باقة" : "Plan");
                    const limit = Number(p?.monthlyIncludedTxLimit || 0);
                    const price = pickPlanPrice(p);

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectPlan?.(p)}
                        className={cn(
                          "relative min-w-[240px] sm:min-w-[260px] rounded-2xl overflow-hidden",
                          "border bg-white/5 backdrop-blur-xl",
                          th.ring,
                          "hover:bg-white/6 transition"
                        )}
                      >
                        <div className={cn("absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r", th.bar)} />
                        <div className={cn("p-3", lang === "ar" ? "text-right" : "text-left")}>
                          <div className={cn("flex items-center justify-between gap-2", lang === "ar" && "flex-row-reverse")}>
                            <div className={cn("flex items-center gap-2", lang === "ar" && "flex-row-reverse")}>
                              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                                <Icon className="text-white" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-white font-extrabold text-sm truncate">{name}</div>
                                <div className="text-[11px] text-white/60 font-semibold">
                                  {lang === "ar"
                                    ? `حد شهري: ${limit} معاملات`
                                    : `Monthly cap: ${limit} tx`}
                                </div>
                              </div>
                            </div>

                            <span className={cn("px-2 py-1 text-[10px] font-extrabold rounded-full border", th.chip)}>
                              {String(key).toUpperCase()}
                            </span>
                          </div>

                          <div className={cn("mt-2 flex items-end gap-2", lang === "ar" && "flex-row-reverse")}>
                            <div className="text-white font-black text-xl">{fmtAED(price)}</div>
                            <div className="text-xs text-white/65 font-bold">{lang === "ar" ? "درهم" : "AED"}</div>
                            <div className="ml-auto text-[11px] text-white/45 font-semibold">
                              {lang === "ar" ? "اضغط للتفاصيل" : "Tap for details"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* divider */}
                <div className="w-px bg-white/10 shrink-0 my-2" />

                {/* ✅ Add-ons group */}
                <div className={cn("flex items-center gap-3 shrink-0", lang === "ar" && "flex-row-reverse")}>
                  {bundles.map((a) => {
                    const type = String(a.type || "bundle");
                    const th = ADDON_THEME[type] || ADDON_THEME.bundle;
                    const Icon = th.icon;

                    const title = pickText(a?.title, lang) || (lang === "ar" ? "إضافة" : "Add-on");
                    const qty = Number(a?.qty || 0);
                    const price = Number(a?.price || 0);
                    const popular = !!a?.popular;

                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onBuyAddon?.(a)}
                        className={cn(
                          "relative min-w-[220px] sm:min-w-[240px] rounded-2xl overflow-hidden",
                          "border bg-white/5 backdrop-blur-xl",
                          th.ring,
                          "hover:bg-white/6 transition"
                        )}
                      >
                        <div className={cn("absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r", th.bar)} />

                        {popular ? (
                          <div className={cn("absolute -top-2", lang === "ar" ? "left-3" : "right-3")}>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-white text-black border-white/50">
                              {lang === "ar" ? "الأكثر طلبًا" : "Popular"}
                            </span>
                          </div>
                        ) : null}

                        <div className={cn("p-3", lang === "ar" ? "text-right" : "text-left")}>
                          <div className={cn("flex items-start justify-between gap-2", lang === "ar" && "flex-row-reverse")}>
                            <div className={cn("flex items-center gap-2", lang === "ar" && "flex-row-reverse")}>
                              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                                <Icon className="text-white" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-white font-extrabold text-sm truncate">{title}</div>
                                <div className="text-[11px] text-white/60 font-semibold">
                                  {lang === "ar" ? `+${qty} معاملات` : `+${qty} transactions`}
                                </div>
                              </div>
                            </div>

                            <span className={cn("px-2 py-1 text-[10px] font-extrabold rounded-full border", th.chip)}>
                              ADD-ON
                            </span>
                          </div>

                          <div className={cn("mt-2 flex items-end gap-2", lang === "ar" && "flex-row-reverse")}>
                            <div className="text-white font-black text-xl">{fmtAED(price)}</div>
                            <div className="text-xs text-white/65 font-bold">{lang === "ar" ? "درهم" : "AED"}</div>
                            <div className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-200 font-extrabold">
                              <Check className="w-4 h-4" />
                              {lang === "ar" ? "شراء سريع" : "Quick buy"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* bottom helper line */}
              <div className="text-[11px] text-white/35 font-semibold mt-1">
                {lang === "ar"
                  ? "اسحب يمين/شمال لمشاهدة كل الباقات والإضافات"
                  : "Swipe left/right to browse plans and add-ons"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer to avoid page content hidden behind sticky bar */}
      <div className="h-[160px]" />
    </div>
  );
}
