"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Shield,
  Zap,
  Crown,
  Sparkles,
  ChevronDown,
  ArrowLeft,
  Building2,
  BadgeCheck,
  Receipt,
  Lock,
  TrendingUp,
  AlertTriangle,
  Globe,
  Sparkle,
  PlusCircle,
  Layers,
} from "lucide-react";

// ✅ Firestore
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

/* =========================
   ✅ Safe text helpers
========================= */
function asText(v, fallback = "") {
  if (v == null) return fallback;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    if (typeof v.ar === "string") return v.ar;
    if (typeof v.en === "string") return v.en;
  }
  return fallback;
}

function localized(obj, lang, fallback = "") {
  if (obj == null) return fallback;
  if (typeof obj === "string" || typeof obj === "number") return String(obj);
  if (typeof obj === "object") {
    const v = obj?.[lang];
    return asText(v, asText(obj, fallback));
  }
  return fallback;
}

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

/* =========================
   ✅ Offer logic (ONLY semiannual + yearly)
========================= */
function isOfferDuration(durKey) {
  return durKey === "semiannual" || durKey === "yearly";
}

function offerText(d, isArabic, t) {
  const paid = Number(d?.paidMonths || 0);
  const bonus = Number(d?.bonus || 0);
  const total = paid + bonus;

  if (!paid || bonus <= 0) return "";
  if (isArabic) {
    const paidLabel = paid === 1 ? t.month : t.months;
    const totalLabel = total === 1 ? t.month : t.months;
    return `${t.pay} ${paid} ${paidLabel} + ${bonus} ${t.free} = ${total} ${totalLabel}`;
  }
  return `${t.pay} ${paid} mo + ${bonus} ${t.free} = ${total} mo`;
}

/** ✅ Quiet glow wrapper */
function ButtonGlow({ active = false, radius = "rounded-full", children }) {
  return (
    <div className={cn("relative group", radius)}>
      <div
        className={cn("absolute -inset-[2px] z-0", radius, "transition-opacity duration-300")}
        style={{
          background:
            "linear-gradient(90deg, rgba(16,185,129,0.85), rgba(56,189,248,0.65), rgba(168,85,247,0.55))",
          filter: "blur(10px)",
          opacity: active ? 0.45 : 0,
        }}
      />
      <div
        className={cn("absolute -inset-[2px] z-0", radius, "opacity-0 group-hover:opacity-55 transition-opacity duration-300")}
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
    accentShadow: "shadow-[0_40px_120px_-90px_rgba(16,185,129,0.38)]",
  },
  growth: {
    bar: "from-sky-400 to-sky-600",
    ring: "border-sky-400/25 hover:border-sky-400/70",
    dot: "bg-sky-400",
    pill: "bg-sky-500/12 border-sky-400/25 text-sky-200",
    accentShadow: "shadow-[0_40px_120px_-90px_rgba(56,189,248,0.35)]",
  },
  scale: {
    bar: "from-purple-400 to-purple-600",
    ring: "border-purple-400/25 hover:border-purple-400/75",
    dot: "bg-purple-400",
    pill: "bg-purple-500/12 border-purple-400/25 text-purple-200",
    accentShadow: "shadow-[0_40px_120px_-90px_rgba(168,85,247,0.35)]",
  },
  enterprise: {
    bar: "from-rose-400 to-red-600",
    ring: "border-red-400/25 hover:border-red-400/80",
    dot: "bg-red-400",
    pill: "bg-red-500/12 border-red-400/25 text-red-200",
    accentShadow: "shadow-[0_40px_120px_-90px_rgba(244,63,94,0.38)]",
  },
};

const PACKAGE_ORDER = { starter: 1, growth: 2, scale: 3, enterprise: 4 };

function packageLabel(key) {
  return String(key || "").toUpperCase();
}

function pickDefaultDurationKey(durations = []) {
  const keys = durations.map((d) => d.key);
  if (keys.includes("yearly")) return "yearly";
  if (keys.includes("semiannual")) return "semiannual";
  return durations?.[durations.length - 1]?.key || "yearly";
}

/**
 * ✅ FINAL RULES:
 * - Starter: yearly only
 * - Growth: semiannual or yearly
 * - Scale: semiannual or yearly
 * - Enterprise: semiannual or yearly
 */
function allowedDurationsForPackage(pkgKey) {
  if (pkgKey === "starter") return new Set(["yearly"]);
  if (pkgKey === "growth") return new Set(["semiannual", "yearly"]);
  if (pkgKey === "scale") return new Set(["semiannual", "yearly"]);
  if (pkgKey === "enterprise") return new Set(["semiannual", "yearly"]);
  return new Set(["semiannual", "yearly"]);
}

const DUR_LABELS = {
  semiannual: { ar: "نصف سنوي", en: "Semiannual" },
  yearly: { ar: "سنوي", en: "Yearly" },
};

/* =========================
   ✅ PLAN META (official, global tone)
========================= */
const PLAN_META = {
  starter: {
    agenciesAr: ["تسهيل", "آمر"],
    agenciesEn: ["Tasheel", "Amer"],
    monthlyLimit: 10,
    vibeAr: "للشركات الصغيرة (1–5)",
    vibeEn: "For small teams (1–5)",
    headlineAr: "ابدأ بتشغيل معاملات شركتك بمعيار احترافي وواضح.",
    headlineEn: "Launch your company operations with clarity and control.",
    subAr:
      "يغطي الاشتراك رسوم الطباعة والضريبة ضمن حد شهري مشمول، مع بقاء الرسوم الحكومية ورسوم Stripe محسوبة دائمًا.",
    subEn:
      "Subscription covers printing & VAT within a monthly included limit, while government fees and Stripe fees always apply.",
  },
  growth: {
    agenciesAr: ["تسهيل", "آمر", "المحاكم"],
    agenciesEn: ["Tasheel", "Amer", "Courts"],
    monthlyLimit: 20,
    vibeAr: "للعمليات المتنامية",
    vibeEn: "For growing operations",
    headlineAr: "نمو أسرع… بتكاليف متوقعة وحدود استخدام واضحة.",
    headlineEn: "Scale faster—with predictable costs and clear limits.",
    subAr:
      "مناسب للشركات التي يرتفع حجم معاملاتِها شهريًا، مع تطبيق سياسة الاستخدام العادل بشكل تلقائي.",
    subEn:
      "Ideal for teams with increasing monthly volume—fair-use is applied automatically.",
  },
  scale: {
    agenciesAr: ["تسهيل", "آمر", "المحاكم", "جهة إضافية"],
    agenciesEn: ["Tasheel", "Amer", "Courts", "Extra entity"],
    monthlyLimit: 30,
    vibeAr: "للشركات عالية الحركة",
    vibeEn: "For high-velocity teams",
    headlineAr: "إنتاجية أعلى… وزمن أقل… دون فقدان السيطرة على التكلفة.",
    headlineEn: "Higher throughput—less time—without losing cost control.",
    subAr:
      "مناسب للفرق ذات المعاملات الكثيفة، مع رؤية أوضح قبل الوصول إلى الحد الشهري.",
    subEn:
      "Built for heavier workflows, with clearer visibility before reaching your monthly limit.",
  },
  enterprise: {
    agenciesAr: ["كل الجهات"],
    agenciesEn: ["All entities"],
    monthlyLimit: "مخصص",
    vibeAr: "للشركات الكبيرة",
    vibeEn: "For enterprise teams",
    headlineAr: "حل مؤسسي: مرونة أعلى، سقف مخصص، وخيارات اتفاقيات خدمة.",
    headlineEn: "Enterprise-grade: higher flexibility, custom limits, and SLA options.",
    subAr:
      "للشركات ذات الأحجام الكبيرة التي تحتاج تنظيمًا أدق واستجابة أعلى، مع إمكانية التعاقد الخاص لاحقًا.",
    subEn:
      "Designed for high-volume operations needing tighter controls and higher responsiveness, with optional custom contracts later.",
  },
};

/* =========================
   ✅ Add-On Meta (Pay-as-you-go)
   Firestore: companySubscriptionAddOns
========================= */
const ADDON_META = {
  titleAr: "إضافات معاملات (Pay-As-You-Go)",
  titleEn: "Transaction Add-Ons (Pay-As-You-Go)",
  subAr:
    "الإضافة تغطي رسوم الطباعة والضريبة فقط، ولا تؤثر على رسوم Stripe. الرسوم الحكومية تُحتسب دائمًا على العميل.",
  subEn:
    "Add-ons cover printing & VAT only and do not affect Stripe fees. Government fees are always paid by the client.",
};

function StatPill({ icon: Icon, label, value, tone = "border-white/10 bg-white/6" }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-2xl border px-3 py-2", tone)}>
      <div className="w-8 h-8 rounded-xl bg-black/25 border border-white/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-white/80" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-white/55 font-bold truncate">{label}</div>
        <div className="text-white font-extrabold text-sm truncate">{value}</div>
      </div>
    </div>
  );
}

function TrustStrip({ isArabic }) {
  const items = isArabic
    ? [
        { icon: BadgeCheck, t: "منصة موثوقة" },
        { icon: Receipt, t: "شفافية تسعير كاملة" },
        { icon: Lock, t: "حماية بيانات الشركة" },
        { icon: AlertTriangle, t: "رسوم Stripe تُحتسب دائمًا" },
      ]
    : [
        { icon: BadgeCheck, t: "Trusted platform" },
        { icon: Receipt, t: "Full pricing transparency" },
        { icon: Lock, t: "Company data protection" },
        { icon: AlertTriangle, t: "Stripe fees always apply" },
      ];

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(({ icon: Icon, t }, i) => (
          <div
            key={i}
            className={cn(
              "rounded-2xl border border-white/10 bg-black/20 px-3 py-3 flex items-center gap-2",
              isArabic && "flex-row-reverse"
            )}
          >
            <div className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-white/80" />
            </div>
            <div className={cn("text-white/85 font-extrabold text-[12px] leading-snug", isArabic && "text-right")}>
              {t}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================
   ✅ One authoritative policy block (no repetition)
========================= */
function PricingPolicyBlock({ isArabic }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 sm:p-6">
      <div className={cn("flex items-start justify-between gap-4", isArabic && "flex-row-reverse")}>
        <div className={cn("min-w-0", isArabic && "text-right")}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-black/20 text-white/80 text-[11px] font-extrabold">
            <Layers className="w-4 h-4" />
            {isArabic ? "سياسة التسعير والاستخدام" : "Pricing & Usage Policy"}
          </div>

          <h2 className="mt-3 text-xl sm:text-2xl font-extrabold text-white leading-tight">
            {isArabic ? "تفاصيل تكلفة أي معاملة — ثابتة وواضحة" : "Transaction cost breakdown — fixed & clear"}
          </h2>

          <div className="mt-3 space-y-3 text-white/75 text-sm font-semibold leading-relaxed">
            <div className={cn("rounded-2xl border border-white/10 bg-black/20 p-4", isArabic && "text-right")}>
              <div className="text-white font-extrabold mb-2">{isArabic ? "مكوّنات أي معاملة في تأهيل:" : "Every transaction in TAHEEL includes:"}</div>
              <div className="space-y-2">
                <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                  <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                  <span>
                    <span className="text-white font-extrabold">{isArabic ? "الرسوم الحكومية:" : "Government fees:"}</span>{" "}
                    {isArabic ? "على العميل دائمًا." : "always paid by the client."}
                  </span>
                </div>

                <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                  <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                  <span>
                    <span className="text-white font-extrabold">{isArabic ? "رسوم الطباعة:" : "Printing fees:"}</span>{" "}
                    {isArabic
                      ? "مشمولة ضمن الاشتراك حتى الحد الشهري المشمول؛ ثم تُحتسب تلقائيًا بعده."
                      : "covered by subscription up to the monthly included limit; then automatically applies after."}
                  </span>
                </div>

                <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                  <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                  <span>
                    <span className="text-white font-extrabold">{isArabic ? "ضريبة القيمة المضافة (VAT):" : "VAT:"}</span>{" "}
                    {isArabic
                      ? "مشمولة ضمن الاشتراك حتى الحد الشهري المشمول؛ ثم تُحتسب تلقائيًا بعده."
                      : "covered by subscription up to the monthly included limit; then automatically applies after."}
                  </span>
                </div>

                <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                  <AlertTriangle className="w-4 h-4 text-amber-200 mt-[2px] shrink-0" />
                  <span>
                    <span className="text-white font-extrabold">{isArabic ? "رسوم الدفع الإلكتروني (Stripe):" : "Payment processing (Stripe):"}</span>{" "}
                    {isArabic
                      ? "تُحتسب دائمًا ولا تُلغى ضمن أي باقة، لأنها تكلفة خارجية."
                      : "always applies and is not waived by any plan, as it is an external cost."}
                  </span>
                </div>
              </div>
            </div>

            <div className={cn("rounded-2xl border border-white/10 bg-black/20 p-4", isArabic && "text-right")}>
              <div className="text-white font-extrabold mb-2">{isArabic ? "منطق الاشتراك (استخدام عادل):" : "Subscription logic (Fair use):"}</div>
              <div className="space-y-2">
                <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                  <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                  <span>
                    {isArabic
                      ? "الاشتراك يغطي فقط: رسوم الطباعة + VAT ضمن حد شهري مشمول لكل باقة."
                      : "Subscription covers: printing fees + VAT within a monthly included limit per plan."}
                  </span>
                </div>
                <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                  <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                  <span>
                    {isArabic
                      ? "بعد تجاوز الحد: تُطبق رسوم الطباعة وVAT تلقائيًا، أو يمكن الترقية أو شراء Add-On."
                      : "After reaching the limit: printing & VAT apply automatically, or you can upgrade or purchase an add-on."}
                  </span>
                </div>
                <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                  <AlertTriangle className="w-4 h-4 text-amber-200 mt-[2px] shrink-0" />
                  <span>
                    {isArabic
                      ? "الرسوم الحكومية ورسوم Stripe تظل محسوبة دائمًا في جميع الحالات."
                      : "Government fees and Stripe fees always apply in all cases."}
                  </span>
                </div>
              </div>
            </div>

            <div className={cn("rounded-2xl border border-white/10 bg-black/20 p-4", isArabic && "text-right")}>
              <div className="text-white font-extrabold mb-2">{isArabic ? "مثال توضيحي (Starter):" : "Example (Starter):"}</div>
              <div className="space-y-2 text-[13px]">
                <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                  <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                  <span>
                    {isArabic
                      ? "تنفيذ 8 معاملات: بدون رسوم طباعة + بدون VAT (مع احتساب Stripe)."
                      : "8 transactions: no printing fees + no VAT (Stripe applies)."}
                  </span>
                </div>
                <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                  <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                  <span>
                    {isArabic
                      ? "المعاملة 11: تُطبق رسوم الطباعة وVAT تلقائيًا (مع احتساب Stripe)."
                      : "11th transaction: printing fees + VAT apply automatically (Stripe applies)."}
                  </span>
                </div>
              </div>
            </div>

            <div className={cn("rounded-2xl border border-white/10 bg-black/20 p-4", isArabic && "text-right")}>
              <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
                <PlusCircle className="w-4 h-4 text-sky-200" />
                <div className="text-white font-extrabold">
                  {isArabic ? ADDON_META.titleAr : ADDON_META.titleEn}
                </div>
              </div>
              <div className="mt-2 text-white/75 text-[13px] font-semibold leading-relaxed">
                {isArabic ? ADDON_META.subAr : ADDON_META.subEn}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-col gap-3 shrink-0">
          <StatPill
            icon={Globe}
            label={isArabic ? "نطاق الخدمة" : "Scope"}
            value={isArabic ? "داخل الإمارات" : "UAE"}
          />
          <StatPill
            icon={TrendingUp}
            label={isArabic ? "توقع التكلفة" : "Predictability"}
            value={isArabic ? "حدود واضحة" : "Clear limits"}
          />
          <StatPill
            icon={Lock}
            label={isArabic ? "الامتثال" : "Compliance"}
            value={isArabic ? "سياسة شفافة" : "Transparent policy"}
          />
        </div>
      </div>
    </div>
  );
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
      chooseDuration: "اختر المدة",
      fixedDuration: "مدة ثابتة",
      months: "أشهر",
      month: "شهر",
      total: "الإجمالي",
      subscribeNow: "اشترك الآن",
      summary: "ملخص الاشتراك",
      package: "الباقة",
      duration: "المدة",
      aed: "درهم",
      finalPrice: "السعر النهائي",
      perks: "المزايا",
      select: "محدد",
      langBtn: "EN",
      loading: "جارٍ تحميل الباقات...",
      empty: "لا توجد باقات متاحة حاليًا.",
      noOffer: "لا يوجد عرض",
      free: "مجانًا",
      pay: "تدفع",
      specialOffer: "عرض خاص",
      agencies: "الجهات المشمولة",
      monthlyLimit: "الحد الشهري المشمول",
      fairUse: "استخدام عادل",
      fairUseLine:
        "عند تجاوز الحد الشهري، تُطبق رسوم الطباعة وVAT تلقائيًا، أو يمكنك الترقية أو شراء إضافة معاملات. الرسوم الحكومية ورسوم Stripe تُحتسب دائمًا.",
      scenario: "مثال سريع",
      scenarioLine1: "8 معاملات: بدون رسوم طباعة + بدون VAT (مع احتساب Stripe)",
      scenarioLine2: "المعاملة 11: تُطبق رسوم الطباعة وVAT تلقائيًا (مع احتساب Stripe)",
      instantSetup: "تفعيل سريع",
      clarity: "وضوح التكلفة",
      addOnsTitle: "إضافات معاملات",
      addOnsLoading: "جارٍ تحميل الإضافات...",
      addOnsEmpty: "لا توجد إضافات متاحة حاليًا.",
      addOnUnits: "معاملات إضافية",
      addOnCovers: "تغطي: الطباعة + VAT فقط",
      stripeAlways: "Stripe يُحتسب دائمًا",
      govAlways: "الرسوم الحكومية على العميل",
      buyAddOn: "شراء إضافة",
    };

    const en = {
      back: "Back",
      pageTitle: "Company Subscriptions",
      chooseDuration: "Choose duration",
      fixedDuration: "Fixed duration",
      months: "Months",
      month: "Month",
      total: "Total",
      subscribeNow: "Subscribe Now",
      summary: "Plan Summary",
      package: "Package",
      duration: "Duration",
      aed: "AED",
      finalPrice: "Final price",
      perks: "Perks",
      select: "Selected",
      langBtn: "AR",
      loading: "Loading plans...",
      empty: "No plans available right now.",
      noOffer: "No offer",
      free: "free",
      pay: "Pay",
      specialOffer: "Special Offer",
      agencies: "Included entities",
      monthlyLimit: "Monthly included limit",
      fairUse: "Fair use",
      fairUseLine:
        "After the monthly limit, printing & VAT apply automatically, or you can upgrade or purchase an add-on. Government fees and Stripe fees always apply.",
      scenario: "Quick example",
      scenarioLine1: "8 transactions: no printing fees + no VAT (Stripe applies)",
      scenarioLine2: "11th: printing fees + VAT apply automatically (Stripe applies)",
      instantSetup: "Fast activation",
      clarity: "Cost clarity",
      addOnsTitle: "Transaction Add-Ons",
      addOnsLoading: "Loading add-ons...",
      addOnsEmpty: "No add-ons available right now.",
      addOnUnits: "Extra transactions",
      addOnCovers: "Covers: printing + VAT only",
      stripeAlways: "Stripe always applies",
      govAlways: "Government fees are paid by client",
      buyAddOn: "Buy Add-On",
    };

    return isArabic ? ar : en;
  }, [isArabic]);

  // ✅ Plans from Firestore
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activePackage, setActivePackage] = useState(pkgFromUrl);

  const [selectedDurationByPkg, setSelectedDurationByPkg] = useState({
    starter: "yearly",
    growth: "yearly",
    scale: "yearly",
    enterprise: "yearly",
  });

  // ✅ Add-ons from Firestore
  const [addOns, setAddOns] = useState([]);
  const [addOnsLoading, setAddOnsLoading] = useState(true);

  useEffect(() => {
    if (pkgFromUrl) setActivePackage(pkgFromUrl);
  }, [pkgFromUrl]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const snap = await getDocs(collection(firestore, "companySubscriptionPlans"));

        const rowsRaw = snap.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          const key = docSnap.id;

          const Icon = ICONS_BY_KEY[key] || Sparkles;
          const brand = DEFAULT_BRAND[key] || DEFAULT_BRAND.starter;

          const isActive = data.isActive !== false;

          const rawPricing = data.pricing || {};
          const allow = allowedDurationsForPackage(key);

          const durations = Object.entries(rawPricing)
            .map(([durKey, v]) => {
              if (!allow.has(durKey)) return null;

              const vv = v || {};
              const paidMonths = Number(vv.paidMonths || (durKey === "semiannual" ? 6 : 12));
              const bonus = Number(vv.bonus || 0);
              const price = Number(vv.price || 0);

              const hasOffer = isOfferDuration(durKey) && bonus > 0 && paidMonths > 0;
              const offerLine = hasOffer ? offerText({ paidMonths, bonus }, isArabic, t) : "";

              const title = DUR_LABELS?.[durKey]?.[isArabic ? "ar" : "en"] || durKey;

              return { key: durKey, title, paidMonths, bonus, price, offerLine, hasOffer };
            })
            .filter(Boolean)
            .sort((a, b) => (a.key === "semiannual" ? 1 : 2) - (b.key === "semiannual" ? 1 : 2));

          const perksLocale = data.perks?.[isArabic ? "ar" : "en"];
          const perks = safeArray(perksLocale ?? data.perks)
            .map((x) => asText(x, ""))
            .filter(Boolean);

          return {
            key,
            name: localized(data.name, isArabic ? "ar" : "en", key),
            fit: localized(data.fit, isArabic ? "ar" : "en", ""),
            icon: Icon,
            brand,
            perks,
            durations,
            isActive,
          };
        });

        const rows = rowsRaw
          .filter((p) => p.isActive)
          .filter((p) => safeArray(p.durations).length > 0)
          .sort((a, b) => (PACKAGE_ORDER[a.key] || 99) - (PACKAGE_ORDER[b.key] || 99));

        if (!mounted) return;

        setPackages(rows);

        setSelectedDurationByPkg((prev) => {
          const next = { ...prev };
          for (const p of rows) {
            const allow = allowedDurationsForPackage(p.key);
            const current = next[p.key];

            const safeDefault = allow.has("yearly")
              ? "yearly"
              : allow.has("semiannual")
              ? "semiannual"
              : pickDefaultDurationKey(p.durations);

            const hasCurrent = p.durations.some((d) => d.key === current);
            next[p.key] = hasCurrent ? current : safeDefault;
          }
          return next;
        });

        const stillExists = rows.some((p) => p.key === (pkgFromUrl || activePackage));
        if (!stillExists && rows[0]?.key) setActivePackage(rows[0].key);
      } catch (e) {
        console.error("Failed to load companySubscriptionPlans:", e);
        if (mounted) setPackages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArabic, t]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setAddOnsLoading(true);

        // ✅ Collection: companySubscriptionAddOns
        // Suggested doc fields:
        // - isActive: boolean
        // - name: { ar, en } or string
        // - qty: number (e.g., 5, 10)
        // - price: number (covers printing + VAT only)
        // - note: { ar, en } optional
        const snap = await getDocs(collection(firestore, "companySubscriptionAddOns"));

        const rows = snap.docs
          .map((d) => {
            const data = d.data() || {};
            const isActive = data.isActive !== false;
            return {
              id: d.id,
              isActive,
              name: localized(data.name, isArabic ? "ar" : "en", ""),
              qty: Number(data.qty || 0),
              price: Number(data.price || 0),
              note: localized(data.note, isArabic ? "ar" : "en", ""),
              sort: Number(data.sort || 0),
            };
          })
          .filter((x) => x.isActive)
          .filter((x) => x.qty > 0 && x.price >= 0)
          .sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.qty - b.qty);

        if (!mounted) return;
        setAddOns(rows);
      } catch (e) {
        console.error("Failed to load companySubscriptionAddOns:", e);
        if (mounted) setAddOns([]);
      } finally {
        if (mounted) setAddOnsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isArabic]);

  const PACKAGES = packages;
  const pkgObj = PACKAGES.find((p) => p.key === activePackage) || PACKAGES[0];

  const selectedDurationKey =
    selectedDurationByPkg?.[activePackage] || pickDefaultDurationKey(pkgObj?.durations || []);

  const durationObj =
    pkgObj?.durations?.find((d) => d.key === selectedDurationKey) ||
    pkgObj?.durations?.[pkgObj?.durations?.length - 1];

  const setDurationFor = (pkgKey, durationKey) => {
    setSelectedDurationByPkg((prev) => ({ ...prev, [pkgKey]: durationKey }));
    setActivePackage(pkgKey);
  };

  // ✅ subscribe redirect
  const goSubscribe = () => {
    if (!pkgObj || !durationObj) return;

    const qs = new URLSearchParams();
    qs.set("lang", lang);
    qs.set("intent", "company_subscription");
    qs.set("planKey", pkgObj.key);
    qs.set("planName", asText(pkgObj.name, ""));
    qs.set("package", pkgObj.key);
    qs.set("duration", durationObj.key);
    qs.set("price", String(Number(durationObj.price || 0)));
    qs.set("paidMonths", String(Number(durationObj.paidMonths || 0)));
    qs.set("bonus", String(Number(durationObj.bonus || 0)));

    const totalMonths = Number(durationObj.paidMonths || 0) + Number(durationObj.bonus || 0);
    qs.set("months", String(totalMonths || (durationObj.key === "semiannual" ? 6 : 12)));

    router.push(`/login?${qs.toString()}`);
  };

  // ✅ add-on purchase redirect (keeps same payment flow style)
  const buyAddOn = (addOn) => {
    if (!addOn) return;

    const qs = new URLSearchParams();
    qs.set("lang", lang);
    qs.set("intent", "company_addon");
    qs.set("addOnId", String(addOn.id));
    qs.set("addOnName", asText(addOn.name, ""));
    qs.set("qty", String(Number(addOn.qty || 0)));
    qs.set("price", String(Number(addOn.price || 0)));

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
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[560px] h-[560px] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-[-180px] left-1/3 w-[520px] h-[520px] rounded-full bg-purple-500/10 blur-3xl" />
      </div>

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

              <div className="relative rounded-xl bg-white p-1 border border-black/10 shadow w-[56px] h-[56px]">
                <Image src="/logo3.png" alt="TAHEEL" fill className="object-contain" priority />
              </div>

              <div className={cn("hidden sm:block", isArabic && "text-right")}>
                <div className="text-white font-extrabold leading-none">{t.pageTitle}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-6xl mx-auto px-3 sm:px-4 py-8 sm:py-10 space-y-5">
        {/* Hero */}
        <div className={cn("rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 sm:p-6", isArabic && "text-right")}>
          <div className={cn("flex items-start justify-between gap-4", isArabic && "flex-row-reverse")}>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-black/20 text-white/80 text-[11px] font-extrabold">
                <Sparkle className="w-4 h-4" />
                {isArabic ? "تشغيل مؤسسي — استخدام عادل — شفافية كاملة" : "Enterprise-ready — Fair use — Full transparency"}
              </div>

              <h1 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight">
                {t.pageTitle}
              </h1>

              <p className="mt-2 text-white/70 font-semibold text-sm sm:text-base leading-relaxed max-w-3xl">
                {isArabic
                  ? "صُمّمت اشتراكات تأهيل للشركات لتبسيط إدارة المعاملات عبر سياسة تسعير واضحة: يغطي الاشتراك رسوم الطباعة وVAT ضمن حد شهري مشمول، بينما تظل الرسوم الحكومية ورسوم Stripe محسوبة دائمًا."
                  : "TAHEEL subscriptions are built for operational clarity: printing & VAT are covered within a monthly included limit, while government fees and Stripe fees always apply."}
              </p>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <StatPill
                icon={Globe}
                label={isArabic ? "نطاق الخدمة" : "Scope"}
                value={isArabic ? "داخل الإمارات" : "UAE"}
              />
              <StatPill
                icon={TrendingUp}
                label={isArabic ? "تحكم بالتكلفة" : "Cost control"}
                value={isArabic ? "حدود واضحة" : "Clear limits"}
              />
            </div>
          </div>

          <div className="mt-4">
            <TrustStrip isArabic={isArabic} />
          </div>
        </div>

        {/* ✅ One official policy block (replaces repeated lines everywhere) */}
        <PricingPolicyBlock isArabic={isArabic} />

        {/* Plans */}
        {loading ? (
          <div className={cn("text-white/70 font-extrabold", isArabic && "text-right")}>{t.loading}</div>
        ) : !PACKAGES?.length ? (
          <div className={cn("text-white/60 font-extrabold", isArabic && "text-right")}>{t.empty}</div>
        ) : (
          <div className="space-y-4">
            {PACKAGES.map((p, idx) => {
              const Icon = p.icon;
              const isOpen = p.key === activePackage;
              const localMeta = PLAN_META?.[p.key] || PLAN_META.starter;

              const selectedKey = selectedDurationByPkg[p.key] || pickDefaultDurationKey(p.durations);
              const selectedDur =
                p.durations.find((d) => d.key === selectedKey) || p.durations[p.durations.length - 1];

              const isFixedDuration = p.durations.length === 1; // Starter only

              return (
                <motion.div
                  key={p.key}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: idx * 0.04 }}
                >
                  <div
                    className={cn(
                      "relative rounded-3xl border bg-white/5 backdrop-blur-xl overflow-hidden",
                      p.brand?.ring || "border-white/10",
                      isOpen ? cn("border-white/20", p.brand?.accentShadow) : ""
                    )}
                  >
                    <div className={cn("absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r", p.brand?.bar)} />

                    {/* Header */}
                    <button
                      onClick={() => setActivePackage((prev) => (prev === p.key ? "" : p.key))}
                      className={cn(
                        "w-full p-5 sm:p-6 flex items-center justify-between text-left cursor-pointer",
                        isArabic && "text-right flex-row-reverse"
                      )}
                    >
                      <div className={cn("flex items-center gap-4 min-w-0", isArabic && "flex-row-reverse")}>
                        <div
                          className={cn(
                            "shrink-0 w-12 h-12 rounded-2xl border flex items-center justify-center",
                            isOpen ? "bg-white/10 border-white/20" : "bg-white/6 border-white/10"
                          )}
                        >
                          <Icon className="w-5 h-5 text-white/85" />
                        </div>

                        <div className="min-w-0">
                          <div className={cn("flex items-center gap-2 flex-wrap", isArabic && "flex-row-reverse")}>
                            <span className={cn("w-2 h-2 rounded-full", p.brand?.dot)} />
                            <div className="text-white font-extrabold text-lg sm:text-xl truncate max-w-[70vw] sm:max-w-[420px]">
                              {asText(p.name, p.key)}
                            </div>

                            <span
                              className={cn(
                                "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-extrabold border",
                                p.brand?.pill || "bg-white/8 border-white/15 text-white/80"
                              )}
                            >
                              <span className={cn("w-2 h-2 rounded-full", p.brand?.dot || "bg-white/40")} />
                              {packageLabel(p.key)}
                            </span>

                            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-white/10 bg-black/20 text-white/75">
                              <Building2 className="w-4 h-4" />
                              {isArabic ? localMeta.vibeAr : localMeta.vibeEn}
                            </span>
                          </div>

                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <StatPill
                              icon={BadgeCheck}
                              label={t.agencies}
                              value={isArabic ? localMeta.agenciesAr.join(" • ") : localMeta.agenciesEn.join(" • ")}
                            />
                            <StatPill
                              icon={Receipt}
                              label={t.monthlyLimit}
                              value={
                                typeof localMeta.monthlyLimit === "number"
                                  ? isArabic
                                    ? `${localMeta.monthlyLimit} معاملة / شهر`
                                    : `${localMeta.monthlyLimit} / month`
                                  : isArabic
                                  ? "مخصص"
                                  : "Custom"
                              }
                            />
                            <StatPill
                              icon={Shield}
                              label={t.fairUse}
                              value={isArabic ? "تطبيق تلقائي" : "Auto applied"}
                            />
                          </div>

                          {p.fit ? (
                            <div className="mt-2 text-[12px] text-white/60 font-semibold line-clamp-2">
                              {asText(p.fit, "")}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className={cn("flex items-center gap-3 shrink-0", isArabic && "flex-row-reverse")}>
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
                            {/* Left */}
                            <div className="lg:col-span-5">
                              <div className="rounded-3xl bg-black/25 border border-white/10 p-5">
                                <div className={cn("flex items-start justify-between gap-3", isArabic && "flex-row-reverse")}>
                                  <div className={cn("min-w-0", isArabic && "text-right")}>
                                    <div className="text-white font-extrabold text-lg">
                                      {isArabic ? localMeta.headlineAr : localMeta.headlineEn}
                                    </div>
                                    <div className="mt-2 text-white/70 text-sm font-semibold leading-relaxed">
                                      {isArabic ? localMeta.subAr : localMeta.subEn}
                                    </div>
                                  </div>
                                  <div className="w-12 h-12 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-5 h-5 text-white/80" />
                                  </div>
                                </div>

                                <div className="mt-4 rounded-2xl bg-white/6 border border-white/10 p-4">
                                  <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
                                    <AlertTriangle className="w-4 h-4 text-amber-200" />
                                    <div className={cn("text-white font-extrabold text-sm", isArabic && "text-right")}>
                                      {t.fairUse}
                                    </div>
                                  </div>
                                  <div className={cn("mt-2 text-white/70 text-[12px] font-semibold leading-relaxed", isArabic && "text-right")}>
                                    {t.fairUseLine}
                                  </div>
                                </div>

                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                                    <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
                                      <Zap className="w-4 h-4 text-emerald-200" />
                                      <div className={cn("text-white font-extrabold text-sm", isArabic && "text-right")}>
                                        {t.instantSetup}
                                      </div>
                                    </div>
                                    <div className={cn("mt-1 text-white/65 text-[12px] font-semibold", isArabic && "text-right")}>
                                      {isArabic ? "تفعيل فوري دون خطوات مطولة." : "Instant activation with no long setup."}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                                    <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
                                      <Shield className="w-4 h-4 text-sky-200" />
                                      <div className={cn("text-white font-extrabold text-sm", isArabic && "text-right")}>
                                        {t.clarity}
                                      </div>
                                    </div>
                                    <div className={cn("mt-1 text-white/65 text-[12px] font-semibold", isArabic && "text-right")}>
                                      {isArabic ? "تكلفة متوقعة وواضحة قبل الدفع." : "Clear cost visibility before paying."}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 rounded-2xl border border-white/10 bg-white/6 p-4">
                                  <div className={cn("text-white font-extrabold", isArabic && "text-right")}>{t.scenario}</div>
                                  <div className={cn("mt-2 space-y-2 text-[12px] font-semibold text-white/75", isArabic && "text-right")}>
                                    <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                                      <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                                      <span>{t.scenarioLine1}</span>
                                    </div>
                                    <div className={cn("flex items-start gap-2", isArabic && "flex-row-reverse")}>
                                      <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                                      <span>{t.scenarioLine2}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right */}
                            <div className="lg:col-span-7">
                              <div className={cn("flex items-center justify-between mb-3", isArabic && "flex-row-reverse")}>
                                <div className="text-white font-extrabold">
                                  {isFixedDuration ? t.fixedDuration : t.chooseDuration}
                                </div>
                              </div>

                              <div className={cn("grid gap-3", isFixedDuration ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
                                {p.durations.map((d) => {
                                  const active = d.key === selectedKey;

                                  return (
                                    <ButtonGlow key={d.key} active={active} radius="rounded-2xl">
                                      <button
                                        type="button"
                                        onClick={() => setDurationFor(p.key, d.key)}
                                        className={cn(
                                          "cursor-pointer relative w-full rounded-2xl border p-4 bg-white/6 backdrop-blur-xl transition text-left",
                                          active
                                            ? "border-emerald-400/55 bg-white/8"
                                            : "border-white/10 hover:border-white/20 hover:bg-white/7"
                                        )}
                                      >
                                        {d.hasOffer ? (
                                          <div className={cn("absolute -top-3 z-20", isArabic ? "right-3" : "left-3")}>
                                            <span className="px-3 py-1 rounded-full text-[11px] font-extrabold shadow border bg-amber-400 text-black border-amber-200/40">
                                              {t.specialOffer}
                                            </span>
                                          </div>
                                        ) : null}

                                        <div className={cn("flex items-start justify-between gap-3", isArabic && "flex-row-reverse text-right")}>
                                          <div className="min-w-0">
                                            <div className="text-white font-extrabold text-base">{asText(d.title, d.key)}</div>
                                            <div className="mt-1 text-[12px] text-white/65 font-semibold">
                                              {isFixedDuration
                                                ? isArabic
                                                  ? "اشتراك سنوي إلزامي كبداية تشغيلية"
                                                  : "Required yearly entry plan"
                                                : isArabic
                                                ? "اختر المدة الأنسب لإدارتك المالية"
                                                : "Choose the duration that fits your budgeting"}
                                            </div>
                                          </div>
                                          <div className="w-10 h-10 rounded-2xl bg-black/25 border border-white/10 flex items-center justify-center shrink-0">
                                            <Receipt className="w-4 h-4 text-white/80" />
                                          </div>
                                        </div>

                                        {d.hasOffer ? (
                                          <div className="mt-2 text-[12px] font-extrabold text-amber-200">{d.offerLine}</div>
                                        ) : null}

                                        <div className="mt-3">
                                          <div className="text-white/55 text-xs">{t.finalPrice}</div>
                                          <div className="text-2xl font-extrabold text-white mt-1 leading-none">
                                            {Number(d.price || 0).toLocaleString()}{" "}
                                            <span className="text-xs text-white/55 font-semibold">{t.aed}</span>
                                          </div>
                                        </div>

                                        {active ? (
                                          <div className={cn("mt-3 inline-flex items-center gap-2 text-emerald-200 text-xs font-extrabold", isArabic && "flex-row-reverse")}>
                                            <Check className="w-4 h-4" />
                                            {t.select}
                                          </div>
                                        ) : null}
                                      </button>
                                    </ButtonGlow>
                                  );
                                })}
                              </div>

                              {/* Summary */}
                              <div className="mt-4 rounded-3xl bg-black/25 border border-white/10 p-5">
                                <div className={cn("flex items-center justify-between", isArabic && "flex-row-reverse")}>
                                  <div className="text-white font-extrabold">{t.summary}</div>
                                  <div className="text-[11px] text-white/55 font-bold truncate max-w-[52%]">
                                    {asText(p.name, p.key)}
                                  </div>
                                </div>

                                <div className="mt-4 rounded-2xl bg-white/6 border border-white/10 p-4">
                                  <div className="text-white/55 text-xs">{t.duration}</div>
                                  <div className="mt-1 text-white font-extrabold">{asText(selectedDur?.title, "")}</div>

                                  <div className="mt-2 text-white/60 text-sm">
                                    {selectedDur?.hasOffer ? (
                                      <span className="font-extrabold text-amber-200">{selectedDur.offerLine}</span>
                                    ) : (
                                      <span className="text-white/45">{t.noOffer}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <div className="text-white font-extrabold mb-3">{t.perks}</div>
                                  <div className="space-y-2 text-sm text-white/80">
                                    {safeArray(p.perks).map((x, i) => (
                                      <div
                                        key={i}
                                        className={cn("flex items-start gap-2", isArabic && "flex-row-reverse text-right")}
                                      >
                                        <Check className="w-4 h-4 text-emerald-300 mt-[2px] shrink-0" />
                                        <span className="break-words">{asText(x, "")}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-5 rounded-2xl bg-white/6 border border-white/10 p-4 flex items-center justify-between gap-3">
                                  <div className={cn("min-w-0", isArabic && "text-right")}>
                                    <div className="text-white/55 text-xs">{t.total}</div>
                                    <div className="text-white text-2xl font-extrabold mt-1">
                                      {Number(selectedDur?.price || 0).toLocaleString()}{" "}
                                      <span className="text-xs text-white/55">{t.aed}</span>
                                    </div>
                                  </div>

                                  <ButtonGlow radius="rounded-full">
                                    <button
                                      type="button"
                                      onClick={goSubscribe}
                                      className="cursor-pointer shrink-0 px-5 py-3 rounded-full font-extrabold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.99] bg-gradient-to-r from-emerald-700 via-emerald-500 to-green-700"
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

        {/* ✅ Add-ons section (below plans) */}
        <div className={cn("rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 sm:p-6", isArabic && "text-right")}>
          <div className={cn("flex items-start justify-between gap-4", isArabic && "flex-row-reverse")}>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-black/20 text-white/80 text-[11px] font-extrabold">
                <PlusCircle className="w-4 h-4" />
                {t.addOnsTitle}
              </div>

              <h2 className="mt-3 text-xl sm:text-2xl font-extrabold text-white leading-tight">
                {isArabic ? "معاملات إضافية عند الحاجة — دون تعطيل" : "Extra capacity when needed—no disruption"}
              </h2>

              <p className="mt-2 text-white/70 font-semibold text-sm sm:text-base leading-relaxed max-w-3xl">
                {isArabic
                  ? "تم تصميم الإضافات لتجنّب أي توقف مفاجئ بعد الحد الشهري. الإضافة تغطي رسوم الطباعة وVAT فقط، بينما تظل الرسوم الحكومية ورسوم Stripe محسوبة دائمًا."
                  : "Add-ons prevent surprises after your monthly limit. They cover printing & VAT only, while government and Stripe fees always apply."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <StatPill icon={Receipt} label={t.addOnCovers} value={isArabic ? "مشمولة" : "Included"} />
            <StatPill icon={AlertTriangle} label={t.stripeAlways} value={isArabic ? "دائمًا" : "Always"} />
            <StatPill icon={BadgeCheck} label={t.govAlways} value={isArabic ? "دائمًا" : "Always"} />
          </div>

          {addOnsLoading ? (
            <div className={cn("mt-4 text-white/70 font-extrabold", isArabic && "text-right")}>{t.addOnsLoading}</div>
          ) : !addOns?.length ? (
            <div className={cn("mt-4 text-white/60 font-extrabold", isArabic && "text-right")}>{t.addOnsEmpty}</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {addOns.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-3xl border border-white/10 bg-black/20 p-4 flex items-center justify-between gap-3",
                    isArabic && "flex-row-reverse"
                  )}
                >
                  <div className={cn("min-w-0", isArabic && "text-right")}>
                    <div className="text-white font-extrabold text-base">
                      {a.name || (isArabic ? "إضافة معاملات" : "Add-On")}
                    </div>
                    <div className="mt-1 text-white/65 text-[12px] font-semibold">
                      {isArabic ? `${a.qty} ${t.addOnUnits}` : `${a.qty} ${t.addOnUnits}`}
                    </div>
                    {a.note ? (
                      <div className="mt-1 text-white/55 text-[12px] font-semibold line-clamp-2">{a.note}</div>
                    ) : null}
                  </div>

                  <div className={cn("flex items-center gap-3 shrink-0", isArabic && "flex-row-reverse")}>
                    <div className={cn("text-right", !isArabic && "text-left")}>
                      <div className="text-white/55 text-xs">{t.finalPrice}</div>
                      <div className="text-white font-extrabold text-xl leading-none">
                        {Number(a.price || 0).toLocaleString()}{" "}
                        <span className="text-xs text-white/55 font-semibold">{t.aed}</span>
                      </div>
                    </div>

                    <ButtonGlow radius="rounded-full">
                      <button
                        type="button"
                        onClick={() => buyAddOn(a)}
                        className="cursor-pointer px-4 py-2 rounded-full font-extrabold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.99] bg-gradient-to-r from-sky-700 via-sky-500 to-blue-700"
                      >
                        {t.buyAddOn}
                      </button>
                    </ButtonGlow>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      {!loading && pkgObj && durationObj ? (
        <div className="sticky bottom-0 z-40 border-t border-white/10 bg-[#08101a]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3">
            <div className={cn("flex items-center justify-between gap-3", isArabic && "flex-row-reverse")}>
              <div className={cn("min-w-0", isArabic && "text-right")}>
                <div className="text-[11px] text-white/55 font-bold">
                  {t.package}: <span className="text-white/85">{asText(pkgObj?.name, "")}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold border",
                      isArabic ? "mr-2" : "ml-2",
                      pkgObj?.brand?.pill || "bg-white/8 border-white/15 text-white/80"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", pkgObj?.brand?.dot || "bg-white/40")} />
                    {packageLabel(pkgObj?.key)}
                  </span>
                  {" • "}
                  {t.duration}: <span className="text-white/85">{asText(durationObj?.title, "")}</span>
                </div>

                {durationObj?.hasOffer ? (
                  <div className="mt-1 text-[12px] font-extrabold text-amber-200">{durationObj.offerLine}</div>
                ) : null}

                <div className="text-white font-extrabold text-lg leading-none mt-1">
                  {t.total}: {Number(durationObj?.price || 0).toLocaleString()}{" "}
                  <span className="text-[12px] text-white/55 font-semibold">{t.aed}</span>
                </div>
              </div>

              <ButtonGlow radius="rounded-full">
                <button
                  type="button"
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
