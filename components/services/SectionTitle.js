"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import MonthlyCreditsFloatingCounter from "@/components/subscriptions/MonthlyCreditsFloatingCounter";
import SectionTitle from "@/components/services/SectionTitle";
import ServiceProfileCard from "@/components/services/ServiceProfileCard";

function toMs(v) {
  if (!v) return 0;
  if (typeof v === "object" && typeof v.toDate === "function") return v.toDate().getTime();
  if (typeof v === "object" && typeof v.seconds === "number") return v.seconds * 1000;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

export default function ServiceSection({
  icon,
  color,
  title,
  services = [],
  filterService,
  lang,
  client,
  onPaid,
  addNotification,
  category,
}) {
  const filteredServices = useMemo(
    () => (services || []).filter(filterService),
    [services, filterService]
  );

  const isCompany = String(category || "").toLowerCase().includes("company");
  const companyId = String(client?.customerId || "").trim(); // COM-xxx

  // ✅ (A) COUNTER visibility: by TIME ONLY (users start/end) - NOT by subscriptionActive
  const [subscriptionTimeActive, setSubscriptionTimeActive] = useState(false);

  // ✅ (B) BENEFITS: by CREDITS ONLY (companySubscriptions.isActive)
  const [subscriptionBenefitsActive, setSubscriptionBenefitsActive] = useState(false);

  useEffect(() => {
    // reset if not a company
    if (!isCompany || !companyId) {
      setSubscriptionTimeActive(false);
      setSubscriptionBenefitsActive(false);
      return;
    }

    // -----------------------------
    // (1) USERS => TIME WINDOW ONLY
    // -----------------------------
    const unsubUser = onSnapshot(doc(firestore, "users", companyId), (snap) => {
      const u = snap.exists() ? snap.data() : null;

      // ✅ ONLY TIME WINDOW (start/end)
      const startAtMs = toMs(u?.subscriptionStartAtISO || u?.subscriptionStartAt);
      const endAtMs = toMs(u?.subscriptionEndAtISO || u?.subscriptionEndAt);
      const now = Date.now();

      // active if now within [start, end)
      const timeOk =
        (!startAtMs || now >= startAtMs) &&
        (!endAtMs || now < endAtMs);

      setSubscriptionTimeActive(Boolean(timeOk));
    });

    // -----------------------------------------
    // (2) companySubscriptions => CREDITS ONLY
    // -----------------------------------------
    const unsubSub = onSnapshot(doc(firestore, "companySubscriptions", companyId), (snap) => {
      const s = snap.exists() ? snap.data() : null;

      // ✅ credits-driven benefits (webhook flips it false when credits = 0)
      setSubscriptionBenefitsActive(Boolean(s?.isActive));
    });

    return () => {
      unsubUser?.();
      unsubSub?.();
    };
  }, [isCompany, companyId]);

  if (!filteredServices.length) {
    return (
      <div className="text-gray-400 text-xl text-center py-8">
        {lang === "ar" ? "لا توجد خدمات متاحة حالياً" : "No services available now"}
      </div>
    );
  }

  return (
    <>
      <SectionTitle icon={icon} color={color}>
        {title}
      </SectionTitle>

      {/* ✅ COUNTER: show/hide by TIME ONLY (even if credits = 0) */}
      {isCompany && companyId && subscriptionTimeActive && (
        <MonthlyCreditsFloatingCounter companyDocId={companyId} lang={lang} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {filteredServices.map((srv, i) => (
          <ServiceProfileCard
            key={(srv.serviceId || srv.name || "srv") + "-" + i}
            active={typeof srv.active === "boolean" ? srv.active : true}
            category={category}
            name={srv.name}
            name_en={srv.name_en}
            description={srv.description}
            description_en={srv.description_en}
            price={srv.price}
            printingFee={srv.printingFee}
            clientPrice={srv.clientPrice}
            duration={srv.duration}
            requiredDocuments={srv.requiredDocuments || srv.documents || []}
            requireUpload={srv.requireUpload}
            coins={srv.coins || 0}
            lang={lang}
            userId={client?.userId}
            userWallet={client?.walletBalance || 0}
            userCoins={client?.coins || 0}
            userEmail={client?.email}
            customerId={companyId}
            longDescription={srv.longDescription}
            longDescription_en={srv.longDescription_en}
            onPaid={onPaid}
            addNotification={addNotification}
            serviceId={srv.serviceId}
            repeatable={srv.repeatable}
            allowPaperCount={srv.allowPaperCount}
            provider={srv.provider}

            // ✅ BENEFITS on cards: credits ONLY
            subscriptionActive={isCompany && subscriptionBenefitsActive}
          />
        ))}
      </div>
    </>
  );
}
