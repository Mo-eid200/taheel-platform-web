import React, { useState, useEffect, useRef } from "react";
import { FaSearch } from "react-icons/fa";
import { firestore } from "@/lib/firebase.client";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

const PREFIXES = [
  { key: "RES", labelAr: "مقيم", labelEn: "Resident" },
  { key: "NON", labelAr: "غير مقيم", labelEn: "Non-Resident" },
  { key: "COM", labelAr: "شركة", labelEn: "Company" }
];

export default function ServicesManagementSection({ employeeData, lang }) {
  // البحث
  const [prefix, setPrefix] = useState("RES");
  const [clientNumber, setClientNumber] = useState("");
  const [fullClientId, setFullClientId] = useState("");
  const [client, setClient] = useState(null);

  // الخدمات
  const [services, setServices] = useState([]);
  const [otherServices, setOtherServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedService, setSelectedService] = useState(null);

  // فلترة الخدمات بالاسم
  const [serviceSearch, setServiceSearch] = useState("");
  // قائمة منسدلة للخدمات
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const dropdownRef = useRef();

  // دمج الخدمات الأخرى من مصدرين: مجموعة services و servicesByClientType.other
  async function fetchOtherServices() {
    // جلب من مجموعة services (type == other)
    const q = query(collection(firestore, "services"), where("type", "==", "other"));
    const snap = await getDocs(q);
    let arr = [];
    snap.forEach(doc => {
      arr.push({ id: doc.id, ...doc.data() });
    });
    // جلب من servicesByClientType > other
    const docRef = doc(firestore, "servicesByClientType", "other");
    const snapOther = await getDoc(docRef);
    if (snapOther.exists()) {
      const data = snapOther.data();
      const otherArr = Object.entries(data)
        .filter(([key, val]) => key.startsWith("service") && val.active)
        .map(([key, val]) => ({ id: key, ...val }));
      arr = arr.concat(otherArr);
    }
    // فلترة التكرار بالـ id
    arr = arr.filter((srv, idx, self) => self.findIndex(s => s.id === srv.id) === idx);
    setOtherServices(arr);
  }

  // فلترة الخدمات حسب البحث (مرونة عالية: يشمل كل الخدمات)
  const filteredServices = serviceSearch.trim()
    ? services.filter(
        s =>
          (s.name || "").toLowerCase().includes(serviceSearch.trim().toLowerCase()) ||
          (Array.isArray(s.providers)
            ? s.providers.join(", ").toLowerCase().includes(serviceSearch.trim().toLowerCase())
            : false)
      )
    : services;
  const filteredOtherServices = serviceSearch.trim()
    ? otherServices.filter(
        s =>
          (s.name || "").toLowerCase().includes(serviceSearch.trim().toLowerCase()) ||
          (Array.isArray(s.providers)
            ? s.providers.join(", ").toLowerCase().includes(serviceSearch.trim().toLowerCase())
            : false)
      )
    : otherServices;

  // إغلاق القائمة عند الضغط خارجها
  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setServicesDropdownOpen(false);
      }
    }
    if (servicesDropdownOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [servicesDropdownOpen]);

  // إضافة "-" بعد أول 3 أرقام
  function handleClientNumberChange(e) {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 7) value = value.slice(0, 7);
    let formatted = value;
    if (value.length > 3) {
      formatted = value.slice(0, 3) + '-' + value.slice(3);
    }
    setClientNumber(formatted);
  }

  // الضغط على زر البحث
  async function handleSearch(e) {
    e.preventDefault();
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
    // جلب الوثيقة نفسها
    const docRef = doc(firestore, "servicesByClientType", clientType);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      // استخراج كل الحقول التي تبدأ بـ service و active = true
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

  // بيانات العميل فقط (بدون تفاصيل خدمة)
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

  // تفاصيل الخدمة (تظهر فقط بعد اختيار خدمة)
  function ServiceDetailsBox() {
    if (!client || !selectedService) return null;
    const requiredDocs = Array.isArray(selectedService.requiredDocuments)
      ? selectedService.requiredDocuments
      : (selectedService.requiredDocuments ? Object.values(selectedService.requiredDocuments) : []);
    const requireUpload = selectedService.requireUpload || requiredDocs.length > 0;

    function UploadDocButtons() {
      if (!requireUpload || requiredDocs.length === 0) return null;
      return (
        <div className="mt-3 flex flex-wrap gap-2">
          {requiredDocs.map((doc, idx) => {
            let docName = typeof doc === "string" ? doc : (doc.ar || doc.en || doc.name || doc.label || `مستند ${idx+1}`);
            return (
              <button
                key={idx}
                type="button"
                className="px-4 py-2 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-base shadow"
                onClick={() => alert(`رفع مستند: ${docName}`)}
              >
                {lang === "ar" ? `رفع: ${docName}` : `Upload: ${docName}`}
              </button>
            );
          })}
        </div>
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
              <UploadDocButtons />
            </div>
          )}
        </div>
      </div>
    );
  }

  // اسم الفئة
  function getCurrentTypeLabel() {
    const found = PREFIXES.find(p => p.key === prefix);
    return found ? (lang === "ar" ? found.labelAr : found.labelEn) : "";
  }

  // قائمة الخدمات المخصصة
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
                style={{ fontSize: "18px" }}
              />
            </div>
            {/* خدمات الفئة */}
            {filteredServices.length > 0 && (
              <div>
                <div className="px-3 py-1 font-bold text-emerald-700 text-sm bg-white border-b">{lang === "ar" ? `خدمات ${getCurrentTypeLabel()}` : `Services ${getCurrentTypeLabel()}`}</div>
                {filteredServices.map(s => (
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
                ))}
              </div>
            )}
            {/* خدمات أخرى - تظهر للجميع */}
            {filteredOtherServices.length > 0 && (
              <div>
                <div className="px-3 py-1 font-bold text-emerald-700 text-sm bg-white border-b">{lang === "ar" ? "خدمات أخرى" : "Other Services"}</div>
                {filteredOtherServices.map(s => (
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
                ))}
              </div>
            )}
            {/* إذا لا يوجد اقتراحات */}
            {filteredServices.length === 0 && filteredOtherServices.length === 0 && (
              <div className="px-4 py-4 text-gray-400 text-center font-bold">{lang === "ar" ? "لا يوجد خدمات مطابقة" : "No matching services found"}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // الشكل النهائي
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
        {/* نوع العميل */}
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
        {/* رقم العميل */}
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
        {/* الخدمات (Dropdown مخصص) */}
        <div className="flex flex-col items-start flex-1" style={{ minWidth: "350px" }}>
          <label className="font-bold text-emerald-700 mb-1 text-sm">{lang === "ar" ? "الخدمة" : "Service"}</label>
          <ServicesDropdown />
        </div>
      </form>
      {/* بيانات العميل تظهر بعد البحث */}
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