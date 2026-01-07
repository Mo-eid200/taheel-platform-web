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

  // =========================
  // ✅ Subscription state (companySubscriptions/{companyDocId})
  // =========================
  const [subInfo, setSubInfo] = useState({
    loading: false,
    active: false,
    status: "none",
    planKey: "",
    planName: "",
    startAt: null,
    endAt: null,
  });

  const isCompany = category === "company";

  // ✅ IMPORTANT: companySubscriptions docId عندك = companyDocId = "COM-400-0106"
  // فالأولوية هنا للـ companyDocId/customerId/companyId (مش userId)
  const companyDocId =
    client?.companyDocId ||
    client?.customerId ||
    client?.companyId ||
    client?.id ||
    client?.uid ||
    client?.userId ||
    "";

  useEffect(() => {
    let mounted = true;

    async function loadSubscription() {
      // الاشتراك يهمنا فقط لحساب شركة + عندنا docId
      if (!isCompany || !companyDocId) {
        if (mounted) {
          setSubInfo((p) => ({ ...p, loading: false, active: false, status: "none" }));
        }
        return;
      }

      try {
        if (mounted) setSubInfo((p) => ({ ...p, loading: true }));

        const ref = doc(firestore, "companySubscriptions", String(companyDocId));
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          if (mounted) {
            setSubInfo({
              loading: false,
              active: false,
              status: "none",
              planKey: "",
              planName: "",
              startAt: null,
              endAt: null,
            });
          }
          return;
        }

        const d = snap.data() || {};
        const status = String(d.status || "").toLowerCase();
        const isActiveFlag = Boolean(d.isActive);

        // ✅ اعتمد على endAt فقط (تجاهل startAt عشان كان بيتسجل غلط عندك)
        const endMs =
          d.endAt?.toMillis ? d.endAt.toMillis() :
          d.endAt?.seconds ? d.endAt.seconds * 1000 :
          d.endAtISO ? Date.parse(d.endAtISO) :
          0;

        const now = Date.now();
        const notExpired = !endMs || now < endMs;

        const active = isActiveFlag && status === "active" && notExpired;

        if (mounted) {
          setSubInfo({
            loading: false,
            active,
            status: d.status || "none",
            planKey: d.planKey || "",
            planName: d.planName || "",
            startAt: d.startAt || null,
            endAt: d.endAt || null,
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
          });
        }
      }
    }

    loadSubscription();
    return () => {
      mounted = false;
    };
  }, [isCompany, companyDocId]);

  // ✅ ده اللي بيروح للكارت
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
            // ✅ أهم سطر
            subscriptionActive={subscriptionActive}
          />
        ))}
      </div>
    </>
  );
}
