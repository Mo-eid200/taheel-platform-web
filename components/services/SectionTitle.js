"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import MonthlyCreditsFloatingCounter from "@/components/subscriptions/MonthlyCreditsFloatingCounter";
import SectionTitle from "@/components/services/SectionTitle";
import ServiceProfileCard from "@/components/services/ServiceProfileCard";

const EMPTY_SUB = {
  loading: false,
  benefitsActive: false, // من companySubscriptions.isActive (رصيد)
  timeActive: false,     // من users.subscriptionActive + endAt (وقت الاشتراك)
  status: "none",
  planKey: "",
  planName: "",
  resolvedCompanyId: "",
};

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

  const candidateIds = useMemo(() => {
    const c = client || {};
    const arr = [
      c.customerId,      // COM-xxx
      c.companyDocId,
      c.companyId,
      c.userId,
      c.uid,
      c.id,
      c.userUid,
      c.firebaseUid,
    ]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);

    return Array.from(new Set(arr));
  }, [client]);

  const candidateKey = useMemo(() => candidateIds.join("|"), [candidateIds]);

  const [subInfo, setSubInfo] = useState(() => ({
    ...EMPTY_SUB,
    loading: isCompany,
  }));

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!isCompany || candidateIds.length === 0) {
        if (mounted) setSubInfo({ ...EMPTY_SUB, loading: false });
        return;
      }

      try {
        if (mounted) setSubInfo((p) => ({ ...p, loading: true }));

        // 1) لاقي ID شغال في users (لوقت الاشتراك)
        let userData = null;
        let resolvedId = "";

        for (const id of candidateIds) {
          const snap = await getDoc(doc(firestore, "users", id));
          if (snap.exists()) {
            userData = snap.data() || {};
            resolvedId = id;
            break;
          }
        }

        // لو مفيش users doc بالمرشحّات، جرّب companySubscriptions على الأقل
        if (!resolvedId) {
          for (const id of candidateIds) {
            const snap = await getDoc(doc(firestore, "companySubscriptions", id));
            if (snap.exists()) {
              resolvedId = id;
              break;
            }
          }
        }

        if (!resolvedId) {
          if (mounted) setSubInfo({ ...EMPTY_SUB, loading: false });
          return;
        }

        // 2) timeActive من users (وقت الاشتراك فقط)
        const subFlag = Boolean(userData?.subscriptionActive);
        const endAtMs = toMs(userData?.subscriptionEndAtISO || userData?.subscriptionEndAt);
        const now = Date.now();
        const timeActive = subFlag && (!endAtMs || now < endAtMs);

        // 3) benefitsActive من companySubscriptions.isActive (رصيد)
        const subSnap = await getDoc(doc(firestore, "companySubscriptions", resolvedId));
        const subData = subSnap.exists() ? subSnap.data() : {};

        const benefitsActive = Boolean(subData?.isActive);

        if (mounted) {
          setSubInfo({
            loading: false,
            resolvedCompanyId: resolvedId,
            timeActive,
            benefitsActive,
            status: subData?.status || "none",
            planKey: subData?.planKey || "",
            planName: subData?.planName || "",
          });
        }
      } catch (e) {
        console.error("load subscription failed:", e);
        if (mounted) setSubInfo({ ...EMPTY_SUB, loading: false });
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [isCompany, candidateKey, candidateIds]);

  const companyId = subInfo.resolvedCompanyId;

  // ✅ العداد: وقت الاشتراك فقط
  const subscriptionTimeActive = isCompany && Boolean(subInfo.timeActive);

  // ✅ الكارت: إعفاءات حسب الرصيد فقط
  const subscriptionActive = isCompany && Boolean(subInfo.benefitsActive);

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

      {/* ✅ العداد يظهر بالوقت فقط */}
      {subscriptionTimeActive && companyId && (
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
            subscriptionActive={subscriptionActive}
          />
        ))}
      </div>
    </>
  );
}
