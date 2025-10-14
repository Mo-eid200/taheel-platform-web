"use client";
import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { firestore as db } from "@/lib/firebase.client";

// COLORS & THEME
const COLORS = {
  bg: "bg-gradient-to-br from-[#f6fafd] to-[#e6f0fa]",
  card: "bg-white/60 border border-gray-200 shadow-lg rounded-xl",
  border: "border-gray-300",
  accent: "text-blue-700",
  accentBg: "bg-blue-600 hover:bg-blue-700",
  badge: "bg-blue-500 text-white",
  green: "bg-green-500 text-white",
  red: "bg-red-600 text-white",
  gray: "bg-gray-200 text-gray-700",
  chip: "bg-blue-100 text-blue-700",
  input: "bg-white/90 border border-gray-300 rounded-md",
  tableHead: "bg-blue-50 text-blue-900",
  tableRow: "hover:bg-blue-50 transition",
  shadow: "shadow",
};

const categories = [
  { key: "all", label_ar: "الكل", label_en: "All" },
  { key: "resident", label_ar: "مقيمين", label_en: "Residents" },
  { key: "nonresident", label_ar: "غير مقيمين", label_en: "Non-Residents" },
  { key: "company", label_ar: "شركات", label_en: "Companies" },
  { key: "other", label_ar: "أخرى", label_en: "Other" },
];

function generateServiceId(clientType) {
  const prefix = {
    resident: "RES",
    nonresident: "NON",
    company: "COM",
    other: "OTH",
  }[clientType] || "SRV";
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-000-${num}${rand}`;
}

function calcAll(price, printingFee) {
  const p = Number(price) || 0;
  const print = Number(printingFee) || 0;
  const tax = +(print * 0.05).toFixed(2);
  const clientPrice = +(p + print + tax).toFixed(2);
  return { tax, clientPrice, print };
}

export default function ServicesSection({ lang = "ar" }) {
  const [clientType, setClientType] = useState("resident");
  const [services, setServices] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [documentsCount, setDocumentsCount] = useState(1);
  const [documentsFields, setDocumentsFields] = useState([""]);
  const [subcategories, setSubcategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [newService, setNewService] = useState({
    name: "",
    description: "",
    category: clientType,
    subcategory: "",
    providers: [],
    price: "",
    printingFee: "",
    coins: "",
    requiredDocuments: [],
    duration: "",
    requireUpload: false,
    repeatable: false,
    active: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [editMode, setEditMode] = useState(false);

  // بحث سريع ومتغيرات التفعيل
  const [searchQuery, setSearchQuery] = useState("");
  const [showActive, setShowActive] = useState("all"); // all | active | inactive
  const [providerFilter, setProviderFilter] = useState("all");

  // جلب البيانات
  useEffect(() => {
    async function fetchData() {
      if (!clientType) return;
      const docRef = doc(db, "servicesByClientType", clientType);
      const snap = await getDoc(docRef);
      const data = snap.exists() ? snap.data() : {};
      setSubcategories(Array.isArray(data.subcategories) ? data.subcategories : []);
      setProviders(Array.isArray(data.providers) ? data.providers : []);
      const arr = Object.entries(data)
        .filter(([key, val]) => key.startsWith("service") && typeof val === "object")
        .map(([key, val]) => ({
          ...val,
          id: key,
          tax: val.tax !== undefined ? val.tax : calcAll(val.price, val.printingFee).tax,
          clientPrice: val.clientPrice !== undefined ? val.clientPrice : calcAll(val.price, val.printingFee).clientPrice,
          active: val.active !== undefined ? val.active : true,
        }));
      setServices(arr.sort((a, b) => a.name.localeCompare(b.name, lang === "ar" ? "ar" : "en")));
    }
    fetchData();
  }, [loading, lang, clientType]);

  useEffect(() => {
    if (documentsCount < 1) setDocumentsCount(1);
    setDocumentsFields(
      Array.from({ length: documentsCount }, (_, i) => newService.requiredDocuments[i] || "")
    );
  }, [documentsCount, newService.requiredDocuments]);

  useEffect(() => {
    if (newService.price !== "" && !isNaN(newService.price)) {
      setNewService((ns) => ({
        ...ns,
        coins: Number(ns.price) || "",
      }));
    }
  }, [newService.price]);

  const { tax, clientPrice, print } = calcAll(newService.price, newService.printingFee);

  // إضافة أو تعديل خدمة
  async function saveService(serviceFieldName, serviceData) {
    const docRef = doc(db, "servicesByClientType", clientType);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, { [serviceFieldName]: serviceData }, { merge: true });
    } else {
      await updateDoc(docRef, { [serviceFieldName]: serviceData });
    }
  }

  async function handleAddService(e) {
    e.preventDefault();
    setLoading(true);
    const serviceFieldName = `service${Date.now()}`;
    const serviceData = {
      name: newService.name,
      description: newService.description,
      category: clientType,
      subcategory: newService.subcategory,
      providers: Array.isArray(newService.providers)
        ? newService.providers.filter(Boolean)
        : typeof newService.providers === "string" && newService.providers
          ? [newService.providers]
          : [],
      price: Number(newService.price),
      printingFee: Number(newService.printingFee),
      coins: Number(newService.coins),
      profit: Number(newService.printingFee),
      tax: Number(tax),
      clientPrice: Number(clientPrice),
      requiredDocuments: newService.requireUpload
        ? documentsFields.map((s) => s.trim()).filter(Boolean)
        : [],
      duration: newService.duration,
      requireUpload: !!newService.requireUpload,
      repeatable: !!newService.repeatable,
      serviceId: generateServiceId(clientType),
      createdAt: serverTimestamp(),
      active: newService.active !== false,
    };
    await saveService(serviceFieldName, serviceData);
    resetForm();
    setLoading(false);
  }

  async function handleDeleteService(id) {
    if (!confirm(lang === "ar" ? "هل أنت متأكد من حذف الخدمة؟" : "Are you sure to delete the service?")) return;
    setLoading(true);
    await updateDoc(doc(db, "servicesByClientType", clientType), {
      [id]: deleteField(),
    });
    setLoading(false);
  }

  async function handleEditService(e) {
    e.preventDefault();
    setLoading(true);
    const serviceData = {
      name: newService.name,
      description: newService.description,
      category: clientType,
      subcategory: newService.subcategory,
      providers: Array.isArray(newService.providers)
        ? newService.providers.filter(Boolean)
        : typeof newService.providers === "string" && newService.providers
          ? [newService.providers]
          : [],
      price: Number(newService.price),
      printingFee: Number(newService.printingFee),
      coins: Number(newService.coins),
      profit: Number(newService.printingFee),
      tax: Number(tax),
      clientPrice: Number(clientPrice),
      requiredDocuments: newService.requireUpload
        ? documentsFields.map((s) => s.trim()).filter(Boolean)
        : [],
      duration: newService.duration,
      requireUpload: !!newService.requireUpload,
      repeatable: !!newService.repeatable,
      serviceId: newService.serviceId || generateServiceId(clientType),
      active: newService.active !== false,
    };
    await saveService(editingId, serviceData);
    resetForm();
    setLoading(false);
  }

  // تفعيل/تعطيل الخدمة
  async function toggleServiceActive(serviceId, newState) {
    setLoading(true);
    await updateDoc(doc(db, "servicesByClientType", clientType), {
      [`${serviceId}.active`]: newState,
    });
    setLoading(false);
  }

  // إدارة التصنيفات الفرعية
  async function handleAddSubcategory(subcat) {
    if (!subcat.trim()) return;
    setLoading(true);
    const docRef = doc(db, "servicesByClientType", clientType);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, { subcategories: [subcat.trim()] }, { merge: true });
    } else {
      await updateDoc(docRef, { subcategories: arrayUnion(subcat.trim()) });
    }
    setLoading(false);
  }
  async function handleRemoveSubcategory(subcat) {
    setLoading(true);
    await updateDoc(doc(db, "servicesByClientType", clientType), {
      subcategories: arrayRemove(subcat),
    });
    setLoading(false);
  }

  // إدارة جهات الخدمة
  async function handleAddProvider(provider) {
    if (!provider.trim()) return;
    setLoading(true);
    const docRef = doc(db, "servicesByClientType", clientType);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, { providers: [provider.trim()] }, { merge: true });
    } else {
      await updateDoc(docRef, { providers: arrayUnion(provider.trim()) });
    }
    setLoading(false);
  }
  async function handleRemoveProvider(provider) {
    setLoading(true);
    await updateDoc(doc(db, "servicesByClientType", clientType), {
      providers: arrayRemove(provider),
    });
    setLoading(false);
  }

  function resetForm() {
    setNewService({
      name: "",
      description: "",
      category: clientType,
      subcategory: "",
      providers: [],
      price: "",
      printingFee: "",
      coins: "",
      requiredDocuments: [],
      duration: "",
      requireUpload: false,
      repeatable: false,
      active: true,
    });
    setDocumentsFields([""]);
    setDocumentsCount(1);
    setShowAdd(false);
    setEditMode(false);
    setEditingId(null);
  }

  // قائمة مزودي الخدمة للفلتر
  const uniqueProviders = Array.from(
    new Set(services.flatMap((s) => Array.isArray(s.providers) ? s.providers : []))
  ).filter(Boolean);

  // فلترة الخدمات
  const filteredServices = services.filter((s) => {
    const categoryCheck = filter === "all" ? true : s.category === filter;
    const stateCheck =
      showActive === "all"
        ? true
        : showActive === "active"
        ? s.active
        : !s.active;
    const providerCheck =
      providerFilter === "all"
        ? true
        : Array.isArray(s.providers) && s.providers.includes(providerFilter);
    const searchCheck =
      !searchQuery ||
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (Array.isArray(s.providers) &&
        s.providers.some((p) =>
          p.toLowerCase().includes(searchQuery.toLowerCase())
        ));
    return categoryCheck && stateCheck && providerCheck && searchCheck;
  });

  const [newSubcatInput, setNewSubcatInput] = useState("");
  const [newProviderInput, setNewProviderInput] = useState("");

  return (
    <div className={`${COLORS.bg} py-6 px-2 min-h-screen`}>
      <div className="max-w-7xl mx-auto">
        {/* رأس: بحث + عداد + فلاتر تفعيل + جهة الخدمة */}
        <div className="flex flex-col md:flex-row md:justify-between items-center mb-7 gap-4">
          <span className="text-2xl font-extrabold text-blue-800 tracking-tight drop-shadow">
            {lang === "ar" ? "إدارة الخدمات" : "Services Management"}
          </span>
          <div className="flex gap-2 flex-wrap items-center">
            <input
              type="text"
              placeholder={lang === "ar" ? "بحث بالاسم أو الجهة..." : "Search by name or provider..."}
              className={`p-2 w-64 ${COLORS.input} text-sm outline-blue-400`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select
              value={showActive}
              onChange={e => setShowActive(e.target.value)}
              className={`p-2 ${COLORS.input} text-sm`}
              style={{minWidth:'105px'}}
            >
              <option value="all">{lang === "ar" ? "كل الحالات" : "All status"}</option>
              <option value="active">{lang === "ar" ? "مفعّلة فقط" : "Active only"}</option>
              <option value="inactive">{lang === "ar" ? "غير مفعّلة" : "Inactive only"}</option>
            </select>
            <select
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
              className={`p-2 ${COLORS.input} text-sm`}
              style={{minWidth:'130px'}}
            >
              <option value="all">{lang === "ar" ? "كل الجهات" : "All providers"}</option>
              {uniqueProviders.map((prov) => (
                <option key={prov} value={prov}>{prov}</option>
              ))}
            </select>
            <span className="font-bold text-blue-700 text-base px-3 py-1 rounded-full bg-blue-100 border border-blue-300">
              {lang === "ar"
                ? `عدد الخدمات: ${filteredServices.length}`
                : `Services: ${filteredServices.length}`}
            </span>
            <button
              onClick={() => {
                setShowAdd((v) => !v);
                if (showAdd) {
                  resetForm();
                }
              }}
              className="px-3 py-2 w-56 rounded-xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 hover:from-blue-900 hover:to-blue-600 text-white font-bold shadow-lg mt-2 md:mt-0 transition cursor-pointer text-sm"
            >
              {lang === "ar"
                ? showAdd
                  ? "إغلاق"
                  : "إضافة خدمة جديدة"
                : showAdd
                ? "Close"
                : "Add Service"}
            </button>
          </div>
        </div>

        {/* إدارة التصنيفات الفرعية وجهات الخدمة */}
        <div className="flex gap-7 mb-8 flex-wrap">
          {/* التصنيفات الفرعية */}
          <div>
            <span className="font-bold text-blue-800 text-sm">
              {lang === "ar" ? "التصنيفات الفرعية:" : "Subcategories:"}
            </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {subcategories.map((cat) => (
                <span key={cat} className={`${COLORS.chip} px-2 py-1 rounded-full flex items-center gap-1 font-semibold text-xs border border-blue-200`}>
                  {cat}
                  <button
                    onClick={() => handleRemoveSubcategory(cat)}
                    className="ml-1 text-red-500 font-bold hover:text-red-700"
                    title={lang === "ar" ? "حذف" : "Remove"}
                    type="button"
                  >×</button>
                </span>
              ))}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleAddSubcategory(newSubcatInput);
                  setNewSubcatInput("");
                }}
                className="flex gap-1"
              >
                <input
                  value={newSubcatInput}
                  onChange={e => setNewSubcatInput(e.target.value)}
                  placeholder={lang === "ar" ? "جديد..." : "New..."}
                  className="p-1 w-32 rounded-full border border-blue-300 text-blue-800 text-xs bg-white/95"
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-700 hover:to-emerald-500 text-white rounded-full font-bold text-xs"
                >+</button>
              </form>
            </div>
          </div>
          {/* جهات الخدمة */}
          <div>
            <span className="font-bold text-blue-800 text-sm">
              {lang === "ar" ? "جهات الخدمة:" : "Providers:"}
            </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {providers.map((prov) => (
                <span key={prov} className={`${COLORS.chip} px-2 py-1 rounded-full flex items-center gap-1 font-semibold text-xs border border-blue-200`}>
                  {prov}
                  <button
                    onClick={() => handleRemoveProvider(prov)}
                    className="ml-1 text-red-500 font-bold hover:text-red-700"
                    title={lang === "ar" ? "حذف" : "Remove"}
                    type="button"
                  >×</button>
                </span>
              ))}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleAddProvider(newProviderInput);
                  setNewProviderInput("");
                }}
                className="flex gap-1"
              >
                <input
                  value={newProviderInput}
                  onChange={e => setNewProviderInput(e.target.value)}
                  placeholder={lang === "ar" ? "جديد..." : "New..."}
                  className="p-1 w-32 rounded-full border border-blue-300 text-blue-800 text-xs bg-white/95"
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-700 hover:to-emerald-500 text-white rounded-full font-bold text-xs"
                >+</button>
              </form>
            </div>
          </div>
        </div>

        {/* فلاتر الفئات */}
        <div className="flex gap-2 mb-9 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              className={`px-3 py-2 w-32 rounded-full border-2 font-bold tracking-tight text-xs ${
                filter === cat.key
                  ? "bg-gradient-to-r from-blue-700 to-cyan-600 text-white border-blue-700"
                  : "bg-white/90 text-blue-700 border-blue-200 hover:bg-blue-100"
              } shadow-sm transition`}
            >
              {lang === "ar" ? cat.label_ar : cat.label_en}
            </button>
          ))}
        </div>

        {/* نموذج إضافة أو تعديل خدمة */}
        {showAdd && (
          <form
            onSubmit={editMode ? handleEditService : handleAddService}
            className="bg-white/95 rounded-2xl p-6 mb-8 shadow-xl border border-blue-100 flex flex-col gap-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2 items-center">
              <input
                required
                className={`p-3 w-full rounded-xl border-2 ${COLORS.border} text-gray-900 font-semibold text-sm bg-white/90`}
                placeholder={lang === "ar" ? "اسم الخدمة" : "Service name"}
                value={newService.name}
                onChange={(e) =>
                  setNewService({ ...newService, name: e.target.value })
                }
              />
              <input
                required
                className={`p-3 w-full rounded-xl border-2 ${COLORS.border} text-gray-900 text-sm bg-white/90`}
                placeholder={lang === "ar" ? "وصف الخدمة" : "Service Description"}
                value={newService.description}
                onChange={(e) =>
                  setNewService({ ...newService, description: e.target.value })
                }
              />
              <select
                className={`p-3 w-full rounded-xl border-2 ${COLORS.border} text-gray-900 font-semibold text-sm bg-white/90`}
                value={newService.subcategory}
                onChange={e =>
                  setNewService({ ...newService, subcategory: e.target.value })
                }
              >
                <option value="">
                  {lang === "ar"
                    ? "تصنيف فرعي (اختياري)"
                    : "Subcategory (optional)"}
                </option>
                {subcategories.map(cat => (
                  <option value={cat} key={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                multiple
                className={`p-3 w-full rounded-xl border-2 ${COLORS.border} text-gray-900 text-sm bg-white/90`}
                value={newService.providers}
                onChange={e => {
                  const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                  setNewService({ ...newService, providers: selected });
                }}
              >
                {providers.map(prov => (
                  <option value={prov} key={prov}>
                    {prov}
                  </option>
                ))}
              </select>
              <input
                required
                type="number"
                min="0"
                className={`p-3 w-full rounded-xl border-2 ${COLORS.border} text-gray-900 text-sm bg-white/90`}
                placeholder={
                  lang === "ar"
                    ? "سعر الخدمة (بدون رسوم الطباعة)"
                    : "Service Price (excl. printing)"
                }
                value={newService.price}
                onChange={(e) =>
                  setNewService({ ...newService, price: e.target.value })
                }
              />
              <input
                type="number"
                min="0"
                className={`p-3 w-full rounded-xl border-2 ${COLORS.border} text-gray-900 text-sm bg-white/90`}
                placeholder={
                  lang === "ar" ? "رسوم الطباعة" : "Printing Fee"
                }
                value={newService.printingFee}
                onChange={(e) =>
                  setNewService({ ...newService, printingFee: e.target.value })
                }
              />
              <input
                required
                type="number"
                min="0"
                readOnly
                className={`p-3 w-full rounded-xl border-2 ${COLORS.border} text-gray-900 bg-gray-100 text-sm`}
                placeholder={lang === "ar" ? "عدد الكوينات" : "Coins"}
                value={newService.coins}
              />
              <input
                className={`p-3 w-full rounded-xl border-2 ${COLORS.border} text-gray-900 text-sm bg-white/90`}
                placeholder={lang === "ar" ? "وقت الإنجاز" : "Estimated Duration"}
                value={newService.duration}
                onChange={(e) =>
                  setNewService({ ...newService, duration: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex-1 flex flex-col gap-1 bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-gray-900 text-xs">
                <span className="font-bold text-blue-700">
                  {lang === "ar" ? "التكلفة النهائية للعميل:" : "Client Final Price:"}
                </span>
                <span>
                  {lang === "ar"
                    ? `سعر الخدمة: ${newService.price || 0} د.إ`
                    : `Service: ${newService.price || 0} AED`}
                </span>
                <span>
                  {lang === "ar"
                    ? `رسوم الطباعة: ${newService.printingFee || 0} د.إ`
                    : `Printing: ${newService.printingFee || 0} AED`}
                </span>
                <span>
                  {lang === "ar"
                    ? `ضريبة الطباعة 5%: ${tax} د.إ`
                    : `Printing Tax 5%: ${tax} AED`}
                </span>
                <span className="font-extrabold text-emerald-700 mt-1">
                  {lang === "ar"
                    ? `الإجمالى للعميل: ${clientPrice} د.إ`
                    : `Total for client: ${clientPrice} AED`}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center mt-3">
              <label className="flex items-center gap-2 select-none cursor-pointer text-blue-800 font-semibold text-xs">
                <input
                  type="checkbox"
                  checked={!!newService.requireUpload}
                  onChange={(e) => {
                    setNewService({
                      ...newService,
                      requireUpload: e.target.checked,
                    });
                    if (!e.target.checked) {
                      setDocumentsCount(1);
                      setDocumentsFields([""]);
                    }
                  }}
                  className="accent-blue-700 w-5 h-5 cursor-pointer"
                />
                {lang === "ar"
                  ? "تفعيل رفع مستند (يجب على العميل رفع مستند)"
                  : "Require document upload (Client must upload documents)"}
              </label>
              {newService.requireUpload && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-700">
                      {lang === "ar"
                        ? "عدد المستندات المطلوبة:"
                        : "Number of required documents:"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="p-1 w-16 rounded border border-blue-300 text-blue-900 font-bold text-xs"
                      value={documentsCount}
                      onChange={(e) =>
                        setDocumentsCount(Number(e.target.value))
                      }
                    />
                  </div>
                  {Array.from({ length: documentsCount }).map((_, i) => (
                    <input
                      key={i}
                      className="p-2 w-56 rounded border border-blue-300 text-blue-900 text-xs"
                      placeholder={
                        lang === "ar"
                          ? `اسم المستند #${i + 1}`
                          : `Document name #${i + 1}`
                      }
                      value={documentsFields[i] || ""}
                      onChange={(e) => {
                        const docs = [...documentsFields];
                        docs[i] = e.target.value;
                        setDocumentsFields(docs);
                        setNewService((ns) => ({
                          ...ns,
                          requiredDocuments: docs,
                        }));
                      }}
                    />
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 select-none cursor-pointer text-blue-800 font-semibold text-xs">
                <input
                  type="checkbox"
                  checked={!!newService.repeatable}
                  onChange={(e) =>
                    setNewService({ ...newService, repeatable: e.target.checked })
                  }
                  className="accent-blue-700 w-5 h-5 cursor-pointer"
                />
                {lang === "ar"
                  ? "خدمة متعددة (يمكن للعميل تحديد عدد مرات التنفيذ)"
                  : "Repeatable service (Client can specify quantity)"}
              </label>
              {/* Switch تفعيل الخدمة */}
              <label className="flex items-center gap-2 select-none cursor-pointer text-blue-800 font-semibold text-xs">
                <input
                  type="checkbox"
                  checked={newService.active !== false}
                  onChange={(e) =>
                    setNewService({ ...newService, active: e.target.checked })
                  }
                  className="accent-blue-700 w-5 h-5 cursor-pointer"
                />
                {lang === "ar"
                  ? "تفعيل ظهور الخدمة"
                  : "Show service as active"}
              </label>
            </div>
            <div className="flex gap-2 self-end mt-3">
              {editMode && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-2 w-32 rounded-xl bg-gray-400 hover:bg-gray-600 text-white font-bold shadow transition cursor-pointer text-xs"
                >
                  {lang === "ar" ? "إلغاء التعديل" : "Cancel Edit"}
                </button>
              )}
              <button
                disabled={loading}
                className="px-3 py-2 w-32 rounded-xl bg-gradient-to-r from-blue-800 via-blue-600 to-cyan-500 hover:from-blue-900 hover:to-blue-600 text-white font-bold shadow transition cursor-pointer text-xs"
              >
                {lang === "ar"
                  ? editMode
                    ? "تعديل الخدمة"
                    : "إضافة الخدمة"
                  : editMode
                  ? "Edit Service"
                  : "Add Service"}
              </button>
            </div>
          </form>
        )}

        {/* عرض الخدمات كبطاقات عصرية (بدل الجدول) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 mb-7">
          {filteredServices.map((service) => (
            <div key={service.id} className={`${COLORS.card} p-5 shadow-xl flex flex-col gap-3`}>
              <div className="flex items-center gap-2">
                <span className={`${COLORS.badge} px-3 py-1 rounded-full font-extrabold text-xs`}>{service.serviceId}</span>
                <span className="font-bold text-xl text-blue-800">{service.name}</span>
                <span className={`ml-auto px-2 py-1 rounded-full font-bold text-xs ${service.active ? COLORS.green : COLORS.red}`}>
                  {service.active
                    ? lang === "ar"
                      ? "مفعّلة"
                      : "Active"
                    : lang === "ar"
                    ? "غير مفعّلة"
                    : "Inactive"}
                </span>
              </div>
              <div className="text-blue-900 text-sm">{service.description}</div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold">
                  {categories.find((c) => c.key === service.category)?.[lang === "ar" ? "label_ar" : "label_en"] || service.category}
                </span>
                {service.subcategory && (
                  <span className="px-2 py-1 rounded-lg bg-cyan-100 text-cyan-800 text-xs">{service.subcategory}</span>
                )}
                {Array.isArray(service.providers) && service.providers.length > 0 && (
                  <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs">
                    {service.providers.join(", ")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-md text-blue-900 font-bold">
                  {lang === "ar" ? "السعر:" : "Price:"} {service.price} د.إ
                </span>
                <span className="text-md text-blue-900 font-bold">
                  {lang === "ar" ? "طباعة:" : "Print:"} {service.printingFee || 0} د.إ
                </span>
                <span className="text-md text-blue-900 font-bold">
                  {lang === "ar" ? "ضريبة:" : "Tax:"} {service.tax}
                </span>
                <span className="text-md text-emerald-700 font-extrabold">
                  {lang === "ar" ? "للعميل:" : "Client:"} {service.clientPrice}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <span className="">{lang === "ar" ? "مستندات:" : "Docs:"} {Array.isArray(service.requiredDocuments) && service.requiredDocuments.length > 0 ? service.requiredDocuments.join(", ") : "-"}</span>
                <span className="">{lang === "ar" ? "رفع:" : "Upload:"} {service.requireUpload ? "✓" : "×"}</span>
                <span className="">{lang === "ar" ? "متعددة:" : "Repeatable:"} {service.repeatable ? "✓" : "×"}</span>
                <span className="">{lang === "ar" ? "مدة:" : "Duration:"} {service.duration || "-"}</span>
                <span className="">{lang === "ar" ? "كوينات:" : "Coins:"} {service.coins}</span>
              </div>
              <div className="flex gap-2 items-center mt-2">
                <button
                  onClick={() => toggleServiceActive(service.id, !service.active)}
                  className={`${service.active ? "bg-green-600" : "bg-red-500"} text-white px-3 py-1 rounded-full font-bold text-xs shadow transition`}
                >
                  {service.active
                    ? lang === "ar"
                      ? "إلغاء التفعيل"
                      : "Deactivate"
                    : lang === "ar"
                    ? "تفعيل"
                    : "Activate"}
                </button>
                <button
                  onClick={() => {
                    setEditMode(true);
                    setShowAdd(true);
                    setEditingId(service.id);
                    setNewService({
                      ...service,
                      price: service.price ?? "",
                      printingFee: service.printingFee ?? "",
                      coins: service.coins ?? "",
                      requireUpload: !!service.requireUpload,
                      repeatable: !!service.repeatable,
                      active: service.active !== false,
                      requiredDocuments: Array.isArray(service.requiredDocuments)
                        ? service.requiredDocuments
                        : [""],
                    });
                    setDocumentsFields(
                      Array.isArray(service.requiredDocuments)
                        ? service.requiredDocuments
                        : [""]
                    );
                    setDocumentsCount(
                      Array.isArray(service.requiredDocuments)
                        ? service.requiredDocuments.length
                        : 1
                    );
                  }}
                  className="bg-blue-700 hover:bg-blue-900 text-white px-3 py-1 rounded-full font-bold text-xs shadow transition"
                >
                  {lang === "ar" ? "تعديل" : "Edit"}
                </button>
                <button
                  onClick={() => handleDeleteService(service.id)}
                  className="bg-red-600 hover:bg-red-800 text-white px-3 py-1 rounded-full font-bold text-xs shadow"
                >
                  {lang === "ar" ? "حذف" : "Delete"}
                </button>
              </div>
            </div>
          ))}
          {filteredServices.length === 0 && (
            <div className="col-span-full w-full py-12 text-center text-gray-400 text-md font-bold">
              {lang === "ar"
                ? "لا توجد خدمات"
                : "No services found"}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-blue-700 opacity-80 text-center">
          {lang === "ar"
            ? "ملاحظة: يمكنك إضافة حقول جديدة تحت كل فئة أو خدمة فرعية مستقبلًا بسهولة عبر الكود."
            : "Note: You can add new fields or sub-services under each category in the future easily via code."}
        </div>
      </div>
    </div>
  );
}