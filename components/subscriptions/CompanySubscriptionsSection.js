"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { firestore, auth } from "@/lib/firebase.client";
import { useRouter, useSearchParams } from "next/navigation";
import CompanyPlanCard from "./CompanyPlanCard";
import AddonsBottomStrip from "./AddonsBottomStrip";

// ✅ Stripe processing calculator (your existing util)
import calcStripeFees from "@/utils/calcStripeFees";

// ✅ Storage key used by /payment/service page
const PAYMENT_STORAGE_KEY = "paymentData";

function toNumberSafe(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function round2(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Number(x.toFixed(2)) : 0;
}

function calcDays(subscriptionDays, monthsShown) {
  const sd = toNumberSafe(subscriptionDays || 0);
  if (Number.isFinite(sd) && sd > 0) return Math.max(0, Math.round(sd));

  const m = toNumberSafe(monthsShown || 0);
  if (Number.isFinite(m) && m > 0) return Math.max(0, Math.round(m * 30));

  return 0;
}

/**
 * ✅ VAT rule for SUBSCRIPTIONS + ADDONS (as requested):
 * VAT 5% on (base + processingFee).
 * processingFee comes from calcStripeFees.
 *
 * We do a small 2-pass to keep it stable:
 * 1) fee on base
 * 2) vat on (base + fee1)
 * 3) fee on (base + vat1)
 * 4) vat on (base + fee2)
 */
function buildGatewayTotals(baseAmountAED) {
  const base = round2(baseAmountAED);

  // pass 1
  const pass1 = calcStripeFees(base, { isInternational: false, isCurrencyConversion: false });
  const fee1 = round2(pass1?.stripeFee ?? 0);
  const vat1 = round2((base + fee1) * 0.05);

  // pass 2 (fee based on base + vat1)
  const pass2 = calcStripeFees(round2(base + vat1), { isInternational: false, isCurrencyConversion: false });
  const fee2 = round2(pass2?.stripeFee ?? fee1);

  // final vat based on base + fee2 (requested)
  const vat = round2((base + fee2) * 0.05);

  const totalPrice = round2(base + vat);        // before processing
  const finalPrice = round2(totalPrice + fee2); // charged amount

  return {
    baseAmountAED: base,
    vatAED: vat,
    processingFeeAED: fee2,
    totalPrice,
    finalPrice,
  };
}

/**
 * ✅ Resolve clientDocId (COM-xxx) from:
 * 1) URL param: ?userId=COM-...
 * 2) Firestore mapping: usersByUid/<uid> -> { userId | docId | clientId }
 */
async function resolveClientDocId({ searchParams, uid }) {
  const fromUrl = (searchParams?.get("userId") || "").trim();
  if (fromUrl) return fromUrl;

  if (!uid) return "";

  try {
    const mapRef = doc(firestore, "usersByUid", String(uid));
    const snap = await getDoc(mapRef);
    if (!snap.exists()) return "";

    const m = snap.data() || {};
    const mapped = String(m.userId || m.docId || m.clientId || "").trim();
    return mapped || "";
  } catch (e) {
    console.error("resolveClientDocId failed:", e);
    return "";
  }
}

// ✅ safely resolve end date from Firestore (Timestamp | ISO string)
function resolveEndDate(subData) {
  try {
    if (!subData) return null;
    const endAt = subData.endAt;
    if (endAt && typeof endAt.toDate === "function") return endAt.toDate();
    if (subData.endAtISO) {
      const d = new Date(subData.endAtISO);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

export default function CompanySubscriptionsSection({
  lang = "ar",
  darkMode = false,
  onSubscribe, // optional external callback
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [clientDocId, setClientDocId] = useState("");

  const [addons, setAddons] = useState([]);
  const [addonsLoading, setAddonsLoading] = useState(true);

  // ✅ NEW: active subscription UI state
  const [activePlanKey, setActivePlanKey] = useState("");
  const [subInfo, setSubInfo] = useState(null); // optional, if you want to show expiry etc.
  const [subInfoLoading, setSubInfoLoading] = useState(false);

  // ✅ Load Addons Catalog
  useEffect(() => {
    let alive = true;

    async function loadAddons() {
      setAddonsLoading(true);
      try {
        const snap = await getDocs(collection(firestore, "companyAddonsCatalog"));
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // ✅ active only + popular first
        const filtered = arr
          .filter((a) => a?.isActive !== false)
          .sort((a, b) => (b?.popular === true ? 1 : 0) - (a?.popular === true ? 1 : 0))
          .reverse();

        if (alive) setAddons(filtered);
      } catch (e) {
        console.error("load addons failed:", e);
        if (alive) setAddons([]);
      } finally {
        if (alive) setAddonsLoading(false);
      }
    }

    loadAddons();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ Resolve clientDocId once
  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const user = auth.currentUser;

        const id = await resolveClientDocId({
          searchParams,
          uid: user?.uid || "",
        });

        if (alive) setClientDocId(id || "");
      } catch (e) {
        console.error("clientDocId resolve error:", e);
        if (alive) setClientDocId("");
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [searchParams]);

  // ✅ NEW: Load current subscription (active plan) for UI
  useEffect(() => {
    let alive = true;

    async function loadSub() {
      const id = (clientDocId || "").trim();
      if (!id) return;

      setSubInfoLoading(true);
      try {
        const subRef = doc(firestore, "companySubscriptions", id);
        const snap = await getDoc(subRef);

        if (!alive) return;

        if (!snap.exists()) {
          setSubInfo(null);
          setActivePlanKey("");
          return;
        }

        const data = snap.data() || {};
        setSubInfo(data);

        const now = new Date();
        const status = String(data.status || "").toLowerCase();
        const endDate = resolveEndDate(data);
        const timeValid = !!endDate && endDate.getTime() > now.getTime();
        const statusOk = status === "active" || status === "trial";

        // ✅ الباقة الحالية فقط لو الاشتراك شغّال فعلاً (وقت + status)
        if (statusOk && timeValid) {
          const pk = String(data.planKey || data.subscriberPlanKey || "").trim();
          setActivePlanKey(pk);
        } else {
          setActivePlanKey("");
        }
      } catch (e) {
        console.error("load companySubscriptions failed:", e);
        if (!alive) return;
        setSubInfo(null);
        setActivePlanKey("");
      } finally {
        if (alive) setSubInfoLoading(false);
      }
    }

    loadSub();
    return () => {
      alive = false;
    };
  }, [clientDocId]);

  // ✅ Load plans
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(firestore, "companySubscriptionPlans"));
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const filtered = arr
          .filter((p) => p?.isActive !== false)
          .sort((a, b) => (a?.sortIndex ?? 999) - (b?.sortIndex ?? 999));

        if (alive) setPlans(filtered);
      } catch (e) {
        console.error("load plans failed:", e);
        if (alive) setPlans([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  // =========================
  // ✅ Subscribe (Plans)
  // =========================
  const handleSubscribe = useCallback(
    async ({
      planKey,
      pricingKey,
      price,
      monthsShown,
      paidMonths,
      bonus,
      isOffer,
      isMost,
      subscriptionName,
      subscriptionDays,
    }) => {
      // ✅ external callback override
      if (typeof onSubscribe === "function") {
        return onSubscribe({
          planKey,
          pricingKey,
          price,
          monthsShown,
          paidMonths,
          bonus,
          isOffer,
          isMost,
          subscriptionName,
          subscriptionDays,
        });
      }

      if (submitting) return;
      setSubmitting(true);

      try {
        const user = auth.currentUser;
        if (!user) {
          alert(lang === "ar" ? "لازم تسجل دخول الأول" : "Please login first");
          router.push("/login");
          return;
        }

        let finalClientDocId = (clientDocId || "").trim();
        if (!finalClientDocId) {
          finalClientDocId = await resolveClientDocId({ searchParams, uid: user.uid });
        }

        if (!finalClientDocId) {
          alert(
            lang === "ar"
              ? "تعذر تحديد رقم العميل (COM-...). افتح الداشبورد بالرابط الصحيح أو تأكد من usersByUid."
              : "Unable to resolve client id (COM-...). Ensure URL has ?userId=COM-... or usersByUid mapping exists."
          );
          return;
        }

        const basePrice = toNumberSafe(price);
        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          alert(lang === "ar" ? "السعر غير صالح" : "Invalid price");
          return;
        }

        const days = calcDays(subscriptionDays, monthsShown);

        const subName =
          subscriptionName?.trim?.() ||
          (lang === "ar" ? `اشتراك ${planKey}` : `Subscription ${planKey}`);

        const totals = buildGatewayTotals(basePrice);

        const payload = {
          requestType: "subscription",
          amountAED: totals.finalPrice,

          customerId: finalClientDocId,
          clientType: "company",
          userEmail: user.email,
          lang,

          planKey,
          pricingKey,

          monthsShown,
          paidMonths,
          bonus,
          isOffer: !!isOffer,
          isMost: !!isMost,

          subscriptionDays: days,
          giftDays: 0,

          serviceId: `subscription_${planKey}`,
          serviceName: subName,

          baseAmountAED: totals.baseAmountAED,
          vatAED: totals.vatAED,
          processingFeeAED: totals.processingFeeAED,
        };

        const r = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed to create payment intent");

        const paymentDataForUI = {
          lang,
          requestType: "subscription",

          clientSecret: data.clientSecret,
          orderNumber: data.orderNumber,

          serviceId: `subscription_${planKey}`,
          serviceName: subName,
          subscriptionName: subName,

          planKey,
          pricingKey,
          subscriptionDays: days,

          price: totals.totalPrice,
          totalPrice: totals.totalPrice,
          finalPrice: totals.finalPrice,

          printingFee: 0,
          vat: totals.vatAED,
          coinDiscount: 0,
          processingFee: totals.processingFeeAED,

          breakdown: data?.breakdown || {
            baseAmountAED: totals.baseAmountAED,
            vatAED: totals.vatAED,
            processingFeeAED: totals.processingFeeAED,
            totalAED: totals.finalPrice,
          },

          baseAmountAED: totals.baseAmountAED,
          userEmail: user.email,
        };

        localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(paymentDataForUI));
        router.push("/payment/service");
      } catch (e) {
        console.error("subscribe failed:", e);
        alert(lang === "ar" ? "حصل خطأ أثناء بدء الدفع" : "Failed to start payment");
      } finally {
        setSubmitting(false);
      }
    },
    [onSubscribe, lang, router, submitting, clientDocId, searchParams]
  );

  // =========================
  // ✅ Buy Addon
  // =========================
  const handleBuyAddon = useCallback(
    async (addon) => {
      if (submitting) return;
      setSubmitting(true);

      try {
        const user = auth.currentUser;
        if (!user) {
          alert(lang === "ar" ? "لازم تسجل دخول الأول" : "Please login first");
          router.push("/login");
          return;
        }

        let finalClientDocId = (clientDocId || "").trim();
        if (!finalClientDocId) {
          finalClientDocId = await resolveClientDocId({ searchParams, uid: user.uid });
        }

        if (!finalClientDocId) {
          alert(
            lang === "ar"
              ? "تعذر تحديد رقم العميل (COM-...). افتح الداشبورد بالرابط الصحيح أو تأكد من usersByUid."
              : "Unable to resolve client id (COM-...). Ensure URL has ?userId=COM-... or usersByUid mapping exists."
          );
          return;
        }

        const addonKey = String(addon?.addonKey || addon?.id || "").trim();
        if (!addonKey) {
          alert(lang === "ar" ? "Addon غير صالح" : "Invalid addon");
          return;
        }

        const titleAr = addon?.title?.ar;
        const titleEn = addon?.title?.en;

        const addonName =
          (lang === "ar" ? titleAr : titleEn) ||
          titleAr ||
          titleEn ||
          (lang === "ar" ? "إضافة معاملات" : "Transaction Add-on");

        const basePrice = round2(addon?.price ?? 0);
        if (!basePrice || basePrice <= 0) {
          alert(lang === "ar" ? "سعر الإضافة غير متاح" : "Addon price not available");
          return;
        }

        const totals = buildGatewayTotals(basePrice);

        const payload = {
          requestType: "addon",
          amountAED: totals.finalPrice,

          customerId: finalClientDocId,
          clientType: "company",
          userEmail: user.email,
          lang,

          addonKey,
          serviceId: `addon_${addonKey}`,
          serviceName: String(addonName),

          baseAmountAED: totals.baseAmountAED,
          vatAED: totals.vatAED,
          processingFeeAED: totals.processingFeeAED,
        };

        const r = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed to create payment intent");

        const paymentDataForUI = {
          lang,
          requestType: "addon",

          clientSecret: data.clientSecret,
          orderNumber: data.orderNumber,

          serviceId: `addon_${addonKey}`,
          serviceName: String(addonName),

          addonKey,
          addonType: String(data?.addon?.type || addon?.type || "bundle"),
          addonQty: Number(data?.addon?.qty || addon?.qty || 0),

          price: totals.totalPrice,
          totalPrice: totals.totalPrice,
          finalPrice: totals.finalPrice,

          printingFee: 0,
          vat: totals.vatAED,
          coinDiscount: 0,
          processingFee: totals.processingFeeAED,

          breakdown: data?.breakdown || {
            baseAmountAED: totals.baseAmountAED,
            vatAED: totals.vatAED,
            processingFeeAED: totals.processingFeeAED,
            totalAED: totals.finalPrice,
          },

          baseAmountAED: totals.baseAmountAED,
          userEmail: user.email,
        };

        localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(paymentDataForUI));
        router.push("/payment/service");
      } catch (e) {
        console.error("buy addon failed:", e);
        alert(lang === "ar" ? "حصل خطأ أثناء بدء الدفع" : "Failed to start payment");
      } finally {
        setSubmitting(false);
      }
    },
    [lang, router, submitting, clientDocId, searchParams]
  );

  const emptyText = useMemo(
    () => (lang === "ar" ? "لا توجد باقات متاحة حالياً." : "No plans available right now."),
    [lang]
  );

  if (loading) {
    return (
      <div className="w-full flex justify-center py-10 text-white/80">
        {lang === "ar" ? "جاري تحميل الباقات..." : "Loading plans..."}
      </div>
    );
  }

  if (!plans.length) {
    return <div className="w-full text-center py-10 text-white/70">{emptyText}</div>;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <CompanyPlanCard
            key={plan.id}
            plan={plan}
            lang={lang}
            darkMode={darkMode}
            onSubscribe={handleSubscribe}
            disabled={submitting}

            // ✅ NEW props for UI states
            activePlanKey={activePlanKey}
            subInfo={subInfo}
            subInfoLoading={subInfoLoading}
          />
        ))}
      </div>

      <AddonsBottomStrip
        lang={lang}
        darkMode={darkMode}
        addons={addons}
        loading={addonsLoading}
        disabled={submitting}
        onBuyAddon={handleBuyAddon}
      />
    </div>
  );
}
