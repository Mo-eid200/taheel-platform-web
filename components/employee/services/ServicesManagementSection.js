import React, { useState, useEffect, useRef } from "react";
import { FaSearch } from "react-icons/fa";
import { firestore } from "@/lib/firebase.client";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import ServiceUploadModal from "./ServiceUploadModal";
import { useRouter } from "next/navigation";
import calcStripeFees from "@/utils/calcStripeFees"; // ✅ الاستيراد الصحيح لدالة الرسوم

const PREFIXES = [
  { key: "RES", labelAr: "مقيم", labelEn: "Resident" },
  { key: "NON", labelAr: "غير مقيم", labelEn: "Non-Resident" },
  { key: "COM", labelAr: "شركة", labelEn: "Company" }
];

function normalizeArabic(text) {
  if (!text) return "";
  return text
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ً|ٌ|ٍ|َ|ُ|ِ|ّ|ْ/g, "")
    .toLowerCase();
}

export default function ServicesManagementSection({ employeeData, lang }) {
  const [prefix, setPrefix] = useState("RES");
  const [clientNumber, setClientNumber] = useState("");
  const [fullClientId, setFullClientId] = useState("");
  const [client, setClient] = useState(null);

  const [services, setServices] = useState([]);
  const [otherServices, setOtherServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedService, setSelectedService] = useState(null);

  const [serviceSearch, setServiceSearch] = useState("");
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const dropdownRef = useRef();

  // مودال رفع المستندات
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [allDocsUploaded, setAllDocsUploaded] = useState(false);

  // حالة الطلب الجديد
  const [orderCreated, setOrderCreated] = useState(false);
  const [orderInfo, setOrderInfo] = useState(null);

  // لينك الدفع
  const [paymentUrl, setPaymentUrl] = useState("");

  const router = useRouter();

  async function fetchOtherServices() {
    const q = query(collection(firestore, "services"), where("type", "==", "other"));
    const snap = await getDocs(q);
    let arr = [];
    snap.forEach(doc => {
      arr.push({ id: doc.id, ...doc.data() });
    });
    const docRef = doc(firestore, "servicesByClientType", "other");
    const snapOther = await getDoc(docRef);
    if (snapOther.exists()) {
      const data = snapOther.data();
      const otherArr = Object.entries(data)
        .filter(([key, val]) => key.startsWith("service") && val.active)
        .map(([key, val]) => ({ id: key, ...val }));
      arr = arr.concat(otherArr);
    }
    arr = arr.filter((srv, idx, self) => self.findIndex(s => s.id === srv.id) === idx);
    setOtherServices(arr);
  }

  function filterFlexible(arr) {
    const searchNorm = normalizeArabic(serviceSearch.trim());
    return searchNorm
      ? arr.filter(
          s =>
            normalizeArabic(s.name || "").includes(searchNorm) ||
            (Array.isArray(s.providers)
              ? normalizeArabic(s.providers.join(", ")).includes(searchNorm)
              : false)
        )
      : arr;
  }
  const filteredServices = filterFlexible(services);
  const filteredOtherServices = filterFlexible(otherServices);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setServicesDropdownOpen(false);
      }
    }
    if (servicesDropdownOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [servicesDropdownOpen]);

  function handleClientNumberChange(e) {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 7) value = value.slice(0, 7);
    let formatted = value;
    if (value.length > 3) {
      formatted = value.slice(0, 3) + '-' + value.slice(3);
    }
    setClientNumber(formatted);
  }

  async function handleSearch(e) {
    e.preventDefault();
    setOrderCreated(false);
    setOrderInfo(null);
    setAllDocsUploaded(false);
    setUploadedDocs({});
    const isValid = /^\d{3}-\d{4}$/.test(clientNumber);
    const clientId = isValid ? `${prefix}-${clientNumber}` : "";
    setFullClientId(clientId);

    if (!clientId || clientId.length < 12) {
      setClient(null);
      setServices([]);
      setOtherServices([]);
      setSelectedServiceId("");
      setSelectedService(null);
      return;
    }

    const docRef = doc(firestore, "users", clientId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      setClient({ ...data, customerId: snap.id });
      const type = data.accountType || data.type;
      await fetchServicesForType(type);
      await fetchOtherServices();
    } else {
      setClient(null);
      setServices([]);
      setOtherServices([]);
    }
    setSelectedServiceId("");
    setSelectedService(null);
  }

  async function fetchServicesForType(type) {
    if (!type) return setServices([]);
    const clientType = String(type).toLowerCase();
    const docRef = doc(firestore, "servicesByClientType", clientType);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const servicesArr = Object.entries(data)
        .filter(([key, val]) => key.startsWith("service") && val.active)
        .map(([key, val]) => ({ id: key, ...val }));
      setServices(servicesArr);
    } else {
      setServices([]);
    }
  }

  useEffect(() => {
    if (!selectedServiceId) {
      setSelectedService(null);
      setUploadModalOpen(false);
      return;
    }
    const all = [...services, ...otherServices];
    const srv = all.find(s => s.id === selectedServiceId);
    setSelectedService(srv || null);
    setUploadModalOpen(false);
  }, [selectedServiceId, services, otherServices]);

  // دالة موحدة لإنشاء الطلب والدفع عبر Stripe API للموظف أو العميل
  async function handleStartPayment({
    client,
    selectedService,
    uploadedDocs,
    employeeData,
    lang,
    setOrderCreated,
    setOrderInfo
  }) {
    // الحسابات بنفس منطق العميل
    const servicePrice = Number(selectedService.price) || 0;
    const printingFee = Number(selectedService.printingFee) || 0;
    const vat = +(printingFee * 0.05).toFixed(2);
    const totalPrice = +(servicePrice + printingFee + vat).toFixed(2);
    const coinDiscount = 0; // خصم الكوينات (لو فيه، أضفه هنا)
    const finalPriceBeforeGateway = +(totalPrice - coinDiscount).toFixed(2);

    const stripeFeesResult = calcStripeFees(finalPriceBeforeGateway);
    const processingFee = stripeFeesResult.stripeFee;
    const finalPrice = stripeFeesResult.totalAmount;

    const serviceProviders = Array.isArray(selectedService.providers) ? selectedService.providers : [];
    const isSpecialist = serviceProviders.some(
      p =>
        p === employeeData?.providerName ||
        p === employeeData?.speciality ||
        p === employeeData?.id ||
        p === employeeData?.name
    );
    const assignedTo = isSpecialist ? employeeData.id : "";
    const assignedToName = isSpecialist ? employeeData.name : "";

    // استدعاء API لإنشاء الطلب والدفع في Stripe
    const res = await fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: finalPrice,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        customerId: client?.customerId,
        userEmail: client?.email,
        attachments: uploadedDocs,
        providers: serviceProviders,
        assignedTo,
        assignedToName,
        employeeData,
        lang
      }),
    });
    const result = await res.json();

    if (!result || !result.clientSecret) {
      alert(lang === "ar" ? "تعذر إنشاء بوابة الدفع، يرجى المحاولة لاحقاً." : "Could not create payment gateway. Please try again later.");
      return;
    }

    // **هنا الهيكل المتطابق مع العميل**
    const paymentData = {
      orderNumber: result.orderNumber,
      clientSecret: result.clientSecret,
      service: {
        name: selectedService.name,
        id: selectedService.id,
        price: servicePrice,
        printingFee,
        vat,
        coinDiscount,
        userEmail: client?.email,
        providers: serviceProviders,
        employeeData
      },
      totalPrice,
      processingFee,
      finalPrice,
      customerId: client?.customerId,
      lang,
      uploadedDocs,
      assignedTo,
      assignedToName
    };

    // حفظ بنفس هيكل العميل
    localStorage.setItem("paymentData", JSON.stringify(paymentData));

    // حفظ بيانات الدفع في Firestore/requests بنفس الهيكل الموحد
    await setDoc(doc(firestore, "requests", result.orderNumber), {
      ...paymentData,
      status: "awaiting_payment",
      createdAt: new Date().toISOString()
    });

    const link = `${window.location.origin}/payment/service?order=${result.orderNumber}`;
    setOrderCreated(true);
    setOrderInfo({
      orderNumber: result.orderNumber,
      paymentUrl: link
    });
    setPaymentUrl(link);
  }

  function ClientInfoBox() {
    if (!client) return null;
    return (
      <div className="w-full rounded-xl overflow-hidden shadow border border-emerald-100 bg-white animate-fade-in mb-2">
        <div className="bg-emerald-50 px-4 py-2 text-center font-bold text-emerald-800 text-lg">
          {lang === "ar" ? "بيانات العميل" : "Client Info"}
        </div>
        <div className="px-4 py-4 grid grid-cols-1 gap-2 text-base font-semibold text-gray-800">
          <div>
            <span className="inline-block w-32 text-emerald-700">{lang === "ar" ? "اسم العميل:" : "Client Name:"}</span>
            <span>{client.firstName} {client.lastName}</span>
          </div>
          <div>
            <span className="inline-block w-32 text-emerald-700">{lang === "ar" ? "رقم العميل:" : "Client ID:"}</span>
            <span>{client.customerId}</span>
          </div>
          <div>
            <span className="inline-block w-32 text-emerald-700">{lang === "ar" ? "نوع العميل:" : "Client Type:"}</span>
            <span>{client.accountType || client.type}</span>
          </div>
        </div>
      </div>
    );
  }

  function ServiceDetailsBox() {
    if (!client || !selectedService) return null;

    const servicePrice = Number(selectedService.price) || 0;
    const printingFee = Number(selectedService.printingFee) || 0;
    const vat = +(printingFee * 0.05).toFixed(2);
    const total = +(servicePrice + printingFee + vat).toFixed(2);

    const requiredDocs = Array.isArray(selectedService.requiredDocuments)
      ? selectedService.requiredDocuments
      : (selectedService.requiredDocuments ? Object.values(selectedService.requiredDocuments) : []);

    function UploadDocButton() {
      if (!selectedService || requiredDocs.length === 0) return null;
      return (
        <button
          type="button"
          className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm shadow mt-3 cursor-pointer"
          style={{ minWidth: 120, fontSize: 15, cursor: "pointer" }}
          onClick={() => {
            setAllDocsUploaded(false);
            setUploadModalOpen(true);
          }}
          onMouseOver={e => e.currentTarget.style.cursor = "pointer"}
        >
          {lang === "ar" ? "رفع المستندات المطلوبة" : "Upload Required Documents"}
        </button>
      );
    }

    return (
      <div className="w-full rounded-xl overflow-hidden shadow border border-emerald-100 bg-white animate-fade-in">
        <div className="bg-emerald-50 px-4 py-2 text-center font-bold text-emerald-800 text-lg">
          {lang === "ar" ? "تفاصيل الخدمة" : "Service Details"}
        </div>
        <div className="px-4 py-4 grid grid-cols-1 gap-3 text-base font-semibold text-gray-800">
          <div>
            <span className="inline-block w-32 text-emerald-700">{lang === "ar" ? "الخدمة:" : "Service:"}</span>
            <span style={{ color: "#1c7ed6", fontWeight: "bold" }}>{selectedService.name}</span>
          </div>
          <div>
            <span className="inline-block w-32 text-emerald-700">{lang === "ar" ? "السعر:" : "Price:"}</span>
            <span>{servicePrice.toFixed(2)} AED</span>
          </div>
          <div className="mt-2">
            <table className="w-full text-xs text-gray-800 font-bold border-separate border-spacing-y-1">
              <tbody>
                <tr>
                  <td>{lang === "ar" ? "رسوم الطباعة" : "Printing Fee"}</td>
                  <td className="text-right">{printingFee.toFixed(2)} AED</td>
                </tr>
                <tr>
                  <td>{lang === "ar" ? "ضريبة القيمة المضافة 5% على رسوم الطباعة" : "VAT 5% on Printing Fee"}</td>
                  <td className="text-right">{vat.toFixed(2)} AED</td>
                </tr>
                <tr>
                  <td className="font-extrabold text-emerald-700">{lang === "ar" ? "المجموع الكلي" : "Total"}</td>
                  <td className="font-extrabold text-emerald-800 text-right">{total.toFixed(2)} AED</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <span className="inline-block w-32 text-emerald-700">{lang === "ar" ? "الوصف:" : "Description:"}</span>
            <span>{selectedService.desc || selectedService.description}</span>
          </div>
          {/* مستندات مطلوبة */}
          {requiredDocs.length > 0 && (
            <div>
              <span className="inline-block w-32 text-emerald-700">{lang === "ar" ? "المستندات المطلوبة:" : "Required Documents:"}</span>
              <ul className="list-disc list-inside text-gray-700 text-sm mt-1 ml-2">
                {requiredDocs.map((doc, idx) => (
                  <li key={idx}>{typeof doc === "string" ? doc : (doc.ar || doc.en || doc.name || doc.label)}</li>
                ))}
              </ul>
              <UploadDocButton />
            </div>
          )}

          {/* زر الإنشاء يظهر فقط بعد رفع المستندات المطلوبة أو إذا لا توجد مستندات مطلوبة */}
          {!orderCreated && (
            (requiredDocs.length === 0 || allDocsUploaded) &&
            <button
              type="button"
              className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-900 text-white font-bold text-sm shadow mt-4"
              style={{ minWidth: 120, fontSize: 15, cursor: "pointer" }}
              onClick={() => {
                handleStartPayment({
                  client,
                  selectedService,
                  uploadedDocs,
                  employeeData,
                  lang,
                  setOrderCreated,
                  setOrderInfo
                });
              }}
              onMouseOver={e => e.currentTarget.style.cursor = "pointer"}
            >
              {lang === "ar" ? "إنشاء الطلب وإرسال لينك الدفع" : "Create Order & Send Payment Link"}
            </button>
          )}

          {/* رسالة نجاح وإنشاء الطلب */}
          {orderCreated && orderInfo && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 shadow text-center font-bold text-lg text-emerald-700">
              <div>
                {lang === "ar" ? "تم تجهيز الطلب بنجاح!" : "Order Prepared Successfully!"}
              </div>
              <div style={{ marginTop: 8 }}>
                <b>{lang === "ar" ? "رقم الطلب:" : "Order Number:"}</b> {orderInfo.orderNumber}
              </div>
              <div style={{ marginTop: 8 }}>
                <b>{lang === "ar" ? "لينك الدفع:" : "Payment Link:"}</b>
                <input
                  type="text"
                  value={orderInfo.paymentUrl}
                  readOnly
                  style={{ width: "80%", margin: "8px 0", fontWeight: "bold", color: "#1565c0", textAlign: "center" }}
                  onClick={e => e.target.select()}
                />
                <button
                  style={{ padding: "4px 9px", marginLeft: "8px", fontSize: 13, cursor: "pointer" }}
                  onClick={() => {
                    navigator.clipboard.writeText(orderInfo.paymentUrl);
                    alert(lang === "ar" ? "تم نسخ الرابط!" : "Link copied!");
                  }}
                  onMouseOver={e => e.currentTarget.style.cursor = "pointer"}
                >
                  {lang === "ar" ? "نسخ الرابط" : "Copy Link"}
                </button>
              </div>
              <div style={{ marginTop: 8, color: "#333", fontSize: "14px", fontWeight: "normal" }}>
                {lang === "ar"
                  ? "يرجى إرسال الرابط للعميل للدفع. الطلب النهائي لن يُنشأ إلا بعد الدفع."
                  : "Please send the link to the client for payment. The final order will be created only after payment."}
              </div>
            </div>
          )}
        </div>
        <ServiceUploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          service={selectedService}
          userId={client?.customerId}
          lang={lang}
          setUploadedDocs={setUploadedDocs}
          uploadedDocs={uploadedDocs}
          requiredDocs={requiredDocs.map((doc, idx) => `doc_${idx}`)}
          displayDocs={requiredDocs.map(doc => typeof doc === "string" ? doc : (doc.ar || doc.en || doc.name || doc.label || ""))}
          onAllDocsUploaded={() => { setUploadModalOpen(false); setAllDocsUploaded(true); }}
        />
      </div>
    );
  }

  function getCurrentTypeLabel() {
    const found = PREFIXES.find(p => p.key === prefix);
    return found ? (lang === "ar" ? found.labelAr : found.labelEn) : "";
  }

  function ServicesDropdown() {
    return (
      <div ref={dropdownRef} className="relative w-full">
        <div
          className={`border-2 rounded-lg px-2 py-1 bg-white shadow w-full flex items-center cursor-pointer ${!client ? "opacity-60" : ""}`}
          style={{ height: 38, cursor: "pointer" }}
          onClick={() => client && setServicesDropdownOpen(true)}
          tabIndex={0}
          onMouseOver={e => e.currentTarget.style.cursor = "pointer"}
        >
          <span className="font-bold text-emerald-900 text-base flex-1 truncate">
            {selectedServiceId
              ? (() => {
                  const all = [...services, ...otherServices];
                  const srv = all.find(s => s.id === selectedServiceId);
                  return srv
                    ? (
                        <span>
                          <span style={{ color: "#1c7ed6", fontWeight: "bold" }}>{srv.name}</span>
                          {srv.providers && srv.providers.length
                            ? <span style={{ color: "#e53935", fontWeight: "bold" }}>
                                {" | " + (lang === "ar" ? "جهة الخدمة:" : "Service Authority:") + " " + srv.providers.join(", ")}
                              </span>
                            : null}
                        </span>
                      )
                    : lang === "ar"
                    ? "-- اختر الخدمة --"
                    : "-- Select Service --";
                })()
              : lang === "ar"
              ? "-- اختر الخدمة --"
              : "-- Select Service --"}
          </span>
          <span className="ml-2 text-gray-500">
            <FaSearch />
          </span>
        </div>
        {servicesDropdownOpen && client && (
          <div
            className="absolute left-0 right-0 z-30 bg-white border-2 border-emerald-100 rounded-lg mt-1 shadow-xl overflow-y-auto"
            style={{ maxHeight: 330 }}
          >
            <div className="px-2 py-2 border-b border-gray-100 bg-gray-50">
              <input
                type="text"
                value={serviceSearch}
                onChange={e => setServiceSearch(e.target.value)}
                autoFocus
                className="w-full border rounded px-2 py-1 text-base font-bold focus:outline-none"
                placeholder={lang === "ar" ? "اكتب اسم الخدمة أو جهة الخدمة..." : "Type service name or authority..."}
                style={{
                  fontSize: "18px",
                  color: "#153A6B",
                  backgroundColor: "#f8f9fb",
                  fontWeight: 700,
                  letterSpacing: "1px"
                }}
              />
            </div>
            <div>
              <div className="px-3 py-1 font-bold text-emerald-700 text-sm bg-white border-b" style={{background:"#f1f8fc"}}>
                {lang === "ar" ? `خدمات ${getCurrentTypeLabel()}` : `Services ${getCurrentTypeLabel()}`}
              </div>
              {filteredServices.length > 0 ? (
                filteredServices.map(s => (
                  <div
                    key={s.id}
                    className="flex flex-row items-center px-3 py-2 cursor-pointer hover:bg-emerald-50"
                    onClick={() => {
                      setSelectedServiceId(s.id);
                      setServicesDropdownOpen(false);
                    }}
                    style={{ borderBottom: "1px solid #f3f5f7", cursor: "pointer" }}
                    onMouseOver={e => e.currentTarget.style.cursor = "pointer"}
                  >
                    <span style={{ color: "#1c7ed6", fontWeight: "bold", fontSize: "17px" }}>{s.name}</span>
                    {s.providers && s.providers.length > 0 && (
                      <span
                        className="ml-2"
                        style={{ color: "#e53935", fontWeight: "bold", fontSize: "15px" }}
                      >
                        | {lang === "ar" ? "جهة الخدمة:" : "Service Authority:"} {s.providers.join(", ")}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-4 py-1 text-gray-400 text-center">{lang === "ar" ? "لا يوجد خدمات مطابقة" : "No matching services found"}</div>
              )}
            </div>
            <div>
              <div className="px-3 py-1 font-bold text-emerald-700 text-sm bg-white border-b" style={{background:"#f8e9e9"}}>
                {lang === "ar" ? "خدمات أخرى" : "Other Services"}
              </div>
              {filteredOtherServices.length > 0 ? (
                filteredOtherServices.map(s => (
                  <div
                    key={s.id}
                    className="flex flex-row items-center px-3 py-2 cursor-pointer hover:bg-emerald-50"
                    onClick={() => {
                      setSelectedServiceId(s.id);
                      setServicesDropdownOpen(false);
                    }}
                    style={{ borderBottom: "1px solid #f3f5f7", cursor: "pointer" }}
                    onMouseOver={e => e.currentTarget.style.cursor = "pointer"}
                  >
                    <span style={{ color: "#1c7ed6", fontWeight: "bold", fontSize: "17px" }}>{s.name}</span>
                    {s.providers && s.providers.length > 0 && (
                      <span
                        className="ml-2"
                        style={{ color: "#e53935", fontWeight: "bold", fontSize: "15px" }}
                      >
                        | {lang === "ar" ? "جهة الخدمة:" : "Service Authority:"} {s.providers.join(", ")}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-4 py-1 text-gray-400 text-center">{lang === "ar" ? "لا يوجد خدمات مطابقة" : "No matching services found"}</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-extrabold text-emerald-700 mb-6 text-center tracking-tight drop-shadow">
        {lang === "ar" ? "إنشاء خدمة للعميل" : "Create Client Service"}
      </h2>
      <form
        className="bg-white rounded-xl shadow-lg px-12 py-8 flex flex-row gap-8 items-center justify-center"
        style={{ minHeight: 80 }}
        onSubmit={handleSearch}
      >
        <div className="flex flex-col items-start" style={{ width: "120px", minWidth: "90px" }}>
          <label className="font-bold text-emerald-700 mb-1 text-sm">{lang === "ar" ? "نوع العميل" : "Client Type"}</label>
          <select
            className="border-2 rounded-lg px-2 py-1 w-full shadow focus:outline-emerald-500 text-base font-bold text-emerald-900 bg-white"
            value={prefix}
            onChange={e => setPrefix(e.target.value)}
            style={{ height: 38, cursor: "pointer" }}
            onMouseOver={e => e.currentTarget.style.cursor = "pointer"}
          >
            {PREFIXES.map(p => (
              <option key={p.key} value={p.key}>{lang === "ar" ? p.labelAr : p.labelEn}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col items-start" style={{ width: "290px", minWidth: "160px" }}>
          <label className="font-bold text-emerald-700 mb-1 text-sm">{lang === "ar" ? "رقم العميل" : "Client Number"}</label>
          <div className="relative w-full flex flex-row items-center">
            <input
              type="text"
              value={clientNumber}
              onChange={handleClientNumberChange}
              placeholder={lang === "ar" ? "2009180" : "2009180"}
              className="border-2 rounded-lg px-3 py-1 w-full shadow focus:outline-emerald-500 text-base font-bold text-emerald-900 tracking-widest bg-white text-center"
              maxLength={8}
              style={{ height: 38, letterSpacing: "2px", fontSize: "22px" }}
              autoComplete="off"
            />
            <button
              type="submit"
              className="ml-2 px-4 py-1 rounded-full bg-emerald-600 hover:bg-emerald-800 text-white flex items-center gap-1 font-bold text-base"
              style={{ height: 38, minWidth: "72px", fontSize: "18px", cursor: "pointer" }}
              title={lang === "ar" ? "بحث" : "Search"}
              onMouseOver={e => e.currentTarget.style.cursor = "pointer"}
            >
              <FaSearch />
              {lang === "ar" ? "بحث" : "Search"}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-start flex-1" style={{ minWidth: "350px" }}>
          <label className="font-bold text-emerald-700 mb-1 text-sm">{lang === "ar" ? "الخدمة" : "Service"}</label>
          <ServicesDropdown />
        </div>
      </form>
      <div className="rounded-xl bg-white/95 p-4 shadow-lg border border-emerald-100 mt-4">
        {client && <ClientInfoBox />}
        {client && selectedService && <ServiceDetailsBox />}
        {fullClientId.length >= 12 && !client && (
          <div className="text-red-600 font-bold text-center py-5 text-base">
            {lang === "ar" ? "العميل غير موجود أو البيانات غير صحيحة." : "Client not found or incorrect info."}
          </div>
        )}
        {!client && !fullClientId && (
          <div className="text-gray-500 text-center py-3 text-base">
            {lang === "ar" ? "يرجى إدخال رقم العميل ثم الضغط على بحث." : "Please enter Client ID then click Search."}
          </div>
        )}
      </div>
    </div>
  );
}