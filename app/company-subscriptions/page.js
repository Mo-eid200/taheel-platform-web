"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Building2,
  Shield,
  Zap,
  Crown,
  Sparkles,
  ChevronDown,
} from "lucide-react";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

export default function CompanySubscriptionsPage() {
  const sp = useSearchParams();
  const lang = sp.get("lang") || "ar";
  const isArabic = lang === "ar";

  // ✅ preselect package from homepage
  const pkgFromUrl = sp.get("package") || "starter";

  const t = useMemo(() => {
    const ar = {
      back: "رجوع",
      pageTitle: "اشتراكات الشركات",
      pageSub: "اختر الباقة المناسبة لشركتك، ثم اختر المدة — وسيظهر السعر النهائي فورًا.",
      pro: "PRO",
      most: "الأكثر اختيارًا",
      offer: "عرض",
      chooseDuration: "اختر المدة",
      months: "شهور",
      month: "شهر",
      total: "الإجمالي",
      start: "ابدأ الاشتراك",
      note: "سيتم ربط الدفع أونلاين لاحقًا داخل نفس الصفحة.",
      summary: "ملخص اختيارك",
      package: "الباقة",
      duration: "المدة",
      includes: "يشمل",
      contact: "تواصل معنا",
      customHint: "تحتاج باقة أكبر أو تخصيص أعلى؟ تواصل معنا.",
      aed: "درهم",
    };

    const en = {
      back: "Back",
      pageTitle: "Company Subscriptions",
      pageSub:
        "Choose the package that fits your company, then select a duration — your final price updates instantly.",
      pro: "PRO",
      most: "Most chosen",
      offer: "Offer",
      chooseDuration: "Choose duration",
      months: "Months",
      month: "Month",
      total: "Total",
      start: "Start subscription",
      note: "Online payment will be integrated later inside this page.",
      summary: "Your selection",
      package: "Package",
      duration: "Duration",
      includes: "Includes",
      contact: "Contact us",
      customHint: "Need a larger or customized plan? Contact us.",
      aed: "AED",
    };

    return isArabic ? ar : en;
  }, [isArabic]);

  /**
   * ✅ DB-READY DATA SHAPE
   * كل باقة جوّاها durations[] بسعرها (final) + monthsShown + paidMonths + bonus
   * + perks[] قابلة للتعديل من لوحة التحكم
   */
  const PACKAGES = useMemo(() => {
    return [
      {
        key: "starter",
        name: "Starter PRO",
        fit: isArabic ? "للشركات الصغيرة (1–5 موظفين)" : "Small companies (1–5 staff)",
        icon: Zap,
        badge: null,
        brand: {
          bar: "from-emerald-400 to-emerald-600",
          ring: "border-emerald-400/25 hover:border-emerald-400/75",
          dot: "bg-emerald-400",
          pill: "bg-emerald-500/12 border-emerald-400/25 text-emerald-200",
          glow: "shadow-[0_45px_140px_-95px_rgba(16,185,129,0.45)]",
        },
        perks: isArabic
          ? ["إلغاء رسوم الطباعة", "دعم مباشر", "تفعيل سريع", "متابعة أسهل للطلبات"]
          : ["Printing fees waived", "Direct support", "Fast activation", "Easier tracking"],
        durations: [
          { key: "monthly", title: isArabic ? "شهري" : "Monthly", monthsShown: 1, paidMonths: 1, bonus: 0, price: 299 },
          { key: "quarterly", title: isArabic ? "3 شهور" : "3 Months", monthsShown: 3, paidMonths: 3, bonus: 0, price: 799 },
          { key: "semiannual", title: isArabic ? "نصف سنوي" : "Semiannual", monthsShown: 7, paidMonths: 6, bonus: 1, tag: t.offer, price: 1799 },
          { key: "yearly", title: isArabic ? "سنوي" : "Yearly", monthsShown: 13, paidMonths: 12, bonus: 1, tag: t.most, best: true, price: 3499 },
        ],
      },
      {
        key: "growth",
        name: "Growth PRO",
        fit: isArabic ? "للشركات المتوسطة (5–10 موظفين)" : "Mid teams (5–10 staff)",
        icon: Sparkles,
        badge: null,
        brand: {
          bar: "from-sky-400 to-sky-600",
          ring: "border-sky-400/25 hover:border-sky-400/75",
          dot: "bg-sky-400",
          pill: "bg-sky-500/12 border-sky-400/25 text-sky-200",
          glow: "shadow-[0_45px_140px_-95px_rgba(56,189,248,0.42)]",
        },
        perks: isArabic
          ? ["متابعة أسرع", "إلغاء رسوم الطباعة", "أولوية أعلى", "تقارير شهرية مبسطة"]
          : ["Faster tracking", "Printing fees waived", "Higher priority", "Monthly simplified reports"],
        durations: [
          { key: "monthly", title: isArabic ? "شهري" : "Monthly", monthsShown: 1, paidMonths: 1, bonus: 0, price: 499 },
          { key: "quarterly", title: isArabic ? "3 شهور" : "3 Months", monthsShown: 3, paidMonths: 3, bonus: 0, price: 1399 },
          { key: "semiannual", title: isArabic ? "نصف سنوي" : "Semiannual", monthsShown: 7, paidMonths: 6, bonus: 1, tag: t.offer, price: 2999 },
          { key: "yearly", title: isArabic ? "سنوي" : "Yearly", monthsShown: 13, paidMonths: 12, bonus: 1, tag: t.most, best: true, price: 5999 },
        ],
      },
      {
        key: "scale",
        name: "Scale PRO",
        fit: isArabic ? "للشركات الكبيرة (10–20 موظف)" : "Larger teams (10–20 staff)",
        icon: Shield,
        badge: null,
        brand: {
          bar: "from-purple-400 to-purple-600",
          ring: "border-purple-400/25 hover:border-purple-400/80",
          dot: "bg-purple-400",
          pill: "bg-purple-500/12 border-purple-400/25 text-purple-200",
          glow: "shadow-[0_45px_140px_-95px_rgba(168,85,247,0.42)]",
        },
        perks: isArabic
          ? ["أولوية معالجة أعلى", "إلغاء رسوم الطباعة", "تقارير أسهل", "تنظيم طلبات أكبر"]
          : ["Higher processing priority", "Printing fees waived", "Cleaner reports", "Handles more workload"],
        durations: [
          { key: "monthly", title: isArabic ? "شهري" : "Monthly", monthsShown: 1, paidMonths: 1, bonus: 0, price: 799 },
          { key: "quarterly", title: isArabic ? "3 شهور" : "3 Months", monthsShown: 3, paidMonths: 3, bonus: 0, price: 2199 },
          { key: "semiannual", title: isArabic ? "نصف سنوي" : "Semiannual", monthsShown: 7, paidMonths: 6, bonus: 1, tag: t.offer, price: 4999 },
          { key: "yearly", title: isArabic ? "سنوي" : "Yearly", monthsShown: 13, paidMonths: 12, bonus: 1, tag: t.most, best: true, price: 9999 },
        ],
      },
      {
        key: "enterprise",
        name: "Enterprise PRO",
        fit: isArabic ? "مؤسسات / 20+ موظف" : "Enterprise / 20+ staff",
        icon: Crown,
        badge: t.most,
        most: true,
        brand: {
          bar: "from-rose-400 to-red-600",
          ring: "border-red-400/25 hover:border-red-400/80",
          dot: "bg-red-400",
          pill: "bg-red-500/12 border-red-400/25 text-red-200",
          glow: "shadow-[0_45px_140px_-95px_rgba(239,68,68,0.38)]",
        },
        perks: isArabic
          ? ["SLA ودعم مخصص", "أولوية قصوى", "حلول حسب نشاط الشركة", "متابعة مدير حساب"]
          : ["SLA & dedicated support", "Maximum priority", "Tailored solutions", "Account manager follow-up"],
        durations: [
          { key: "monthly", title: isArabic ? "شهري" : "Monthly", monthsShown: 1, paidMonths: 1, bonus: 0, price: 1299 },
          { key: "quarterly", title: isArabic ? "3 شهور" : "3 Months", monthsShown: 3, paidMonths: 3, bonus: 0, price: 3599 },
          { key: "semiannual", title: isArabic ? "نصف سنوي" : "Semiannual", monthsShown: 7, paidMonths: 6, bonus: 1, tag: t.offer, price: 7999 },
          { key: "yearly", title: isArabic ? "سنوي" : "Yearly", monthsShown: 13, paidMonths: 12, bonus: 1, tag: t.most, best: true, price: 15999 },
        ],
      },
    ];
  }, [isArabic, t.offer, t.most]);

  const [activePackage, setActivePackage] = useState(pkgFromUrl);
  const [selectedDurationByPkg, setSelectedDurationByPkg] = useState(() => ({
    starter: "yearly",
    growth: "yearly",
    scale: "yearly",
    enterprise: "yearly",
  }));

  useEffect(() => {
    if (pkgFromUrl) setActivePackage(pkgFromUrl);
  }, [pkgFromUrl]);

  const pkgObj = PACKAGES.find((p) => p.key === activePackage) || PACKAGES[0];
  const selectedDurationKey = selectedDurationByPkg[activePackage] || "yearly";
  const durationObj =
    pkgObj.durations.find((d) => d.key === selectedDurationKey) || pkgObj.durations[pkgObj.durations.length - 1];

  const totalPrice = durationObj.price;

  const setDurationFor = (pkgKey, durationKey) => {
    setSelectedDurationByPkg((prev) => ({ ...prev, [pkgKey]: durationKey }));
    setActivePackage(pkgKey);
  };

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#0b131e] via-[#0f1a26] to-[#070b12] py-8 sm:py-12 px-2 sm:px-4">
      <div className="max-w-6xl mx-auto">

        {/* Top Back */}
        <div className={cn("flex items-center justify-between mb-6", isArabic && "flex-row-reverse")}>
          <Link
            href={`/?lang=${lang}`}
            className="text-white/75 hover:text-white font-bold text-sm inline-flex items-center gap-2"
          >
            <span className={cn(isArabic ? "rotate-180" : "")}>←</span> {t.back}
          </Link>

          <div className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/6 border border-white/10 text-white/85 text-xs font-extrabold">
            <Building2 className="w-4 h-4 text-emerald-300" />
            {t.note}
          </div>
        </div>

        {/* ✅ Global header with WHITE logo plate */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 sm:p-7 mb-6">
          <div className={cn("flex items-center gap-4", isArabic && "flex-row-reverse")}>
            <div className="shrink-0 rounded-2xl bg-white p-3 border border-black/10 shadow">
              <Image src="/logo3.png" alt="TAHEEL" width={64} height={64} />
            </div>

            <div className={cn("flex-1", isArabic && "text-right")}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/6 border border-white/10 text-white/85 text-xs font-extrabold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {t.pro}
              </div>

              <h1 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-extrabold text-white drop-shadow">
                {t.pageTitle}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-white/65 max-w-3xl leading-relaxed">
                {t.pageSub}
              </p>
            </div>
          </div>
        </div>

        {/* ✅ Long flexible cards (each package) */}
        <div className="space-y-4">
          {PACKAGES.map((p, idx) => {
            const Icon = p.icon;
            const isOpen = p.key === activePackage;
            const selectedKey = selectedDurationByPkg[p.key] || "yearly";
            const selectedDur = p.durations.find((d) => d.key === selectedKey) || p.durations[p.durations.length - 1];

            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: idx * 0.04 }}
                className={cn(
                  "relative rounded-3xl border bg-white/5 backdrop-blur-xl overflow-hidden",
                  p.brand.ring,
                  p.brand.glow,
                  isOpen ? "ring-2 ring-emerald-400/25" : ""
                )}
              >
                {/* top identity bar */}
                <div className={cn("absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r", p.brand.bar)} />

                {/* header row */}
                <button
                  onClick={() => setActivePackage((prev) => (prev === p.key ? "" : p.key))}
                  className={cn(
                    "w-full p-5 sm:p-6 flex items-center justify-between text-left cursor-pointer",
                    isArabic && "text-right flex-row-reverse"
                  )}
                >
                  <div className={cn("flex items-center gap-4", isArabic && "flex-row-reverse")}>
                    <div className={cn("w-12 h-12 rounded-2xl border flex items-center justify-center bg-white/6 border-white/10")}>
                      <Icon className="w-5 h-5 text-white/80" />
                    </div>

                    <div>
                      <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
                        <span className={cn("w-2 h-2 rounded-full", p.brand.dot)} />
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
                    <div className={cn("px-2.5 py-1 rounded-full border text-xs font-extrabold", p.brand.pill)}>
                      PRO
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 text-white/60 transition",
                        isOpen ? "rotate-180" : ""
                      )}
                    />
                  </div>
                </button>

                {/* expanded body */}
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="px-5 sm:px-6 pb-6"
                    >
                      <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-4", isArabic && "")}>
                        {/* left: durations */}
                        <div className="lg:col-span-7">
                          <div className={cn("flex items-center justify-between mb-3", isArabic && "flex-row-reverse")}>
                            <div className="text-white font-extrabold">{t.chooseDuration}</div>
                            <div className="text-[12px] text-white/50">
                              {isArabic ? "اختر مدة الاشتراك داخل هذه الباقة" : "Select duration inside this package"}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {p.durations.map((d) => {
                              const active = d.key === selectedKey;
                              return (
                                <button
                                  key={d.key}
                                  onClick={() => setDurationFor(p.key, d.key)}
                                  className={cn(
                                    "relative rounded-2xl border p-4 bg-white/6 backdrop-blur-xl transition text-left cursor-pointer",
                                    active
                                      ? "border-emerald-400/55 ring-2 ring-emerald-400/20 shadow-[0_30px_90px_-75px_rgba(16,185,129,0.45)]"
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
                                    <div className="text-white/55 text-xs">{isArabic ? "السعر النهائي" : "Final price"}</div>
                                    <div className="text-2xl font-extrabold text-white mt-1 leading-none">
                                      {d.price.toLocaleString()}{" "}
                                      <span className="text-xs text-white/55 font-semibold">{t.aed}</span>
                                    </div>
                                  </div>

                                  {active ? (
                                    <div className="mt-3 inline-flex items-center gap-2 text-emerald-200 text-xs font-extrabold">
                                      <Check className="w-4 h-4" />
                                      {isArabic ? "تم الاختيار" : "Selected"}
                                    </div>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* right: perks + selected */}
                        <div className="lg:col-span-5">
                          <div className="rounded-3xl bg-black/20 border border-white/10 p-5">
                            <div className={cn("flex items-center justify-between", isArabic && "flex-row-reverse")}>
                              <div className="text-white font-extrabold">{t.summary}</div>
                              <div className="text-[11px] text-white/55 font-bold">
                                {p.name}
                              </div>
                            </div>

                            <div className="mt-4 rounded-2xl bg-white/6 border border-white/10 p-4">
                              <div className="text-white/55 text-xs">{t.duration}</div>
                              <div className="mt-1 text-white font-extrabold">
                                {selectedDur.title} • {selectedDur.monthsShown}{" "}
                                {selectedDur.monthsShown === 1 ? t.month : t.months}
                              </div>
                              <div className="mt-2 text-white/60 text-sm">
                                {selectedDur.bonus ? (
                                  <span>
                                    {t.includes}{" "}
                                    <span className="font-extrabold text-emerald-200">
                                      +{selectedDur.bonus} {isArabic ? "شهر مجاني" : "free month"}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-white/45">{isArabic ? "بدون عرض إضافي" : "No extra offer"}</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-4">
                              <div className="text-white font-extrabold mb-3">
                                {isArabic ? "مميزات الباقة" : "Package perks"}
                              </div>
                              <div className="space-y-2 text-sm text-white/75">
                                {p.perks.map((x, i) => (
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
                                  {selectedDur.price.toLocaleString()}{" "}
                                  <span className="text-xs text-white/55">{t.aed}</span>
                                </div>
                              </div>

                              <button
                                onClick={() => alert(isArabic ? "هنربط الدفع بعدين ✅" : "Payment integration later ✅")}
                                className="px-5 py-3 rounded-full font-extrabold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.99] bg-gradient-to-r from-emerald-700 via-emerald-500 to-green-700"
                              >
                                {t.start}
                              </button>
                            </div>

                            <div className="mt-4 text-[12px] text-white/45">
                              {t.customHint}
                            </div>

                            <Link href={`/contact?lang=${lang}`} className="block mt-3">
                              <div className="w-full text-center px-5 py-3 rounded-full bg-white/10 border border-white/10 text-white font-extrabold hover:bg-white/15 transition">
                                {t.contact}
                              </div>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 text-center text-[11px] text-white/35">
          © TAHEEL — Company Subscriptions
        </div>
      </div>
    </section>
  );
}
