"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  FaWallet,
  FaCoins,
  FaBell,
  FaWhatsapp,
  FaTrash,
  FaCommentDots,
  FaUserCheck,
  FaUserSlash,
  FaBuilding,
  FaUserPlus,
  FaSearch,
} from "react-icons/fa";
import { MdEmail, MdPhone, MdClose, MdEdit } from "react-icons/md";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { firestore, auth } from "@/lib/firebase.client";
import ChatWidgetFull from "@/components/ClientChat/ChatWidgetFull";

// =======================
// CONSTANTS
// =======================
const typeTabs = [
  { key: "all", label: "الكل", icon: <FaUserPlus /> },
  { key: "resident", label: "المقيمين", icon: <FaUserCheck /> },
  { key: "nonResident", label: "غير المقيمين", icon: <FaUserSlash /> },
  { key: "company", label: "الشركات", icon: <FaBuilding /> },
];

const typeLabel = {
  resident: "مقيم",
  nonResident: "غير مقيم",
  company: "شركة",
};

// =======================
// UI HELPERS
// =======================
function clientTypeIcon(type) {
  switch (type) {
    case "company":
      return <FaBuilding className="text-indigo-600 mr-1" />;
    case "resident":
      return <FaUserCheck className="text-emerald-500 mr-1" />;
    case "nonResident":
      return <FaUserSlash className="text-orange-400 mr-1" />;
    default:
      return null;
  }
}

function StatusChip({ status }) {
  const map = {
    active: { label: "نشط", color: "bg-emerald-200 text-emerald-800" },
    banned: { label: "محظور", color: "bg-red-200 text-red-700" },
    inactive: { label: "غير نشط", color: "bg-gray-200 text-gray-600" },
    suspended: { label: "معلق", color: "bg-yellow-100 text-yellow-700" },
  };
  const obj = map[status] || map.inactive;
  return (
    <span
      className={`px-3 py-1 rounded-full font-bold shadow text-xs ${obj.color} border border-gray-200`}
    >
      {obj.label}
    </span>
  );
}

// =======================
// DATA NORMALIZERS (DOCS)
// =======================
function normalizePhoneForWhatsApp(phone) {
  if (!phone) return null;
  const clean = String(phone).replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (clean.startsWith("0")) return `971${clean.slice(1)}`;
  if (clean.startsWith("971")) return clean;
  if (clean.startsWith("+")) return clean.slice(1);
  return clean;
}

function getClientTypeFromUser(u) {
  return u?.type || u?.accountType || "resident";
}

function formatClientForCard(rawUser) {
  if (!rawUser) return null;

  const fullName =
    rawUser.name ||
    rawUser.nameEn ||
    [rawUser.firstName, rawUser.middleName, rawUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    rawUser.clientNumber ||
    rawUser.uid ||
    "بدون اسم";

  const docs = [];
  const pushDoc = (label, type, url) => {
    if (!url) return;
    docs.push({
      label: label || type || "مستند",
      type: type || "",
      url,
    });
  };

  // Emirates ID Front
  const eidFront =
    rawUser.eidFront ||
    rawUser.eidFrontUrl ||
    rawUser.emiratesIdFront ||
    null;
  if (eidFront) {
    if (typeof eidFront === "string")
      pushDoc("هوية إمارات (الوجه الأمامي)", "eidFront", eidFront);
    else if (eidFront?.url)
      pushDoc(
        eidFront.label || "هوية إمارات (الوجه الأمامي)",
        eidFront.type || "eidFront",
        eidFront.url
      );
  }

  // Emirates ID Back
  const eidBack =
    rawUser.eidBack || rawUser.eidBackUrl || rawUser.emiratesIdBack || null;
  if (eidBack) {
    if (typeof eidBack === "string")
      pushDoc("هوية إمارات (الوجه الخلفي)", "eidBack", eidBack);
    else if (eidBack?.url)
      pushDoc(
        eidBack.label || "هوية إمارات (الوجه الخلفي)",
        eidBack.type || "eidBack",
        eidBack.url
      );
  }

  // Passport
  const passport = rawUser.passport || rawUser.passportUrl || rawUser.passportScan || null;
  if (passport) {
    if (typeof passport === "string") pushDoc("جواز السفر", "passport", passport);
    else if (passport?.url)
      pushDoc(passport.label || "جواز السفر", passport.type || "passport", passport.url);
  }

  // Company docs
  const isCompany =
    getClientTypeFromUser(rawUser) === "company" ||
    !!rawUser.tradeLicenseUrl ||
    !!rawUser.companyLicenseNumber ||
    !!rawUser.companyNameEn ||
    !!rawUser.companyNameAr;

  if (isCompany) {
    if (rawUser.tradeLicenseUrl)
      pushDoc("الرخصة التجارية", "tradeLicense", rawUser.tradeLicenseUrl);

    if (Array.isArray(rawUser.companyDocs)) {
      rawUser.companyDocs.forEach((d, i) => {
        if (!d) return;
        if (typeof d === "string") pushDoc(`مستند شركة ${i + 1}`, "companyDoc", d);
        else if (d?.url)
          pushDoc(d.label || `مستند شركة ${i + 1}`, d.type || "companyDoc", d.url);
      });
    }
  }

  // documents (map/array)
  if (rawUser.documents) {
    const v = rawUser.documents;

    if (Array.isArray(v)) {
      v.forEach((d, i) => {
        if (!d) return;
        if (typeof d === "string") pushDoc(`مستند ${i + 1}`, `doc_${i}`, d);
        else if (d?.url) pushDoc(d.label || `مستند ${i + 1}`, d.type || `doc_${i}`, d.url);
      });
    } else if (typeof v === "object") {
      Object.entries(v).forEach(([k, val]) => {
        if (!val) return;
        if (typeof val === "string") pushDoc(k, k, val);
        else if (Array.isArray(val)) {
          val.forEach((item, idx) => {
            if (item?.url) pushDoc(item.label || `${k} ${idx + 1}`, item.type || k, item.url);
          });
        } else if (val?.url) {
          pushDoc(val.label || k, val.type || k, val.url);
        }
      });
    }
  }

  // attachments (sometimes docs are saved here)
  if (Array.isArray(rawUser.attachments)) {
    rawUser.attachments.forEach((a, i) => {
      if (!a) return;
      if (typeof a === "string") pushDoc(`مرفق ${i + 1}`, "attachment", a);
      else if (a?.url) pushDoc(a.label || a.name || `مرفق ${i + 1}`, a.type || "attachment", a.url);
    });
  }

  return {
    uid: rawUser.uid || rawUser.userId || rawUser.customerId || "",
    profilePic: rawUser.profilePic || "",
    name: fullName,
    email: rawUser.email || "",
    phone: rawUser.phone || "",
    type: getClientTypeFromUser(rawUser),
    status: rawUser.status || "inactive",
    clientNumber: rawUser.clientNumber || "",
    wallet: typeof rawUser.wallet === "number" ? rawUser.wallet : 0,
    coins: typeof rawUser.coins === "number" ? rawUser.coins : 0,
    coreDocuments: docs,
    _raw: rawUser,
  };
}

// =======================
// ID GENERATOR
// =======================
async function generateUniqueClientNumber(type) {
  let prefix = "";
  if (type === "resident") prefix = "RES";
  else if (type === "nonResident") prefix = "NON";
  else prefix = "COM";

  const clientsSnap = await getDocs(
    query(collection(firestore, "users"), where("type", "==", type))
  );

  const numbers = [];
  clientsSnap.forEach((docSnap) => {
    const client = docSnap.data();
    if (client.clientNumber && client.clientNumber.startsWith(prefix)) {
      const match = client.clientNumber.match(/(\d{3})-(\d{4})$/);
      if (match) numbers.push(parseInt(match[1] + match[2], 10));
    }
  });

  let next = 1;
  if (numbers.length) next = Math.max(...numbers) + 1;

  const serial3 = String(Math.floor(next / 10000)).padStart(3, "0");
  const serial4 = String(next % 10000).padStart(4, "0");
  return `${prefix}-${serial3}-${serial4}`;
}

// =======================
// MAIN
// =======================
function UsersManagementSection({ lang = "ar" }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("all");

  const [edit, setEdit] = useState(false);
  const [editData, setEditData] = useState({});

  const [addNew, setAddNew] = useState(false);
  const [addData, setAddData] = useState({
    type: "resident",
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const [showChat, setShowChat] = useState(false);

  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const usersRef = collection(firestore, "users");
    const unsub = onSnapshot(usersRef, (snap) => {
      const arr = [];
      snap.forEach((docSnap) => {
        const user = docSnap.data();
        if (user.role === "client") arr.push({ ...user, uid: docSnap.id });
      });
      setClients(arr);
    });
    return () => unsub();
  }, []);

  const list = useMemo(
    () => (tab === "all" ? clients : clients.filter((c) => c.type === tab)),
    [clients, tab]
  );

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return list.filter((u) =>
      [u.name, u.email, u.phone, u.clientNumber].filter(Boolean).join(" ").toLowerCase().includes(s)
    );
  }, [list, search]);

  const handleOpenCard = (client) => {
    setSelected(client);
    setShowChat(false);
  };

  const handleEditOpen = (client) => {
    setEditData({ ...client });
    setEditError("");
    setEdit(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError("");
    try {
      const { uid, ...rest } = editData; // لا ترجع تكتب uid داخل الدوك
      await updateDoc(doc(firestore, "users", uid), { ...rest, uid });
      setEdit(false);
      setSelected({ ...editData });
    } catch (err) {
      setEditError("حدث خطأ أثناء تحديث البيانات");
    }
    setEditLoading(false);
  };

  const handleWhatsApp = (client) => {
    const wa = normalizePhoneForWhatsApp(client?.phone);
    if (!wa) return;
    window.open(`https://wa.me/${wa}`, "_blank");
  };

  const handleToggleStatus = async (client) => {
    const newStatus = client.status === "active" ? "inactive" : "active";
    await updateDoc(doc(firestore, "users", client.uid), { status: newStatus });
    setSelected((prev) => (prev ? { ...prev, status: newStatus } : null));
  };

  const handleDelete = async (client) => {
    if (window.confirm(`تأكيد حذف: ${client.name}?`)) {
      await deleteDoc(doc(firestore, "users", client.uid));
      setSelected(null);
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    setAddError("");

    if (!addData.name || !addData.email || !addData.password || !addData.phone) {
      setAddError("يرجى إدخال كل البيانات!");
      return;
    }

    setAddLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        addData.email,
        addData.password
      );

      const { user } = userCredential;
      const clientNumber = await generateUniqueClientNumber(addData.type);

      const clientData = {
        clientNumber,
        name: addData.name,
        type: addData.type,
        profilePic: "",
        email: addData.email,
        phone: addData.phone,
        status: "active",
        wallet: 0,
        coins: 0,
        role: "client",
        attachments: [],
        registeredAt: new Date().toISOString(),
        uid: user.uid,
      };

      await setDoc(doc(firestore, "users", user.uid), clientData);

      setAddNew(false);
      setAddData({
        type: "resident",
        name: "",
        email: "",
        password: "",
        phone: "",
      });
    } catch (err) {
      setAddError(err?.message || "حدث خطأ أثناء إنشاء العميل");
    }
    setAddLoading(false);
  };

  // =======================
  // RENDER CLIENT CARD
  // =======================
  const renderClientCard = (client) => {
    const c = formatClientForCard(client);
    if (!c) return null;

    const waPhone = normalizePhoneForWhatsApp(c.phone);
    const whatsappLink = waPhone ? `https://wa.me/${waPhone}` : null;
    const mailtoLink = c.email ? `mailto:${c.email}` : null;

    return (
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-emerald-100 w-[95vw] max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-100">
          <div className="flex flex-col sm:flex-row gap-5 sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <img
                src={c.profilePic || "/default-avatar.png"}
                alt={c.name}
                className="w-20 h-20 rounded-full border-4 border-white shadow object-cover"
              />
              <div>
                <div className="text-2xl font-extrabold text-emerald-900">
                  {c.name}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-mono font-bold text-emerald-800 bg-white border border-emerald-100 px-2 py-1 rounded">
                    {c.clientNumber || c.uid}
                  </span>

                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded inline-flex items-center">
                    {clientTypeIcon(c.type)}
                    {typeLabel[c.type] || c.type}
                  </span>

                  <StatusChip status={c.status} />
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center bg-white rounded-xl border border-emerald-100 px-4 py-2 shadow-sm min-w-24">
                <span className="text-[11px] text-gray-500 font-bold">
                  الرصيد
                </span>
                <span className="text-emerald-700 font-extrabold">
                  {c.wallet} د.إ
                </span>
              </div>
              <div className="flex flex-col items-center bg-white rounded-xl border border-emerald-100 px-4 py-2 shadow-sm min-w-24">
                <span className="text-[11px] text-gray-500 font-bold">
                  الكوينات
                </span>
                <span className="text-yellow-700 font-extrabold">{c.coins}</span>
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="mt-4 flex flex-wrap gap-2">
            {c.email && (
              <span className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm font-bold text-gray-800">
                <MdEmail className="text-emerald-600" />
                {c.email}
              </span>
            )}
            {c.phone && (
              <span className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm font-bold text-gray-800">
                <MdPhone className="text-emerald-600" />
                {c.phone}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg shadow"
              >
                <FaWhatsapp /> واتساب
              </a>
            )}

            {mailtoLink && (
              <a
                href={mailtoLink}
                className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold px-4 py-2 rounded-lg shadow"
              >
                <MdEmail /> إيميل
              </a>
            )}

            <button
              onClick={() => setShowChat((v) => !v)}
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-black text-white font-bold px-4 py-2 rounded-lg shadow"
            >
              <FaCommentDots /> شات داخلي
            </button>

            <button
              onClick={() => handleToggleStatus(client)}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg shadow"
            >
              <FaUserCheck />
              {client.status === "active" ? "تعطيل" : "تفعيل"}
            </button>

            <button
              onClick={() => handleEditOpen(client)}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg shadow"
            >
              <MdEdit /> تعديل
            </button>

            <button
              onClick={() => handleDelete(client)}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg shadow"
            >
              <FaTrash /> حذف
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Documents */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="font-extrabold text-gray-900 mb-3">
              مستندات الحساب الأساسية
            </div>

            {c.coreDocuments?.length ? (
              <div className="flex flex-col gap-2">
                {c.coreDocuments.map((d, i) => (
                  <a
                    key={i}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-gray-50 hover:bg-emerald-50 border border-gray-200 rounded-xl px-4 py-3 transition"
                  >
                    <div className="text-sm font-bold text-gray-800">
                      {d.label}
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-700 underline">
                      فتح
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 font-bold text-sm">
                لا يوجد مستندات مضافة
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="font-extrabold text-gray-900 mb-3">
              التواصل الداخلي
            </div>

            {showChat ? (
              <div className="border rounded-xl bg-gray-50 p-2">
                <ChatWidgetFull
                  userId={"ADMIN"}
                  userName={"مدير النظام"}
                  roomId={c.uid}
                />
              </div>
            ) : (
              <div className="text-gray-500 font-bold text-sm">
                اضغط “شات داخلي” لفتح المحادثة مع العميل.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // =======================
  // UI
  // =======================
  return (
    <div className="p-0 bg-gradient-to-br from-[#f6fbf8] to-[#f5faff] min-h-screen">
      {/* Floating Add Button */}
      <button
        className="fixed bottom-7 right-7 z-50 bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white rounded-full p-4 shadow-2xl flex items-center gap-2 hover:scale-110 transition transform font-bold text-lg"
        onClick={() => setAddNew(true)}
        title="إضافة عميل"
        style={{ boxShadow: "0 8px 24px 0 #2dd4bf44" }}
      >
        <FaUserPlus />{" "}
        <span className="hidden sm:inline">
          {lang === "ar" ? "إضافة عميل" : "Add Client"}
        </span>
      </button>

      {/* Header */}
      <div className="py-10 px-4 sm:px-10 flex flex-col md:flex-row md:justify-between items-center gap-6 mb-7 bg-gradient-to-r from-emerald-100 to-white border-b border-emerald-50">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <FaUserPlus className="text-emerald-500 text-3xl" />
            <h1 className="text-3xl font-extrabold text-emerald-900 tracking-tight">
              {lang === "ar" ? "إدارة العملاء" : "Clients Management"}
            </h1>
          </div>

          <div className="flex gap-4 text-base font-bold">
            <div className="flex flex-col items-center bg-white/90 rounded-lg px-6 py-2 shadow border border-emerald-50 min-w-24">
              <span className="text-gray-500 text-xs">
                {lang === "ar" ? "الكل" : "Total"}
              </span>
              <span className="text-emerald-800 text-xl">{list.length}</span>
            </div>
            <div className="flex flex-col items-center bg-white/90 rounded-lg px-6 py-2 shadow border border-emerald-50 min-w-24">
              <span className="text-gray-500 text-xs">
                {lang === "ar" ? "نشط" : "Active"}
              </span>
              <span className="text-emerald-600 text-xl">
                {list.filter((c) => c.status === "active").length}
              </span>
            </div>
            <div className="flex flex-col items-center bg-white/90 rounded-lg px-6 py-2 shadow border border-emerald-50 min-w-24">
              <span className="text-gray-500 text-xs">
                {lang === "ar" ? "محظور" : "Banned"}
              </span>
              <span className="text-red-500 text-xl">
                {list.filter((c) => c.status === "banned").length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <FaSearch className="absolute left-3 top-3 text-emerald-400" />
            <input
              className="border rounded-full pl-10 pr-3 py-2 text-gray-700 bg-white/90 w-full shadow-sm focus:border-emerald-400"
              placeholder="بحث بالاسم أو البريد أو الهاتف أو الرقم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 sm:px-10 mb-7">
        {typeTabs.map((t) => (
          <button
            key={t.key}
            className={`flex items-center gap-2 px-5 py-2 font-bold rounded-full border-2 cursor-pointer transition text-base shadow-sm 
              ${
                tab === t.key
                  ? "border-emerald-600 text-emerald-700 bg-white shadow"
                  : "border-gray-100 text-gray-500 bg-gray-50 hover:bg-emerald-50"
              }`}
            onClick={() => setTab(t.key)}
            style={{ minWidth: 120, justifyContent: "center" }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl shadow bg-white/95 mb-2 mx-2 sm:mx-10">
        <table className="min-w-full">
          <thead>
            <tr className="bg-emerald-50 text-emerald-800 text-sm">
              <th className="py-2 px-4"></th>
              <th className="py-2 px-4">الاسم</th>
              <th className="py-2 px-4">النوع</th>
              <th className="py-2 px-4">رقم العميل</th>
              <th className="py-2 px-4">الحالة</th>
              <th className="py-2 px-4">البريد</th>
              <th className="py-2 px-4">الهاتف</th>
              <th className="py-2 px-4">الرصيد</th>
              <th className="py-2 px-4">الكوينات</th>
              <th className="py-2 px-4"></th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((client) => (
              <tr
                key={client.uid}
                className="text-center hover:bg-emerald-50 transition"
              >
                <td>
                  <img
                    src={client.profilePic || "/default-avatar.png"}
                    alt={client.name}
                    className="w-11 h-11 rounded-full object-cover inline-block border-2 border-emerald-100 cursor-pointer shadow"
                    onClick={() => handleOpenCard(client)}
                  />
                </td>

                <td
                  className="py-2 px-4 font-semibold text-emerald-900 cursor-pointer hover:underline"
                  onClick={() => handleOpenCard(client)}
                >
                  {client.name}
                </td>

                <td
                  className="py-2 px-4 font-bold text-indigo-600 cursor-pointer hover:underline"
                  onClick={() => handleOpenCard(client)}
                >
                  {typeLabel[client.type] || client.type}
                </td>

                <td
                  className="py-2 px-4 font-mono font-bold text-emerald-800 cursor-pointer hover:underline"
                  onClick={() => handleOpenCard(client)}
                >
                  {client.clientNumber || "-"}
                </td>

                <td className="py-2 px-4">
                  <StatusChip status={client.status} />
                </td>

                <td className="py-2 px-4 text-gray-700">{client.email}</td>
                <td className="py-2 px-4 text-gray-700">{client.phone}</td>

                <td className="py-2 px-4 font-bold text-emerald-700">
                  {client.wallet || 0} درهم
                </td>

                <td className="py-2 px-4 font-bold text-yellow-600">
                  {client.coins || 0}
                </td>

                <td className="py-2 px-4">
                  <button
                    className="text-emerald-700 font-bold hover:underline"
                    onClick={() => handleOpenCard(client)}
                  >
                    عرض
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-gray-400">
                  لا يوجد عملاء بهذه البيانات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Client Card Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <button
              className="absolute top-3 left-3 sm:left-auto sm:right-3 text-gray-500 hover:text-gray-900 font-bold cursor-pointer text-2xl z-20"
              onClick={() => setSelected(null)}
              title="إغلاق"
              style={{ zIndex: 60 }}
            >
              <MdClose />
            </button>
            {renderClientCard(selected)}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {edit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative border-2 border-emerald-100">
            <button
              className="absolute top-2 left-2 text-gray-500 hover:text-gray-900 font-bold cursor-pointer text-2xl"
              onClick={() => setEdit(false)}
              title="إغلاق"
            >
              <MdClose />
            </button>

            <form className="flex flex-col gap-4" onSubmit={handleSaveEdit}>
              <div className="text-lg font-bold text-center mb-2 text-emerald-800">
                تعديل بيانات العميل
              </div>

              {editError && (
                <div className="bg-red-100 text-red-800 p-2 rounded">
                  {editError}
                </div>
              )}

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">
                  الاسم:
                </label>
                <input
                  className="border rounded px-3 py-2 w-full text-gray-900"
                  value={editData.name || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, name: e.target.value })
                  }
                  placeholder="الاسم"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">
                  النوع:
                </label>
                <select
                  className="border rounded px-3 py-2 w-full text-gray-900"
                  value={editData.type || "resident"}
                  onChange={(e) =>
                    setEditData({ ...editData, type: e.target.value })
                  }
                >
                  <option value="resident">مقيم</option>
                  <option value="nonResident">غير مقيم</option>
                  <option value="company">شركة</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">
                  البريد الإلكتروني:
                </label>
                <input
                  className="border rounded px-3 py-2 w-full text-gray-900"
                  value={editData.email || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, email: e.target.value })
                  }
                  placeholder="البريد"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">
                  الهاتف:
                </label>
                <input
                  className="border rounded px-3 py-2 w-full text-gray-900"
                  value={editData.phone || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, phone: e.target.value })
                  }
                  placeholder="الهاتف"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-sm font-bold text-gray-700">
                    المحفظة:
                  </label>
                  <input
                    className="border rounded px-3 py-2 w-full text-gray-900"
                    value={typeof editData.wallet === "number" ? editData.wallet : Number(editData.wallet || 0)}
                    onChange={(e) =>
                      setEditData({ ...editData, wallet: Number(e.target.value) })
                    }
                    placeholder="المحفظة"
                    type="number"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-bold text-gray-700">
                    الكوينات:
                  </label>
                  <input
                    className="border rounded px-3 py-2 w-full text-gray-900"
                    value={typeof editData.coins === "number" ? editData.coins : Number(editData.coins || 0)}
                    onChange={(e) =>
                      setEditData({ ...editData, coins: Number(e.target.value) })
                    }
                    placeholder="الكوينات"
                    type="number"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-center mt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="bg-emerald-600 text-white rounded px-6 py-2 font-bold cursor-pointer shadow"
                >
                  {editLoading ? "جاري الحفظ..." : "حفظ"}
                </button>
                <button
                  type="button"
                  className="bg-gray-400 text-white rounded px-6 py-2 font-bold cursor-pointer shadow"
                  onClick={() => setEdit(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 relative border-2 border-emerald-200">
            <button
              className="absolute top-2 left-2 text-gray-500 hover:text-gray-900 font-bold cursor-pointer text-2xl"
              onClick={() => setAddNew(false)}
              title="إغلاق"
            >
              <MdClose />
            </button>

            <form className="flex flex-col gap-4" onSubmit={handleAddClient}>
              <div className="text-lg font-bold text-center mb-2 text-emerald-800 flex items-center gap-2 justify-center">
                <FaUserPlus /> إضافة عميل جديد
              </div>

              {addError && (
                <div className="bg-red-100 text-red-800 p-2 rounded">
                  {addError}
                </div>
              )}

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">
                  نوع العميل:
                </label>
                <select
                  className="border rounded px-3 py-2 w-full text-gray-800"
                  value={addData.type}
                  onChange={(e) =>
                    setAddData({ ...addData, type: e.target.value })
                  }
                >
                  <option value="resident">مقيم</option>
                  <option value="nonResident">غير مقيم</option>
                  <option value="company">شركة</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">
                  الاسم:
                </label>
                <input
                  className="border rounded px-3 py-2 w-full text-gray-900"
                  value={addData.name}
                  onChange={(e) => setAddData({ ...addData, name: e.target.value })}
                  placeholder="اسم العميل"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">
                  البريد الإلكتروني:
                </label>
                <input
                  className="border rounded px-3 py-2 w-full text-gray-900"
                  value={addData.email}
                  onChange={(e) =>
                    setAddData({ ...addData, email: e.target.value })
                  }
                  placeholder="ادخل البريد الإلكتروني الصحيح"
                  type="email"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">
                  كلمة المرور:
                </label>
                <input
                  className="border rounded px-3 py-2 w-full text-gray-900"
                  value={addData.password}
                  onChange={(e) =>
                    setAddData({ ...addData, password: e.target.value })
                  }
                  placeholder="كلمة المرور"
                  type="password"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">
                  الهاتف:
                </label>
                <input
                  className="border rounded px-3 py-2 w-full text-gray-900"
                  value={addData.phone}
                  onChange={(e) =>
                    setAddData({ ...addData, phone: e.target.value })
                  }
                  placeholder="05XXXXXXXX"
                />
              </div>

              <div className="flex gap-2 justify-center mt-2">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="bg-emerald-600 text-white rounded px-6 py-2 font-bold cursor-pointer shadow flex items-center gap-2"
                >
                  <FaUserPlus />
                  {addLoading ? "جاري الإضافة..." : "إضافة"}
                </button>
                <button
                  type="button"
                  className="bg-gray-400 text-white rounded px-6 py-2 font-bold cursor-pointer shadow"
                  onClick={() => setAddNew(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersManagementSection;
