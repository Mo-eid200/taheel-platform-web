"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

const COLLECTION = "companySubscriptionPlans"; // ✅ نفس اللي زرعته

const DURATION_ORDER = ["monthly", "quarterly", "semiannual", "yearly"];

const uiText = (lang) => ({
  title: lang === "ar" ? "اشتراكات الشركات" : "Company Subscriptions",
  subtitle:
    lang === "ar"
      ? "تحكم كامل في الباقات والأسعار والمميزات (Production Live)"
      : "Manage plans, pricing & perks (Production Live)",
  loading: lang === "ar" ? "جاري تحميل الباقات..." : "Loading plans...",
  empty: lang === "ar" ? "لا توجد باقات." : "No plans found.",
  save: lang === "ar" ? "حفظ التعديلات" : "Save changes",
  saving: lang === "ar" ? "جاري الحفظ..." : "Saving...",
  saved: lang === "ar" ? "تم الحفظ ✅" : "Saved ✅",
  error: lang === "ar" ? "حدث خطأ ❌" : "Something went wrong ❌",
  addPerk: lang === "ar" ? "إضافة ميزة" : "Add perk",
  remove: lang === "ar" ? "حذف" : "Remove",
  active: lang === "ar" ? "مفعلة" : "Active",
  sortIndex: lang === "ar" ? "الترتيب" : "Sort",
  planKey: lang === "ar" ? "مفتاح الباقة" : "Plan key",
  nameAr: lang === "ar" ? "اسم الباقة (عربي)" : "Plan name (AR)",
  nameEn: lang === "ar" ? "اسم الباقة (إنجليزي)" : "Plan name (EN)",
  fitAr: lang === "ar" ? "وصف مختصر (عربي)" : "Short fit (AR)",
  fitEn: lang === "ar" ? "وصف مختصر (إنجليزي)" : "Short fit (EN)",
  perksAr: lang === "ar" ? "المميزات (عربي)" : "Perks (AR)",
  perksEn: lang === "ar" ? "المميزات (إنجليزي)" : "Perks (EN)",
  pricing: lang === "ar" ? "الأسعار" : "Pricing",
  duration: lang === "ar" ? "المدة" : "Duration",
  monthsShown: lang === "ar" ? "عدد الشهور المعروضة" : "Shown months",
  paidMonths: lang === "ar" ? "عدد الشهور المدفوعة" : "Paid months",
  bonus: lang === "ar" ? "شهور مجانية" : "Bonus months",
  price: lang === "ar" ? "السعر (AED)" : "Price (AED)",
  tag: lang === "ar" ? "Tag" : "Tag",
  best: lang === "ar" ? "أفضل اختيار" : "Best",
  tagHelp:
    lang === "ar"
      ? "اكتب: most أو offer أو اتركها فارغة"
      : "Use: most / offer / empty",
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

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);

  const [plans, setPlans] = useState([]); // array of plan objects

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(collection(firestore, COLLECTION));
        const rows = snap.docs.map((x) => normalizePlanDoc(x.id, x.data()));

        // sort by sortIndex then by key
        rows.sort((a, b) => (a.sortIndex - b.sortIndex) || a.key.localeCompare(b.key));

        if (mounted) setPlans(rows);
      } catch (e) {
        console.error("Load plans error:", e);
        if (mounted) setPlans([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setField = (id, patch) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const setNested = (id, path, value) => {
    // path example: ["name","ar"] or ["pricing","monthly","price"]
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

      // ✅ Merge-safe payload
      const payload = {
        key: plan.key,
        isActive: Boolean(plan.isActive),
        sortIndex: Number(plan.sortIndex || 0),
        name: {
          ar: String(plan.name?.ar || ""),
          en: String(plan.name?.en || ""),
        },
        fit: {
          ar: String(plan.fit?.ar || ""),
          en: String(plan.fit?.en || ""),
        },
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
                title: {
                  ar: String(v.title?.ar || ""),
                  en: String(v.title?.en || ""),
                },
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
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className={cn("bg-white/80 rounded-xl shadow p-6 sm:p-8 text-gray-900")}>
      <div className={cn("flex items-start justify-between gap-4", lang === "ar" && "flex-row-reverse")}>
        <div className={cn(lang === "ar" ? "text-right" : "text-left")}>
          <div className="text-2xl font-extrabold">{t.title}</div>
          <div className="text-sm text-gray-600 mt-1">{t.subtitle}</div>
        </div>

        {toast ? (
          <div
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-bold",
              toast.type === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            )}
          >
            {toast.msg}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className={cn("text-gray-600 font-bold", lang === "ar" && "text-right")}>{t.loading}</div>
        ) : !plans.length ? (
          <div className={cn("text-gray-600 font-bold", lang === "ar" && "text-right")}>{t.empty}</div>
        ) : (
          <div className="space-y-4">
            {plans.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={cn("p-4 sm:p-5 flex items-center justify-between gap-3", lang === "ar" && "flex-row-reverse")}>
                  <div className={cn("min-w-0", lang === "ar" && "text-right")}>
                    <div className="font-extrabold text-lg">
                      {p.name?.[lang === "ar" ? "ar" : "en"] || p.key}
                      <span className="ml-2 text-xs font-bold text-gray-500">({t.planKey}: {p.id})</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {p.fit?.[lang === "ar" ? "ar" : "en"] || ""}
                    </div>
                  </div>

                  <div className={cn("flex items-center gap-3", lang === "ar" && "flex-row-reverse")}>
                    <label className={cn("text-sm font-bold text-gray-700 flex items-center gap-2", lang === "ar" && "flex-row-reverse")}>
                      <span>{t.active}</span>
                      <input
                        type="checkbox"
                        checked={!!p.isActive}
                        onChange={(e) => setField(p.id, { isActive: e.target.checked })}
                        className="w-5 h-5"
                      />
                    </label>

                    <button
                      onClick={() => savePlan(p)}
                      disabled={savingId === p.id}
                      className={cn(
                        "px-4 py-2 rounded-lg font-extrabold text-white",
                        savingId === p.id ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
                      )}
                    >
                      {savingId === p.id ? t.saving : t.save}
                    </button>
                  </div>
                </div>

                <div className="px-4 sm:px-5 pb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left: basics */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="font-extrabold mb-3">{lang === "ar" ? "بيانات الباقة" : "Plan info"}</div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-bold text-gray-600 mb-1">{t.sortIndex}</div>
                        <input
                          value={p.sortIndex}
                          onChange={(e) => setField(p.id, { sortIndex: Number(e.target.value || 0) })}
                          type="number"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <div className="text-xs font-bold text-gray-600 mb-1">{t.planKey}</div>
                        <input
                          value={p.key}
                          onChange={(e) => setField(p.id, { key: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <div className="text-xs font-bold text-gray-600 mb-1">{t.nameAr}</div>
                        <input
                          value={p.name?.ar || ""}
                          onChange={(e) => setNested(p.id, ["name", "ar"], e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <div className="text-xs font-bold text-gray-600 mb-1">{t.nameEn}</div>
                        <input
                          value={p.name?.en || ""}
                          onChange={(e) => setNested(p.id, ["name", "en"], e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <div className="text-xs font-bold text-gray-600 mb-1">{t.fitAr}</div>
                        <input
                          value={p.fit?.ar || ""}
                          onChange={(e) => setNested(p.id, ["fit", "ar"], e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <div className="text-xs font-bold text-gray-600 mb-1">{t.fitEn}</div>
                        <input
                          value={p.fit?.en || ""}
                          onChange={(e) => setNested(p.id, ["fit", "en"], e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                        />
                      </div>
                    </div>

                    {/* perks */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-extrabold text-gray-700">{t.perksAr}</div>
                          <button
                            onClick={() => addPerk(p.id, "ar")}
                            className="text-xs font-extrabold text-emerald-700 hover:underline"
                          >
                            + {t.addPerk}
                          </button>
                        </div>
                        <div className="mt-2 space-y-2">
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
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                              />
                              <button
                                onClick={() => removePerk(p.id, "ar", i)}
                                className="px-2 py-2 rounded-lg bg-rose-50 text-rose-700 font-extrabold"
                              >
                                {t.remove}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-extrabold text-gray-700">{t.perksEn}</div>
                          <button
                            onClick={() => addPerk(p.id, "en")}
                            className="text-xs font-extrabold text-emerald-700 hover:underline"
                          >
                            + {t.addPerk}
                          </button>
                        </div>
                        <div className="mt-2 space-y-2">
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
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                              />
                              <button
                                onClick={() => removePerk(p.id, "en", i)}
                                className="px-2 py-2 rounded-lg bg-rose-50 text-rose-700 font-extrabold"
                              >
                                {t.remove}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: pricing */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="font-extrabold mb-2">{t.pricing}</div>
                    <div className="text-xs text-gray-600 mb-3">{t.tagHelp}</div>

                    <div className="space-y-3">
                      {DURATION_ORDER.map((k) => {
                        const row = p.pricing?.[k] || {};
                        return (
                          <div key={k} className="rounded-xl border border-gray-200 p-3">
                            <div className="font-extrabold text-sm text-gray-800 mb-2">
                              {t.duration}: <span className="text-gray-600">{k}</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <div>
                                <div className="text-[11px] font-bold text-gray-600 mb-1">{t.monthsShown}</div>
                                <input
                                  type="number"
                                  value={row.monthsShown ?? 1}
                                  onChange={(e) => setNested(p.id, ["pricing", k, "monthsShown"], Number(e.target.value || 1))}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-bold text-gray-600 mb-1">{t.paidMonths}</div>
                                <input
                                  type="number"
                                  value={row.paidMonths ?? row.monthsShown ?? 1}
                                  onChange={(e) => setNested(p.id, ["pricing", k, "paidMonths"], Number(e.target.value || 1))}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-bold text-gray-600 mb-1">{t.bonus}</div>
                                <input
                                  type="number"
                                  value={row.bonus ?? 0}
                                  onChange={(e) => setNested(p.id, ["pricing", k, "bonus"], Number(e.target.value || 0))}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-bold text-gray-600 mb-1">{t.price}</div>
                                <input
                                  type="number"
                                  value={row.price ?? 0}
                                  onChange={(e) => setNested(p.id, ["pricing", k, "price"], Number(e.target.value || 0))}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                                />
                              </div>

                              <div>
                                <div className="text-[11px] font-bold text-gray-600 mb-1">{t.tag}</div>
                                <input
                                  value={row.tag || ""}
                                  onChange={(e) => setNested(p.id, ["pricing", k, "tag"], e.target.value.trim())}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold"
                                  placeholder="most / offer"
                                />
                              </div>

                              <div className="flex items-end gap-2">
                                <label className="flex items-center gap-2 text-xs font-extrabold text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={!!row.best}
                                    onChange={(e) => setNested(p.id, ["pricing", k, "best"], e.target.checked)}
                                    className="w-4 h-4"
                                  />
                                  {t.best}
                                </label>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 text-xs text-gray-500">
                      * {lang === "ar"
                        ? "اضغط حفظ التعديلات لكل باقة على حدة (أمان أعلى في Production)."
                        : "Save per plan (safer for Production)."}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
