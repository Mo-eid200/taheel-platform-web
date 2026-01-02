"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Shield, Zap, Crown, Sparkles, ChevronDown, ArrowLeft } from "lucide-react";

// ✅ Firestore
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

/** ✅ Quiet glow wrapper (ONLY for buttons) */
function ButtonGlow({ active = false, radius = "rounded-full", children }) {
  return (
    <div className={cn("relative group", radius)}>
      {/* active glow */}
      <div
        className={cn("absolute -inset-[2px] z-0", radius, "transition-opacity duration-300")}
        style={{
          background:
            "linear-gradient(90deg, rgba(16,185,129,0.85), rgba(56,189,248,0.65), rgba(168,85,247,0.55))",
          filter: "blur(10px)",
          opacity: active ? 0.45 : 0,
        }}
      />
      {/* hover glow */}
      <div
        className={cn(
          "absolute -inset-[2px] z-0",
          radius,
          "opacity-0 group-hover:opacity-55 transition-opacity duration-300"
        )}
        style={{
          background:
            "linear-gradient(90deg, rgba(16,185,129,0.85), rgba(56,189,248,0.65), rgba(168,85,247,0.55))",
          filter: "blur(10px)",
        }}
      />
      <div className={cn("relative z-10", radius)}>{children}</div>
    </div>
  );
}

const ICONS_BY_KEY = {
  starter: Zap,
  growth: Sparkles,
  scale: Shield,
  enterprise: Crown,
};

const DEFAULT_BRAND = {
  starter: {
    bar: "from-emerald-400 to-emerald-600",
    ring: "border-emerald-400/25 hover:border-emerald-400/70",
    dot: "bg-emerald-400",
    pill: "bg-emerald-500/12 border-emerald-400/25 text-emerald-200",
  },
  growth: {
    bar: "from-sky-400 to-sky-600",
    ring: "border-sky-400/25 hover:border-sky-400/70",
    dot: "bg-sky-400",
    pill: "bg-sky-500/12 border-sky-400/25 text-sky-200",
  },
  scale: {
    bar: "from-purple-400 to-purple-600",
    ring: "border-purple-400/25 hover:border-purple-400/75",
    dot: "bg-purple-400",
    pill: "bg-purple-500/12 border-purple-400/25 text-purple-200",
  },
  enterprise: {
    bar: "from-rose-400 to-red-600",
    ring: "border-red-400/25 hover:border-red-400/80",
    dot: "bg-red-400",
    pill: "bg-red-500/12 border-red-400/25 text-red-200",
  },
};

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

export default function CompanySubscriptionsPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const lang = sp.get("lang") || "ar";
  const isArabic = lang === "ar";
  const pkgFromUrl = sp.get("package") || "starter";

  const t = useMemo(() => {
    const ar = {
      back: "رجوع",
      pageTitle: "اشتراكات الشركات",
      pro: "PRO",
      most: "الأكثر اختيارًا",
      offer: "عرض",
      chooseDuration: "اختر المدة",
      months: "شهور",
      month: "شهر",
      total: "الإجمالي",
      subscribeNow: "اشترك الآن",
      summary: "ملخص",
      package: "الباقة",
      duration: "المدة",
      includes: "يشمل",
      aed: "درهم",
      finalPrice: "السعر النهائي",
      perks: "المميزات",
      select: "تم الاختيار",
      langBtn: "EN",
      loading: "جاري تحميل الباقات...",
      empty: "لا توجد باقات متاحة الآن.",
    };

    const en = {
      back: "Back",
      pageTitle: "Company Subscriptions",
      pro: "PRO",
      most: "Most chosen",
      offer: "Offer",
      chooseDuration: "Choose duration",
      months: "Months",
      month: "Month",
      total: "Total",
      subscribeNow: "Subscribe Now",
      summary: "Summary",
      package: "Package",
      duration: "Duration",
      includes: "Includes",
      aed: "AED",
      finalPrice: "Final price",
      perks: "Perks",
      select: "Selected",
      langBtn: "AR",
      loading: "Loading packages...",
      empty: "No packages available right now.",
    };

    return isArabic ? ar : en;
  }, [isArabic]);

  // ✅ Packages from Firestore
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activePackage, setActivePackage] = useState(pkgFromUrl);
  const [selectedDurationByPkg, setSelectedDurationByPkg] = useState({
    starter: "yearly",
    growth: "yearly",
    scale: "yearly",
    enterprise: "yearly",
  });

  useEffect(() => {
    if (pkgFromUrl) setActivePackage(pkgFromUrl);
  }, [pkgFromUrl]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        // ✅ collection name (change here if different)
        const colRef = collection(firestore, "company_subscriptions");
        const snap = await getDocs(colRef);

        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          const key = d.id;

          const Icon = ICONS_BY_KEY[key] || Sparkles;

          // durations might be stored as object {monthly:..., yearly:...}
          const rawDurations = data.durations || {};
          const durationsArr = Object.entries(rawDurations).map(([k, v]) => {
            const vv = v || {};
            const title = vv.title?.[isArabic ? "ar" : "en"] || vv.title || k;
            const tagKey = vv.tagKey; // "offer" | "most" etc

            return {
              key: k,
              title,
              monthsShown: Number(vv.monthsShown ?? 1),
              paidMonths: Number(vv.paidMonths ?? vv.monthsShown ?? 1),
              bonus: Number(vv.bonus ?? 0),
              price: Number(vv.price ?? 0),
              best: Boolean(vv.best),
              tag: tagKey ? (tagKey === "offer" ? t.offer : tagKey === "most" ? t.most : vv.tag) : vv.tag,
            };
          });

          // sort durations in desired order
          const order = { monthly: 1, quarterly: 2, semiannual: 3, yearly: 4 };
          durationsArr.sort((a, b) => (order[a.key] || 99) - (order[b.key] || 99));

          return {
            key,
            name: data.name?.[isArabic ? "ar" : "en"] || data.name || key,
            fit: data.fit?.[isArabic ? "ar" : "en"] || data.fit || "",
            icon: Icon,
            badge:
              (data.badgeKey === "most" ? t.most : data.badgeKey === "offer" ? t.offer : null) ||
              data.badge ||
              null,
            most: Boolean(data.most),
            brand: data.brand || DEFAULT_BRAND[key] || DEFAULT_BRAND.starter,
            perks: safeArray(data.perks?.[isArabic ? "ar" : "en"] || data.perks),
            durations: durationsArr.length ? durationsArr : [],
          };
        });

        // keep stable order by known keys
        const keyOrder = { starter: 1, growth: 2, scale: 3, enterprise: 4 };
        rows.sort((a, b) => (keyOrder[a.key] || 99) - (keyOrder[b.key] || 99));

        if (mounted) setPackages(rows);
      } catch (e) {
        console.error("Failed to load company_subscriptions:", e);
        if (mounted) setPackages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isArabic, t.offer, t.most]);

  const PACKAGES = packages;

  const pkgObj = PACKAGES.find((p) => p.key === activePackage) || PACKAGES[0];
  const selectedDurationKey = selectedDurationByPkg?.[activePackage] || "yearly";
  const durationObj =
    pkgObj?.durations?.find((d) => d.key === selectedDurationKey) ||
    pkgObj?.durations?.[pkgObj?.durations?.length - 1];

  const setDurationFor = (pkgKey, durationKey) => {
    setSelectedDurationByPkg((prev) => ({ ...prev, [pkgKey]: durationKey }));
    setActivePackage(pkgKey);
  };

  const goSubscribe = () => {
    if (!pkgObj || !durationObj) return;

    const qs = new URLSearchParams();
    qs.set("lang", lang);
    qs.set("intent", "company_subscription");
    qs.set("package", pkgObj.key);
    qs.set("duration", durationObj.key);
    qs.set("price", String(durationObj.price));
    qs.set("months", String(durationObj.monthsShown));
    router.push(`/login?${qs.toString()}`);
  };

  const toggleLang = () => {
    const qs = new URLSearchParams();
    qs.set("lang", isArabic ? "en" : "ar");
    qs.set("package", activePackage || "starter");
    router.push(`/company-subscriptions?${qs.toString()}`);
  };

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#0b131e] via-[#0f1a26] to-[#070b12]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-[#08101a]/70 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3">
          <div className={cn("flex items-center justify-between", isArabic && "flex-row-reverse")}>
            <Link
              href={`/?lang=${lang}`}
              className="inline-flex items-center gap-2 text-white/85 hover:text-white font-extrabold text-sm cursor-pointer"
            >
              <ArrowLeft className={cn("w-4 h-4", isArabic && "rotate-180")} />
              {t.back}
            </Link>

            <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
              <ButtonGlow radius="rounded-full">
                <button
                  onClick={toggleLang}
                  className="cursor-pointer px-3 py-2 rounded-full bg-white/8 border border-white/12 text-white/85 font-extrabold text-xs hover:bg-white/12 transition"
                >
                  {t.langBtn}
                </button>
              </ButtonGlow>

              {/* Logo */}
              <div className="relative rounded-xl bg-white p-1 border border-black/10 shadow w-[60px] h-[60px]">
                <Image src="/logo3.png" alt="TAHEEL" fill className="object-contain" priority />
              </div>

              <div className={cn("hidden sm:block", isArabic && "text-right")}>
                <div className="text-white font-extrabold leading-none">{t.pageTitle}</div>
                <div className="text-[11px] text-white/45 mt-1">{t.pro}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-8 sm:py-10">
        <div className={cn("mb-5", isArabic && "text-right")}>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white">{t.pageTitle}</h1>
        </div>

        {loading ? (
          <div className={cn("text-white/70 font-extrabold", isArabic && "text-right")}>{t.loading}</div>
        ) : !PACKAGES?.length ? (
          <div className={cn("text-white/60 font-extrabold", isArabic && "text-right")}>{t.empty}</div>
        ) : (
          <div className="space-y-4">
            {PACKAGES.map((p, idx) => {
              const Icon = p.icon;
              const isOpen = p.key === activePackage;
              const selectedKey = selectedDurationByPkg[p.key] || "yearly";
              const selectedDur =
                p.durations.find((d) => d.key === selectedKey) || p.durations[p.durations.length - 1];

              return (
                <motion.div
                  key={p.key}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: idx * 0.04 }}
                >
                  <div
                    className={cn(
                      "relative rounded-3xl border bg-white/5 backdrop-blur-xl overflow-hidden",
                      p.brand?.ring || "border-white/10",
                      isOpen ? "border-emerald-400/35 shadow-[0_40px_120px_-90px_rgba(16,185,129,0.35)]" : ""
                    )}
                  >
                    <div className={cn("absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r", p.brand?.bar)} />

                    <button
                      onClick={() => setActivePackage((prev) => (prev === p.key ? "" : p.key))}
                      className={cn(
                        "w-full p-5 sm:p-6 flex items-center justify-between text-left cursor-pointer",
                        isArabic && "text-right flex-row-reverse"
                      )}
                    >
                      <div className={cn("flex items-center gap-4", isArabic && "flex-row-reverse")}>
                        <div
                          className={cn(
                            "w-12 h-12 rounded-2xl border flex items-center justify-center",
                            isOpen ? "bg-white/10 border-white/20" : "bg-white/6 border-white/10"
                          )}
                        >
                          <Icon className="w-5 h-5 text-white/85" />
                        </div>

                        <div>
                          <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
                            <span className={cn("w-2 h-2 rounded-full", p.brand?.dot)} />
                            <div className="text-white font-extrabold text-lg sm:text-xl">{p.name}</div>
                            {p.badge ? (
                              <span className="ml-2 px-3 py-1 rounded-full text-[11px] font-extrabold bg-red-500 text-white">
                                {p.badge}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-[12px] text-white/60 font-semibold">{p.fit}</div>
                        </div>
                      </div>

                      <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse")}>
                        <div className={cn("px-2.5 py-1 rounded-full border text-xs font-extrabold", p.brand?.pill)}>
                          PRO
                        </div>
                        <ChevronDown className={cn("w-5 h-5 text-white/60 transition", isOpen ? "rotate-180" : "")} />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="px-5 sm:px-6 pb-6"
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* Durations */}
                            <div className="lg:col-span-7">
                              <div className={cn("flex items-center justify-between mb-3", isArabic && "flex-row-reverse")}>
                                <div className="text-white font-extrabold">{t.chooseDuration}</div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {p.durations.map((d) => {
                                  const active = d.key === selectedKey;

                                  return (
                                    <ButtonGlow key={d.key} active={active} radius="rounded-2xl">
                                      <button
                                        onClick={() => setDurationFor(p.key, d.key)}
                                        className={cn(
                                          "cursor-pointer relative w-full rounded-2xl border p-4 bg-white/6 backdrop-blur-xl transition text-left",
                                          active
                                            ? "border-emerald-400/55 bg-white/8"
                                            : "border-white/10 hover:border-white/20 hover:bg-white/7"
                                        )}
                                      >
                                        {d.tag ? (
                                          <div className={cn("absolute -top-3 z-20", isArabic ? "right-3" : "left-3")}>
                                            <span
                                              className={cn(
                                                "px-3 py-1 rounded-full text-[11px] font-extrabold shadow border",
                                                d.best
                                                  ? "bg-purple-500 text-white border-purple-300/30"
                                                  : "bg-white/10 text-white border-white/10"
                                              )}
                                            >
                                              {d.tag}
                                            </span>
                                          </div>
                                        ) : null}

                                        <div className="text-white font-extrabold text-base">{d.title}</div>

                                        <div className="mt-1 text-[12px] text-white/60 font-semibold">
                                          {d.monthsShown} {d.monthsShown === 1 ? t.month : t.months}
                                          {d.bonus ? (
                                            <span className="ml-2 text-emerald-200 font-extrabold">
                                              {isArabic ? `(+${d.bonus} مجاني)` : `(+${d.bonus} free)`}
                                            </span>
                                          ) : null}
                                        </div>

                                        <div className="mt-3">
                                          <div className="text-white/55 text-xs">{t.finalPrice}</div>
                                          <div className="text-2xl font-extrabold text-white mt-1 leading-none">
                                            {Number(d.price || 0).toLocaleString()}{" "}
                                            <span className="text-xs text-white/55 font-semibold">{t.aed}</span>
                                          </div>
                                        </div>

                                        {active ? (
                                          <div className="mt-3 inline-flex items-center gap-2 text-emerald-200 text-xs font-extrabold">
                                            <Check className="w-4 h-4" />
                                            {t.select}
                                          </div>
                                        ) : null}
                                      </button>
                                    </ButtonGlow>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Summary */}
                            <div className="lg:col-span-5">
                              <div className="rounded-3xl bg-black/25 border border-white/10 p-5">
                                <div className={cn("flex items-center justify-between", isArabic && "flex-row-reverse")}>
                                  <div className="text-white font-extrabold">{t.summary}</div>
                                  <div className="text-[11px] text-white/55 font-bold">{p.name}</div>
                                </div>

                                <div className="mt-4 rounded-2xl bg-white/6 border border-white/10 p-4">
                                  <div className="text-white/55 text-xs">{t.duration}</div>
                                  <div className="mt-1 text-white font-extrabold">
                                    {selectedDur?.title} • {selectedDur?.monthsShown}{" "}
                                    {selectedDur?.monthsShown === 1 ? t.month : t.months}
                                  </div>

                                  <div className="mt-2 text-white/60 text-sm">
                                    {selectedDur?.bonus ? (
                                      <span>
                                        {t.includes}{" "}
                                        <span className="font-extrabold text-emerald-200">
                                          +{selectedDur.bonus} {isArabic ? "شهر مجاني" : "free month"}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-white/45">{isArabic ? "بدون عرض" : "No offer"}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <div className="text-white font-extrabold mb-3">{t.perks}</div>
                                  <div className="space-y-2 text-sm text-white/80">
                                    {safeArray(p.perks).map((x, i) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <Check className="w-4 h-4 text-emerald-300 mt-[2px]" />
                                        <span>{x}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-5 rounded-2xl bg-white/6 border border-white/10 p-4 flex items-center justify-between">
                                  <div>
                                    <div className="text-white/55 text-xs">{t.total}</div>
                                    <div className="text-white text-2xl font-extrabold mt-1">
                                      {Number(selectedDur?.price || 0).toLocaleString()}{" "}
                                      <span className="text-xs text-white/55">{t.aed}</span>
                                    </div>
                                  </div>

                                  <ButtonGlow radius="rounded-full">
                                    <button
                                      onClick={goSubscribe}
                                      className="cursor-pointer px-5 py-3 rounded-full font-extrabold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.99] bg-gradient-to-r from-emerald-700 via-emerald-500 to-green-700"
                                    >
                                      {t.subscribeNow}
                                    </button>
                                  </ButtonGlow>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      {!loading && pkgObj && durationObj ? (
        <div className="sticky bottom-0 z-40 border-t border-white/10 bg-[#08101a]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3">
            <div className={cn("flex items-center justify-between gap-3", isArabic && "flex-row-reverse")}>
              <div className={cn("min-w-0", isArabic && "text-right")}>
                <div className="text-[11px] text-white/55 font-bold">
                  {t.package}: <span className="text-white/85">{pkgObj.name}</span> • {t.duration}:{" "}
                  <span className="text-white/85">{durationObj.title}</span>
                </div>
                <div className="text-white font-extrabold text-lg leading-none mt-1">
                  {t.total}: {Number(durationObj.price || 0).toLocaleString()}{" "}
                  <span className="text-[12px] text-white/55 font-semibold">{t.aed}</span>
                </div>
              </div>

              <ButtonGlow radius="rounded-full">
                <button
                  onClick={goSubscribe}
                  className="cursor-pointer shrink-0 px-6 py-3 rounded-full font-extrabold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.99] bg-gradient-to-r from-emerald-700 via-emerald-500 to-green-700"
                >
                  {t.subscribeNow}
                </button>
              </ButtonGlow>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
