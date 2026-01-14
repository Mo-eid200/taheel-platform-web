"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";
import MonthlyCreditsFloatingCounter from "@/components/subscriptions/MonthlyCreditsFloatingCounter";
import SectionTitle from "@/components/services/SectionTitle";
import ServiceProfileCard from "@/components/services/ServiceProfileCard";

const EMPTY_SUB = {
  loading: false,

  // ✅ isActive الحقيقي حسب اتفاقنا: مربوط بالوقت فقط
  isActive: false,

  // ✅ timeActive: للعداد (نفس isActive)
  timeActive: false,

  status: "none",
  planKey: "",
  planName: "",
  startAt: null,
  endAt: null,
  usedDocId: "",
};

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
      c.customerId, // غالبًا COM-xxx
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

    async function loadSubscription() {
      if (!isCompany || candidateIds.length === 0) {
        if (mounted) setSubInfo({ ...EMPTY_SUB, loading: false });
        return;
      }

      try {
        if (mounted) setSubInfo((p) => ({ ...p, loading: true }));

        let found = null;
        let foundId = "";

        for (const id of candidateIds) {
          const ref = doc(firestore, "companySubscriptions", String(id));
          const snap = await getDoc(ref);
          if (snap.exists()) {
            found = snap.data() || {};
            foundId = id;
            break;
          }
        }

        if (!found) {
          if (mounted) setSubInfo({ ...EMPTY_SUB, loading: false });
          return;
        }

        // ==========================
        // ✅ الوقت فقط = مصدر الحقيقة
        // ==========================
        const startMs =
          found.startAt?.toMillis?.() ??
          (found.startAt?.seconds ? found.startAt.seconds * 1000 : 0) ??
          (found.startAtISO ? Date.parse(found.startAtISO) : 0);

        const endMs =
          found.endAt?.toMillis?.() ??
          (found.endAt?.seconds ? found.endAt.seconds * 1000 : 0) ??
          (found.endAtISO ? Date.parse(found.endAtISO) : 0);

        const now = Date.now();
        const timeActive = (!startMs || now >= startMs) && (!endMs || now < endMs);

        // ✅ حسب اتفاقنا: isActive = timeActive (حتى لو العدادات 0)
        const isActive = Boolean(timeActive);

        if (mounted) {
          setSubInfo({
            loading: false,
            isActive,
            timeActive, // للعداد

            status: found.status || "none",
            planKey: found.planKey || "",
            planName: found.planName || "",
            startAt: found.startAt || null,
            endAt: found.endAt || null,
            usedDocId: foundId,
          });
        }
      } catch (e) {
        console.error("loadSubscription failed:", e);
        if (mounted) setSubInfo({ ...EMPTY_SUB, loading: false, status: "error" });
      }
    }

    loadSubscription();
    return () => {
      mounted = false;
    };
  }, [isCompany, candidateKey, candidateIds]);

  // ✅ مصدر واحد واضح
  const subscriptionTimeActive = isCompany && Boolean(subInfo.timeActive); // للعداد (ظهور/اختفاء)
  const subscriptionActive = isCompany && Boolean(subInfo.isActive); // للكارت (إعفاءات)

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

      {/* ✅ العداد يظهر طول ما وقت الاشتراك شغال فقط */}
{isCompany && subscriptionTimeActive && (
  <MonthlyCreditsFloatingCounter companyDocId={client?.customerId} lang={lang} />
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
            customerId={client?.customerId}
            longDescription={srv.longDescription}
            longDescription_en={srv.longDescription_en}
            onPaid={onPaid}
            addNotification={addNotification}
            serviceId={srv.serviceId}
            repeatable={srv.repeatable}
            allowPaperCount={srv.allowPaperCount}
            provider={srv.provider}

            // ✅ الإعفاءات داخل الكارت = isActive (حتى لو العدادات 0)
            subscriptionActive={subscriptionActive}
          />
        ))}
      </div>
    </>
  );
}
