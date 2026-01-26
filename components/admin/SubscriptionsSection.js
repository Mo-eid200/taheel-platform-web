"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  deleteDoc,
  onSnapshot,
  query as fsQuery,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import {
  Zap,
  Sparkles,
  Shield,
  Crown,
  Save,
  CheckCircle2,
  AlertTriangle,
  Tag,
  SlidersHorizontal,
  Check,
  BadgePercent,
  LayoutGrid,
  Eye,
  PackagePlus,
  Boxes,
  WalletCards,
  Settings2,
} from "lucide-react";

/* =========================================
   Utils
========================================= */
function cn(...a) {
  return a.filter(Boolean).join(" ");
}
const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const safeStr = (v, fallback = "") =>
  typeof v === "string" ? v : v == null ? fallback : String(v);
const safeBool = (v, fallback = false) => (typeof v === "boolean" ? v : fallback);
const uniq = (arr) =>
  Array.from(new Set((arr || []).filter(Boolean).map((x) => String(x).trim())));

// ✅ safe clone بدل structuredClone
const deepClone = (obj) => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
};

/* =========================================
   Firestore Collections
========================================= */
const PLANS_COL = "companySubscriptionPlans";
const ADDONS_COL = "companyAddonsCatalog";

/* =========================================
   Plans / Durations (حسب نظامك)
   - Starter: سنوي فقط
   - Growth/Scale/Enterprise: نصف سنوي + سنوي (+ contract كخيار فوتره لو محتاج)
   - في الـ DB قد يكون موجود monthly/quarterly لكن إحنا هنخفيهم/نصفرهم عند الحفظ
========================================= */
const TIER_ORDER = ["starter", "growth", "scale", "enterprise"];

// هنخلي الكود قادر يقرأ أي بيانات قديمة (monthly/quarterly) لكن UI تركّز على semiannual/yearly
const DURATIONS_ALL = ["monthly", "quarterly", "semiannual", "yearly"];
const DURATIONS_UI = ["semiannual", "yearly"];

const DUR_LABELS = {
  monthly: { ar: "شهري", en: "Monthly" },
  quarterly: { ar: "3 شهور", en: "3 Months" },
  semiannual: { ar: "نصف سنوي", en: "Semiannual" },
  yearly: { ar: "سنوي", en: "Yearly" },
};

// العروض/البونص مسموح فقط في: نصف سنوي + سنوي
const isOfferDuration = (k) => k === "semiannual" || k === "yearly";

/* =========================================
   Brands (الهويات البصرية)
========================================= */
const BRAND = {
  starter: {
    icon: Zap,
    bar: "from-emerald-400 via-emerald-500 to-emerald-600",
    ring: "ring-emerald-500/20",
    chipDark: "bg-emerald-500/14 text-emerald-200 border-emerald-400/20",
    btn: "bg-emerald-600 hover:bg-emerald-700",
    focus: "focus:ring-emerald-500/30",
    glow: "shadow-[0_30px_110px_-70px_rgba(16,185,129,0.45)]",
  },
  growth: {
    icon: Sparkles,
    bar: "from-cyan-400 via-sky-500 to-blue-600",
    ring: "ring-sky-500/20",
    chipDark: "bg-sky-500/14 text-sky-200 border-sky-400/20",
    btn: "bg-sky-600 hover:bg-sky-700",
    focus: "focus:ring-sky-500/30",
    glow: "shadow-[0_30px_110px_-70px_rgba(56,189,248,0.40)]",
  },
  scale: {
    icon: Shield,
    bar: "from-violet-400 via-purple-500 to-fuchsia-600",
    ring: "ring-purple-500/20",
    chipDark: "bg-purple-500/14 text-purple-200 border-purple-400/20",
    btn: "bg-purple-600 hover:bg-purple-700",
    focus: "focus:ring-purple-500/30",
    glow: "shadow-[0_30px_110px_-70px_rgba(168,85,247,0.40)]",
  },
  enterprise: {
    icon: Crown,
    bar: "from-rose-400 via-red-500 to-orange-600",
    ring: "ring-rose-500/20",
    chipDark: "bg-rose-500/14 text-rose-200 border-rose-400/20",
    btn: "bg-rose-600 hover:bg-rose-700",
    focus: "focus:ring-rose-500/30",
    glow: "shadow-[0_30px_110px_-70px_rgba(244,63,94,0.40)]",
  },
};

/* =========================================
   i18n
========================================= */
const uiText = (lang) => ({
  pageTitle: lang === "ar" ? "إدارة الباقات والإضافات" : "Plans & Add-ons Manager",
  pageSub:
    lang === "ar"
      ? "تحكم كامل في باقات الشركات و Add-ons (Live)"
      : "Manage company plans and add-ons (Live)",

  tabPlans: lang === "ar" ? "الباقات" : "Plans",
  tabAddons: lang === "ar" ? "الإضافات" : "Add-ons",

  loadingPlans: lang === "ar" ? "جاري تحميل الباقات..." : "Loading plans...",
  loadingAddons: lang === "ar" ? "جاري تحميل الإضافات..." : "Loading add-ons...",
  emptyPlans: lang === "ar" ? "لا توجد باقات." : "No plans found.",
  emptyAddons: lang === "ar" ? "لا توجد إضافات." : "No add-ons found.",

  save: lang === "ar" ? "حفظ" : "Save",
  saving: lang === "ar" ? "جاري الحفظ..." : "Saving...",
  saved: lang === "ar" ? "تم الحفظ ✅" : "Saved ✅",
  error: lang === "ar" ? "خطأ في الحفظ ❌" : "Save failed ❌",

  active: lang === "ar" ? "مفعلة" : "Active",
  visible: lang === "ar" ? "ظاهرة" : "Visible",
  mandatory: lang === "ar" ? "إجباري" : "Mandatory",
  popular: lang === "ar" ? "شائعة" : "Popular",

  sortIndex: lang === "ar" ? "الترتيب" : "Sort",
  key: lang === "ar" ? "Key" : "Key",
  planKey: lang === "ar" ? "Plan Key" : "Plan Key",
  addonKey: lang === "ar" ? "Addon Key" : "Addon Key",
  version: lang === "ar" ? "Version" : "Version",
  currency: lang === "ar" ? "Currency" : "Currency",

  nameAr: lang === "ar" ? "اسم (عربي)" : "Name (AR)",
  nameEn: lang === "ar" ? "اسم (English)" : "Name (EN)",
  fitAr: lang === "ar" ? "وصف مختصر (عربي)" : "Short fit (AR)",
  fitEn: lang === "ar" ? "وصف مختصر (English)" : "Short fit (EN)",

  tabPerks: lang === "ar" ? "المميزات" : "Perks",
  tabPricing: lang === "ar" ? "الأسعار" : "Pricing",
  tabMeta: lang === "ar" ? "البيانات" : "Meta",
  tabRules: lang === "ar" ? "قواعد الخطة" : "Plan Rules",
  tabCovers: lang === "ar" ? "Covers" : "Covers",
  tabStripe: lang === "ar" ? "Stripe" : "Stripe",

  addPerk: lang === "ar" ? "إضافة ميزة" : "Add perk",
  remove: lang === "ar" ? "حذف" : "Remove",

  monthsShown: lang === "ar" ? "الشهور المعروضة" : "Shown months",
  paidMonths: lang === "ar" ? "المدفوعة" : "Paid months",
  bonus: lang === "ar" ? "مجاني" : "Bonus",
  price: lang === "ar" ? "السعر (AED)" : "Price (AED)",
  tag: lang === "ar" ? "Tag" : "Tag",
  best: lang === "ar" ? "Best" : "Best",

  stripeMode: lang === "ar" ? "Stripe Mode" : "Stripe Mode",
  stripePriceId: lang === "ar" ? "Price ID" : "Price ID",
  stripeProductId: lang === "ar" ? "Product ID" : "Product ID",

  helperTag: lang === "ar" ? "المسموح: most / offer فقط" : "Allowed: most / offer only",
  helperOffer:
    lang === "ar"
      ? "العروض/البونص مسموح فقط في: نصف سنوي + سنوي"
      : "Offers/bonus allowed only for: Semiannual + Yearly",

  searchPlaceholder: lang === "ar" ? "بحث بالاسم / الكود / الوصف..." : "Search by name / key / fit...",

  ok: lang === "ar" ? "تمام" : "OK",
  fix: lang === "ar" ? "يحتاج تعديل" : "Needs fix",

  afterLimit: lang === "ar" ? "بعد الحد" : "After limit",
  allowAddon: lang === "ar" ? "يسمح بإضافات" : "Allow add-ons",
  allowUpgrade: lang === "ar" ? "يسمح بالترقية" : "Allow upgrade",
  hardBlock: lang === "ar" ? "حظر كامل" : "Hard block",
  mode: lang === "ar" ? "Mode" : "Mode",
  allowEntitiesOutsidePlan: lang === "ar" ? "يسمح خارج الخطة" : "Allow outside plan",
  allowedBillingPeriods: lang === "ar" ? "فترات الفوترة" : "Allowed billing periods",
  includedEntities: lang === "ar" ? "الكيانات المشمولة" : "Included entities",
  monthlyIncludedTxLimit: lang === "ar" ? "حد معاملات/شهر" : "Monthly tx limit",

  coversAdminProcessing: lang === "ar" ? "معالجة إدارية" : "Admin processing",
  coversGovernmentFee: lang === "ar" ? "رسوم حكومية" : "Government fee",
  coversPrintingFee: lang === "ar" ? "رسوم طباعة" : "Printing fee",
  coversStripeFee: lang === "ar" ? "رسوم بوابة" : "Stripe fee",
  coversVat: lang === "ar" ? "VAT" : "VAT",

  qty: lang === "ar" ? "عدد المعاملات" : "Qty",
  perTxn: lang === "ar" ? "لكل معاملة" : "Per txn",
  priceMin: lang === "ar" ? "سعر أقل" : "Min price",
  priceMax: lang === "ar" ? "سعر أعلى" : "Max price",
  type: lang === "ar" ? "النوع" : "Type",
});

/* =========================================
   Rules: Billing periods per tier
========================================= */
function defaultAllowedBillingPeriodsForTier(tier) {
  // حسب كلامك:
  // - Starter: سنوي فقط
  // - الباقي: نصف سنوي + سنوي (+ contract موجود في بياناتك)
  if (tier === "starter") return ["yearly"];
  return ["semiannual", "yearly", "contract"];
}

function allowedDurationsForPlan(plan) {
  // allowedBillingPeriods في DB قيمها: semiannual/yearly/contract
  // إحنا هنربط الفترات بـ durations
  const abp = uniq(plan?.allowedBillingPeriods || []);
  const out = [];
  if (abp.includes("semiannual")) out.push("semiannual");
  if (abp.includes("yearly")) out.push("yearly");
  // contract ليس duration تسعير داخل pricing map عندك، فنتجاهله في pricing UI
  return out.length ? out : ["yearly"];
}

function monthsByDuration(dur) {
  if (dur === "monthly") return 1;
  if (dur === "quarterly") return 3;
  if (dur === "semiannual") return 6;
  return 12;
}

/* =========================================
   Normalizers
========================================= */
function normalizePlanDoc(id, data) {
  const d = data || {};
  const pricing = d.pricing || {};
  const perks = d.perks || { ar: [], en: [] };

  const normalizedPricing = {};

  // نضمن وجود مفاتيح pricing الأربعة (لو موجودة قديمة) للحفظ الآمن
  for (const k of DURATIONS_ALL) {
    const v = pricing[k] || {};
    const defaultMonths = monthsByDuration(k);

    const monthsShown = safeNum(v.monthsShown, defaultMonths) || defaultMonths;
    const paidMonths = safeNum(v.paidMonths, monthsShown) || monthsShown;

    normalizedPricing[k] = {
      title: {
        ar: safeStr(v?.title?.ar, DUR_LABELS[k]?.ar || ""),
        en: safeStr(v?.title?.en, DUR_LABELS[k]?.en || ""),
      },
      monthsShown,
      paidMonths,
      bonus: safeNum(v.bonus, 0),
      price: safeNum(v.price, 0),
      tag: safeStr(v.tag, ""),
      best: safeBool(v.best, false),
      currency: safeStr(v.currency, safeStr(d.currency, "AED")),
      stripe: {
        mode: safeStr(v?.stripe?.mode, "subscription"),
        priceId: safeStr(v?.stripe?.priceId, ""),
        productId: safeStr(v?.stripe?.productId, ""),
      },
    };
  }

  // tier ثابت: starter/growth/scale/enterprise
  const rawTier = safeStr(d.tier, safeStr(d.planKey, safeStr(d.key, "starter")));
  const tier = TIER_ORDER.includes(rawTier) ? rawTier : "starter";

  const allowedBillingPeriods = uniq(
    Array.isArray(d.allowedBillingPeriods) && d.allowedBillingPeriods.length
      ? d.allowedBillingPeriods
      : defaultAllowedBillingPeriodsForTier(tier)
  );

  return {
    id,
    key: safeStr(d.key, id),
    planKey: safeStr(d.planKey, safeStr(d.key, id)),
    tier,

    isActive: safeBool(d.isActive, true),
    isVisible: safeBool(d.isVisible, true),
    isMandatory: safeBool(d.isMandatory, false),

    sortIndex: safeNum(d.sortIndex, 0),
    version: safeNum(d.version, 1),

    currency: safeStr(d.currency, "AED"),

    name: { ar: safeStr(d?.name?.ar), en: safeStr(d?.name?.en) },
    fit: { ar: safeStr(d?.fit?.ar), en: safeStr(d?.fit?.en) },

    perks: {
      ar: Array.isArray(perks.ar) ? perks.ar.map((x) => safeStr(x)).filter(Boolean) : [],
      en: Array.isArray(perks.en) ? perks.en.map((x) => safeStr(x)).filter(Boolean) : [],
    },

    afterLimit: {
      allowAddon: safeBool(d?.afterLimit?.allowAddon, true),
      allowUpgrade: safeBool(d?.afterLimit?.allowUpgrade, false),
      hardBlock: safeBool(d?.afterLimit?.hardBlock, false),
      mode: safeStr(d?.afterLimit?.mode, "custom"),
    },

    allowEntitiesOutsidePlan: safeBool(d.allowEntitiesOutsidePlan, true),
    allowedBillingPeriods,
    includedEntities: uniq(Array.isArray(d.includedEntities) ? d.includedEntities : ["all"]),
    monthlyIncludedTxLimit: safeNum(d.monthlyIncludedTxLimit, 0),

    covers: {
      adminProcessing: safeBool(d?.covers?.adminProcessing, true),
      governmentFee: safeBool(d?.covers?.governmentFee, false),
      printingFee: safeBool(d?.covers?.printingFee, true),
      stripeFee: safeBool(d?.covers?.stripeFee, false),
      vat: safeBool(d?.covers?.vat, true),
    },

    pricing: normalizedPricing,

    brand: d.brand && typeof d.brand === "object" ? d.brand : null,
  };
}

function normalizeAddonDoc(id, data) {
  const d = data || {};
  return {
    id,
    addonKey: safeStr(d.addonKey, id),

    isActive: safeBool(d.isActive, true),
    popular: safeBool(d.popular, false),

    currency: safeStr(d.currency, "AED"),
    version: safeNum(d.version, 1),

    title: { ar: safeStr(d?.title?.ar), en: safeStr(d?.title?.en) },
    type: safeStr(d.type, "bundle"),
    qty: safeNum(d.qty, 0),

    perTxn: safeNum(d.perTxn, 0),
    price: safeNum(d.price, 0),
    priceMin: safeNum(d.priceMin, 0),
    priceMax: safeNum(d.priceMax, 0),

    covers: {
      adminProcessing: safeBool(d?.covers?.adminProcessing, true),
      governmentFee: safeBool(d?.covers?.governmentFee, false),
      printingFee: safeBool(d?.covers?.printingFee, true),
      stripeFee: safeBool(d?.covers?.stripeFee, false),
      vat: safeBool(d?.covers?.vat, true),
    },

    stripe: {
      mode: safeStr(d?.stripe?.mode, "payment"),
      priceId: safeStr(d?.stripe?.priceId, ""),
      productId: safeStr(d?.stripe?.productId, ""),
    },
  };
}

/* =========================================
   Toast
========================================= */
function SafeToast({ toast, isAr }) {
  if (!toast) return null;
  return (
    <div
      className={cn(
        "px-3 py-2 rounded-xl text-sm font-extrabold inline-flex items-center gap-2",
        toast.type === "ok"
          ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/20"
          : "bg-rose-500/15 text-rose-100 border border-rose-400/20",
        isAr && "flex-row-reverse"
      )}
    >
      {toast.type === "ok" ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <AlertTriangle className="w-4 h-4" />
      )}
      {toast.msg}
    </div>
  );
}

/* =========================================
   Toggle
========================================= */
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "w-12 h-7 rounded-full border transition relative",
        checked ? "bg-emerald-500/30 border-emerald-400/25" : "bg-white/8 border-white/10"
      )}
    >
      <span
        className={cn(
          "absolute top-1 w-5 h-5 rounded-full transition",
          checked ? "left-6 bg-emerald-300" : "left-1 bg-white/60"
        )}
      />
    </button>
  );
}

/* =========================================
   Main Component
========================================= */
export default function PlansAndAddonsManager({ lang = "ar" }) {
  const t = useMemo(() => uiText(lang), [lang]);
  const isAr = lang === "ar";

  const [activeTab, setActiveTab] = useState("plans");

  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingAddons, setLoadingAddons] = useState(true);

  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);

  const [plans, setPlans] = useState([]);
  const [addons, setAddons] = useState([]);

  const [tabByPlan, setTabByPlan] = useState({});
  const [expandedPlans, setExpandedPlans] = useState({});
  const [expandedAddons, setExpandedAddons] = useState({});

  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  /* ---------------------------
     Load Plans + Addons
  ---------------------------- */
  useEffect(() => {
    const qPlans = fsQuery(collection(firestore, PLANS_COL));
    const unsubPlans = onSnapshot(
      qPlans,
      (snap) => {
        const rows = snap.docs.map((x) => normalizePlanDoc(x.id, x.data()));
        // ترتيب حسب sortIndex ثم ترتيب tiers ثم key
        rows.sort((a, b) => {
          const sa = safeNum(a.sortIndex, 0);
          const sb = safeNum(b.sortIndex, 0);
          if (sa !== sb) return sa - sb;
          const ta = TIER_ORDER.indexOf(a.tier);
          const tb = TIER_ORDER.indexOf(b.tier);
          if (ta !== tb) return ta - tb;
          return String(a.key).localeCompare(String(b.key));
        });
        setPlans(rows);
        setLoadingPlans(false);
      },
      (err) => {
        console.error("Plans snapshot error:", err);
        setPlans([]);
        setLoadingPlans(false);
      }
    );

    const qAddons = fsQuery(collection(firestore, ADDONS_COL));
    const unsubAddons = onSnapshot(
      qAddons,
      (snap) => {
        const rows = snap.docs.map((x) => normalizeAddonDoc(x.id, x.data()));
        rows.sort((a, b) => String(a.addonKey).localeCompare(String(b.addonKey)));
        setAddons(rows);
        setLoadingAddons(false);
      },
      (err) => {
        console.error("Addons snapshot error:", err);
        setAddons([]);
        setLoadingAddons(false);
      }
    );

    return () => {
      unsubPlans();
      unsubAddons();
    };
  }, []);

  /* ---------------------------
     Setters (immutable)
  ---------------------------- */
  const setPlanField = (id, patch) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const setAddonField = (id, patch) => {
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const setPlanNested = (id, path, value) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const copy = deepClone(p);
        let ref = copy;
        for (let i = 0; i < path.length - 1; i++) {
          const k = path[i];
          ref[k] = ref[k] ?? {};
          ref = ref[k];
        }
        ref[path[path.length - 1]] = value;
        return copy;
      })
    );
  };

  const setAddonNested = (id, path, value) => {
    setAddons((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const copy = deepClone(a);
        let ref = copy;
        for (let i = 0; i < path.length - 1; i++) {
          const k = path[i];
          ref[k] = ref[k] ?? {};
          ref = ref[k];
        }
        ref[path[path.length - 1]] = value;
        return copy;
      })
    );
  };

  /* ---------------------------
     Perks helpers
  ---------------------------- */
  const addPerk = (id, locale) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const copy = deepClone(p);
        copy.perks = copy.perks || { ar: [], en: [] };
        copy.perks[locale] = Array.isArray(copy.perks[locale]) ? copy.perks[locale] : [];
        copy.perks[locale].push("");
        return copy;
      })
    );
  };

  const removePerk = (id, locale, idx) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const copy = deepClone(p);
        copy.perks[locale] = (copy.perks?.[locale] || []).filter((_, i) => i !== idx);
        return copy;
      })
    );
  };

  /* ---------------------------
     Validation helpers
  ---------------------------- */
  const sanitizeTag = (tag) => {
    const v = String(tag || "").trim().toLowerCase();
    if (!v) return "";
    if (v === "offer" || v === "most") return v;
    return "";
  };

  const validatePlan = (plan) => {
    const issues = [];

    // تحقق من allowed billing periods حسب tier
    const abp = uniq(plan.allowedBillingPeriods || []);
    if (plan.tier === "starter") {
      if (!abp.includes("yearly") || abp.includes("semiannual")) {
        issues.push("starter: allowedBillingPeriods يجب أن تكون yearly فقط");
      }
    } else {
      if (!abp.includes("semiannual") || !abp.includes("yearly")) {
        issues.push(`${plan.tier}: allowedBillingPeriods يجب أن تحتوي semiannual + yearly`);
      }
    }

    // تحقق من التسعير حسب الفترات المسموح بها
    const allowedDur = allowedDurationsForPlan(plan);
    for (const dur of DURATIONS_UI) {
      const v = plan.pricing?.[dur] || {};
      const monthsShown = safeNum(v.monthsShown, monthsByDuration(dur));
      const paidMonths = safeNum(v.paidMonths, monthsShown);
      const bonus = safeNum(v.bonus, 0);
      const tag = sanitizeTag(v.tag);

      if (allowedDur.includes(dur)) {
        if (monthsShown <= 0) issues.push(`${dur}: monthsShown <= 0`);
        if (paidMonths <= 0) issues.push(`${dur}: paidMonths <= 0`);
        if (bonus < 0) issues.push(`${dur}: bonus < 0`);

        if ((tag === "offer" || bonus > 0) && !isOfferDuration(dur)) {
          issues.push(`${dur}: offer/bonus not allowed (only semiannual/yearly)`);
        }
        if (tag === "most" && dur !== "yearly") {
          issues.push(`${dur}: tag 'most' should be yearly`);
        }
      } else {
        // غير مسموح: لازم ما يكونش فيه سعر/بونص/تاج
        if (safeNum(v.price, 0) > 0) issues.push(`${dur}: غير مسموح لهذه الخطة (price>0)`);
        if (safeNum(v.bonus, 0) > 0) issues.push(`${dur}: غير مسموح لهذه الخطة (bonus>0)`);
        if (String(v.tag || "").trim()) issues.push(`${dur}: غير مسموح لهذه الخطة (tag)`);
      }
    }

    // afterLimit required
    if (!plan.afterLimit || typeof plan.afterLimit !== "object") issues.push("afterLimit: missing");

    return issues;
  };

  /* ---------------------------
     Save Plan
  ---------------------------- */
  const savePlan = async (plan) => {
    try {
      setSavingId(plan.id);
      setToast(null);

      const allowedDur = allowedDurationsForPlan(plan);

      // Build pricing output (يحافظ على مفاتيح pricing الأربعة)
      const pricingOut = Object.fromEntries(
        DURATIONS_ALL.map((k) => {
          const v = plan.pricing?.[k] || {};
          const defaultMonths = monthsByDuration(k);

          let monthsShown = Math.max(1, safeNum(v.monthsShown, defaultMonths));
          let paidMonths = Math.max(1, safeNum(v.paidMonths, monthsShown));
          let bonus = safeNum(v.bonus, 0);
          let tag = sanitizeTag(v.tag);

          // لو duration غير مسموح: صفّر السعر/الbonus/tag وخلّي months default
          const isAllowed = allowedDur.includes(k);
          if (!isAllowed) {
            monthsShown = defaultMonths;
            paidMonths = defaultMonths;
            bonus = 0;
            tag = "";
          }

          // offer/bonus only on semiannual/yearly
          const safeBonus = isOfferDuration(k) ? Math.max(0, bonus) : 0;
          if (!isOfferDuration(k) && tag === "offer") tag = "";
          if (k !== "yearly" && tag === "most") tag = "";

          // Starter سنوي فقط: تأمين إضافي
          if (plan.tier === "starter" && k !== "yearly") {
            bonus = 0;
            tag = "";
          }

          return [
            k,
            {
              title: {
                ar: safeStr(v?.title?.ar, DUR_LABELS[k]?.ar || ""),
                en: safeStr(v?.title?.en, DUR_LABELS[k]?.en || ""),
              },
              monthsShown,
              paidMonths,
              bonus: safeBonus,
              price: isAllowed ? Math.max(0, safeNum(v.price, 0)) : 0,
              tag,
              best: !!v.best,
              currency: safeStr(v.currency, safeStr(plan.currency, "AED")),
              stripe: {
                mode: safeStr(v?.stripe?.mode, "subscription"),
                priceId: safeStr(v?.stripe?.priceId, ""),
                productId: safeStr(v?.stripe?.productId, ""),
              },
            },
          ];
        })
      );

      // Allowed billing periods guardrail
      const allowedBillingPeriods = uniq(plan.allowedBillingPeriods || []);
      const enforcedABP =
        plan.tier === "starter"
          ? ["yearly"]
          : uniq(
              allowedBillingPeriods.length
                ? allowedBillingPeriods
                : defaultAllowedBillingPeriodsForTier(plan.tier)
            );

      // tier guardrail
      const enforcedTier = TIER_ORDER.includes(plan.tier) ? plan.tier : "starter";

      const payload = {
        key: safeStr(plan.key, plan.id),
        planKey: safeStr(plan.planKey, safeStr(plan.key, plan.id)),
        tier: enforcedTier,

        isActive: !!plan.isActive,
        isVisible: !!plan.isVisible,
        isMandatory: !!plan.isMandatory,

        sortIndex: safeNum(plan.sortIndex, 0),
        version: safeNum(plan.version, 1),

        currency: safeStr(plan.currency, "AED"),

        name: { ar: safeStr(plan?.name?.ar), en: safeStr(plan?.name?.en) },
        fit: { ar: safeStr(plan?.fit?.ar), en: safeStr(plan?.fit?.en) },

        perks: {
          ar: Array.isArray(plan?.perks?.ar) ? plan.perks.ar.filter(Boolean) : [],
          en: Array.isArray(plan?.perks?.en) ? plan.perks.en.filter(Boolean) : [],
        },

        // afterLimit كما وصفت
        afterLimit: {
          allowAddon: !!plan?.afterLimit?.allowAddon,
          allowUpgrade: !!plan?.afterLimit?.allowUpgrade,
          hardBlock: !!plan?.afterLimit?.hardBlock,
          mode: safeStr(plan?.afterLimit?.mode, "custom"),
        },

        allowEntitiesOutsidePlan: !!plan.allowEntitiesOutsidePlan,
        allowedBillingPeriods: enforcedABP,
        includedEntities: uniq(plan.includedEntities || ["all"]),
        monthlyIncludedTxLimit: safeNum(plan.monthlyIncludedTxLimit, 0),

        covers: {
          adminProcessing: !!plan?.covers?.adminProcessing,
          governmentFee: !!plan?.covers?.governmentFee,
          printingFee: !!plan?.covers?.printingFee,
          stripeFee: !!plan?.covers?.stripeFee,
          vat: !!plan?.covers?.vat,
        },

        ...(plan.brand ? { brand: plan.brand } : {}),

        pricing: pricingOut,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(firestore, PLANS_COL, plan.id), payload, { merge: true });
      setToast({ type: "ok", msg: t.saved });
    } catch (e) {
      console.error("Save plan error:", e);
      setToast({ type: "err", msg: t.error });
    } finally {
      setSavingId(null);
      setTimeout(() => setToast(null), 2400);
    }
  };

  /* ---------------------------
     Save Addon
  ---------------------------- */
  const saveAddon = async (addon) => {
    try {
      setSavingId(addon.id);
      setToast(null);

      const payload = {
        addonKey: safeStr(addon.addonKey, addon.id),

        isActive: !!addon.isActive,
        popular: !!addon.popular,

        currency: safeStr(addon.currency, "AED"),
        version: safeNum(addon.version, 1),

        title: { ar: safeStr(addon?.title?.ar), en: safeStr(addon?.title?.en) },
        type: safeStr(addon.type, "bundle"),
        qty: Math.max(0, safeNum(addon.qty, 0)),

        perTxn: Math.max(0, safeNum(addon.perTxn, 0)),
        price: Math.max(0, safeNum(addon.price, 0)),
        priceMin: Math.max(0, safeNum(addon.priceMin, 0)),
        priceMax: Math.max(0, safeNum(addon.priceMax, 0)),

        covers: {
          adminProcessing: !!addon?.covers?.adminProcessing,
          governmentFee: !!addon?.covers?.governmentFee,
          printingFee: !!addon?.covers?.printingFee,
          stripeFee: !!addon?.covers?.stripeFee,
          vat: !!addon?.covers?.vat,
        },

        stripe: {
          mode: safeStr(addon?.stripe?.mode, "payment"),
          priceId: safeStr(addon?.stripe?.priceId, ""),
          productId: safeStr(addon?.stripe?.productId, ""),
        },

        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(firestore, ADDONS_COL, addon.id), payload, { merge: true });
      setToast({ type: "ok", msg: t.saved });
    } catch (e) {
      console.error("Save addon error:", e);
      setToast({ type: "err", msg: t.error });
    } finally {
      setSavingId(null);
      setTimeout(() => setToast(null), 2400);
    }
  };

  /* ---------------------------
     Create Plan (4 tiers)
     - default tier = starter
     - starter: yearly only
     - others: semiannual+yearly (+contract in allowedBillingPeriods)
  ---------------------------- */
  const createPlan = async () => {
    try {
      setSavingId("create-plan");
      setToast(null);

      const ref = doc(collection(firestore, PLANS_COL));
      const newId = ref.id;

      const tier = "starter";
      const allowedBillingPeriods = defaultAllowedBillingPeriodsForTier(tier);

      const basePricing = Object.fromEntries(
        DURATIONS_ALL.map((k) => {
          const months = monthsByDuration(k);
          const enabled = tier === "starter" ? k === "yearly" : (k === "semiannual" || k === "yearly");
          return [
            k,
            {
              title: { ar: DUR_LABELS[k]?.ar || "", en: DUR_LABELS[k]?.en || "" },
              monthsShown: months,
              paidMonths: months,
              bonus: 0,
              price: enabled ? 0 : 0,
              tag: "",
              best: false,
              currency: "AED",
              stripe: { mode: "subscription", priceId: "", productId: "" },
            },
          ];
        })
      );

      const payload = {
        key: newId,
        planKey: newId,
        tier,

        isActive: true,
        isVisible: true,
        isMandatory: false,

        sortIndex: plans.length
          ? Math.max(...plans.map((x) => safeNum(x.sortIndex, 0))) + 10
          : 10,
        version: 1,
        currency: "AED",

        name: { ar: "باقة جديدة", en: "New Plan" },
        fit: { ar: "", en: "" },

        perks: { ar: [], en: [] },

        // afterLimit الافتراضي حسب وصفك
        afterLimit: {
          allowAddon: true,
          allowUpgrade: false,
          hardBlock: false,
          mode: "custom",
        },

        allowEntitiesOutsidePlan: true,
        allowedBillingPeriods,
        includedEntities: ["all"],
        monthlyIncludedTxLimit: 0,

        covers: {
          adminProcessing: true,
          governmentFee: false,
          printingFee: true,
          stripeFee: false,
          vat: true,
        },

        pricing: basePricing,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, payload, { merge: true });

      setExpandedPlans((prev) => ({ ...prev, [newId]: true }));
      setTabByPlan((prev) => ({ ...prev, [newId]: "pricing" }));

      setToast({ type: "ok", msg: isAr ? "تم إنشاء باقة جديدة ✅" : "New plan created ✅" });
    } catch (e) {
      console.error("Create plan error:", e);
      setToast({ type: "err", msg: isAr ? "فشل إنشاء الباقة ❌" : "Create plan failed ❌" });
    } finally {
      setSavingId(null);
      setTimeout(() => setToast(null), 2400);
    }
  };

  /* ---------------------------
     Create Addon (extra_5/10/20…)
  ---------------------------- */
  const createAddon = async () => {
    try {
      setSavingId("create-addon");
      setToast(null);

      const now = Date.now();
      const newId = `extra_${now}`; // تقدر تغيّره بعدين لـ extra_5/10/20

      const payload = {
        addonKey: newId,
        isActive: true,
        popular: false,

        currency: "AED",
        version: 1,

        title: { ar: "إضافة جديدة", en: "New Add-on" },
        type: "bundle",
        qty: 0,

        perTxn: 0,
        price: 0,
        priceMin: 0,
        priceMax: 0,

        covers: {
          adminProcessing: true,
          governmentFee: false,
          printingFee: true,
          stripeFee: false,
          vat: true,
        },

        stripe: { mode: "payment", priceId: "", productId: "" },

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(firestore, ADDONS_COL, newId), payload, { merge: true });

      setExpandedAddons((prev) => ({ ...prev, [newId]: true }));

      setToast({ type: "ok", msg: isAr ? "تم إنشاء Add-on جديدة ✅" : "New add-on created ✅" });
    } catch (e) {
      console.error("Create addon error:", e);
      setToast({ type: "err", msg: isAr ? "فشل إنشاء الإضافة ❌" : "Create add-on failed ❌" });
    } finally {
      setSavingId(null);
      setTimeout(() => setToast(null), 2400);
    }
  };

  /* ---------------------------
     Remove Plan
  ---------------------------- */
  const removePlan = async (id) => {
    try {
      const ok = window.confirm(isAr ? "متأكد تريد حذف الباقة؟" : "Delete this plan?");
      if (!ok) return;

      setSavingId(id);
      setToast(null);

      await deleteDoc(doc(firestore, PLANS_COL, id));

      setExpandedPlans((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setTabByPlan((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      setToast({ type: "ok", msg: isAr ? "تم حذف الباقة ✅" : "Plan deleted ✅" });
    } catch (e) {
      console.error("Delete plan error:", e);
      setToast({ type: "err", msg: isAr ? "فشل حذف الباقة ❌" : "Delete plan failed ❌" });
    } finally {
      setSavingId(null);
      setTimeout(() => setToast(null), 2400);
    }
  };

  /* ---------------------------
     Remove Addon
  ---------------------------- */
  const removeAddon = async (id) => {
    try {
      const ok = window.confirm(isAr ? "متأكد تريد حذف الإضافة؟" : "Delete this add-on?");
      if (!ok) return;

      setSavingId(id);
      setToast(null);

      await deleteDoc(doc(firestore, ADDONS_COL, id));

      setExpandedAddons((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      setToast({ type: "ok", msg: isAr ? "تم حذف الإضافة ✅" : "Add-on deleted ✅" });
    } catch (e) {
      console.error("Delete addon error:", e);
      setToast({ type: "err", msg: isAr ? "فشل حذف الإضافة ❌" : "Delete add-on failed ❌" });
    } finally {
      setSavingId(null);
      setTimeout(() => setToast(null), 2400);
    }
  };

  /* ---------------------------
     Filters
  ---------------------------- */
  const filteredPlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter((p) => {
      if (onlyActive && !p.isActive) return false;
      if (!q) return true;
      const hay = `${p.id} ${p.key} ${p.planKey} ${p.tier} ${p.name?.ar || ""} ${p.name?.en || ""} ${
        p.fit?.ar || ""
      } ${p.fit?.en || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [plans, query, onlyActive]);

  const filteredAddons = useMemo(() => {
    const q = query.trim().toLowerCase();
    return addons.filter((a) => {
      if (onlyActive && !a.isActive) return false;
      if (!q) return true;
      const hay = `${a.id} ${a.addonKey} ${a.title?.ar || ""} ${a.title?.en || ""} ${a.type || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [addons, query, onlyActive]);

  const totalActivePlans = useMemo(() => plans.filter((x) => x.isActive).length, [plans]);
  const totalVisiblePlans = useMemo(() => plans.filter((x) => x.isVisible).length, [plans]);
  const totalActiveAddons = useMemo(() => addons.filter((x) => x.isActive).length, [addons]);

  /* ---------------------------
     UI styles
  ---------------------------- */
  const inputBaseDark =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-extrabold text-white/90 shadow-sm outline-none focus:ring-4 transition placeholder:text-white/35";

  /* =========================================
     Render
  ========================================= */
  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#07120d] via-[#071610] to-[#040a07] p-4 sm:p-6 shadow-[0_25px_90px_-55px_rgba(16,185,129,0.35)]">
      {/* Header */}
      <div className={cn("flex items-start justify-between gap-4", isAr && "flex-row-reverse")}>
        <div className={cn(isAr ? "text-right" : "text-left")}>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">{t.pageTitle}</div>
          <div className="text-sm text-white/60 mt-1">{t.pageSub}</div>

          <div className={cn("mt-3 flex items-center gap-2 flex-wrap", isAr && "flex-row-reverse")}>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-extrabold border border-white/10 bg-white/5 text-white/80">
              <LayoutGrid className="w-4 h-4" />
              {isAr ? `الباقات: ${plans.length}` : `Plans: ${plans.length}`}
            </span>

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-extrabold border border-emerald-400/15 bg-emerald-500/10 text-emerald-200">
              <Check className="w-4 h-4" />
              {isAr ? `مفعّل: ${totalActivePlans}` : `Active: ${totalActivePlans}`}
            </span>

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-extrabold border border-sky-400/15 bg-sky-500/10 text-sky-200">
              <Eye className="w-4 h-4" />
              {isAr ? `ظاهر: ${totalVisiblePlans}` : `Visible: ${totalVisiblePlans}`}
            </span>

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-extrabold border border-white/10 bg-white/5 text-white/80">
              <Boxes className="w-4 h-4" />
              {isAr ? `الإضافات: ${addons.length}` : `Add-ons: ${addons.length}`}
            </span>

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-extrabold border border-emerald-400/15 bg-emerald-500/10 text-emerald-200">
              <Check className="w-4 h-4" />
              {isAr ? `مفعّل (إضافات): ${totalActiveAddons}` : `Active (Add-ons): ${totalActiveAddons}`}
            </span>

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-extrabold border border-amber-400/15 bg-amber-500/10 text-amber-200">
              <BadgePercent className="w-4 h-4" />
              {t.helperOffer}
            </span>
          </div>
        </div>

        <div className={cn("flex items-center gap-3", isAr && "flex-row-reverse")}>
          <SafeToast toast={toast} isAr={isAr} />
        </div>
      </div>

      {/* Top Tabs */}
      <div className={cn("mt-5 flex items-center gap-2", isAr && "flex-row-reverse")}>
        <button
          onClick={() => setActiveTab("plans")}
          className={cn(
            "cursor-pointer px-4 py-2 rounded-2xl text-sm font-extrabold border transition inline-flex items-center gap-2",
            activeTab === "plans"
              ? "bg-white text-black border-white"
              : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
          )}
        >
          <WalletCards className="w-4 h-4" />
          {t.tabPlans}
        </button>

        <button
          onClick={() => setActiveTab("addons")}
          className={cn(
            "cursor-pointer px-4 py-2 rounded-2xl text-sm font-extrabold border transition inline-flex items-center gap-2",
            activeTab === "addons"
              ? "bg-white text-black border-white"
              : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
          )}
        >
          <PackagePlus className="w-4 h-4" />
          {t.tabAddons}
        </button>
      </div>

      {/* Toolbar */}
      <div
        className={cn(
          "mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 flex items-center justify-between gap-3",
          isAr && "flex-row-reverse"
        )}
      >
        <div className={cn("flex items-center gap-2 w-full sm:w-auto", isAr && "flex-row-reverse")}>
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-black/20 w-full sm:w-[360px]",
              isAr && "flex-row-reverse"
            )}
          >
            <SlidersHorizontal className="w-4 h-4 text-white/55" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent outline-none text-white/90 font-extrabold placeholder:text-white/35"
              placeholder={t.searchPlaceholder}
            />
          </div>

          <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
            <span className="text-white/70 text-sm font-extrabold">{isAr ? "مفعلة فقط" : "Active only"}</span>
            <Toggle checked={onlyActive} onChange={setOnlyActive} />
          </div>
        </div>

        <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
          <div className="hidden sm:block text-xs text-white/45 font-bold">{t.helperTag}</div>

          {activeTab === "plans" ? (
            <button
              onClick={createPlan}
              disabled={savingId === "create-plan"}
              className={cn(
                "cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold text-white transition active:scale-[0.98]",
                savingId === "create-plan" ? "bg-white/15" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              <PackagePlus className="w-4 h-4" />
              {isAr ? "إضافة باقة" : "Add Plan"}
            </button>
          ) : (
            <button
              onClick={createAddon}
              disabled={savingId === "create-addon"}
              className={cn(
                "cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold text-white transition active:scale-[0.98]",
                savingId === "create-addon" ? "bg-white/15" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              <PackagePlus className="w-4 h-4" />
              {isAr ? "إضافة Add-on" : "Add Add-on"}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mt-5">
        {/* =========================
           PLANS
        ========================== */}
        {activeTab === "plans" ? (
          loadingPlans ? (
            <div className={cn("text-white/70 font-extrabold", isAr && "text-right")}>{t.loadingPlans}</div>
          ) : !filteredPlans.length ? (
            <div className={cn("text-white/60 font-extrabold", isAr && "text-right")}>{t.emptyPlans}</div>
          ) : (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
              {filteredPlans.map((p) => {
                const brand = BRAND[p.tier] || BRAND.starter;
                const Icon = brand.icon || Sparkles;

                const tab = tabByPlan[p.id] || "pricing";
                const open = !!expandedPlans[p.id];

                const issues = validatePlan(p);
                const isOk = issues.length === 0;

                const yearly = p.pricing?.yearly || {};
                const yearlyTag = String(yearly.tag || "").toLowerCase();
                const badge =
                  yearly.best || yearlyTag === "most"
                    ? isAr
                      ? "الأكثر اختيارًا"
                      : "Most chosen"
                    : null;

                return (
                  <div
                    key={p.id}
                    className={cn(
                      "rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden ring-1",
                      brand.ring,
                      open ? brand.glow : ""
                    )}
                  >
                    <div className={cn("h-[5px] bg-gradient-to-r", brand.bar)} />

                    {/* header */}
                    <button
                      type="button"
                      onClick={() => setExpandedPlans((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                      className={cn(
                        "w-full p-4 sm:p-5 flex items-start justify-between gap-3 text-left cursor-pointer",
                        isAr && "flex-row-reverse text-right"
                      )}
                    >
                      <div className={cn("flex items-start gap-3 min-w-0", isAr && "flex-row-reverse")}>
                        <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-white/80" />
                        </div>

                        <div className="min-w-0">
                          <div className={cn("flex items-center gap-2 flex-wrap", isAr && "flex-row-reverse")}>
                            <div className="font-extrabold text-lg text-white truncate">
                              {p.name?.[isAr ? "ar" : "en"] || p.key || p.planKey || p.id}
                            </div>

                            {badge ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-white text-black">
                                {badge}
                              </span>
                            ) : null}

                            <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-extrabold border", brand.chipDark)}>
                              <Tag className={cn("w-3.5 h-3.5 inline-block -mt-[2px]", isAr ? "ml-1" : "mr-1")} />
                              {p.tier.toUpperCase()}
                            </span>

                            <span
                              className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] font-extrabold border",
                                isOk
                                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                  : "border-amber-400/20 bg-amber-500/10 text-amber-200"
                              )}
                            >
                              {isOk ? t.ok : t.fix}
                            </span>

                            <span
                              className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] font-extrabold border",
                                p.isVisible
                                  ? "border-sky-400/20 bg-sky-500/10 text-sky-200"
                                  : "border-white/10 bg-white/5 text-white/60"
                              )}
                            >
                              {t.visible}: {p.isVisible ? (isAr ? "نعم" : "Yes") : isAr ? "لا" : "No"}
                            </span>

                            {p.isMandatory ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-200">
                                {t.mandatory}
                              </span>
                            ) : null}
                          </div>

                          {p.fit?.[isAr ? "ar" : "en"] ? (
                            <div className="text-sm text-white/60 mt-1 line-clamp-2">{p.fit?.[isAr ? "ar" : "en"]}</div>
                          ) : null}

                          <div className={cn("mt-2 flex items-center gap-2 flex-wrap", isAr && "flex-row-reverse")}>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/25 text-white/70 border border-white/10">
                              {t.planKey}: {p.planKey || p.key || p.id}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/25 text-white/70 border border-white/10">
                              {t.sortIndex}: {p.sortIndex}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/25 text-white/70 border border-white/10">
                              {t.version}: {p.version}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={cn("flex items-center gap-3 shrink-0", isAr && "flex-row-reverse")}>
                        <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                          <span className="text-white/65 text-sm font-extrabold">{t.visible}</span>
                          <Toggle checked={!!p.isVisible} onChange={(v) => setPlanField(p.id, { isVisible: v })} />
                        </div>

                        <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                          <span className="text-white/65 text-sm font-extrabold">{t.active}</span>
                          <Toggle checked={!!p.isActive} onChange={(v) => setPlanField(p.id, { isActive: v })} />
                        </div>

                        <div
                          className={cn(
                            "w-10 h-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center transition",
                            open ? "rotate-180" : ""
                          )}
                        >
                          <span className="text-white/70 font-extrabold">⌄</span>
                        </div>
                      </div>
                    </button>

                    {/* expanded */}
                    {open ? (
                      <div className="px-4 sm:px-5 pb-5">
                        {/* tabs */}
                        <div className={cn("mt-4 flex items-center gap-2 flex-wrap", isAr && "flex-row-reverse")}>
                          {[
                            { k: "pricing", label: t.tabPricing, icon: WalletCards },
                            { k: "perks", label: t.tabPerks, icon: Sparkles },
                            { k: "rules", label: t.tabRules, icon: Settings2 },
                            { k: "covers", label: t.tabCovers, icon: Shield },
                            { k: "stripe", label: t.tabStripe, icon: Tag },
                            { k: "meta", label: t.tabMeta, icon: SlidersHorizontal },
                          ].map((x) => {
                            const Ico = x.icon;
                            return (
                              <button
                                key={x.k}
                                onClick={() => setTabByPlan((prev) => ({ ...prev, [p.id]: x.k }))}
                                className={cn(
                                  "cursor-pointer px-3 py-2 rounded-xl text-sm font-extrabold border transition inline-flex items-center gap-2",
                                  tab === x.k
                                    ? "bg-white text-black border-white"
                                    : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                                )}
                              >
                                <Ico className="w-4 h-4" />
                                {x.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* ====== PLAN EDITOR ====== */}
                        {tab === "pricing" ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                            {(() => {
                              const allowedDur = allowedDurationsForPlan(p);
                              return DURATIONS_UI.map((dur) => {
                                const enabled = allowedDur.includes(dur);
                                const v = p.pricing?.[dur] || {};
                                return (
                                  <div key={dur} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className={cn("flex items-center justify-between gap-2", isAr && "flex-row-reverse")}>
                                      <div className="text-white font-extrabold">
                                        {DUR_LABELS[dur]?.[isAr ? "ar" : "en"] || dur}
                                      </div>
                                      <div className="text-xs text-white/45 font-bold">
                                        {!enabled
                                          ? isAr
                                            ? "غير متاح لهذه الباقة"
                                            : "Not enabled for this plan"
                                          : isOfferDuration(dur)
                                          ? isAr
                                            ? "يسمح بعرض/بونص"
                                            : "Offer allowed"
                                          : isAr
                                          ? "بدون عروض"
                                          : "No offer"}
                                      </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-2">
                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.monthsShown}</div>
                                        <input
                                          type="number"
                                          value={v.monthsShown ?? monthsByDuration(dur)}
                                          onChange={(e) =>
                                            setPlanNested(p.id, ["pricing", dur, "monthsShown"], Number(e.target.value || monthsByDuration(dur)))
                                          }
                                          className={cn(inputBaseDark, brand.focus)}
                                          disabled={!enabled}
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.paidMonths}</div>
                                        <input
                                          type="number"
                                          value={v.paidMonths ?? monthsByDuration(dur)}
                                          onChange={(e) =>
                                            setPlanNested(p.id, ["pricing", dur, "paidMonths"], Number(e.target.value || monthsByDuration(dur)))
                                          }
                                          className={cn(inputBaseDark, brand.focus)}
                                          disabled={!enabled}
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.bonus}</div>
                                        <input
                                          type="number"
                                          value={v.bonus ?? 0}
                                          onChange={(e) => setPlanNested(p.id, ["pricing", dur, "bonus"], Number(e.target.value || 0))}
                                          className={cn(inputBaseDark, brand.focus)}
                                          disabled={!enabled}
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.price}</div>
                                        <input
                                          type="number"
                                          value={v.price ?? 0}
                                          onChange={(e) => setPlanNested(p.id, ["pricing", dur, "price"], Number(e.target.value || 0))}
                                          className={cn(inputBaseDark, brand.focus)}
                                          disabled={!enabled}
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.tag}</div>
                                        <input
                                          value={v.tag || ""}
                                          onChange={(e) => setPlanNested(p.id, ["pricing", dur, "tag"], e.target.value)}
                                          className={cn(inputBaseDark, brand.focus)}
                                          placeholder="offer / most"
                                          disabled={!enabled}
                                        />
                                      </div>
                                      <div className={cn("flex items-end justify-between gap-2", isAr && "flex-row-reverse")}>
                                        <div className="w-full">
                                          <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.best}</div>
                                          <div
                                            className={cn(
                                              "flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2",
                                              isAr && "flex-row-reverse",
                                              !enabled && "opacity-60"
                                            )}
                                          >
                                            <span className="text-white/75 font-extrabold text-sm">{isAr ? "تمييز" : "Highlight"}</span>
                                            <Toggle
                                              checked={!!v.best}
                                              onChange={(val) => setPlanNested(p.id, ["pricing", dur, "best"], val)}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Stripe IDs per duration */}
                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.stripeMode}</div>
                                        <input
                                          value={v?.stripe?.mode || "subscription"}
                                          onChange={(e) => setPlanNested(p.id, ["pricing", dur, "stripe", "mode"], e.target.value.trim())}
                                          className={cn(inputBaseDark, brand.focus)}
                                          placeholder="subscription"
                                          disabled={!enabled}
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.stripePriceId}</div>
                                        <input
                                          value={v?.stripe?.priceId || ""}
                                          onChange={(e) => setPlanNested(p.id, ["pricing", dur, "stripe", "priceId"], e.target.value.trim())}
                                          className={cn(inputBaseDark, brand.focus)}
                                          placeholder="price_..."
                                          disabled={!enabled}
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.stripeProductId}</div>
                                        <input
                                          value={v?.stripe?.productId || ""}
                                          onChange={(e) => setPlanNested(p.id, ["pricing", dur, "stripe", "productId"], e.target.value.trim())}
                                          className={cn(inputBaseDark, brand.focus)}
                                          placeholder="prod_..."
                                          disabled={!enabled}
                                        />
                                      </div>
                                    </div>

                                    {!enabled ? (
                                      <div className={cn("mt-3 text-xs font-bold text-white/45", isAr && "text-right")}>
                                        {isAr
                                          ? "هذه المدة غير مفعلة في allowedBillingPeriods لهذه الباقة."
                                          : "This duration is disabled by allowedBillingPeriods for this plan."}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        ) : null}

                        {tab === "perks" ? (
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(["ar", "en"]).map((locale) => (
                              <div key={locale} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className={cn("flex items-center justify-between", isAr && "flex-row-reverse")}>
                                  <div className="text-sm font-extrabold text-white">
                                    {locale === "ar"
                                      ? isAr
                                        ? "المميزات (عربي)"
                                        : "Perks (AR)"
                                      : isAr
                                      ? "المميزات (English)"
                                      : "Perks (EN)"}
                                  </div>
                                  <button
                                    onClick={() => addPerk(p.id, locale)}
                                    className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white"
                                  >
                                    <Sparkles className="w-4 h-4" /> {t.addPerk}
                                  </button>
                                </div>

                                <div className="mt-3 space-y-2">
                                  {(p.perks?.[locale] || []).map((val, idx) => (
                                    <div key={idx} className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                                      <input
                                        value={val}
                                        onChange={(e) => setPlanNested(p.id, ["perks", locale, idx], e.target.value)}
                                        className={cn(inputBaseDark, brand.focus)}
                                        placeholder={isAr ? "اكتب الميزة..." : "Type perk..."}
                                      />
                                      <button
                                        onClick={() => removePerk(p.id, locale, idx)}
                                        className="cursor-pointer px-3 py-2 rounded-xl font-extrabold border border-rose-400/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
                                      >
                                        {t.remove}
                                      </button>
                                    </div>
                                  ))}
                                </div>

                                {/* Hint: Add-ons keys */}
                                <div className={cn("mt-4 text-xs font-bold text-white/45", isAr && "text-right")}>
                                  {isAr
                                    ? "ملاحظة: الإضافات (extra_5 / extra_10 / extra_20) تُدار من تبويب Add-ons وليست داخل perks."
                                    : "Note: Add-ons (extra_5/extra_10/extra_20) are managed in Add-ons tab, not inside perks."}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {tab === "rules" ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {[
                                { path: ["afterLimit", "allowAddon"], label: t.allowAddon },
                                { path: ["afterLimit", "allowUpgrade"], label: t.allowUpgrade },
                                { path: ["afterLimit", "hardBlock"], label: t.hardBlock },
                                { path: ["allowEntitiesOutsidePlan"], label: t.allowEntitiesOutsidePlan },
                              ].map((x, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3",
                                    isAr && "flex-row-reverse"
                                  )}
                                >
                                  <span className="text-white/80 font-extrabold">{x.label}</span>
                                  <Toggle
                                    checked={
                                      !!(x.path[0] === "allowEntitiesOutsidePlan"
                                        ? p.allowEntitiesOutsidePlan
                                        : p?.[x.path[0]]?.[x.path[1]])
                                    }
                                    onChange={(v) =>
                                      x.path[0] === "allowEntitiesOutsidePlan"
                                        ? setPlanField(p.id, { allowEntitiesOutsidePlan: v })
                                        : setPlanNested(p.id, x.path, v)
                                    }
                                  />
                                </div>
                              ))}

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.mode}</div>
                                <input
                                  value={p.afterLimit?.mode || "custom"}
                                  onChange={(e) => setPlanNested(p.id, ["afterLimit", "mode"], e.target.value.trim())}
                                  className={cn(inputBaseDark, brand.focus)}
                                  placeholder="custom"
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.monthlyIncludedTxLimit}</div>
                                <input
                                  type="number"
                                  value={p.monthlyIncludedTxLimit ?? 0}
                                  onChange={(e) => setPlanField(p.id, { monthlyIncludedTxLimit: Number(e.target.value || 0) })}
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.allowedBillingPeriods}</div>
                                <input
                                  value={(p.allowedBillingPeriods || []).join(", ")}
                                  onChange={(e) =>
                                    setPlanField(p.id, {
                                      allowedBillingPeriods: uniq(e.target.value.split(",").map((s) => s.trim())),
                                    })
                                  }
                                  className={cn(inputBaseDark, brand.focus)}
                                  placeholder="semiannual, yearly, contract"
                                  disabled={p.tier === "starter"} // Starter ثابت سنوي فقط
                                />
                                {p.tier === "starter" ? (
                                  <div className={cn("mt-2 text-xs font-bold text-white/45", isAr && "text-right")}>
                                    {isAr ? "Starter: ثابت سنوي فقط" : "Starter: locked to yearly only"}
                                  </div>
                                ) : null}
                              </div>

                              <div className="sm:col-span-2">
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.includedEntities}</div>
                                <input
                                  value={(p.includedEntities || []).join(", ")}
                                  onChange={(e) =>
                                    setPlanField(p.id, {
                                      includedEntities: uniq(e.target.value.split(",").map((s) => s.trim())),
                                    })
                                  }
                                  className={cn(inputBaseDark, brand.focus)}
                                  placeholder="all"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <div className={cn("mt-2 text-xs font-bold text-white/45", isAr && "text-right")}>
                                  {isAr
                                    ? "مهم: Starter سنوي فقط. Growth/Scale/Enterprise نصف سنوي + سنوي (والـ contract كخيار فوترة)."
                                    : "Important: Starter is yearly-only. Others are semiannual + yearly (contract allowed as billing option)."}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {tab === "covers" ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {[
                                { k: "adminProcessing", label: t.coversAdminProcessing },
                                { k: "governmentFee", label: t.coversGovernmentFee },
                                { k: "printingFee", label: t.coversPrintingFee },
                                { k: "stripeFee", label: t.coversStripeFee },
                                { k: "vat", label: t.coversVat },
                              ].map((x) => (
                                <div
                                  key={x.k}
                                  className={cn(
                                    "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3",
                                    isAr && "flex-row-reverse"
                                  )}
                                >
                                  <span className="text-white/80 font-extrabold">{x.label}</span>
                                  <Toggle checked={!!p?.covers?.[x.k]} onChange={(v) => setPlanNested(p.id, ["covers", x.k], v)} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {tab === "stripe" ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="text-sm text-white/70 font-extrabold">
                              {isAr ? "Stripe موجود داخل كل مدة في Pricing (priceId / productId)" : "Stripe is configured per duration in Pricing"}
                            </div>
                            <div className="text-xs text-white/45 font-bold mt-2">
                              {isAr
                                ? "ملاحظة: Starter سنوي فقط، والباقي نصف سنوي + سنوي."
                                : "Note: Starter is yearly-only; others have semiannual + yearly."}
                            </div>
                          </div>
                        ) : null}

                        {tab === "meta" ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.planKey}</div>
                                <input
                                  value={p.planKey}
                                  onChange={(e) => setPlanField(p.id, { planKey: e.target.value.trim() })}
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.key}</div>
                                <input
                                  value={p.key}
                                  onChange={(e) => setPlanField(p.id, { key: e.target.value.trim() })}
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.sortIndex}</div>
                                <input
                                  type="number"
                                  value={p.sortIndex ?? 0}
                                  onChange={(e) => setPlanField(p.id, { sortIndex: Number(e.target.value || 0) })}
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.version}</div>
                                <input
                                  type="number"
                                                                    value={p.version ?? 1}
                                  onChange={(e) => setPlanField(p.id, { version: Number(e.target.value || 1) })}
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.currency}</div>
                                <input
                                  value={p.currency || "AED"}
                                  onChange={(e) => setPlanField(p.id, { currency: e.target.value.trim() || "AED" })}
                                  className={cn(inputBaseDark, brand.focus)}
                                  placeholder="AED"
                                />
                              </div>

                              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.nameAr}</div>
                                  <input
                                    value={p?.name?.ar || ""}
                                    onChange={(e) => setPlanNested(p.id, ["name", "ar"], e.target.value)}
                                    className={cn(inputBaseDark, brand.focus)}
                                    placeholder={isAr ? "اسم الباقة بالعربي" : "Plan name in Arabic"}
                                  />
                                </div>
                                <div>
                                  <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.nameEn}</div>
                                  <input
                                    value={p?.name?.en || ""}
                                    onChange={(e) => setPlanNested(p.id, ["name", "en"], e.target.value)}
                                    className={cn(inputBaseDark, brand.focus)}
                                    placeholder={isAr ? "اسم الباقة بالإنجليزي" : "Plan name in English"}
                                  />
                                </div>
                              </div>

                              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.fitAr}</div>
                                  <input
                                    value={p?.fit?.ar || ""}
                                    onChange={(e) => setPlanNested(p.id, ["fit", "ar"], e.target.value)}
                                    className={cn(inputBaseDark, brand.focus)}
                                    placeholder={isAr ? "وصف مختصر بالعربي..." : "Short fit (AR)..."}
                                  />
                                </div>
                                <div>
                                  <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.fitEn}</div>
                                  <input
                                    value={p?.fit?.en || ""}
                                    onChange={(e) => setPlanNested(p.id, ["fit", "en"], e.target.value)}
                                    className={cn(inputBaseDark, brand.focus)}
                                    placeholder={isAr ? "وصف مختصر بالإنجليزي..." : "Short fit (EN)..."}
                                  />
                                </div>
                              </div>

                              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div
                                  className={cn(
                                    "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3",
                                    isAr && "flex-row-reverse"
                                  )}
                                >
                                  <span className="text-white/80 font-extrabold">{t.mandatory}</span>
                                  <Toggle checked={!!p.isMandatory} onChange={(v) => setPlanField(p.id, { isMandatory: v })} />
                                </div>

                                <div
                                  className={cn(
                                    "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3",
                                    isAr && "flex-row-reverse"
                                  )}
                                >
                                  <span className="text-white/80 font-extrabold">{t.active}</span>
                                  <Toggle checked={!!p.isActive} onChange={(v) => setPlanField(p.id, { isActive: v })} />
                                </div>
                              </div>

                              {/* Issues box */}
                              <div className="sm:col-span-2">
                                {issues.length ? (
                                  <div className={cn("rounded-2xl border border-amber-400/15 bg-amber-500/10 p-4", isAr && "text-right")}>
                                    <div className="text-amber-200 font-extrabold mb-2">
                                      {isAr ? "ملاحظات تحتاج تعديل:" : "Issues to fix:"}
                                    </div>
                                    <ul className={cn("text-amber-100/90 text-xs font-bold space-y-1", isAr && "pr-4")}>
                                      {issues.map((x, i) => (
                                        <li key={i} className={cn(isAr ? "list-disc" : "list-disc ml-4")}>
                                          {x}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <div className={cn("rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4", isAr && "text-right")}>
                                    <div className="text-emerald-200 font-extrabold">
                                      {isAr ? "كل شيء تمام ✅" : "All good ✅"}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* Footer actions */}
                        <div className={cn("mt-4 flex items-center justify-between gap-2", isAr && "flex-row-reverse")}>
                          <button
                            onClick={() => removePlan(p.id)}
                            disabled={savingId === p.id}
                            className={cn(
                              "cursor-pointer px-4 py-2 rounded-2xl font-extrabold border transition",
                              "border-rose-400/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15",
                              savingId === p.id && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            {t.remove}
                          </button>

                          <button
                            onClick={() => savePlan(p)}
                            disabled={savingId === p.id}
                            className={cn(
                              "cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold text-white transition active:scale-[0.98]",
                              savingId === p.id ? "bg-white/15" : brand.btn
                            )}
                          >
                            <Save className="w-4 h-4" />
                            {savingId === p.id ? t.saving : t.save}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : null}

        {/* =========================
           ADDONS
        ========================== */}
        {activeTab === "addons" ? (
          loadingAddons ? (
            <div className={cn("text-white/70 font-extrabold", isAr && "text-right")}>{t.loadingAddons}</div>
          ) : !filteredAddons.length ? (
            <div className={cn("text-white/60 font-extrabold", isAr && "text-right")}>{t.emptyAddons}</div>
          ) : (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
              {filteredAddons.map((a) => {
                const open = !!expandedAddons[a.id];
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden ring-1 ring-white/10"
                    )}
                  >
                    <div className="h-[5px] bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />

                    {/* header */}
                    <button
                      type="button"
                      onClick={() => setExpandedAddons((prev) => ({ ...prev, [a.id]: !prev[a.id] }))}
                      className={cn(
                        "w-full p-4 sm:p-5 flex items-start justify-between gap-3 text-left cursor-pointer",
                        isAr && "flex-row-reverse text-right"
                      )}
                    >
                      <div className={cn("flex items-start gap-3 min-w-0", isAr && "flex-row-reverse")}>
                        <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                          <Boxes className="w-5 h-5 text-white/80" />
                        </div>

                        <div className="min-w-0">
                          <div className={cn("flex items-center gap-2 flex-wrap", isAr && "flex-row-reverse")}>
                            <div className="font-extrabold text-lg text-white truncate">
                              {a.title?.[isAr ? "ar" : "en"] || a.addonKey || a.id}
                            </div>

                            <span
                              className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] font-extrabold border",
                                a.isActive
                                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                  : "border-white/10 bg-white/5 text-white/60"
                              )}
                            >
                              {t.active}: {a.isActive ? (isAr ? "نعم" : "Yes") : isAr ? "لا" : "No"}
                            </span>

                            {a.popular ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-amber-400/20 bg-amber-500/10 text-amber-200">
                                {t.popular}
                              </span>
                            ) : null}

                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/25 text-white/70 border border-white/10">
                              {t.addonKey}: {a.addonKey}
                            </span>

                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/25 text-white/70 border border-white/10">
                              {t.version}: {a.version}
                            </span>
                          </div>

                          <div className={cn("mt-2 flex items-center gap-2 flex-wrap", isAr && "flex-row-reverse")}>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/25 text-white/70 border border-white/10">
                              {t.type}: {a.type || "bundle"}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/25 text-white/70 border border-white/10">
                              {t.qty}: {a.qty}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/25 text-white/70 border border-white/10">
                              {t.price}: {a.price}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={cn("flex items-center gap-3 shrink-0", isAr && "flex-row-reverse")}>
                        <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                          <span className="text-white/65 text-sm font-extrabold">{t.popular}</span>
                          <Toggle checked={!!a.popular} onChange={(v) => setAddonField(a.id, { popular: v })} />
                        </div>

                        <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                          <span className="text-white/65 text-sm font-extrabold">{t.active}</span>
                          <Toggle checked={!!a.isActive} onChange={(v) => setAddonField(a.id, { isActive: v })} />
                        </div>

                        <div
                          className={cn(
                            "w-10 h-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center transition",
                            open ? "rotate-180" : ""
                          )}
                        >
                          <span className="text-white/70 font-extrabold">⌄</span>
                        </div>
                      </div>
                    </button>

                    {/* expanded */}
                    {open ? (
                      <div className="px-4 sm:px-5 pb-5">
                        <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.addonKey}</div>
                              <input
                                value={a.addonKey || ""}
                                onChange={(e) => setAddonField(a.id, { addonKey: e.target.value.trim() })}
                                className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                                placeholder="extra_10"
                              />
                            </div>

                            <div>
                              <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.version}</div>
                              <input
                                type="number"
                                value={a.version ?? 1}
                                onChange={(e) => setAddonField(a.id, { version: Number(e.target.value || 1) })}
                                className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                              />
                            </div>

                            <div>
                              <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.nameAr}</div>
                              <input
                                value={a?.title?.ar || ""}
                                onChange={(e) => setAddonNested(a.id, ["title", "ar"], e.target.value)}
                                className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                                placeholder={isAr ? "اسم الإضافة بالعربي" : "Add-on title (AR)"}
                              />
                            </div>

                            <div>
                              <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.nameEn}</div>
                              <input
                                value={a?.title?.en || ""}
                                onChange={(e) => setAddonNested(a.id, ["title", "en"], e.target.value)}
                                className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                                placeholder={isAr ? "اسم الإضافة بالإنجليزي" : "Add-on title (EN)"}
                              />
                            </div>

                            <div>
                              <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.type}</div>
                              <input
                                value={a.type || "bundle"}
                                onChange={(e) => setAddonField(a.id, { type: e.target.value.trim() })}
                                className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                                placeholder="bundle"
                              />
                            </div>

                            <div>
                              <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.currency}</div>
                              <input
                                value={a.currency || "AED"}
                                onChange={(e) => setAddonField(a.id, { currency: e.target.value.trim() || "AED" })}
                                className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                                placeholder="AED"
                              />
                            </div>

                            <div>
                              <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.qty}</div>
                              <input
                                type="number"
                                value={a.qty ?? 0}
                                onChange={(e) => setAddonField(a.id, { qty: Number(e.target.value || 0) })}
                                className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                              />
                            </div>

                            <div>
                              <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.perTxn}</div>
                              <input
                                type="number"
                                value={a.perTxn ?? 0}
                                onChange={(e) => setAddonField(a.id, { perTxn: Number(e.target.value || 0) })}
                                className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                              />
                            </div>

                            <div>
                              <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.price}</div>
                              <input
                                type="number"
                                value={a.price ?? 0}
                                onChange={(e) => setAddonField(a.id, { price: Number(e.target.value || 0) })}
                                className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.priceMin}</div>
                                <input
                                  type="number"
                                  value={a.priceMin ?? 0}
                                  onChange={(e) => setAddonField(a.id, { priceMin: Number(e.target.value || 0) })}
                                  className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                                />
                              </div>
                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.priceMax}</div>
                                <input
                                  type="number"
                                  value={a.priceMax ?? 0}
                                  onChange={(e) => setAddonField(a.id, { priceMax: Number(e.target.value || 0) })}
                                  className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                                />
                              </div>
                            </div>

                            {/* Covers */}
                            <div className="sm:col-span-2 mt-1">
                              <div className={cn("text-white/80 font-extrabold mb-2", isAr && "text-right")}>{t.tabCovers}</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                  { k: "adminProcessing", label: t.coversAdminProcessing },
                                  { k: "governmentFee", label: t.coversGovernmentFee },
                                  { k: "printingFee", label: t.coversPrintingFee },
                                  { k: "stripeFee", label: t.coversStripeFee },
                                  { k: "vat", label: t.coversVat },
                                ].map((x) => (
                                  <div
                                    key={x.k}
                                    className={cn(
                                      "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3",
                                      isAr && "flex-row-reverse"
                                    )}
                                  >
                                    <span className="text-white/80 font-extrabold">{x.label}</span>
                                    <Toggle checked={!!a?.covers?.[x.k]} onChange={(v) => setAddonNested(a.id, ["covers", x.k], v)} />
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Stripe */}
                            <div className="sm:col-span-2 mt-2">
                              <div className={cn("text-white/80 font-extrabold mb-2", isAr && "text-right")}>{t.tabStripe}</div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                  <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.stripeMode}</div>
                                  <input
                                    value={a?.stripe?.mode || "payment"}
                                    onChange={(e) => setAddonNested(a.id, ["stripe", "mode"], e.target.value.trim())}
                                    className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                                    placeholder="payment"
                                  />
                                </div>
                                <div>
                                  <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.stripePriceId}</div>
                                  <input
                                    value={a?.stripe?.priceId || ""}
                                    onChange={(e) => setAddonNested(a.id, ["stripe", "priceId"], e.target.value.trim())}
                                    className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                                    placeholder="price_..."
                                  />
                                </div>
                                <div>
                                  <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.stripeProductId}</div>
                                  <input
                                    value={a?.stripe?.productId || ""}
                                    onChange={(e) => setAddonNested(a.id, ["stripe", "productId"], e.target.value.trim())}
                                    className={cn(inputBaseDark, "focus:ring-emerald-500/30")}
                                    placeholder="prod_..."
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer actions */}
                        <div className={cn("mt-4 flex items-center justify-between gap-2", isAr && "flex-row-reverse")}>
                          <button
                            onClick={() => removeAddon(a.id)}
                            disabled={savingId === a.id}
                            className={cn(
                              "cursor-pointer px-4 py-2 rounded-2xl font-extrabold border transition",
                              "border-rose-400/25 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15",
                              savingId === a.id && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            {t.remove}
                          </button>

                          <button
                            onClick={() => saveAddon(a)}
                            disabled={savingId === a.id}
                            className={cn(
                              "cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold text-white transition active:scale-[0.98]",
                              savingId === a.id ? "bg-white/15" : "bg-emerald-600 hover:bg-emerald-700"
                            )}
                          >
                            <Save className="w-4 h-4" />
                            {savingId === a.id ? t.saving : t.save}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
