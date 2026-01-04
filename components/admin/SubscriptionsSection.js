"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
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
} from "lucide-react";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

const COLLECTION = "companySubscriptionPlans";
const DURATION_ORDER = ["monthly", "quarterly", "semiannual", "yearly"];
const DUR_LABELS = {
  monthly: { ar: "شهري", en: "Monthly" },
  quarterly: { ar: "3 شهور", en: "3 Months" },
  semiannual: { ar: "نصف سنوي", en: "Semiannual" },
  yearly: { ar: "سنوي", en: "Yearly" },
};

const isOfferDuration = (k) => k === "semiannual" || k === "yearly";

/** ✅ Visual identity per plan (fits green admin theme) */
const BRAND = {
  starter: {
    icon: Zap,
    bar: "from-emerald-400 via-emerald-500 to-emerald-600",
    ring: "ring-emerald-500/20",
    chip: "bg-emerald-500/12 text-emerald-700 border-emerald-500/20",
    chipDark: "bg-emerald-500/14 text-emerald-200 border-emerald-400/20",
    btn: "bg-emerald-600 hover:bg-emerald-700",
    focus: "focus:ring-emerald-500/30",
    glow: "shadow-[0_30px_110px_-70px_rgba(16,185,129,0.45)]",
  },
  growth: {
    icon: Sparkles,
    bar: "from-cyan-400 via-sky-500 to-blue-600",
    ring: "ring-sky-500/20",
    chip: "bg-sky-500/12 text-sky-700 border-sky-500/20",
    chipDark: "bg-sky-500/14 text-sky-200 border-sky-400/20",
    btn: "bg-sky-600 hover:bg-sky-700",
    focus: "focus:ring-sky-500/30",
    glow: "shadow-[0_30px_110px_-70px_rgba(56,189,248,0.40)]",
  },
  scale: {
    icon: Shield,
    bar: "from-violet-400 via-purple-500 to-fuchsia-600",
    ring: "ring-purple-500/20",
    chip: "bg-purple-500/12 text-purple-700 border-purple-500/20",
    chipDark: "bg-purple-500/14 text-purple-200 border-purple-400/20",
    btn: "bg-purple-600 hover:bg-purple-700",
    focus: "focus:ring-purple-500/30",
    glow: "shadow-[0_30px_110px_-70px_rgba(168,85,247,0.40)]",
  },
  enterprise: {
    icon: Crown,
    bar: "from-rose-400 via-red-500 to-orange-600",
    ring: "ring-rose-500/20",
    chip: "bg-rose-500/12 text-rose-700 border-rose-500/20",
    chipDark: "bg-rose-500/14 text-rose-200 border-rose-400/20",
    btn: "bg-rose-600 hover:bg-rose-700",
    focus: "focus:ring-rose-500/30",
    glow: "shadow-[0_30px_110px_-70px_rgba(244,63,94,0.40)]",
  },
};

const uiText = (lang) => ({
  title: lang === "ar" ? "اشتراكات الشركات" : "Company Subscriptions",
  subtitle:
    lang === "ar"
      ? "لوحة تحكم كاملة للباقات والأسعار والمميزات (Live)"
      : "Manage plans, pricing & perks (Live)",
  loading: lang === "ar" ? "جاري تحميل الباقات..." : "Loading plans...",
  empty: lang === "ar" ? "لا توجد باقات." : "No plans found.",
  save: lang === "ar" ? "حفظ" : "Save",
  saving: lang === "ar" ? "جاري الحفظ..." : "Saving...",
  saved: lang === "ar" ? "تم الحفظ ✅" : "Saved ✅",
  error: lang === "ar" ? "خطأ في الحفظ ❌" : "Save failed ❌",
  active: lang === "ar" ? "مفعلة" : "Active",
  sortIndex: lang === "ar" ? "الترتيب" : "Sort",
  key: lang === "ar" ? "Key" : "Key",
  nameAr: lang === "ar" ? "اسم (عربي)" : "Name (AR)",
  nameEn: lang === "ar" ? "اسم (English)" : "Name (EN)",
  fitAr: lang === "ar" ? "وصف مختصر (عربي)" : "Short fit (AR)",
  fitEn: lang === "ar" ? "وصف مختصر (English)" : "Short fit (EN)",

  tabPerks: lang === "ar" ? "المميزات" : "Perks",
  tabPricing: lang === "ar" ? "الأسعار" : "Pricing",
  tabMeta: lang === "ar" ? "البيانات" : "Meta",

  addPerk: lang === "ar" ? "إضافة ميزة" : "Add perk",
  remove: lang === "ar" ? "حذف" : "Remove",

  duration: lang === "ar" ? "المدة" : "Duration",
  monthsShown: lang === "ar" ? "الشهور المعروضة" : "Shown months",
  paidMonths: lang === "ar" ? "المدفوعة" : "Paid months",
  bonus: lang === "ar" ? "مجاني" : "Bonus",
  price: lang === "ar" ? "السعر (AED)" : "Price (AED)",
  tag: lang === "ar" ? "Tag" : "Tag",
  best: lang === "ar" ? "Best" : "Best",

  helperTag: lang === "ar" ? "المسموح: most / offer فقط" : "Allowed: most / offer only",
  helperOffer:
    lang === "ar"
      ? "العروض مسموحة فقط في: نصف سنوي + سنوي"
      : "Offers allowed only for: Semiannual + Yearly",

  perksAr: lang === "ar" ? "المميزات (عربي)" : "Perks (AR)",
  perksEn: lang === "ar" ? "المميزات (English)" : "Perks (EN)",

  quickSummary: lang === "ar" ? "ملخص سريع" : "Quick Summary",
  offer: lang === "ar" ? "عرض" : "Offer",
  most: lang === "ar" ? "الأكثر اختيارًا" : "Most chosen",
  ok: lang === "ar" ? "تمام" : "OK",
  fix: lang === "ar" ? "يحتاج تعديل" : "Needs fix",

  offerLine:
    lang === "ar"
      ? "صيغة العرض: تدفع X + مجاني Y"
      : "Offer formula: Pay X + Free Y",
});

function normalizePlanDoc(id, data) {
  const d = data || {};
  const pricing = d.pricing || {};
  const normalizedPricing = {};
  for (const k of DURATION_ORDER) {
    const v = pricing[k] || {};
    normalizedPricing[k] = {
      title: v.title || { ar: "", en: "" },
      monthsShown: Number(v.monthsShown ?? 1),
      paidMonths: Number(v.paidMonths ?? v.monthsShown ?? 1),
      bonus: Number(v.bonus ?? 0),
      price: Number(v.price ?? 0),
      tag: String(v.tag || ""),
      best: Boolean(v.best),
    };
  }

  const perks = d.perks || { ar: [], en: [] };
  return {
    id,
    key: d.key || id,
    isActive: Boolean(d.isActive ?? true),
    sortIndex: Number(d.sortIndex ?? 0),
    name: d.name || { ar: "", en: "" },
    fit: d.fit || { ar: "", en: "" },
    perks: {
      ar: Array.isArray(perks.ar) ? perks.ar : [],
      en: Array.isArray(perks.en) ? perks.en : [],
    },
    pricing: normalizedPricing,
  };
}

function SafeToast({ toast, isAr }) {
  if (!toast) return null;
  return (
    <div
      className={cn(
        "px-3 py-2 rounded-xl text-sm font-extrabold inline-flex items-center gap-2",
        toast.type === "ok" ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/20" : "bg-rose-500/15 text-rose-100 border border-rose-400/20",
        isAr && "flex-row-reverse"
      )}
    >
      {toast.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.msg}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
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

export default function SubscriptionsSection({ lang = "ar" }) {
  const t = useMemo(() => uiText(lang), [lang]);
  const isAr = lang === "ar";

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [plans, setPlans] = useState([]);
  const [tabByPlan, setTabByPlan] = useState({});
  const [expanded, setExpanded] = useState({}); // {id:true}
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(collection(firestore, COLLECTION));
        const rows = snap.docs.map((x) => normalizePlanDoc(x.id, x.data()));
        rows.sort((a, b) => (a.sortIndex - b.sortIndex) || a.key.localeCompare(b.key));
        if (mounted) setPlans(rows);
      } catch (e) {
        console.error("Load plans error:", e);
        if (mounted) setPlans([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const setField = (id, patch) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const setNested = (id, path, value) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const copy = structuredClone(p);
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

  const addPerk = (id, locale) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const copy = structuredClone(p);
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
        const copy = structuredClone(p);
        copy.perks[locale] = (copy.perks[locale] || []).filter((_, i) => i !== idx);
        return copy;
      })
    );
  };

  const sanitizeTag = (tag) => {
    const v = String(tag || "").trim().toLowerCase();
    if (!v) return "";
    if (v === "offer" || v === "most") return v;
    return ""; // ✅ only allow these
  };

  const validatePlan = (plan) => {
    const issues = [];

    // pricing sanity + offers rules
    for (const dur of DURATION_ORDER) {
      const v = plan.pricing?.[dur] || {};
      const monthsShown = Number(v.monthsShown ?? 1);
      const paidMonths = Number(v.paidMonths ?? monthsShown);
      const bonus = Number(v.bonus ?? 0);
      const tag = sanitizeTag(v.tag);

      if (monthsShown <= 0) issues.push(`${dur}: monthsShown <= 0`);
      if (paidMonths <= 0) issues.push(`${dur}: paidMonths <= 0`);
      if (bonus < 0) issues.push(`${dur}: bonus < 0`);

      // ✅ Offer allowed only for semiannual/yearly
      if ((tag === "offer" || bonus > 0) && !isOfferDuration(dur)) {
        issues.push(`${dur}: offer/bonus not allowed (only semiannual/yearly)`);
      }

      // ✅ prevent nonsense like monthsShown not matching paid+bonus (optional strict)
      // Here: we don't force match, but we will cap shown months to a reasonable display:
      // If you want strict: uncomment next lines.
      // const total = paidMonths + bonus;
      // if (monthsShown !== total) issues.push(`${dur}: monthsShown should equal paid+bonus (${total})`);

      // ✅ if tag is "most" it should ideally be yearly
      if (tag === "most" && dur !== "yearly") {
        issues.push(`${dur}: tag 'most' should be yearly`);
      }
    }

    return issues;
  };

  const savePlan = async (plan) => {
    try {
      setSavingId(plan.id);
      setToast(null);

      // ✅ sanitize tags + enforce offer rule at save time
      const pricingOut = Object.fromEntries(
        DURATION_ORDER.map((k) => {
          const v = plan.pricing?.[k] || {};
          const monthsShown = Number(v.monthsShown ?? 1);
          const paidMonths = Number(v.paidMonths ?? monthsShown);
          const bonus = Number(v.bonus ?? 0);

          let tag = sanitizeTag(v.tag);

          // Offer only semiannual/yearly, and only if bonus>0
          if (!isOfferDuration(k)) {
            // strip offer & bonus if someone mistakenly set it
            tag = tag === "most" ? tag : ""; // allow most only if you want; we keep it but validate above
          }
          const safeBonus = isOfferDuration(k) ? bonus : 0;
          const safePaid = paidMonths;

          return [
            k,
            {
              title: { ar: String(v.title?.ar || ""), en: String(v.title?.en || "") },
              monthsShown: Number(monthsShown ?? 1),
              paidMonths: Number(safePaid ?? 1),
              bonus: Number(safeBonus ?? 0),
              price: Number(v.price ?? 0),
              tag,
              best: Boolean(v.best),
            },
          ];
        })
      );

      const payload = {
        key: String(plan.key || plan.id),
        isActive: Boolean(plan.isActive),
        sortIndex: Number(plan.sortIndex || 0),
        name: { ar: String(plan.name?.ar || ""), en: String(plan.name?.en || "") },
        fit: { ar: String(plan.fit?.ar || ""), en: String(plan.fit?.en || "") },
        perks: {
          ar: Array.isArray(plan.perks?.ar) ? plan.perks.ar.filter(Boolean) : [],
          en: Array.isArray(plan.perks?.en) ? plan.perks.en.filter(Boolean) : [],
        },
        pricing: pricingOut,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(firestore, COLLECTION, plan.id), payload, { merge: true });

      setToast({ type: "ok", msg: t.saved });
    } catch (e) {
      console.error("Save plan error:", e);
      setToast({ type: "err", msg: t.error });
    } finally {
      setSavingId(null);
      setTimeout(() => setToast(null), 2400);
    }
  };

  const inputBaseDark =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-extrabold text-white/90 shadow-sm outline-none focus:ring-4 transition placeholder:text-white/35";
  const softCard =
    "rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden";

  const filteredPlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter((p) => {
      if (onlyActive && !p.isActive) return false;
      if (!q) return true;
      const hay =
        `${p.id} ${p.key} ${p.name?.ar || ""} ${p.name?.en || ""} ${p.fit?.ar || ""} ${p.fit?.en || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [plans, query, onlyActive]);

  const totalActive = useMemo(() => plans.filter((x) => x.isActive).length, [plans]);

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#07120d] via-[#071610] to-[#040a07] p-4 sm:p-6 shadow-[0_25px_90px_-55px_rgba(16,185,129,0.35)]">
      {/* Header */}
      <div className={cn("flex items-start justify-between gap-4", isAr && "flex-row-reverse")}>
        <div className={cn(isAr ? "text-right" : "text-left")}>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">{t.title}</div>
          <div className="text-sm text-white/60 mt-1">{t.subtitle}</div>

          <div className={cn("mt-3 flex items-center gap-2 flex-wrap", isAr && "flex-row-reverse")}>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-extrabold border border-white/10 bg-white/5 text-white/80">
              <LayoutGrid className="w-4 h-4" />
              {isAr ? `إجمالي: ${plans.length}` : `Total: ${plans.length}`}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-extrabold border border-emerald-400/15 bg-emerald-500/10 text-emerald-200">
              <Check className="w-4 h-4" />
              {isAr ? `مفعّل: ${totalActive}` : `Active: ${totalActive}`}
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

      {/* Toolbar */}
      <div className={cn("mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 flex items-center justify-between gap-3", isAr && "flex-row-reverse")}>
        <div className={cn("flex items-center gap-2 w-full sm:w-auto", isAr && "flex-row-reverse")}>
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-black/20 w-full sm:w-[340px]", isAr && "flex-row-reverse")}>
            <SlidersHorizontal className="w-4 h-4 text-white/55" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent outline-none text-white/90 font-extrabold placeholder:text-white/35"
              placeholder={isAr ? "بحث بالاسم / الكود / الوصف..." : "Search name / key / fit..."}
            />
          </div>

          <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
            <span className="text-white/70 text-sm font-extrabold">{isAr ? "مفعلة فقط" : "Active only"}</span>
            <Toggle checked={onlyActive} onChange={setOnlyActive} />
          </div>
        </div>

        <div className="hidden sm:block text-xs text-white/45 font-bold">
          {t.helperTag}
        </div>
      </div>

      {/* Body */}
      <div className="mt-5">
        {loading ? (
          <div className={cn("text-white/70 font-extrabold", isAr && "text-right")}>{t.loading}</div>
        ) : !filteredPlans.length ? (
          <div className={cn("text-white/60 font-extrabold", isAr && "text-right")}>{t.empty}</div>
        ) : (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            {filteredPlans.map((p) => {
              const brand = BRAND[p.id] || BRAND[p.key] || BRAND.starter;
              const Icon = brand.icon || Sparkles;
              const tab = tabByPlan[p.id] || "pricing";
              const open = !!expanded[p.id];

              const issues = validatePlan(p);
              const isOk = issues.length === 0;

              const yearly = p.pricing?.yearly || {};
              const yearlyTag = String(yearly.tag || "").toLowerCase();
              const badge =
                yearly.best || yearlyTag === "most"
                  ? (isAr ? "الأكثر اختيارًا" : "Most chosen")
                  : null;

              return (
                <div key={p.id} className={cn(softCard, "ring-1", brand.ring, open ? brand.glow : "")}>
                  {/* top gradient bar */}
                  <div className={cn("h-[5px] bg-gradient-to-r", brand.bar)} />

                  {/* header */}
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className={cn("w-full p-4 sm:p-5 flex items-start justify-between gap-3 text-left cursor-pointer", isAr && "flex-row-reverse text-right")}
                  >
                    <div className={cn("flex items-start gap-3 min-w-0", isAr && "flex-row-reverse")}>
                      <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-white/80" />
                      </div>

                      <div className="min-w-0">
                        <div className={cn("flex items-center gap-2 flex-wrap", isAr && "flex-row-reverse")}>
                          <div className="font-extrabold text-lg text-white truncate">
                            {p.name?.[isAr ? "ar" : "en"] || p.key || p.id}
                          </div>

                          {badge ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-white text-black">
                              {badge}
                            </span>
                          ) : null}

                          <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-extrabold border", brand.chipDark)}>
                            <Tag className="w-3.5 h-3.5 inline-block mr-1 -mt-[2px]" />
                            PRO
                          </span>

                          <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-extrabold border", isOk ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-amber-400/20 bg-amber-500/10 text-amber-200")}>
                            {isOk ? t.ok : t.fix}
                          </span>
                        </div>

                        {p.fit?.[isAr ? "ar" : "en"] ? (
                          <div className="text-sm text-white/60 mt-1 line-clamp-2">
                            {p.fit?.[isAr ? "ar" : "en"]}
                          </div>
                        ) : null}

                        <div className={cn("mt-2 flex items-center gap-2 flex-wrap", isAr && "flex-row-reverse")}>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/25 text-white/70 border border-white/10">
                            {t.key}: {p.id}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/25 text-white/70 border border-white/10">
                            {t.sortIndex}: {p.sortIndex}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={cn("flex items-center gap-3 shrink-0", isAr && "flex-row-reverse")}>
                      <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                        <span className="text-white/65 text-sm font-extrabold">{t.active}</span>
                        <Toggle checked={!!p.isActive} onChange={(v) => setField(p.id, { isActive: v })} />
                      </div>

                      <div className={cn("w-10 h-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center transition", open ? "rotate-180" : "")}>
                        {/* chevron visual */}
                        <span className="text-white/70 font-extrabold">⌄</span>
                      </div>
                    </div>
                  </button>

                  {/* expanded content */}
                  {open ? (
                    <div className="px-4 sm:px-5 pb-5">
                      {/* quick summary */}
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className={cn("flex items-center justify-between gap-3", isAr && "flex-row-reverse")}>
                          <div className="text-white font-extrabold">{t.quickSummary}</div>

                          <button
                            onClick={() => savePlan(p)}
                            disabled={savingId === p.id}
                            className={cn(
                              "cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl font-extrabold text-white shadow-sm transition active:scale-[0.98]",
                              savingId === p.id ? "bg-white/20" : brand.btn
                            )}
                          >
                            <Save className="w-4 h-4" />
                            {savingId === p.id ? t.saving : t.save}
                          </button>
                        </div>

                        {!isOk ? (
                          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-amber-100">
                            <div className="font-extrabold text-sm">
                              {isAr ? "ملاحظات" : "Notes"}
                            </div>
                            <ul className={cn("mt-2 text-xs font-bold space-y-1", isAr && "text-right")}>
                              {issues.slice(0, 6).map((x, i) => (
                                <li key={i}>• {x}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                          {DURATION_ORDER.map((k) => {
                            const row = p.pricing?.[k] || {};
                            const tag = String(row.tag || "").toLowerCase();
                            const tagLabel = tag === "offer" ? t.offer : tag === "most" ? t.most : "";
                            const tagOk =
                              tag === "" ||
                              (tag === "most" && k === "yearly") ||
                              (tag === "offer" && isOfferDuration(k));

                            return (
                              <div
                                key={k}
                                className={cn(
                                  "rounded-2xl border p-3 bg-white/5",
                                  "border-white/10"
                                )}
                              >
                                <div className={cn("flex items-center justify-between", isAr && "flex-row-reverse")}>
                                  <div className="text-white/85 font-extrabold text-sm">
                                    {DUR_LABELS[k][isAr ? "ar" : "en"]}
                                  </div>
                                  {tagLabel ? (
                                    <span
                                      className={cn(
                                        "px-2 py-1 rounded-full text-[10px] font-extrabold border",
                                        tagOk
                                          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                          : "border-amber-400/20 bg-amber-500/10 text-amber-200"
                                      )}
                                    >
                                      {tagLabel}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-2 text-white font-extrabold text-xl">
                                  {Number(row.price || 0).toLocaleString()}
                                  <span className="text-xs text-white/45 font-bold"> AED</span>
                                </div>

                                {isOfferDuration(k) && Number(row.bonus || 0) > 0 ? (
                                  <div className="mt-1 text-[11px] font-extrabold text-amber-200">
                                    {t.offerLine}: {Number(row.paidMonths || row.monthsShown || 1)} + {Number(row.bonus || 0)}
                                  </div>
                                ) : (
                                  <div className="mt-1 text-[11px] font-bold text-white/45">
                                    {isAr ? "بدون عرض" : "No offer"}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* tabs */}
                      <div className={cn("mt-4 flex items-center gap-2", isAr && "flex-row-reverse")}>
                        {[
                          { k: "pricing", label: t.tabPricing },
                          { k: "perks", label: t.tabPerks },
                          { k: "meta", label: t.tabMeta },
                        ].map((x) => (
                          <button
                            key={x.k}
                            onClick={() => setTabByPlan((prev) => ({ ...prev, [p.id]: x.k }))}
                            className={cn(
                              "cursor-pointer px-3 py-2 rounded-xl text-sm font-extrabold border transition",
                              tab === x.k
                                ? "bg-white text-black border-white"
                                : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                            )}
                          >
                            {x.label}
                          </button>
                        ))}
                      </div>

                      {/* tab content */}
                      <div className="mt-3">
                        {/* META */}
                        {tab === "meta" ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.sortIndex}</div>
                                <input
                                  value={p.sortIndex}
                                  onChange={(e) => setField(p.id, { sortIndex: Number(e.target.value || 0) })}
                                  type="number"
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.key}</div>
                                <input
                                  value={p.key}
                                  onChange={(e) => setField(p.id, { key: e.target.value })}
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.nameAr}</div>
                                <input
                                  value={p.name?.ar || ""}
                                  onChange={(e) => setNested(p.id, ["name", "ar"], e.target.value)}
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.nameEn}</div>
                                <input
                                  value={p.name?.en || ""}
                                  onChange={(e) => setNested(p.id, ["name", "en"], e.target.value)}
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.fitAr}</div>
                                <input
                                  value={p.fit?.ar || ""}
                                  onChange={(e) => setNested(p.id, ["fit", "ar"], e.target.value)}
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.fitEn}</div>
                                <input
                                  value={p.fit?.en || ""}
                                  onChange={(e) => setNested(p.id, ["fit", "en"], e.target.value)}
                                  className={cn(inputBaseDark, brand.focus)}
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* PERKS */}
                        {tab === "perks" ? (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {/* perks ar */}
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className={cn("flex items-center justify-between", isAr && "flex-row-reverse")}>
                                <div className="text-sm font-extrabold text-white">{t.perksAr}</div>
                                <button
                                  onClick={() => addPerk(p.id, "ar")}
                                  className="cursor-pointer text-xs font-extrabold text-white/90 hover:underline"
                                >
                                  + {t.addPerk}
                                </button>
                              </div>

                              <div className="mt-3 space-y-2">
                                {(p.perks?.ar || []).map((x, i) => (
                                  <div key={i} className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                                    <input
                                      value={x}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setPlans((prev) =>
                                          prev.map((pp) => {
                                            if (pp.id !== p.id) return pp;
                                            const copy = structuredClone(pp);
                                            copy.perks.ar[i] = val;
                                            return copy;
                                          })
                                        );
                                      }}
                                      className={cn(inputBaseDark, brand.focus)}
                                    />
                                    <button
                                      onClick={() => removePerk(p.id, "ar", i)}
                                      className="cursor-pointer px-3 py-2 rounded-xl bg-rose-500/15 text-rose-100 font-extrabold border border-rose-400/20 hover:bg-rose-500/25 transition"
                                    >
                                      {t.remove}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* perks en */}
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className={cn("flex items-center justify-between", isAr && "flex-row-reverse")}>
                                <div className="text-sm font-extrabold text-white">{t.perksEn}</div>
                                <button
                                  onClick={() => addPerk(p.id, "en")}
                                  className="cursor-pointer text-xs font-extrabold text-white/90 hover:underline"
                                >
                                  + {t.addPerk}
                                </button>
                              </div>

                              <div className="mt-3 space-y-2">
                                {(p.perks?.en || []).map((x, i) => (
                                  <div key={i} className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                                    <input
                                      value={x}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setPlans((prev) =>
                                          prev.map((pp) => {
                                            if (pp.id !== p.id) return pp;
                                            const copy = structuredClone(pp);
                                            copy.perks.en[i] = val;
                                            return copy;
                                          })
                                        );
                                      }}
                                      className={cn(inputBaseDark, brand.focus)}
                                    />
                                    <button
                                      onClick={() => removePerk(p.id, "en", i)}
                                      className="cursor-pointer px-3 py-2 rounded-xl bg-rose-500/15 text-rose-100 font-extrabold border border-rose-400/20 hover:bg-rose-500/25 transition"
                                    >
                                      {t.remove}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* PRICING */}
                        {tab === "pricing" ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className={cn("flex items-center justify-between gap-3 mb-2", isAr && "flex-row-reverse")}>
                              <div className="text-sm font-extrabold text-white">{t.tabPricing}</div>
                              <div className="text-xs text-white/45 font-bold">{t.helperTag}</div>
                            </div>

                            <div className="space-y-3">
                              {DURATION_ORDER.map((k) => {
                                const row = p.pricing?.[k] || {};
                                const tag = sanitizeTag(row.tag);
                                const tagLabel = tag === "offer" ? t.offer : tag === "most" ? t.most : "";

                                const tagBad =
                                  (tag === "offer" && !isOfferDuration(k)) ||
                                  (tag === "most" && k !== "yearly");

                                const bonusBad = !isOfferDuration(k) && Number(row.bonus || 0) > 0;

                                return (
                                  <div key={k} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className={cn("flex items-center justify-between", isAr && "flex-row-reverse")}>
                                      <div className="font-extrabold text-white">
                                        {DUR_LABELS[k][isAr ? "ar" : "en"]}
                                      </div>

                                      <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                                        {tagLabel ? (
                                          <span
                                            className={cn(
                                              "px-3 py-1 rounded-full text-[11px] font-extrabold border",
                                              tagBad ? "border-amber-400/20 bg-amber-500/10 text-amber-200" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                            )}
                                          >
                                            {tagLabel}
                                          </span>
                                        ) : null}

                                        {row.best ? (
                                          <span className={cn("px-3 py-1 rounded-full text-[11px] font-extrabold border", brand.chipDark)}>
                                            {t.best}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 lg:grid-cols-6 gap-2">
                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.monthsShown}</div>
                                        <input
                                          type="number"
                                          value={row.monthsShown ?? 1}
                                          onChange={(e) =>
                                            setNested(p.id, ["pricing", k, "monthsShown"], Number(e.target.value || 1))
                                          }
                                          className={cn(inputBaseDark, brand.focus)}
                                        />
                                      </div>

                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.paidMonths}</div>
                                        <input
                                          type="number"
                                          value={row.paidMonths ?? row.monthsShown ?? 1}
                                          onChange={(e) =>
                                            setNested(p.id, ["pricing", k, "paidMonths"], Number(e.target.value || 1))
                                          }
                                          className={cn(inputBaseDark, brand.focus)}
                                        />
                                      </div>

                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.bonus}</div>
                                        <input
                                          type="number"
                                          value={row.bonus ?? 0}
                                          onChange={(e) =>
                                            setNested(p.id, ["pricing", k, "bonus"], Number(e.target.value || 0))
                                          }
                                          className={cn(
                                            inputBaseDark,
                                            brand.focus,
                                            bonusBad ? "border-amber-400/30" : ""
                                          )}
                                        />
                                        {bonusBad ? (
                                          <div className={cn("mt-1 text-[11px] font-extrabold text-amber-200", isAr && "text-right")}>
                                            {t.helperOffer}
                                          </div>
                                        ) : null}
                                      </div>

                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.price}</div>
                                        <input
                                          type="number"
                                          value={row.price ?? 0}
                                          onChange={(e) =>
                                            setNested(p.id, ["pricing", k, "price"], Number(e.target.value || 0))
                                          }
                                          className={cn(inputBaseDark, brand.focus)}
                                        />
                                      </div>

                                      <div>
                                        <div className="text-[11px] font-extrabold text-white/55 mb-1">{t.tag}</div>
                                        <input
                                          value={row.tag || ""}
                                          onChange={(e) =>
                                            setNested(p.id, ["pricing", k, "tag"], e.target.value.trim().toLowerCase())
                                          }
                                          className={cn(inputBaseDark, brand.focus, tagBad ? "border-amber-400/30" : "")}
                                          placeholder="most / offer"
                                        />
                                        {tagBad ? (
                                          <div className={cn("mt-1 text-[11px] font-extrabold text-amber-200", isAr && "text-right")}>
                                            {t.helperTag}
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className={cn("flex items-end", isAr && "justify-end")}>
                                        <label className={cn("cursor-pointer flex items-center gap-2 text-sm font-extrabold text-white/80", isAr && "flex-row-reverse")}>
                                          <input
                                            type="checkbox"
                                            checked={!!row.best}
                                            onChange={(e) => setNested(p.id, ["pricing", k, "best"], e.target.checked)}
                                            className="w-5 h-5 cursor-pointer"
                                          />
                                          {t.best}
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* bottom save */}
                      <div className={cn("mt-4 flex items-center justify-end", isAr && "justify-start")}>
                        <button
                          onClick={() => savePlan(p)}
                          disabled={savingId === p.id}
                          className={cn(
                            "cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-white shadow-lg transition active:scale-[0.98]",
                            savingId === p.id ? "bg-white/20" : brand.btn
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
        )}
      </div>
    </section>
  );
}
