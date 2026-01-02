"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import { Zap, Sparkles, Shield, Crown, Save, CheckCircle2, AlertTriangle, Tag } from "lucide-react";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

const COLLECTION = "companySubscriptionPlans";
const DURATION_ORDER = ["monthly", "quarterly", "semiannual", "yearly"];

// ✅ Visual identity per plan
const BRAND = {
  starter: {
    icon: Zap,
    bar: "from-emerald-400 to-emerald-600",
    ring: "ring-emerald-500/20",
    chip: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    btn: "bg-emerald-600 hover:bg-emerald-700",
    focus: "focus:ring-emerald-500/30",
  },
  growth: {
    icon: Sparkles,
    bar: "from-sky-400 to-sky-600",
    ring: "ring-sky-500/20",
    chip: "bg-sky-500/10 text-sky-700 border-sky-500/20",
    btn: "bg-sky-600 hover:bg-sky-700",
    focus: "focus:ring-sky-500/30",
  },
  scale: {
    icon: Shield,
    bar: "from-purple-400 to-purple-600",
    ring: "ring-purple-500/20",
    chip: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    btn: "bg-purple-600 hover:bg-purple-700",
    focus: "focus:ring-purple-500/30",
  },
  enterprise: {
    icon: Crown,
    bar: "from-rose-400 to-red-600",
    ring: "ring-rose-500/20",
    chip: "bg-rose-500/10 text-rose-700 border-rose-500/20",
    btn: "bg-rose-600 hover:bg-rose-700",
    focus: "focus:ring-rose-500/30",
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

  addPerk: lang === "ar" ? "إضافة ميزة" : "Add perk",
  remove: lang === "ar" ? "حذف" : "Remove",

  duration: lang === "ar" ? "المدة" : "Duration",
  monthsShown: lang === "ar" ? "الشهور المعروضة" : "Shown months",
  paidMonths: lang === "ar" ? "المدفوعة" : "Paid months",
  bonus: lang === "ar" ? "مجاني" : "Bonus",
  price: lang === "ar" ? "السعر (AED)" : "Price (AED)",
  tag: lang === "ar" ? "Tag" : "Tag",
  best: lang === "ar" ? "Best" : "Best",

  helperTag: lang === "ar" ? "مثال: most / offer" : "Example: most / offer",
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
      tag: v.tag || "",
      best: Boolean(v.best),
    };
  }

  return {
    id,
    key: d.key || id,
    isActive: Boolean(d.isActive ?? true),
    sortIndex: Number(d.sortIndex ?? 0),
    name: d.name || { ar: "", en: "" },
    fit: d.fit || { ar: "", en: "" },
    perks: d.perks || { ar: [], en: [] },
    pricing: normalizedPricing,
  };
}

export default function SubscriptionsSection({ lang }) {
  const t = useMemo(() => uiText(lang), [lang]);
  const isAr = lang === "ar";

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [plans, setPlans] = useState([]);
  const [tabByPlan, setTabByPlan] = useState({}); // {planId: "perks"|"pricing"}

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

  const savePlan = async (plan) => {
    try {
      setSavingId(plan.id);
      setToast(null);

      const payload = {
        key: plan.key,
        isActive: Boolean(plan.isActive),
        sortIndex: Number(plan.sortIndex || 0),
        name: { ar: String(plan.name?.ar || ""), en: String(plan.name?.en || "") },
        fit: { ar: String(plan.fit?.ar || ""), en: String(plan.fit?.en || "") },
        perks: {
          ar: Array.isArray(plan.perks?.ar) ? plan.perks.ar.filter(Boolean) : [],
          en: Array.isArray(plan.perks?.en) ? plan.perks.en.filter(Boolean) : [],
        },
        pricing: Object.fromEntries(
          DURATION_ORDER.map((k) => {
            const v = plan.pricing?.[k] || {};
            return [
              k,
              {
                title: { ar: String(v.title?.ar || ""), en: String(v.title?.en || "") },
                monthsShown: Number(v.monthsShown ?? 1),
                paidMonths: Number(v.paidMonths ?? v.monthsShown ?? 1),
                bonus: Number(v.bonus ?? 0),
                price: Number(v.price ?? 0),
                tag: String(v.tag || ""),
                best: Boolean(v.best),
              },
            ];
          })
        ),
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

  const inputBase =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-800 shadow-sm outline-none focus:ring-4 transition";
  const cardBase =
    "bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition";

  return (
    <div className="rounded-2xl bg-gradient-to-b from-white/85 to-white/70 shadow p-6 sm:p-8 text-gray-900">
      {/* Header */}
      <div className={cn("flex items-start justify-between gap-4", isAr && "flex-row-reverse")}>
        <div className={cn(isAr ? "text-right" : "text-left")}>
          <div className="text-2xl sm:text-3xl font-extrabold">{t.title}</div>
          <div className="text-sm text-gray-600 mt-1">{t.subtitle}</div>
        </div>

        {toast ? (
          <div
            className={cn(
              "px-3 py-2 rounded-xl text-sm font-extrabold inline-flex items-center gap-2",
              toast.type === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            )}
          >
            {toast.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className={cn("text-gray-600 font-bold", isAr && "text-right")}>{t.loading}</div>
        ) : !plans.length ? (
          <div className={cn("text-gray-600 font-bold", isAr && "text-right")}>{t.empty}</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {plans.map((p) => {
              const brand = BRAND[p.id] || BRAND[p.key] || BRAND.starter;
              const Icon = brand.icon || Sparkles;
              const tab = tabByPlan[p.id] || "pricing";

              const badge =
                p.pricing?.yearly?.best ? (isAr ? "الأكثر اختيارًا" : "Most chosen") : null;

              return (
                <div key={p.id} className={cn(cardBase, "ring-1", brand.ring)}>
                  {/* top gradient bar */}
                  <div className={cn("h-[5px] bg-gradient-to-r", brand.bar)} />

                  {/* card header */}
                  <div className={cn("p-4 sm:p-5 flex items-start justify-between gap-3", isAr && "flex-row-reverse")}>
                    <div className={cn("flex items-start gap-3 min-w-0", isAr && "flex-row-reverse")}>
                      <div className={cn("w-11 h-11 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center")}>
                        <Icon className="w-5 h-5 text-gray-700" />
                      </div>

                      <div className={cn("min-w-0", isAr && "text-right")}>
                        <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                          <div className="font-extrabold text-lg truncate">
                            {p.name?.[isAr ? "ar" : "en"] || p.key}
                          </div>

                          {badge ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/90 text-white">
                              {badge}
                            </span>
                          ) : null}
                        </div>

                        <div className="text-sm text-gray-600 mt-1">
                          {p.fit?.[isAr ? "ar" : "en"] || ""}
                        </div>

                        <div className={cn("mt-2 flex items-center gap-2 flex-wrap", isAr && "flex-row-reverse")}>
                          <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border", brand.chip)}>
                            <Tag className="w-3.5 h-3.5" />
                            PRO
                          </span>

                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-gray-100 text-gray-700 border border-gray-200">
                            {t.key}: {p.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={cn("flex items-center gap-3", isAr && "flex-row-reverse")}>
                      <label className={cn("text-sm font-extrabold text-gray-700 flex items-center gap-2 cursor-pointer", isAr && "flex-row-reverse")}>
                        <span>{t.active}</span>
                        <input
                          type="checkbox"
                          checked={!!p.isActive}
                          onChange={(e) => setField(p.id, { isActive: e.target.checked })}
                          className="w-5 h-5 cursor-pointer"
                        />
                      </label>

                      <button
                        onClick={() => savePlan(p)}
                        disabled={savingId === p.id}
                        className={cn(
                          "cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl font-extrabold text-white shadow-sm transition active:scale-[0.98]",
                          savingId === p.id ? "bg-gray-400" : brand.btn
                        )}
                      >
                        <Save className="w-4 h-4" />
                        {savingId === p.id ? t.saving : t.save}
                      </button>
                    </div>
                  </div>

                  {/* tabs */}
                  <div className={cn("px-4 sm:px-5 pb-4 flex items-center gap-2", isAr && "flex-row-reverse")}>
                    <button
                      onClick={() => setTabByPlan((prev) => ({ ...prev, [p.id]: "pricing" }))}
                      className={cn(
                        "cursor-pointer px-3 py-2 rounded-xl text-sm font-extrabold border transition",
                        tab === "pricing"
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {t.tabPricing}
                    </button>
                    <button
                      onClick={() => setTabByPlan((prev) => ({ ...prev, [p.id]: "perks" }))}
                      className={cn(
                        "cursor-pointer px-3 py-2 rounded-xl text-sm font-extrabold border transition",
                        tab === "perks"
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {t.tabPerks}
                    </button>
                  </div>

                  {/* body */}
                  <div className="px-4 sm:px-5 pb-5">
                    {/* Plan meta */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div>
                        <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.sortIndex}</div>
                        <input
                          value={p.sortIndex}
                          onChange={(e) => setField(p.id, { sortIndex: Number(e.target.value || 0) })}
                          type="number"
                          className={cn(inputBase, brand.focus)}
                        />
                      </div>

                      <div>
                        <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.key}</div>
                        <input
                          value={p.key}
                          onChange={(e) => setField(p.id, { key: e.target.value })}
                          className={cn(inputBase, brand.focus)}
                        />
                      </div>

                      <div>
                        <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.nameAr}</div>
                        <input
                          value={p.name?.ar || ""}
                          onChange={(e) => setNested(p.id, ["name", "ar"], e.target.value)}
                          className={cn(inputBase, brand.focus)}
                        />
                      </div>

                      <div>
                        <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.nameEn}</div>
                        <input
                          value={p.name?.en || ""}
                          onChange={(e) => setNested(p.id, ["name", "en"], e.target.value)}
                          className={cn(inputBase, brand.focus)}
                        />
                      </div>

                      <div>
                        <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.fitAr}</div>
                        <input
                          value={p.fit?.ar || ""}
                          onChange={(e) => setNested(p.id, ["fit", "ar"], e.target.value)}
                          className={cn(inputBase, brand.focus)}
                        />
                      </div>

                      <div>
                        <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.fitEn}</div>
                        <input
                          value={p.fit?.en || ""}
                          onChange={(e) => setNested(p.id, ["fit", "en"], e.target.value)}
                          className={cn(inputBase, brand.focus)}
                        />
                      </div>
                    </div>

                    {tab === "perks" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* perks ar */}
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-extrabold text-gray-800">{isAr ? "المميزات (عربي)" : "Perks (AR)"}</div>
                            <button
                              onClick={() => addPerk(p.id, "ar")}
                              className="cursor-pointer text-xs font-extrabold text-gray-900 hover:underline"
                            >
                              + {t.addPerk}
                            </button>
                          </div>

                          <div className="mt-3 space-y-2">
                            {(p.perks?.ar || []).map((x, i) => (
                              <div key={i} className="flex items-center gap-2">
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
                                  className={cn(inputBase, brand.focus)}
                                />
                                <button
                                  onClick={() => removePerk(p.id, "ar", i)}
                                  className="cursor-pointer px-3 py-2 rounded-xl bg-rose-50 text-rose-700 font-extrabold border border-rose-100 hover:bg-rose-100 transition"
                                >
                                  {t.remove}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* perks en */}
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-extrabold text-gray-800">{isAr ? "المميزات (English)" : "Perks (EN)"}</div>
                            <button
                              onClick={() => addPerk(p.id, "en")}
                              className="cursor-pointer text-xs font-extrabold text-gray-900 hover:underline"
                            >
                              + {t.addPerk}
                            </button>
                          </div>

                          <div className="mt-3 space-y-2">
                            {(p.perks?.en || []).map((x, i) => (
                              <div key={i} className="flex items-center gap-2">
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
                                  className={cn(inputBase, brand.focus)}
                                />
                                <button
                                  onClick={() => removePerk(p.id, "en", i)}
                                  className="cursor-pointer px-3 py-2 rounded-xl bg-rose-50 text-rose-700 font-extrabold border border-rose-100 hover:bg-rose-100 transition"
                                >
                                  {t.remove}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className={cn("flex items-center justify-between gap-3 mb-2", isAr && "flex-row-reverse")}>
                          <div className="text-sm font-extrabold text-gray-800">{t.tabPricing}</div>
                          <div className="text-xs text-gray-600">{t.helperTag}</div>
                        </div>

                        <div className="space-y-3">
                          {DURATION_ORDER.map((k) => {
                            const row = p.pricing?.[k] || {};
                            return (
                              <div key={k} className="rounded-2xl border border-gray-200 bg-white p-4">
                                <div className={cn("flex items-center justify-between", isAr && "flex-row-reverse")}>
                                  <div className="font-extrabold text-gray-900">
                                    {t.duration}: <span className="text-gray-500">{k}</span>
                                  </div>
                                  {row.best ? (
                                    <span className={cn("px-3 py-1 rounded-full text-[11px] font-extrabold border", brand.chip)}>
                                      {t.best}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  <div>
                                    <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.monthsShown}</div>
                                    <input
                                      type="number"
                                      value={row.monthsShown ?? 1}
                                      onChange={(e) => setNested(p.id, ["pricing", k, "monthsShown"], Number(e.target.value || 1))}
                                      className={cn(inputBase, brand.focus)}
                                    />
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.paidMonths}</div>
                                    <input
                                      type="number"
                                      value={row.paidMonths ?? row.monthsShown ?? 1}
                                      onChange={(e) => setNested(p.id, ["pricing", k, "paidMonths"], Number(e.target.value || 1))}
                                      className={cn(inputBase, brand.focus)}
                                    />
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.bonus}</div>
                                    <input
                                      type="number"
                                      value={row.bonus ?? 0}
                                      onChange={(e) => setNested(p.id, ["pricing", k, "bonus"], Number(e.target.value || 0))}
                                      className={cn(inputBase, brand.focus)}
                                    />
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.price}</div>
                                    <input
                                      type="number"
                                      value={row.price ?? 0}
                                      onChange={(e) => setNested(p.id, ["pricing", k, "price"], Number(e.target.value || 0))}
                                      className={cn(inputBase, brand.focus)}
                                    />
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-extrabold text-gray-600 mb-1">{t.tag}</div>
                                    <input
                                      value={row.tag || ""}
                                      onChange={(e) => setNested(p.id, ["pricing", k, "tag"], e.target.value.trim())}
                                      className={cn(inputBase, brand.focus)}
                                      placeholder="most / offer"
                                    />
                                  </div>

                                  <div className="flex items-end">
                                    <label className="cursor-pointer flex items-center gap-2 text-sm font-extrabold text-gray-700">
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
