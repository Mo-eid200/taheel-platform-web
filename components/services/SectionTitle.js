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
  selectedSection,
  freePrinting,
}) {
  const filteredServices = (services || []).filter(filterService);

  if (!filteredServices.length) {
    return (
      <div className="text-gray-400 text-xl text-center py-8">
        {lang === "ar" ? "لا توجد خدمات متاحة حالياً" : "No services available now"}
      </div>
    );
  }

  // ✅ الاشتراك (Free Printing) يشتغل فقط داخل قسم خدمات الشركات + حساب شركة
  const isCompanyServicesSection = selectedSection === "companyServices";
  const effectiveFreePrinting =
    Boolean(freePrinting) && isCompanyServicesSection && category === "company";

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

            // ✅ سيبها زي ما هي — الكارت هيعرضها "-" / 0 في حالة الاشتراك
            printingFee={srv.printingFee}
            tax={srv.tax}
            clientPrice={srv.clientPrice}

            duration={srv.duration}
            requiredDocuments={srv.requiredDocuments || srv.documents || []}
            requireUpload={srv.requireUpload}
            coins={srv.coins || 0}
            lang={lang}

            // ✅ حماية لو client لسه محمّلش
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
            pricePerPage={srv.pricePerPage}

            // ✅ المهم: ابعت freePrinting الحقيقي فقط
            freePrinting={effectiveFreePrinting}
          />
        ))}
      </div>
    </>
  );
}
