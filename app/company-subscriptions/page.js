"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Sparkles, Building2, Shield, Zap, Crown } from "lucide-react";

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
      title: "اشتراك الشركات (PRO)",
      sub: "اختر نوع الباقة ثم اختر المدة المناسبة.",
      choosePackage: "اختر نوع الباقة",
      chooseDuration: "اختر المدة",
      most: "الأكثر اختيارًا",
      offer: "عرض",
      monthly: "شهري",
      quarterly: "3 شهور",
      semiannual: "نصف سنوي",
      yearly: "سنوي",
      months: "شهور",
      month: "شهر",
      bestValue: "أفضل قيمة",
      aed: "درهم",
      durationHint: "اختر مدة الاشتراك داخل الباقة",
      payLater: "ربط الدفع لاحقًا",
      summary: "ملخص اختيارك",
      selectedPackage: "الباقة",
      selectedDuration: "المدة",
      total: "الإجمالي",
      startNow: "ابدأ الاشتراك",
      contact: "تواصل معنا",
    };

    const en = {
      back: "Back",
      title: "Company Subscription (PRO)",
      sub: "Choose a package type, then pick a duration.",
      choosePackage: "Choose package type",
      chooseDuration: "Choose duration",
      most: "Most chosen",
      offer: "Offer",
      monthly: "Monthly",
      quarterly: "3 Months",
      semiannual: "Semiannual",
      yearly: "Yearly",
      months: "Months",
      month: "Month",
      bestValue: "Best value",
      aed: "AED",
      durationHint: "Pick a duration inside the package",
      payLater: "Payment integration later",
      summary: "Your selection",
      selectedPackage: "Package",
      selectedDuration: "Duration",
      total: "Total",
      startNow: "Start subscription",
      contact: "Contact us",
    };

    return isArabic ? ar : en;
  }, [isArabic]);

  const PACKAGES = useMemo(() => {
    return [
      {
        key: "starter",
        name: "Starter PRO",
        fit: isArabic ? "للشركات الصغيرة (1–5)" : "Small companies (1–5)",
        icon: Zap,
        brand: {
          bar: "from-emerald-400 to-emerald-600",
          ring: "border-emerald-400/25 hover:border-emerald-400/70",
          pill: "bg-emerald-500/12 border-emerald-400/25 text-emerald-200",
          dot: "bg-emerald-400",
        },
        perks: isArabic
          ? ["إلغاء رسوم الطباعة", "دعم مباشر", "تفعيل سريع"]
          : ["Printing fees waived", "Direct support", "Fast activation"],
      },
      {
        key: "growth",
        name: "Growth PRO",
        fit: isArabic ? "للشركات المتوسطة (5–10)" : "Mid teams (5–10)",
        icon: Sparkles,
        brand: {
          bar: "from-sky-400 to-sky-600",
          ring: "border-sky-400/25 hover:border-sky-400/70",
          pill: "bg-sky-500/12 border-sky-400/25 text-sky-200",
          dot: "bg-sky-400",
        },
        perks: isArabic
          ? ["متابعة أسرع", "إلغاء رسوم الطباعة", "أولوية أعلى"]
          : ["Faster tracking", "Printing fees waived", "Higher priority"],
      },
      {
        key: "scale",
        name: "Scale PRO",
        fit: isArabic ? "للشركات الكبيرة (10–20)" : "Larger teams (10–20)",
        icon: Shield,
        brand: {
          bar: "from-purple-400 to-purple-600",
          ring: "border-purple-400/25 hover:border-purple-400/75",
          pill: "bg-purple-500/12 border-purple-400/25 text-purple-200",
          dot: "bg-purple-400",
        },
        perks: isArabic
          ? ["أولوية معالجة أعلى", "إلغاء رسوم الطباعة", "تقارير أسهل"]
          : ["Higher processing priority", "Printing fees waived", "Cleaner reports"],
      },
      {
        key: "enterprise",
        name: "Enterprise PRO",
        fit: isArabic ? "مؤسسات / 20+" : "Enterprise / 20+",
        icon: Crown,
        most: true,
        brand: {
          bar: "from-rose-400 to-red-600",
          ring: "border-red-400/25 hover:border-red-400/75",
          pill: "bg-red-500/12 border-red-400/25 text-red-200",
          dot: "bg-red-400",
        },
        perks: isArabic
          ? ["SLA ودعم مخصص", "أولوية قصوى", "حلول حسب نشاط الشركة"]
          : ["SLA & dedicated support", "Maximum priority", "Tailored solutions"],
      },
    ];
  }, [isArabic]);

  // ✅ durations (offers: 6 -> 7, 12 -> 13)
  const DURATIONS = useMemo(() => {
    return [
      { key: "monthly", title: t.monthly, monthsShown: 1, paidMonths: 1, bonus: 0, tag: "" },
      { key: "quarterly", title: t.quarterly, monthsShown: 3, paidMonths: 3, bonus: 0, tag: "" },
      { key: "semiannual", title: t.semiannual, monthsShown: 7, paidMonths: 6, bonus: 1, tag: t.offer },
      { key: "yearly", title: t.yearly, monthsShown: 13, paidMonths: 12, bonus: 1, tag: t.most, best: true },
    ];
  }, [t]);

  // ✅ placeholder pricing (غيره بعدين من لوحة التحكم)
  const BASE_MONTHLY_PRICE = {
    starter: 299,
    growth: 499,
    scale: 799,
    enterprise: 1299,
  };

  const [selectedPackage, setSelectedPackage] = useState(pkgFromUrl);
  const [selectedDuration, setSelectedDuration] = useState("yearly");

  useEffect(() => {
    if (pkgFromUrl) setSelectedPackage(pkgFromUrl);
  }, [pkgFromUrl]);

  const pkgObj = PACKAGES.find((x) => x.key === selectedPackage) || PACKAGES[0];
  const durationObj = DURATIONS.find((d) => d.key === selectedDuration) || DURATIONS[3];

  const computedPrice = useMemo(() => {
    const base = BASE_MONTHLY_PRICE[selectedPackage] || 0;
    return base * durationObj.paidMonths;
  }, [selectedPackage, durationObj, BASE_MONTHLY_PRICE]);

  return (
    <section className="min-h-screen py-10 sm:py-14 px-2 sm:px-4 bg-gradient-to-b from-[#0b131e] via-[#0f1a26] to-[#070b12]">
      <div className="max-w-6xl mx-auto">
        {/* Top bar */}
        <div className={cn("flex items-center justify-between mb-6", isArabic && "flex-row-reverse")}>
          <Link
            href={`/?lang=${lang}`}
            className="text-white/75 hover:text-white font-bold text-sm inline-flex items-center gap-2"
          >
            <span className={cn(isArabic ? "rotate-180" : "")}>←</span> {t.back}
          </Link>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/6 border border-white/10 text-white/85 text-xs font-extrabold">
            <Building2 className="w-4 h-4 text-emerald-300" />
            {t.payLater}
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white drop-shadow">
            {t.title}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-white/65 max-w-3xl mx-auto">{t.sub}</p>
        </div>

        {/* Choose Package */}
        <div className="mb-8">
          <div className={cn("flex items-center justify-between mb-4", isArabic && "flex-row-reverse")}>
            <div className="text-white font-extrabold">{t.choosePackage}</div>
            {pkgObj.most ? (
              <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-red-500 text-white">
                {t.most}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PACKAGES.map((p) => {
              const Icon = p.icon;
              const active = p.key === selectedPackage;
              return (
                <button
                  key={p.key}
                  onClick={() => setSelectedPackage(p.key)}
                  className={cn(
                    "text-left relative rounded-3xl p-5 border bg-white/5 backdrop-blur-xl transition",
                    p.brand.ring,
                    active
                      ? "ring-2 ring-emerald-400/40 shadow-[0_40px_120px_-90px_rgba(16,185,129,0.55)]"
                      : "hover:shadow-[0_30px_90px_-75px_rgba(0,0,0,0.65)]"
                  )}
                >
                  <div className={cn("absolute top-0 left-0 right-0 h-[5px] rounded-t-3xl bg-gradient-to-r", p.brand.bar)} />

                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", p.brand.dot)} />
                        <div className="text-white font-extrabold">{p.name}</div>
                      </div>
                      <div className="mt-1 text-[12px] text-white/60 font-semibold">{p.fit}</div>
                    </div>

                    <div className={cn("px-2.5 py-1 rounded-full border text-xs font-extrabold", p.brand.pill)}>
                      PRO
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-white/70 text-sm">
                    <Icon className="w-4 h-4 text-white/70" />
                    <span className="text-white/60">{p.perks[0]}</span>
                  </div>

                  {active ? (
                    <div className="mt-4 inline-flex items-center gap-2 text-emerald-200 text-xs font-extrabold">
                      <Check className="w-4 h-4" />
                      {isArabic ? "تم اختيار الباقة" : "Selected"}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Choose Duration */}
        <div className="mb-10">
          <div className={cn("flex items-center justify-between mb-4", isArabic && "flex-row-reverse")}>
            <div className="text-white font-extrabold">{t.chooseDuration}</div>
            <div className="text-[12px] text-white/50">{t.durationHint}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DURATIONS.map((d, idx) => {
              const active = d.key === selectedDuration;
              const price = (BASE_MONTHLY_PRICE[selectedPackage] || 0) * d.paidMonths;

              return (
                <motion.button
                  key={d.key}
                  onClick={() => setSelectedDuration(d.key)}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                  className={cn(
                    "text-left relative rounded-3xl p-5 border bg-white/5 backdrop-blur-xl transition cursor-pointer",
                    active
                      ? "border-emerald-400/60 ring-2 ring-emerald-400/35 shadow-[0_40px_120px_-90px_rgba(16,185,129,0.55)]"
                      : "border-white/10 hover:border-white/20 hover:shadow-[0_30px_90px_-75px_rgba(0,0,0,0.65)]"
                  )}
                >
                  {d.tag ? (
                    <div className={cn("absolute -top-3 z-20", isArabic ? "right-4" : "left-4")}>
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-[11px] font-extrabold shadow border",
                          d.best ? "bg-purple-500 text-white border-purple-300/30" : "bg-white/10 text-white border-white/10"
                        )}
                      >
                        {d.tag}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-white font-extrabold text-lg">{d.title}</div>
                      <div className="mt-1 text-[12px] text-white/60 font-semibold">
                        {d.monthsShown} {d.monthsShown === 1 ? t.month : t.months}
                        {d.bonus ? (
                          <span className="ml-2 text-emerald-200 font-extrabold">
                            {isArabic ? `(+${d.bonus} مجاني)` : `(+${d.bonus} free)`}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {d.best ? (
                      <div className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-400/25 text-purple-200">
                        {t.bestValue}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <div className="text-white/55 text-xs">{isArabic ? "السعر" : "Price"}</div>
                    <div className="text-3xl font-extrabold text-white mt-1 leading-none">
                      {price.toLocaleString()}
                      <span className="text-xs text-white/55 font-semibold"> {t.aed}</span>
                    </div>
                    <div className="text-[11px] text-white/45 mt-2">
                      {isArabic
                        ? `يتم احتسابها على ${d.paidMonths} شهر (العرض داخل المدة)`
                        : `Charged for ${d.paidMonths} month(s) (offer included)`}
                    </div>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-white/75">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>{pkgObj.perks[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>{pkgObj.perks[1]}</span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Summary + CTA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          <div className="lg:col-span-2 rounded-3xl bg-white/5 border border-white/10 p-6 backdrop-blur-xl">
            <div className="text-white font-extrabold text-lg mb-4">{t.summary}</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/6 border border-white/10 p-4">
                <div className="text-white/55 text-xs">{t.selectedPackage}</div>
                <div className="mt-1 text-white font-extrabold">{pkgObj.name}</div>
                <div className="mt-1 text-white/60 text-sm">{pkgObj.fit}</div>
              </div>

              <div className="rounded-2xl bg-white/6 border border-white/10 p-4">
                <div className="text-white/55 text-xs">{t.selectedDuration}</div>
                <div className="mt-1 text-white font-extrabold">
                  {durationObj.title} • {durationObj.monthsShown}{" "}
                  {durationObj.monthsShown === 1 ? t.month : t.months}
                </div>
                <div className="mt-1 text-white/60 text-sm">
                  {durationObj.bonus
                    ? isArabic
                      ? `يشمل +${durationObj.bonus} شهر مجاني`
                      : `Includes +${durationObj.bonus} free month`
                    : isArabic
                      ? "بدون عرض إضافي"
                      : "No extra offer"}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-black/20 border border-white/10 p-4 flex items-center justify-between">
              <div>
                <div className="text-white/55 text-xs">{t.total}</div>
                <div className="text-white text-2xl font-extrabold mt-1">
                  {computedPrice.toLocaleString()}{" "}
                  <span className="text-xs text-white/55">{t.aed}</span>
                </div>
              </div>

              <button
                onClick={() => alert(isArabic ? "هنربط الدفع بعدين ✅" : "Payment integration later ✅")}
                className="px-6 py-3 rounded-full font-extrabold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.99] bg-gradient-to-r from-emerald-700 via-emerald-500 to-green-700"
              >
                {t.startNow}
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 border border-white/10 p-6 backdrop-blur-xl">
            <div className="text-white font-extrabold text-lg mb-3">
              {isArabic ? "المميزات داخل الباقة" : "Package benefits"}
            </div>

            <div className="space-y-3 text-sm text-white/75">
              {pkgObj.perks.map((x, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-300 mt-[2px]" />
                  <span>{x}</span>
                </div>
              ))}

              <div className="pt-3 mt-4 border-t border-white/10 text-[12px] text-white/50">
                {isArabic
                  ? "لو محتاج باقة مخصصة أعلى من Enterprise — تواصل معنا."
                  : "Need something beyond Enterprise? Contact us."}
              </div>

              <Link href={`/contact?lang=${lang}`} className="block mt-3">
                <div className="w-full text-center px-5 py-3 rounded-full bg-white/10 border border-white/10 text-white font-extrabold hover:bg-white/15 transition">
                  {t.contact}
                </div>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-[11px] text-white/35">
          © TAHEEL — Company PRO Subscriptions
        </div>
      </div>
    </section>
  );
}
