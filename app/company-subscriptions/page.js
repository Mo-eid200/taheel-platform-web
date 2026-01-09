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
  Timer,
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

/** ✅ Fixed duration labels */
const DUR_LABELS = {
  semiannual: { ar: "نصف سنوي", en: "Semiannual" },
  yearly: { ar: "سنوي", en: "Yearly" },
};

/* =========================
   ✅ Visual + Psychological copy meta (Front-only)
========================= */
const PLAN_META = {
  starter: {
    agenciesAr: ["تسهيل", "آمر"],
    agenciesEn: ["Tasheel", "Amer"],
    monthlyLimit: 10,
    vibeAr: "للشركات الصغيرة (1–5)",
    vibeEn: "For small teams (1–5)",
    headlineAr: "أساس قوي لتشغيل معاملات شركتك بوضوح كامل.",
    headlineEn: "A clean foundation for company transactions with full clarity.",
    subAr:
      "يغطي الاشتراك رسوم الطباعة وضريبة القيمة المضافة ضمن حد شهري مشمول، مع بقاء الرسوم الحكومية ورسوم Stripe محسوبة دائمًا.",
    subEn:
      "Subscription covers printing & VAT within a monthly included limit—government fees and Stripe fees always apply.",
  },
  growth: {
    agenciesAr: ["تسهيل", "آمر", "المحاكم"],
    agenciesEn: ["Tasheel", "Amer", "Courts"],
    monthlyLimit: 20,
    vibeAr: "للعمليات المتنامية",
    vibeEn: "For growing operations",
    headlineAr: "ارتقِ بالسرعة… دون فقدان التحكم في التكلفة.",
    headlineEn: "Scale speed—without losing cost control.",
    subAr:
      "مصمم لفرق ترتفع معاملاتها شهريًا، مع نفس مبدأ الاستخدام العادل ووضوح الفوترة.",
    subEn:
      "Built for teams with increasing monthly volume—same fair-use policy and billing clarity.",
  },
  scale: {
    agenciesAr: ["تسهيل", "آمر", "المحاكم", "جهة إضافية"],
    agenciesEn: ["Tasheel", "Amer", "Courts", "Extra entity"],
    monthlyLimit: 30,
    vibeAr: "للشركات عالية الحركة",
    vibeEn: "For high-velocity teams",
    headlineAr: "حجم أعلى… تنظيم أقوى… تجربة أكثر سلاسة.",
    headlineEn: "Higher volume. Stronger ops. Smoother experience.",
    subAr:
      "للمهام المكثفة مع أولوية أعلى وتخطيط واضح قبل تجاوز الحد الشهري.",
    subEn:
      "For heavier workflows with higher priority and clear planning before limit.",
  },
  enterprise: {
    agenciesAr: ["كل الجهات"],
    agenciesEn: ["All entities"],
    monthlyLimit: "مخصص",
    vibeAr: "للشركات والمؤسسات",
    vibeEn: "For enterprise teams",
    headlineAr: "حل مؤسسي: سقف أعلى + مرونة + مزايا تشغيلية.",
    headlineEn: "Enterprise grade: higher caps, flexibility, operational advantages.",
    subAr:
      "للجهات ذات الحجم الكبير والتي تتطلب مستوى خدمة أعلى وإمكانية ترتيبات خاصة لاحقًا.",
    subEn:
      "For large-volume teams needing higher service levels and optional custom arrangements later.",
  },
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
        { icon: BadgeCheck, t: "منصة موثوقة بمعايير تشغيل واضحة" },
        { icon: Receipt, t: "شفافية كاملة في عناصر التكلفة" },
        { icon: Lock, t: "حماية بيانات الشركة وضوابط الوصول" },
        { icon: AlertTriangle, t: "الرسوم الحكومية وStripe تُحتسب دائمًا" },
      ]
    : [
        { icon: BadgeCheck, t: "Trusted platform with clear operating rules" },
        { icon: Receipt, t: "Full cost transparency" },
        { icon: Lock, t: "Data protection & access control" },
        { icon: AlertTriangle, t: "Government + Stripe fees always apply" },
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
   ✅ Add-ons strip (Pulled from Firestore)
   Collection: companyAddonsCatalog
========================= */
function AddonsStrip({ isArabic, t, addons = [], onBuy }) {
  if (!addons?.length) return null;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-white/10 bg-black/20">
        <div className={cn("flex items-center justify-between gap-3", isArabic && "flex-row-reverse")}>
          <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
            <div className="w-10 h-10 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center">
              <PlusCircle className="w-5 h-5 text-white/80" />
            </div>
            <div className={cn("min-w-0", isArabic && "text-right")}>
              <div className="text-white font-extrabold">{t.addonsTitle}</div>
              <div className="text-white/60 text-[12px] font-semibold">
                {t.addonsSub}
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold border border-white/10 bg-white/6 text-white/80">
            <Layers className="w-4 h-4" />
            {t.addonsUniversal}
          </span>
        </div>
      </div>

      {/* Scroll strip */}
      <div className="p-4 sm:p-5">
        <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {addons.map((a) => {
            const title = asText(a?.title, "");
            const isPopular = !!a?.popular;

            const priceRange =
              a?.type === "emergency" && (Number(a?.priceMin || 0) > 0 || Number(a?.priceMax || 0) > 0)
                ? `${Number(a?.priceMin || 0).toLocaleString()}–${Number(a?.priceMax || 0).toLocaleString()}`
                : Number(a?.price || 0).toLocaleString();

            const qtyLabel =
              a?.type === "bundle"
                ? isArabic
                  ? `${Number(a?.qty || 0)} معاملات`
                  : `${Number(a?.qty || 0)} tx`
                : isArabic
                ? "معاملة واحدة"
                : "Single";

            return (
              <div
                key={a.addonKey}
                className="min-w-[280px] sm:min-w-[320px] rounded-3xl border border-white/10 bg-black/20 p-4 relative"
              >
                {isPopular ? (
                  <div className={cn("absolute -top-3 z-20", isArabic ? "right-4" : "left-4")}>
                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold shadow border bg-amber-400 text-black border-amber-200/40">
                      {t.mostPopular}
                    </span>
                  </div>
                ) : null}

                <div className={cn("flex items-start justify-between gap-3", isArabic && "flex-row-reverse text-right")}>
                  <div className="min-w-0">
                    <div className="text-white font-extrabold text-base truncate">{title}</div>
                    <div className="mt-1 text-[12px] text-white/65 font-semibold">
                      {t.addonsCoversLine}
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center shrink-0">
                    <Timer className="w-5 h-5 text-white/80" />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/6 border border-white/10 p-3">
                  <div className={cn("flex items-center justify-between", isArabic && "flex-row-reverse")}>
                    <div className="text-white/55 text-xs font-bold">{t.addonsBundle}</div>
                    <div className="text-white font-extrabold text-sm">{qtyLabel}</div>
                  </div>

                  <div className={cn("mt-3 flex items-end justify-between gap-3", isArabic && "flex-row-reverse")}>
                    <div className="min-w-0">
                      <div className="text-white/55 text-xs">{t.finalPrice}</div>
                      <div className="text-white text-2xl font-extrabold leading-none mt-1">
                        {priceRange} <span className="text-xs text-white/55 font-semibold">{t.aed}</span>
                      </div>
                      <div className="mt-2 text-[11px] text-white/55 font-semibold">
                        {t.addonsStripeNote}
                      </div>
                    </div>

                    <ButtonGlow radius="rounded-full">
                      <button
                        type="button"
                        onClick={() => onBuy?.(a)}
                        className="cursor-pointer shrink-0 px-4 py-2.5 rounded-full font-extrabold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.99] bg-gradient-to-r from-sky-700 via-sky-500 to-indigo-700"
                      >
                        {t.addonsBuy}
                      </button>
                    </ButtonGlow>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={cn("mt-3 text-[12px] text-white/60 font-semibold", isArabic && "text-right")}>
          {t.addonsFootnote}
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
      fixedDuration: "المدة ثابتة",
      months: "أشهر",
      month: "شهر",
      total: "الإجمالي",
      subscribeNow: "اشترك الآن",
      summary: "ملخص الباقة",
      package: "الباقة",
      duration: "المدة",
      aed: "درهم",
      finalPrice: "السعر النهائي",
      perks: "المزايا",
      select: "تم الاختيار",
      langBtn: "EN",
      loading: "جاري تحميل الباقات...",
      empty: "لا توجد باقات متاحة حاليًا.",
      noOffer: "بدون عرض",
      free: "مجانًا",
      pay: "تدفع",
      specialOffer: "عرض خاص",
      agencies: "الجهات المشمولة",
      monthlyLimit: "الحد الشهري المشمول",
      policyTitle: "سياسة الاستخدام العادل",
      policyLine:
        "عند تجاوز الحد الشهري، تُطبّق رسوم الطباعة وضريبة القيمة المضافة تلقائيًا، أو يمكن الترقية أو شراء إضافة معاملات. الرسوم الحكومية ورسوم Stripe تُحتسب دائمًا.",
      scenario: "مثال توضيحي",
      scenarioLine1: "إنجاز 8 معاملات: دون رسوم طباعة وضريبة (مع احتساب Stripe).",
      scenarioLine2: "عند المعاملة 11: تُعاد رسوم الطباعة والضريبة تلقائيًا (مع احتساب Stripe).",
      // ✅ Add-ons
      addonsTitle: "إضافة معاملات (Add-On)",
      addonsSub: "تحكم مرن عند الحاجة — دون إيقاف أو مفاجآت.",
      addonsUniversal: "مناسبة لجميع الباقات",
      addonsCoversLine: "تغطي: الطباعة + VAT + المعالجة الإدارية — لا تشمل الرسوم الحكومية أو Stripe.",
      addonsStripeNote: "ملاحظة: رسوم Stripe تُحتسب دائمًا.",
      addonsBuy: "شراء الإضافة",
      addonsBundle: "الحزمة",
      addonsFootnote:
        "الإضافات تُستخدم فقط لتغطية (الطباعة + VAT + المعالجة). الرسوم الحكومية ورسوم Stripe لا تدخل ضمن الاشتراك أو الإضافة.",
      mostPopular: "الأكثر طلبًا",
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
      perks: "Benefits",
      select: "Selected",
      langBtn: "AR",
      loading: "Loading packages...",
      empty: "No packages available right now.",
      noOffer: "No offer",
      free: "free",
      pay: "Pay",
      specialOffer: "Special Offer",
      agencies: "Included entities",
      monthlyLimit: "Monthly included limit",
      policyTitle: "Fair-Use Policy",
      policyLine:
        "When the monthly limit is exceeded, printing & VAT apply automatically, or you can upgrade / purchase an add-on. Government fees and Stripe fees always apply.",
      scenario: "Example",
      scenarioLine1: "8 transactions: no printing + no VAT (Stripe applies).",
      scenarioLine2: "11th: printing + VAT apply automatically (Stripe applies).",
      // ✅ Add-ons
      addonsTitle: "Transaction Add-Ons",
      addonsSub: "Flexible control when you need it—no blocks, no surprises.",
      addonsUniversal: "Works with any plan",
      addonsCoversLine: "Covers: printing + VAT + admin processing — excludes government & Stripe fees.",
      addonsStripeNote: "Note: Stripe fee always applies.",
      addonsBuy: "Buy Add-On",
      addonsBundle: "Bundle",
      addonsFootnote:
        "Add-ons are only for (printing + VAT + admin processing). Government & Stripe fees are never included in plans or add-ons.",
      mostPopular: "Most popular",
    };

    return isArabic ? ar : en;
  }, [isArabic]);

  // ✅ Packages from Firestore
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Add-ons from Firestore
  const [addons, setAddons] = useState([]);

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

        // ✅ Plans
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

        // ✅ Add-ons Catalog
        const aSnap = await getDocs(collection(firestore, "companyAddonsCatalog"));
        const aRows = aSnap.docs
          .map((d) => {
            const data = d.data() || {};
            const addonKey = d.id;
            const isActive = data.isActive !== false;
            return {
              addonKey,
              title: data.title,
              qty: Number(data.qty || 0),
              price: Number(data.price || 0),
              priceMin: Number(data.priceMin || 0),
              priceMax: Number(data.priceMax || 0),
              currency: String(data.currency || "AED"),
              perTxn: Number(data.perTxn || 0),
              popular: !!data.popular,
              type: String(data.type || "bundle"),
              covers: data.covers || {},
              stripe: data.stripe || {},
              isActive,
              sortIndex: Number(data.sortIndex || 999),
            };
          })
          .filter((x) => x.isActive)
          .sort((a, b) => {
            // popular first, then sortIndex, then qty asc
            if (!!b.popular !== !!a.popular) return b.popular ? 1 : -1;
            if ((a.sortIndex || 999) !== (b.sortIndex || 999)) return (a.sortIndex || 999) - (b.sortIndex || 999);
            return (a.qty || 0) - (b.qty || 0);
          });

        if (!mounted) return;

        setPackages(rows);
        setAddons(aRows);

        // ✅ fix defaults
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
        console.error("Failed to load plans/addons:", e);
        if (mounted) {
          setPackages([]);
          setAddons([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArabic, t]);

  const PACKAGES = packages;

  const pkgObj = PACKAGES.find((p) => p.key === activePackage) || PACKAGES[0];
  const selectedDurationKey =
    selectedDurationByPkg?.[activePackage] || pickDefaultDurationKey(pkgObj?.durations || []);

  const durationObj =
    pkgObj?.durations?.find((d) => d.key === selectedDurationKey) ||
    pkgObj?.durations?.[pkgObj?.durations?.length - 1];

  const meta = PLAN_META?.[pkgObj?.key] || PLAN_META.starter;

  const setDurationFor = (pkgKey, durationKey) => {
    setSelectedDurationByPkg((prev) => ({ ...prev, [pkgKey]: durationKey }));
    setActivePackage(pkgKey);
  };

  // ✅ redirect to login (subscription intent)
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

  // ✅ Add-on buy (go to login with addon intent)
  const goBuyAddon = (addon) => {
    if (!addon?.addonKey) return;

    const qs = new URLSearchParams();
    qs.set("lang", lang);
    qs.set("intent", "company_addon");

    qs.set("addonKey", String(addon.addonKey));
    qs.set("addonTitle", asText(addon.title, ""));

    qs.set("type", String(addon.type || "bundle"));
    qs.set("qty", String(Number(addon.qty || 0)));

    // price or range
    if (addon.type === "emergency") {
      qs.set("priceMin", String(Number(addon.priceMin || 0)));
      qs.set("priceMax", String(Number(addon.priceMax || 0)));
    } else {
      qs.set("price", String(Number(addon.price || 0)));
    }

    qs.set("currency", String(addon.currency || "AED"));

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
      {/* Subtle background orbs */}
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
                {isArabic ? "GovOps للشركات — شفافية — استخدام عادل" : "Company GovOps — Transparency — Fair use"}
              </div>

              <h1 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight">
                {t.pageTitle}
              </h1>

              <p className="mt-2 text-white/70 font-semibold text-sm sm:text-base leading-relaxed max-w-3xl">
                {isArabic
                  ? "نموذج اشتراك مؤسسي واضح: الاشتراك يغطي الطباعة وVAT ضمن حد شهري مشمول، بينما الرسوم الحكومية ورسوم Stripe تُحتسب دائمًا. عند الحاجة، يمكنك الترقية أو شراء إضافة معاملات دون تعطيل."
                  : "A clear enterprise subscription model: plans cover printing & VAT within a monthly included limit, while government and Stripe fees always apply. Upgrade or buy an add-on anytime—without disruption."}
              </p>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <StatPill
                icon={Globe}
                label={isArabic ? "تشغيل داخل الإمارات" : "UAE operations"}
                value={isArabic ? "GovOps منظم" : "Structured GovOps"}
              />
              <StatPill
                icon={TrendingUp}
                label={isArabic ? "تحكم في التكاليف" : "Cost control"}
                value={isArabic ? "ضمن الحد الشهري" : "Within monthly limit"}
              />
            </div>
          </div>

          <div className="mt-4">
            <TrustStrip isArabic={isArabic} />
          </div>
        </div>

        {/* ✅ Add-ons strip (brand-consistent) */}
        <AddonsStrip isArabic={isArabic} t={t} addons={addons} onBuy={goBuyAddon} />

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

              const isFixedDuration = p.durations.length === 1; // ✅ Starter

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
                            <StatPill icon={Shield} label={t.policyTitle} value={isArabic ? "مفعّل تلقائيًا" : "Auto applied"} />
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
                            {/* Left (Policy + Example) */}
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

                                {/* ✅ Single policy block (official + non-repetitive) */}
                                <div className="mt-4 rounded-2xl bg-white/6 border border-white/10 p-4">
                                  <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
                                    <AlertTriangle className="w-4 h-4 text-amber-200" />
                                    <div className={cn("text-white font-extrabold text-sm", isArabic && "text-right")}>
                                      {t.policyTitle}
                                    </div>
                                  </div>
                                  <div className={cn("mt-2 text-white/70 text-[12px] font-semibold leading-relaxed", isArabic && "text-right")}>
                                    {t.policyLine}
                                  </div>
                                </div>

                                <div className="mt-4 rounded-2xl border border-white/10 bg-white/6 p-4">
                                  <div className={cn("flex items-center justify-between", isArabic && "flex-row-reverse")}>
                                    <div className={cn("text-white font-extrabold", isArabic && "text-right")}>{t.scenario}</div>
                                  </div>
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

                            {/* Right (Durations + Summary) */}
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
                                                  ? "اشتراك تأسيسي سنوي (إلزامي)"
                                                  : "Yearly starter entry (mandatory)"
                                                : isArabic
                                                ? "اختر الأنسب لدورتك التشغيلية"
                                                : "Choose what fits your operating cycle"}
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
