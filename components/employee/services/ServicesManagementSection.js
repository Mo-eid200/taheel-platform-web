import React, { useState, useEffect, useRef } from "react";
import { FaSearch } from "react-icons/fa";
import { firestore } from "@/lib/firebase.client";
import { doc, getDoc, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import ServiceUploadModal from "./ServiceUploadModal";

const PREFIXES = [
  { key: "RES", labelAr: "مقيم", labelEn: "Resident" },
  { key: "NON", labelAr: "غير مقيم", labelEn: "Non-Resident" },
  { key: "COM", labelAr: "شركة", labelEn: "Company" }
];

// دالة تطبيع النص العربي
function normalizeArabic(text) {
  if (!text) return "";
  return text
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ً|ٌ|ٍ|َ|ُ|ِ|ّ|ْ/g, "") // إزالة التشكيل
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

  // جلب الخدمات الأخرى من مصدرين
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

  // بحث مرن بالتطبيع العربي
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
    if (!selectedServiceId) return setSelectedService(null);
    const all = [...services, ...otherServices];
    const srv = all.find(s => s.id === selectedServiceId);
    setSelectedService(srv || null);
  }, [selectedServiceId, services, otherServices]);

  // دالة توليد رقم تتبع (طلب)
  function generateOrderNumber() {
    const part1 = Math.floor(100 + Math.random() * 900); // 3 أرقام
    const part2 = Math.floor(1000 + Math.random() * 9000); // 4 أرقام
    return `REQ-${part1}-${part2}`;
  }

  // دالة إنشاء الطلب وحفظه في فايرستور
  async function handleCreateOrder() {
    if (!client || !selectedService || !uploadedDocs || Object.keys(uploadedDocs).length === 0) {
      alert(lang === "ar" ? "يجب رفع كل المستندات أولاً." : "Please upload all required documents first.");
      return;
    }

    try {
      const orderNumber = generateOrderNumber();
      const orderData = {
        orderNumber,
        clientId: client.customerId,
        clientName: client.firstName + " " + client.lastName,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        uploadedDocs, // روابط المستندات
        status: "pending_payment",
        createdAt: new Date().toISOString(),
      };

      // إنشاء الطلب في فايرستور
      await addDoc(collection(firestore, "orders"), orderData);

      // هنا ممكن توليد لينك دفع حقيقي حسب النظام (Stripe, PayTabs...)
      // بشكل تجريبي نرسل لينك وهمي
      const paymentUrl = "https://payment.example.com/pay?order=" + orderNumber;

      setOrderCreated(true);
      setOrderInfo({ ...orderData, paymentUrl });
    } catch (error) {
      alert(lang === "ar" ? "حدث خطأ أثناء إنشاء الطلب." : "Error creating order.");
      console.error(error);
    }
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
    const requiredDocs = Array.isArray(selectedService.requiredDocuments)
      ? selectedService.requiredDocuments
      : (selectedService.requiredDocuments ? Object.values(selectedService.requiredDocuments) : []);
    const requireUpload = selectedService.requireUpload || requiredDocs.length > 0;

function UploadDocButton() {
  if (!selectedService || requiredDocs.length === 0) return null;
  return (
    <button
      type="button"
      className="px-5 py-2 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-base shadow mt-3 cursor-pointer"
      onClick={() => {
        setAllDocsUploaded(false); // ضروري!
        setUploadModalOpen(true);  // يفتح المودال دائماً
      }}
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
            <span>{selectedService.price} AED</span>
          </div>
          <div>
            <span className="inline-block w-32 text-emerald-700">{lang === "ar" ? "الوصف:" : "Description:"}</span>
            <span>{selectedService.desc || selectedService.description}</span>
          </div>
          {requiredDocs.length > 0 && (
            <div>
              <span className="inline-block w-32 text-emerald-700">{lang === "ar" ? "المستندات المطلوبة:" : "Required Documents:"}</span>
              <ul className="list-disc list-inside text-gray-700 text-sm mt-1 ml-2">
                {requiredDocs.map((doc, idx) => (
                  <li key={idx}>{typeof doc === "string" ? doc : (doc.ar || doc.en || doc.name || doc.label)}</li>
                ))}
              </ul>
              <UploadDocButton />

              {/* زر توليد الطلب يظهر فقط بعد اكتمال رفع المستندات */}
              {allDocsUploaded && !orderCreated && (
                <button
                  type="button"
                  className="px-6 py-2 rounded-full bg-emerald-700 hover:bg-emerald-900 text-white font-bold text-base shadow mt-4"
                  onClick={handleCreateOrder}
                >
                  {lang === "ar" ? "إنشاء الطلب وإرسال لينك الدفع" : "Create Order & Send Payment Link"}
                </button>
              )}

              {/* بعد إنشاء الطلب أظهر رقم الطلب واللينك */}
              {orderCreated && orderInfo && (
                <div className="mt-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 shadow text-center font-bold text-lg text-emerald-700">
                  <div>
                    {lang === "ar" ? "تم إنشاء الطلب بنجاح!" : "Order Created Successfully!"}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <b>{lang === "ar" ? "رقم الطلب:" : "Order Number:"}</b> {orderInfo.orderNumber}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <b>{lang === "ar" ? "لينك الدفع:" : "Payment Link:"}</b>
                    <a
                      href={orderInfo.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-700 ml-2"
                    >
                      {orderInfo.paymentUrl}
                    </a>
                  </div>
                </div>
              )}
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

  // قائمة الخدمات المنسدلة مع تقسيم فرعي واضح
  function ServicesDropdown() {
    return (
      <div ref={dropdownRef} className="relative w-full">
        <div
          className={`border-2 rounded-lg px-2 py-1 bg-white shadow w-full flex items-center cursor-pointer ${!client ? "opacity-60" : ""}`}
          style={{ height: 38 }}
          onClick={() => client && setServicesDropdownOpen(true)}
          tabIndex={0}
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
            {/* قائمة فرعية: خدمات الفئة الحالية */}
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
                    style={{ borderBottom: "1px solid #f3f5f7" }}
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
            {/* قائمة فرعية: خدمات أخرى */}
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
                    style={{ borderBottom: "1px solid #f3f5f7" }}
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
            style={{ height: 38 }}
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
              style={{ height: 38, minWidth: "72px", fontSize: "18px" }}
              title={lang === "ar" ? "بحث" : "Search"}
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