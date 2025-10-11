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
  });
  const [editingId, setEditingId] = useState(null);
  const [editMode, setEditMode] = useState(false);

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
      active: true,
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
      active: true,
    };
    await saveService(editingId, serviceData);
    resetForm();
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
    });
    setDocumentsFields([""]);
    setDocumentsCount(1);
    setShowAdd(false);
    setEditMode(false);
    setEditingId(null);
  }

  const filteredServices =
    filter === "all"
      ? services
      : services.filter((s) => s.category === filter);

  const [newSubcatInput, setNewSubcatInput] = useState("");
  const [newProviderInput, setNewProviderInput] = useState("");

  return (
    <div className="bg-gradient-to-br from-white to-cyan-50 rounded-2xl shadow p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between items-center mb-6 gap-3">
        <span className="text-xl font-bold text-cyan-900">
          {lang === "ar" ? "إدارة الخدمات" : "Services Management"}
        </span>
        <div className="flex gap-2">
          <select
            value={clientType}
            onChange={(e) => {
              setClientType(e.target.value);
              setFilter("all");
              setNewService((ns) => ({
                ...ns,
                category: e.target.value,
              }));
            }}
            className="p-2 w-56 rounded border text-cyan-800 font-bold bg-cyan-50 text-sm"
          >
            {categories.filter((c) => c.key !== "all").map((cat) => (
              <option value={cat.key} key={cat.key}>
                {lang === "ar" ? cat.label_ar : cat.label_en}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setShowAdd((v) => !v);
              if (showAdd) {
                resetForm();
              }
            }}
            className="px-3 py-2 w-56 rounded bg-cyan-700 hover:bg-cyan-900 text-white font-bold shadow mt-2 md:mt-0 transition cursor-pointer text-sm"
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
      <div className="flex gap-4 mb-6 flex-wrap">
        {/* التصنيفات الفرعية */}
        <div>
          <span className="font-bold text-cyan-800 text-sm">
            {lang === "ar" ? "التصنيفات الفرعية:" : "Subcategories:"}
          </span>
          <div className="flex flex-wrap gap-2 mt-1">
            {subcategories.map((cat) => (
              <span key={cat} className="bg-cyan-100 px-2 py-1 rounded flex items-center gap-1 text-cyan-900 font-semibold text-xs">
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
                className="p-1 w-32 rounded border text-cyan-900 text-xs"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-800 text-white rounded font-bold text-xs"
              >+</button>
            </form>
          </div>
        </div>
        {/* جهات الخدمة */}
        <div>
          <span className="font-bold text-cyan-800 text-sm">
            {lang === "ar" ? "جهات الخدمة:" : "Providers:"}
          </span>
          <div className="flex flex-wrap gap-2 mt-1">
            {providers.map((prov) => (
              <span key={prov} className="bg-cyan-100 px-2 py-1 rounded flex items-center gap-1 text-cyan-900 font-semibold text-xs">
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
                className="p-1 w-32 rounded border text-cyan-900 text-xs"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-800 text-white rounded font-bold text-xs"
              >+</button>
            </form>
          </div>
        </div>
      </div>

      {/* فلاتر الفئات */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setFilter(cat.key)}
            className={`px-3 py-1 w-32 rounded-lg border font-semibold transition cursor-pointer text-xs ${
              filter === cat.key
                ? "bg-cyan-700 text-white border-cyan-700"
                : "bg-white text-cyan-700 border-cyan-300 hover:bg-cyan-50"
            }`}
          >
            {lang === "ar" ? cat.label_ar : cat.label_en}
          </button>
        ))}
      </div>

      {/* نموذج إضافة أو تعديل خدمة */}
      {showAdd && (
        <form
          onSubmit={editMode ? handleEditService : handleAddService}
          className="bg-cyan-50 rounded-lg p-4 mb-6 shadow flex flex-col gap-2 border border-cyan-200"
        >
          <div className="flex flex-wrap gap-2 mb-2 justify-center">
            <input
              required
              className="p-2 w-56 rounded border text-gray-900 font-semibold text-sm"
              placeholder={lang === "ar" ? "اسم الخدمة" : "Service name"}
              value={newService.name}
              onChange={(e) =>
                setNewService({ ...newService, name: e.target.value })
              }
            />
            <input
              required
              className="p-2 w-56 rounded border text-gray-900 text-sm"
              placeholder={lang === "ar" ? "وصف الخدمة" : "Service Description"}
              value={newService.description}
              onChange={(e) =>
                setNewService({ ...newService, description: e.target.value })
              }
            />
            <select
              className="p-2 w-56 rounded border text-gray-900 font-semibold text-sm"
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
              className="p-2 w-56 rounded border text-gray-900 text-sm"
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
              className="p-2 w-56 rounded border text-gray-900 text-sm"
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
              className="p-2 w-56 rounded border text-gray-900 text-sm"
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
              className="p-2 w-56 rounded border text-gray-900 bg-gray-100 text-sm"
              placeholder={lang === "ar" ? "عدد الكوينات" : "Coins"}
              value={newService.coins}
            />
            <input
              className="p-2 w-56 rounded border text-gray-900 text-sm"
              placeholder={lang === "ar" ? "وقت الإنجاز" : "Estimated Duration"}
              value={newService.duration}
              onChange={(e) =>
                setNewService({ ...newService, duration: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 flex flex-col gap-1 bg-gray-50 p-2 rounded border border-gray-200 text-gray-900 text-xs">
              <span className="font-bold text-cyan-800">
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
          <label className="flex items-center gap-2 mt-2 select-none cursor-pointer text-cyan-800 font-semibold text-xs">
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
              className="accent-cyan-700 w-5 h-5 cursor-pointer"
            />
            {lang === "ar"
              ? "تفعيل رفع مستند (يجب على العميل رفع مستند)"
              : "Require document upload (Client must upload documents)"}
          </label>
          {newService.requireUpload && (
            <div className="flex flex-col gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-cyan-700">
                  {lang === "ar"
                    ? "عدد المستندات المطلوبة:"
                    : "Number of required documents:"}
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="p-1 w-16 rounded border text-cyan-900 font-bold text-xs"
                  value={documentsCount}
                  onChange={(e) =>
                    setDocumentsCount(Number(e.target.value))
                  }
                />
              </div>
              {Array.from({ length: documentsCount }).map((_, i) => (
                <input
                  key={i}
                  className="p-2 w-56 rounded border text-gray-900 text-xs"
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
          <label className="flex items-center gap-2 mt-1 select-none cursor-pointer text-cyan-800 font-semibold text-xs">
            <input
              type="checkbox"
              checked={!!newService.repeatable}
              onChange={(e) =>
                setNewService({ ...newService, repeatable: e.target.checked })
              }
              className="accent-cyan-700 w-5 h-5 cursor-pointer"
            />
            {lang === "ar"
              ? "خدمة متعددة (يمكن للعميل تحديد عدد مرات التنفيذ)"
              : "Repeatable service (Client can specify quantity)"}
          </label>
          <div className="flex gap-2 self-end">
            {editMode && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-2 w-32 rounded bg-gray-400 hover:bg-gray-600 text-white font-bold shadow mt-2 transition cursor-pointer text-xs"
              >
                {lang === "ar" ? "إلغاء التعديل" : "Cancel Edit"}
              </button>
            )}
            <button
              disabled={loading}
              className="px-3 py-2 w-32 rounded bg-cyan-800 hover:bg-cyan-900 text-white font-bold shadow mt-2 transition cursor-pointer text-xs"
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

      {/* جدول الخدمات */}
      <div className="overflow-x-auto">
        <table className="w-full text-center border rounded-lg bg-white text-xs sm:text-sm">
          <thead className="bg-cyan-100 text-cyan-900">
            <tr>
              <th className="py-2 px-1">ID</th>
              <th className="py-2 px-1">{lang === "ar" ? "الاسم" : "Name"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "الوصف" : "Description"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "التصنيف" : "Category"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "فرعي" : "Subcategory"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "جهة" : "Provider"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "السعر" : "Price"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "طباعة" : "Printing"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "ضريبة" : "Tax"}</th>
              <th className="py-2 px-1 font-bold text-emerald-700">{lang === "ar" ? "للعميل" : "Client"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "كوينات" : "Coins"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "مدة" : "Duration"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "مستندات" : "Documents"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "رفع؟" : "Upload?"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "متعددة؟" : "Repeatable?"}</th>
              <th className="py-2 px-1">{lang === "ar" ? "تحكم" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.map((service) => (
              <tr
                key={service.id}
                className="border-b hover:bg-cyan-50 transition text-xs"
              >
                <td className="py-2 px-1 font-mono text-cyan-800">{service.serviceId}</td>
                <td className="py-2 px-1 font-bold text-cyan-900">{service.name}</td>
                <td className="py-2 px-1 text-cyan-700 whitespace-pre-line">{service.description}</td>
                <td className="py-2 px-1">
                  {
                    categories.find((c) => c.key === service.category)?.[lang === "ar" ? "label_ar" : "label_en"] ||
                    service.category
                  }
                </td>
                <td className="py-2 px-1 text-cyan-700">{service.subcategory}</td>
                <td className="py-2 px-1 text-cyan-700">
                  {Array.isArray(service.providers) && service.providers.length > 0
                    ? service.providers.join(", ")
                    : "-"}
                </td>
                <td className="py-2 px-1 text-cyan-900">{service.price} د.إ</td>
                <td className="py-2 px-1 text-cyan-900">{service.printingFee || 0} د.إ</td>
                <td className="py-2 px-1 text-cyan-800 bg-gray-100 font-bold">{service.tax}</td>
                <td className="py-2 px-1 text-emerald-800 bg-gray-100 font-bold">{service.clientPrice}</td>
                <td className="py-2 px-1 text-cyan-900">{service.coins}</td>
                <td className="py-2 px-1 text-cyan-700">{service.duration}</td>
                <td className="py-2 px-1 text-cyan-800">
                  {Array.isArray(service.requiredDocuments) && service.requiredDocuments.length > 0
                    ? service.requiredDocuments.map((d, i) => <div key={i}>{d}</div>)
                    : "-"}
                </td>
                <td className="py-2 px-1">
                  {service.requireUpload ? (
                    <span title={lang === "ar" ? "يتطلب رفع مستند" : "Requires document upload"}
                      className="inline-block w-5 h-5 bg-cyan-700 rounded text-white font-bold text-center leading-5">✓</span>
                  ) : (
                    <span title={lang === "ar" ? "لا يتطلب" : "Not required"}
                      className="inline-block w-5 h-5 bg-gray-200 rounded text-gray-500 font-bold text-center leading-5">×</span>
                  )}
                </td>
                <td className="py-2 px-1">
                  {service.repeatable ? (
                    <span title={lang === "ar" ? "خدمة متعددة" : "Repeatable"}
                      className="inline-block w-5 h-5 bg-emerald-700 rounded text-white font-bold text-center leading-5">✓</span>
                  ) : (
                    <span title={lang === "ar" ? "خدمة مرة واحدة" : "One time"}
                      className="inline-block w-5 h-5 bg-gray-200 rounded text-gray-500 font-bold text-center leading-5">×</span>
                  )}
                </td>
                <td className="py-2 px-1">
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
                    className="px-2 py-1 w-20 bg-cyan-600 hover:bg-cyan-800 text-white rounded mx-1 transition cursor-pointer text-xs"
                  >
                    {lang === "ar" ? "تعديل" : "Edit"}
                  </button>
                  <button
                    onClick={() => handleDeleteService(service.id)}
                    className="px-2 py-1 w-20 bg-red-600 hover:bg-red-800 text-white rounded mx-1 transition cursor-pointer text-xs"
                  >
                    {lang === "ar" ? "حذف" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
            {filteredServices.length === 0 && (
              <tr>
                <td colSpan={16} className="py-6 text-gray-400 text-xs">
                  {lang === "ar"
                    ? "لا توجد خدمات"
                    : "No services found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-cyan-700 opacity-70">
        {lang === "ar"
          ? "ملاحظة: يمكنك إضافة حقول جديدة تحت كل فئة أو خدمة فرعية مستقبلًا بسهولة عبر الكود."
          : "Note: You can add new fields or sub-services under each category in the future easily via code."}
      </div>
    </div>
  );
}