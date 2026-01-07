"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase.client";

import SectionTitle from "@/components/services/SectionTitle";
import ServiceProfileCard from "@/components/services/ServiceProfileCard";

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

  const [subInfo, setSubInfo] = useState({
    loading: false,
    active: false,
    status: "none",
    planKey: "",
    planName: "",
    startAt: null,
    endAt: null,
    usedDocId: "",
  });

  const isCompany = category === "company";

  // ✅ جرّب كل الـ IDs المحتملة (بالترتيب)
  const candidateIds = useMemo(() => {
    const c = client || {};
    const arr = [
      c.companyDocId,
      c.customerId,
      c.userId,
      c.uid,
      c.id,
      c.companyId,
      c.userUid,
      c.firebaseUid,
    ]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);

    // إزالة التكرار
    return Array.from(new Set(arr));
  }, [client]);

  useEffect(() => {
    let mounted = true;

    async function loadSubscription() {
      if (!isCompany || candidateIds.length === 0) {
        if (mounted) setSubInfo((p) => ({ ...p, loading: false, active: false, status: "none" }));
        return;
      }

      try {
        if (mounted) setSubInfo((p) => ({ ...p, loading: true }));

        let found = null;
        let foundId = "";

        // ✅ حاول getDoc لكل ID لحد ما تلاقي الدوك
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
          if (mounted) {
            setSubInfo({
              loading: false,
              active: false,
              status: "none",
              planKey: "",
              planName: "",
              startAt: null,
              endAt: null,
              usedDocId: "",
            });
          }
          return;
        }

        const status = String(found.status || "").toLowerCase();
        const isActiveFlag = Boolean(found.isActive);

        const startMs =
          found.startAt?.toMillis ? found.startAt.toMillis() :
          found.startAt?.seconds ? found.startAt.seconds * 1000 :
          found.startAtISO ? Date.parse(found.startAtISO) :
          0;

        const endMs =
          found.endAt?.toMillis ? found.endAt.toMillis() :
          found.endAt?.seconds ? found.endAt.seconds * 1000 :
          found.endAtISO ? Date.parse(found.endAtISO) :
          0;

        const now = Date.now();
        const withinWindow = (!startMs || now >= startMs) && (!endMs || now < endMs);

        const active = isActiveFlag && status === "active" && withinWindow;

        if (mounted) {
          setSubInfo({
            loading: false,
            active,
            status: found.status || "none",
            planKey: found.planKey || "",
            planName: found.planName || "",
            startAt: found.startAt || null,
            endAt: found.endAt || null,
            usedDocId: foundId,
          });
        }
      } catch (e) {
        if (mounted) {
          setSubInfo({
            loading: false,
            active: false,
            status: "error",
            planKey: "",
            planName: "",
            startAt: null,
            endAt: null,
            usedDocId: "",
          });
        }
      }
    }

    loadSubscription();
    return () => {
      mounted = false;
    };
  }, [isCompany, candidateIds]);

  const subscriptionActive = isCompany && Boolean(subInfo.active);

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {filteredServices.map((srv, i) => (
          <ServiceProfileCard
            key={(srv.serviceId || srv.name || "srv") + "-" + i}
            category={category}
            name={srv.name}
            name_en={srv.name_en}
            description={srv.description}
            description_en={srv.description_en}
            price={srv.price}
            printingFee={srv.printingFee}
            tax={srv.tax}
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
            subscriptionActive={subscriptionActive} // ✅
          />
        ))}
      </div>
    </>
  );
}
