"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { firestore, auth } from "@/lib/firebase.client";
import { useRouter, useSearchParams } from "next/navigation";
import CompanyPlanCard from "./CompanyPlanCard";
import AddonsBottomStrip from "./AddonsBottomStrip";

// ✅ Storage key used by /payment/service page
const PAYMENT_STORAGE_KEY = "paymentData";

function toNumberSafe(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function calcDays(subscriptionDays, monthsShown) {
  const sd = toNumberSafe(subscriptionDays || 0);
  if (Number.isFinite(sd) && sd > 0) return Math.max(0, Math.round(sd));

  const m = toNumberSafe(monthsShown || 0);
  if (Number.isFinite(m) && m > 0) return Math.max(0, Math.round(m * 30));

  return 0;
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

        // ✅ MATCH SERVER: amountAED + subscription metadata
        const payload = {
          requestType: "subscription",
          amountAED: basePrice,

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
        };

        const r = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed to create payment intent");

        // ✅ ALWAYS rely on server breakdown
        const breakdown = data?.breakdown || {};
        const totalBefore = Number(breakdown.baseAmountAED ?? basePrice);
        const processingFeeSafe = Number(breakdown.processingFeeAED ?? data?.processingFee ?? 0);
        const final = Number(breakdown.totalAED ?? data?.finalPrice ?? 0);

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

          price: totalBefore,
          totalPrice: totalBefore,
          finalPrice: final,

          printingFee: 0,
          vat: 0,
          coinDiscount: 0,
          processingFee: processingFeeSafe,

          breakdown: data?.breakdown || null,
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
  // ✅ Buy Addon (SERVER resolves price/qty from catalog)
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

        // ✅ MATCH SERVER: addonKey only (server reads catalog: price + qty)
        const payload = {
          requestType: "addon",

          customerId: finalClientDocId,
          clientType: "company",
          userEmail: user.email,
          lang,

          addonKey,
          serviceId: `addon_${addonKey}`,
          serviceName: String(addonName),
        };

        const r = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) throw new Error(data?.error || "Failed to create payment intent");

        // ✅ ALWAYS rely on server breakdown
        const breakdown = data?.breakdown || {};
        const totalBefore = Number(breakdown.baseAmountAED ?? 0);
        const processingFeeSafe = Number(breakdown.processingFeeAED ?? data?.processingFee ?? 0);
        const final = Number(breakdown.totalAED ?? data?.finalPrice ?? 0);

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

          price: totalBefore,
          totalPrice: totalBefore,
          finalPrice: final,

          printingFee: 0,
          vat: 0,
          coinDiscount: 0,
          processingFee: processingFeeSafe,

          breakdown: data?.breakdown || null,
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
