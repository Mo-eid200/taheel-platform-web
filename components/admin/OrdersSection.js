"use client";
export const dynamic = "force-dynamic";

import React, { Suspense, useEffect, useState, useRef } from "react";

import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { firestore as db } from "@/lib/firebase.client";

import {
  MdClose,
  MdEmail,
  MdWhatsapp,
  MdNotificationsActive,
  MdOutlineChat,
  MdPerson,
  MdVolumeUp,
} from "react-icons/md";

import {
  FaUserTie,
  FaUserAlt,
  FaBuilding,
  FaUserCheck,
  FaUserSlash,
} from "react-icons/fa";

import ChatWidgetFull from "@/components/ClientChat/ChatWidgetFull";

// =======================
// CONSTANTS
// =======================

const STATUS_ICONS = {
  new: "🆕",
  under_review: "🔎",
  government_processing: "🏛️",
  completed: "✅",
  rejected: "❌",
  pending_requirements: "📄",
  archived: "🗄️",
};

const STATUS_LABEL = {
  new: "جديد",
  under_review: "قيد المراجعة",
  government_processing: "قيد المعالجة الحكومية",
  completed: "مكتمل",
  rejected: "مرفوض",
  pending_requirements: "بانتظار مستندات",
  archived: "مؤرشف",
};

const STATUS_BADGE_STYLE = {
  new: "bg-sky-100 text-sky-800 border-sky-300",
  under_review: "bg-yellow-100 text-yellow-800 border-yellow-400",
  government_processing:
    "bg-indigo-100 text-indigo-900 border-indigo-400",
  completed: "bg-green-100 text-green-800 border-green-400",
  rejected: "bg-red-100 text-red-800 border-red-400",
  pending_requirements:
    "bg-orange-100 text-orange-800 border-orange-400",
  archived: "bg-gray-100 text-gray-700 border-gray-400",
};

// Tabs by client type
const TYPE_TABS = [
  { key: "all", label: "الكل", icon: <MdPerson /> },
  { key: "resident", label: "المقيمين", icon: <FaUserCheck /> },
  { key: "nonResident", label: "غير المقيمين", icon: <FaUserSlash /> },
  { key: "company", label: "الشركات", icon: <FaBuilding /> },
  { key: "other", label: "أخرى", icon: <FaUserAlt /> },
];

// الموظف الحالي (placeholder لحد ما نوصل الـ Auth)
const currentEmployee = {
  userId:
    typeof window !== "undefined" && window.localStorage
      ? window.localStorage.getItem("userId") || "EMP1"
      : "EMP1",
  name:
    typeof window !== "undefined" && window.localStorage
      ? window.localStorage.getItem("userName") || "موظف"
      : "موظف",
};

// =======================
// HELPERS
// =======================

function getClientType(clientId) {
  if (!clientId) return "other";
  if (clientId.startsWith("RES-")) return "resident";
  if (clientId.startsWith("NON-")) return "nonResident";
  if (clientId.startsWith("COM-")) return "company";
  return "other";
}

function timeSince(dateIso) {
  if (!dateIso) return "-";
  const created = new Date(dateIso);
  const diffMs = Date.now() - created.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} دقيقة`;
  const hrs = Math.round(mins / 60);
  return `${hrs} ساعة`;
}

// نسق بيانات العميل + المستندات الأساسية
function formatClient(rawUser) {
  if (!rawUser) return null;

  const fullName =
    rawUser.name ||
    rawUser.nameEn ||
    [rawUser.firstName, rawUser.middleName, rawUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    rawUser.customerId ||
    rawUser.userId ||
    "بدون اسم";

  const coreDocs = [];

  // Emirates ID front
  if (rawUser.eidFront?.url || rawUser.eidFrontUrl || typeof rawUser.eidFront === "string") {
    coreDocs.push({
      label: "هوية إمارات (الوجه الأمامي)",
      type: "eidFront",
      url:
        rawUser.eidFront?.url ||
        rawUser.eidFrontUrl ||
        (typeof rawUser.eidFront === "string" ? rawUser.eidFront : ""),
    });
  }

  // Emirates ID back
  if (rawUser.eidBack?.url || rawUser.eidBackUrl || typeof rawUser.eidBack === "string") {
    coreDocs.push({
      label: "هوية إمارات (الوجه الخلفي)",
      type: "eidBack",
      url:
        rawUser.eidBack?.url ||
        rawUser.eidBackUrl ||
        (typeof rawUser.eidBack === "string" ? rawUser.eidBack : ""),
    });
  }

  // Passport
  if (
    rawUser.passport?.url ||
    rawUser.passportUrl ||
    typeof rawUser.passport === "string"
  ) {
    coreDocs.push({
      label: "جواز السفر",
      type: "passport",
      url:
        rawUser.passport?.url ||
        rawUser.passportUrl ||
        (typeof rawUser.passport === "string" ? rawUser.passport : ""),
    });
  }

  // Company docs
  const isCompany =
    rawUser.accountType === "company" ||
    !!rawUser.companyLicenseNumber ||
    !!rawUser.companyNameEn ||
    !!rawUser.companyNameAr;

  if (isCompany) {
    if (rawUser.tradeLicenseUrl) {
      coreDocs.push({
        label: "الرخصة التجارية",
        type: "tradeLicense",
        url: rawUser.tradeLicenseUrl,
      });
    }

    if (Array.isArray(rawUser.companyDocs)) {
      rawUser.companyDocs.forEach((doc, idx) => {
        if (!doc?.url) return;
        coreDocs.push({
          label: doc.label || `مستند شركة ${idx + 1}`,
          type: doc.type || "companyDoc",
          url: doc.url,
        });
      });
    }
  }

  return {
    userId: rawUser.userId || rawUser.customerId,
    profilePic: rawUser.profilePic || "",
    name: fullName,
    email: rawUser.email || "",
    phone: rawUser.phone || "",
    coreDocuments: coreDocs,
  };
}

// نسق بيانات الطلب
function formatOrder(rawReq) {
  let orderFiles = [];

  if (Array.isArray(rawReq.attachments) && rawReq.attachments.length > 0) {
    orderFiles = rawReq.attachments
      .filter((att) => att?.url)
      .map((att, i) => ({
        name: att.name || `مرفق ${i + 1}`,
        url: att.url,
      }));
  } else if (rawReq.fileUrl) {
    orderFiles.push({
      name: rawReq.fileName || "مرفق",
      url: rawReq.fileUrl,
    });
  }

  let requiredDocs = [];
  if (Array.isArray(rawReq.requiredDocuments)) {
    requiredDocs = rawReq.requiredDocuments;
  } else if (
    rawReq.service &&
    Array.isArray(rawReq.service.requiredDocuments)
  ) {
    requiredDocs = rawReq.service.requiredDocuments;
  }

  return {
    requestId: rawReq.requestId || rawReq.id,
    trackingNumber: rawReq.trackingNumber || rawReq.requestId,
    clientId: rawReq.clientId || rawReq.customerId,
    serviceId: rawReq.serviceId || rawReq.service?.serviceId || "",
    serviceName:
      rawReq.serviceName ||
      rawReq.service?.name ||
      rawReq.service?.serviceName ||
      rawReq.serviceId ||
      "",
    status: rawReq.status || "new",
    createdAt: rawReq.createdAt || rawReq.lastUpdated || "",
    assignedTo: rawReq.assignedTo || "",
    assignedToName: rawReq.assignedToName || "",
    paidAmount:
      typeof rawReq.paidAmount === "number" ? rawReq.paidAmount : null,

    statusHistory: Array.isArray(rawReq.statusHistory)
      ? rawReq.statusHistory
      : [],

    orderAttachments: orderFiles,
    requiredDocuments: requiredDocs,
  };
}

// =======================
// MAIN COMPONENT
// =======================

function OrdersSectionInner({ lang = "ar" }) {
  // ---------- STATE ----------
  const [ordersRaw, setOrdersRaw] = useState([]);
  const [orders, setOrders] = useState([]);

  const [clientsRaw, setClientsRaw] = useState({});
  const [clients, setClients] = useState({});

  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState({});

  // UI state
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null); // {..} or null
  const [showClientCard, setShowClientCard] = useState(null); // client formatted obj or null

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTo, setAssignTo] = useState("");

  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifContent, setNotifContent] = useState("");

  const [pendingStatus, setPendingStatus] = useState(null);
  // pendingStatus = { order, newStatus, note }

  const [showChat, setShowChat] = useState(false);
  const [chatPreview, setChatPreview] = useState({});

  const [playNotifSound, setPlayNotifSound] = useState(false);
  const notifAudioRef = useRef(null);

  // ---------- FIRESTORE LISTENERS ----------

  // requests
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "requests"), (snap) => {
      const list = [];
      snap.forEach((docSnap) => {
        list.push({ ...docSnap.data(), requestId: docSnap.id });
      });
      setOrdersRaw(list);
    });
    return () => unsub();
  }, []);

  // users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const rawMap = {};
      const empArray = [];

      snap.forEach((docSnap) => {
        const u = { ...docSnap.data(), userId: docSnap.id };
        rawMap[u.userId] = u;
        if (u.role === "employee" || u.role === "admin") {
          empArray.push(u);
        }
      });

      setClientsRaw(rawMap);
      setEmployees(empArray);
    });

    return () => unsub();
  }, []);

  // services
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "servicesByClientType"),
      async (snap) => {
        const flat = {};
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          Object.entries(data).forEach(([serviceId, svc]) => {
            flat[serviceId] = {
              ...svc,
              type: docSnap.id,
              id: serviceId,
            };
          });
        }
        setServices(flat);
      }
    );
    return () => unsub();
  }, []);

  // build normalized data
  useEffect(() => {
    const formattedOrders = ordersRaw.map(formatOrder);

    const formattedClientsMap = {};
    Object.keys(clientsRaw).forEach((id) => {
      formattedClientsMap[id] = formatClient(clientsRaw[id]);
    });

    setOrders(formattedOrders);
    setClients(formattedClientsMap);
  }, [ordersRaw, clientsRaw]);

  // notification sound hook example
  useEffect(() => {
    // لو حابب تشغل صوت لما ييجي طلب جديد
    // setPlayNotifSound(true);
  }, [orders.length]);

  useEffect(() => {
    if (playNotifSound && notifAudioRef.current) {
      notifAudioRef.current.play();
      setPlayNotifSound(false);
    }
  }, [playNotifSound]);

  // ---------- DERIVED DATA ----------

  // count per status
  const statusCounts = {};
  orders.forEach((o) => {
    const s = o.status || "new";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const newOrders = orders
    .filter((o) => (o.status || "new") === "new")
    .sort((a, b) => ((a.createdAt || "") > (b.createdAt || "") ? 1 : -1));

  // filter table
  let filteredOrders = orders.filter((o) => {
    const thisClientType = getClientType(o.clientId);

    if (activeTab !== "all" && thisClientType !== activeTab) return false;
    if (statusFilter !== "all" && (o.status || "new") !== statusFilter)
      return false;

    const client = clients[o.clientId] || {};
    const svcFromDB = services[o.serviceId] || {};
    const serviceDisplay =
      o.serviceName ||
      svcFromDB.name ||
      svcFromDB.name_en ||
      o.serviceId;

    const searchable = [
      o.trackingNumber,
      o.requestId,
      o.clientId,
      client.name,
      client.userId,
      client.email,
      client.phone,
      serviceDisplay,
      o.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(searchValue.toLowerCase());
  });

  filteredOrders = filteredOrders.sort((a, b) =>
    (a.createdAt || "") > (b.createdAt || "") ? 1 : -1
  );

  // ---------- ACTIONS ----------

  async function sendAutoNotification(order, newStatus) {
    const client = clients[order.clientId];
    if (!client) return;

    const msg = `تم تحديث حالة طلبك (${order.trackingNumber || order.requestId}) إلى: ${
      STATUS_LABEL[newStatus] || newStatus
    }`;

    const notifData = {
      title: "تحديث حالة طلبك",
      body: msg,
      type: "status",
      notificationId: `notif-${Date.now()}`,
      relatedRequest: order.requestId,
      targetId: client.userId,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    await addDoc(collection(db, "notifications"), notifData);
  }

  async function confirmChangeStatus() {
    if (!pendingStatus) return;
    const { order, newStatus, note } = pendingStatus;

    const statusHistory = Array.isArray(order.statusHistory)
      ? order.statusHistory
      : [];

    const updatedHistory = [
      ...statusHistory,
      {
        status: newStatus,
        timestamp: new Date().toISOString(),
        updatedBy: currentEmployee.name,
        ...(note ? { note } : {}),
      },
    ];

    await updateDoc(doc(db, "requests", order.requestId), {
      status: newStatus,
      statusHistory: updatedHistory,
    });

    setSelectedOrder((prev) =>
      prev && prev.requestId === order.requestId
        ? { ...prev, status: newStatus, statusHistory: updatedHistory }
        : prev
    );

    await sendAutoNotification(order, newStatus);

    setPendingStatus(null);
  }

  async function handleAssign(order, empId) {
    const employee = employees.find((e) => e.userId === empId);
    if (!employee) return;

    await updateDoc(doc(db, "requests", order.requestId), {
      assignedTo: employee.userId,
      assignedToName: employee.name || "",
      lastUpdated: new Date().toISOString(),
    });

    setShowAssignModal(false);
    setSelectedOrder((prev) =>
      prev && prev.requestId === order.requestId
        ? { ...prev, assignedTo: empId, assignedToName: employee.name }
        : prev
    );
  }

  async function sendCustomNotification(order, content) {
    if (!content || !order) return;
    const client = clients[order.clientId];
    if (!client) return;

    const notifData = {
      title: "رسالة من فريق تاهيل",
      body: content,
      type: "custom",
      notificationId: `notif-${Date.now()}`,
      relatedRequest: order.requestId,
      targetId: client.userId,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    await addDoc(collection(db, "notifications"), notifData);

    setShowNotifModal(false);
    setNotifContent("");
  }

  // ---------- SUB COMPONENTS ----------

  function ClientCard({ client, onClose }) {
    if (!client) return null;

    return (
      <div className="p-5 rounded-2xl bg-white shadow-xl border border-gray-200 w-full max-w-lg relative">
        {onClose && (
          <button
            className="absolute top-2 left-2 text-2xl text-gray-400 hover:text-gray-900 font-bold"
            style={{ cursor: "pointer" }}
            onClick={onClose}
          >
            <MdClose />
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          <img
            src={client.profilePic || "/default-avatar.png"}
            alt={client.name}
            className="w-24 h-24 rounded-full border-4 border-gray-100 shadow mb-2 object-cover"
          />
          <div className="text-xl font-extrabold text-gray-900">
            {client.name}
          </div>
          <div className="text-gray-500 font-mono font-semibold text-xs">
            {client.userId}
          </div>

          <div className="mt-3 mb-1 flex flex-wrap justify-center gap-2 text-[0.8rem] font-semibold">
            {client.email && (
              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded border border-gray-200">
                {client.email}
              </span>
            )}
            {client.phone && (
              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded border border-gray-200">
                {client.phone}
              </span>
            )}
          </div>
        </div>

        {/* المستندات الأساسية */}
        <div className="mt-4 w-full text-left">
          <div className="font-bold text-gray-800 mb-2 text-sm">
            مستندات الحساب الأساسية:
          </div>

          {client.coreDocuments && client.coreDocuments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {client.coreDocuments.map((docItem, i) => (
                <a
                  key={i}
                  href={docItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between bg-white px-3 py-2 rounded-lg text-indigo-700 font-bold text-xs hover:bg-indigo-50 border border-indigo-200 shadow-sm"
                  style={{ cursor: "pointer" }}
                >
                  <span className="text-gray-800 font-semibold leading-snug">
                    {docItem.label}
                  </span>
                  <span className="underline text-indigo-600 font-mono break-all text-[0.7rem]">
                    فتح
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-xs font-semibold">
              لا يوجد مستندات أساسية
            </div>
          )}
        </div>
      </div>
    );
  }

  function OrderDetailsModal({ order }) {
    if (!order) return null;

    // العميل الخام من الـ firestore عشان تبقى up-to-date
    const rawClient = clientsRaw[order.clientId] || {};
    const formattedClient = formatClient(rawClient);

    const assignedEmp = employees.find(
      (e) => e.userId === order.assignedTo
    );

    // الخدمة
    const svcFromDB = services[order.serviceId] || {};
    const serviceDisplay =
      order.serviceName ||
      svcFromDB.name ||
      svcFromDB.name_en ||
      order.serviceId;

    // وقت الطلب
    const createdAtLocal = order.createdAt
      ? new Date(order.createdAt).toLocaleString("ar-EG")
      : "-";
    const sinceTextValue = timeSince(order.createdAt);

    // آخر note لنفس الحالة الحالية
    let currentNote = null;
    if (Array.isArray(order.statusHistory)) {
      const lastWithThisStatus = [...order.statusHistory]
        .reverse()
        .find((h) => h.status === order.status && h.note);
      currentNote = lastWithThisStatus?.note || null;
    }

    // روابط تواصل
    const whatsappLink = formattedClient?.phone
      ? `https://wa.me/${formattedClient.phone.replace(/^0/, "971")}`
      : null;

    const mailtoLink = formattedClient?.email
      ? `mailto:${formattedClient.email}`
      : null;

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-[1000px] w-full flex flex-col lg:flex-row gap-4 lg:gap-6 overflow-auto max-h-[90vh] relative">
          {/* close */}
          <button
            className="absolute top-3 left-3 text-2xl text-gray-400 hover:text-gray-900 font-bold"
            style={{ cursor: "pointer" }}
            onClick={() => setSelectedOrder(null)}
          >
            <MdClose />
          </button>

          {/* العمود الأيمن: بيانات العميل + مستندات أساسية */}
          <aside className="flex-none bg-gray-50 p-4 lg:p-6 border-b lg:border-b-0 lg:border-r lg:min-w-[300px] lg:max-w-[320px] flex items-start justify-center rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none">
            <ClientCard
              client={formattedClient}
              onClose={() => setSelectedOrder(null)}
            />
          </aside>

          {/* العمود الأيسر: تفاصيل الطلب */}
          <section className="flex-1 flex flex-col gap-4 p-4 lg:p-6 text-[0.95rem] text-gray-900 font-semibold">
            {/* حالة الطلب + معلومات سريعة */}
            <div className="flex flex-col gap-2 mb-2 pr-8">
              <div
                className={
                  "inline-flex items-center gap-1 px-2 py-1 rounded border font-bold text-xs w-fit " +
                  (STATUS_BADGE_STYLE[order.status] ||
                    "bg-gray-100 text-gray-900 border-gray-400")
                }
              >
                {STATUS_ICONS[order.status] || "❓"}{" "}
                {STATUS_LABEL[order.status] || order.status}
              </div>

              <div className="font-extrabold text-gray-900 text-lg leading-snug">
                {serviceDisplay}
              </div>

              <div className="text-sm">
                <span className="font-bold text-gray-700">
                  رقم الطلب:
                </span>{" "}
                <span className="font-mono text-indigo-700 font-bold">
                  {order.trackingNumber || order.requestId}
                </span>
              </div>

              <div className="text-xs text-gray-700">
                <span className="font-bold text-gray-700">
                  وقت الطلب:
                </span>{" "}
                {createdAtLocal}{" "}
                <span className="text-gray-500 font-normal">
                  ({sinceTextValue} مضت)
                </span>
              </div>

              <div className="text-sm">
                <span className="font-bold text-gray-700">
                  الموظف الحالي:
                </span>{" "}
                <span className="inline-flex items-center gap-1 text-indigo-700 font-bold">
                  <FaUserTie className="text-indigo-600" />
                  {assignedEmp
                    ? assignedEmp.name
                    : order.assignedTo || "غير معين"}
                </span>
              </div>

              <div className="text-sm">
                <span className="font-bold text-gray-700">
                  المبلغ:
                </span>{" "}
                <span className="text-green-700 font-bold">
                  {order.paidAmount
                    ? `${order.paidAmount} د.إ`
                    : "-"}
                </span>
              </div>
            </div>

            {/* آخر ملاحظة للحالة */}
            {currentNote && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded text-yellow-700 font-semibold text-sm">
                <div className="font-bold text-yellow-800 mb-1">
                  ملاحظة الموظف الحالية:
                </div>
                <div>{currentNote}</div>
              </div>
            )}

            {/* مرفقات الطلب */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="font-bold text-gray-800 mb-3 text-sm flex items-center justify-between">
                <span>مرفقات هذا الطلب</span>
                <span className="text-[0.7rem] text-gray-500 font-normal">
                  (مرفوع من العميل لهذا الطلب بالذات)
                </span>
              </div>

              {order.orderAttachments &&
              order.orderAttachments.length > 0 ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {order.orderAttachments.map((att, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                    >
                      <div className="text-gray-800 font-semibold leading-snug break-all">
                        {att.name || `مرفق ${i + 1}`}
                      </div>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-indigo-600 font-bold"
                        style={{ cursor: "pointer" }}
                        download={att.name}
                      >
                        تنزيل
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-400 text-xs font-semibold">
                  لا يوجد مرفقات مضافة على هذا الطلب حتى الآن
                </div>
              )}
            </div>

            {/* المستندات المطلوبة من العميل */}
            {order.requiredDocuments &&
              order.requiredDocuments.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <div className="font-bold text-gray-800 mb-3 text-sm flex items-center justify-between">
                    <span>المستندات المطلوبة من العميل</span>
                    <span className="text-[0.7rem] text-gray-500 font-normal">
                      (لازم يرفعهم عشان نكمل)
                    </span>
                  </div>

                  <ul className="list-disc ml-5 text-xs text-gray-800 font-semibold leading-relaxed">
                    {order.requiredDocuments.map((reqItem, i) => (
                      <li key={i} className="mb-1">
                        {typeof reqItem === "string"
                          ? reqItem
                          : reqItem?.label ||
                            reqItem?.name ||
                            "مستند مطلوب"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* تواصل مع العميل */}
            <div className="flex flex-wrap gap-2 items-center mt-2 text-sm">
              <span className="font-bold text-gray-800">
                تواصل مع العميل:
              </span>

              <button
                className="flex items-center gap-1 bg-gray-900 hover:bg-black text-white font-bold px-3 py-1.5 rounded-lg shadow text-xs"
                style={{ cursor: "pointer" }}
                onClick={() => setShowChat(!showChat)}
                disabled={!formattedClient?.userId}
              >
                <MdOutlineChat /> شات داخلي
              </button>

              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg shadow text-xs"
                  style={{ cursor: "pointer" }}
                >
                  <MdWhatsapp /> واتساب
                </a>
              )}

              {mailtoLink && (
                <a
                  href={mailtoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded-lg shadow text-xs"
                  style={{ cursor: "pointer" }}
                >
                  <MdEmail /> إرسال إيميل
                </a>
              )}

              <button
                className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-3 py-1.5 rounded-lg shadow text-xs"
                style={{ cursor: "pointer" }}
                onClick={() => setShowNotifModal(true)}
              >
                <MdNotificationsActive /> إشعار مخصص
              </button>
            </div>

            {/* الشات الداخلي */}
            {showChat && formattedClient?.userId && (
              <div className="mt-4 border rounded-xl bg-gray-50 p-2 shadow-inner">
                <ChatWidgetFull
                  userId={currentEmployee.userId}
                  userName={currentEmployee.name}
                  roomId={formattedClient.userId}
                />
              </div>
            )}

            {/* تغيير حالة الطلب */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target;
                const newStatus = form.status.value;
                const note = form.note.value;
                setPendingStatus({
                  order,
                  newStatus,
                  note,
                });
              }}
              className="flex flex-col gap-2 mt-6 border-t border-gray-200 pt-4"
            >
              <label className="font-bold text-gray-800 text-sm">
                تغيير الحالة:
              </label>

              <select
                name="status"
                defaultValue={order.status}
                className="border rounded-lg px-2 py-2 cursor-pointer focus:ring-2 focus:ring-gray-900 text-sm font-bold text-gray-800"
                style={{ cursor: "pointer" }}
              >
                {Object.keys(STATUS_LABEL).map((key) => (
                  <option value={key} key={key}>
                    {STATUS_ICONS[key]} {STATUS_LABEL[key]}
                  </option>
                ))}
              </select>

              <input
                type="text"
                name="note"
                className="border rounded-lg px-2 py-2 text-sm text-gray-800"
                placeholder="ملاحظة الموظف (اختياري)"
              />

              <button
                type="submit"
                className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg font-bold shadow text-sm transition-all"
                style={{ cursor: "pointer" }}
              >
                <MdNotificationsActive />
                حفظ الحالة وإشعار العميل
              </button>
            </form>

            {/* تحويل لموظف آخر */}
            <div className="mt-4">
              <button
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow text-sm transition-all"
                style={{ cursor: "pointer" }}
                onClick={() => setShowAssignModal(true)}
              >
                <FaUserTie /> تحويل الطلب لموظف آخر
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ---------- RENDER ----------
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          إدارة الطلبات
        </h1>

        {/* تنبيه طلبات جديدة */}
        {newOrders.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-blue-800 font-bold">
              <MdNotificationsActive className="text-xl" />
              <span>
                لديك {newOrders.length} طلب جديد يحتاج للمراجعة
              </span>
            </div>
          </div>
        )}

        {/* Tabs حسب نوع العميل */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                activeTab === tab.key
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
              style={{ cursor: "pointer" }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* الفلاتر العامة */}
        <div className="flex gap-4 items-center flex-wrap">
          <select
            className="border rounded-lg px-3 py-2 bg-white text-sm"
            style={{ cursor: "pointer" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">جميع الحالات</option>
            {Object.keys(STATUS_LABEL).map((status) => (
              <option key={status} value={status}>
                {STATUS_ICONS[status]} {STATUS_LABEL[status]} (
                {statusCounts[status] || 0})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="بحث برقم الطلب / العميل / الخدمة..."
            className="border rounded-lg px-3 py-2 text-sm"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />

          {/* زر الصوت التجريبي */}
          <button
            className="flex items-center gap-2 bg-white border border-yellow-300 hover:bg-yellow-50 text-yellow-700 px-3 py-2 rounded-lg font-bold text-sm shadow-sm"
            style={{ cursor: "pointer" }}
            onClick={() => {
              if (notifAudioRef.current) notifAudioRef.current.play();
            }}
            title="تشغيل صوت الإشعار"
          >
            <MdVolumeUp /> صوت إشعار
          </button>
        </div>
      </div>

      {/* جدول الطلبات */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">
                  الطلب
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">
                  العميل
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">
                  الحالة
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">
                  الوقت
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">
                  الموظف
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">
                  إجراءات
                </th>
              </tr>
            </thead>

            <tbody className="text-gray-800">
              {filteredOrders.map((order) => {
                const client = clients[order.clientId] || {};
                const svcFromDB = services[order.serviceId] || {};
                const serviceDisplay =
                  order.serviceName || svcFromDB.name || order.serviceId;
                const assignedEmp = employees.find(
                  (e) => e.userId === order.assignedTo
                );

                return (
                  <tr
                    key={order.requestId}
                    className="border-t hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm font-bold text-gray-900">
                        {serviceDisplay}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {order.trackingNumber || order.requestId}
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <img
                          src={client.profilePic || "/default-avatar.png"}
                          alt={client.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <div className="text-sm font-bold text-gray-900">
                            {client.name || "بدون اسم"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {client.userId}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold border ${
                          STATUS_BADGE_STYLE[order.status] ||
                          "bg-gray-100 text-gray-900 border-gray-400"
                        }`}
                      >
                        {STATUS_ICONS[order.status]}{" "}
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 align-top text-xs text-gray-600">
                      {timeSince(order.createdAt)} مضت
                    </td>

                    <td className="px-4 py-3 align-top text-xs text-gray-800 font-bold">
                      {assignedEmp
                        ? assignedEmp.name
                        : order.assignedTo || "-"}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm font-bold"
                          style={{ cursor: "pointer" }}
                          onClick={() => setSelectedOrder(order)}
                        >
                          عرض
                        </button>

                        {client && (
                          <button
                            className="text-gray-600 hover:text-gray-800 text-sm font-bold"
                            style={{ cursor: "pointer" }}
                            onClick={() => setShowClientCard(client)}
                          >
                            العميل
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-gray-400 text-sm font-bold"
                  >
                    لا يوجد طلبات بهذه البيانات.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --------- MODALS / OVERLAYS (خارج الجدول) --------- */}

      {/* تفاصيل الطلب */}
      {selectedOrder && <OrderDetailsModal order={selectedOrder} />}

      {/* كارت عميل مستقل من الجدول */}
      {showClientCard && !selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <ClientCard
            client={showClientCard}
            onClose={() => setShowClientCard(null)}
          />
        </div>
      )}

      {/* مودال تحويل الطلب لموظف آخر */}
      {showAssignModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full relative border border-gray-200">
            <button
              className="absolute top-2 left-2 text-2xl font-bold text-gray-700 hover:text-gray-900 transition"
              style={{ cursor: "pointer" }}
              onClick={() => setShowAssignModal(false)}
            >
              ×
            </button>

            <div className="font-bold mb-3 text-gray-900 flex items-center gap-2 text-lg">
              <FaUserTie className="text-indigo-600" />
              اختر الموظف
            </div>

            <select
              className="border-2 border-gray-300 rounded-lg w-full px-3 py-2 mb-3 cursor-pointer text-gray-900 font-bold bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
              style={{ cursor: "pointer" }}
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
            >
              <option value="">اختر الموظف</option>
              {employees.map((emp) => (
                <option value={emp.userId} key={emp.userId}>
                  {emp.name}
                </option>
              ))}
            </select>

            <button
              className="bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 rounded-lg font-bold w-full cursor-pointer mb-2 transition"
              style={{ cursor: "pointer" }}
              disabled={!assignTo}
              onClick={() => {
                handleAssign(selectedOrder, assignTo);
              }}
            >
              تحويل الطلب
            </button>

            <button
              className="absolute top-2 right-2 text-2xl font-bold text-gray-400 hover:text-red-500 cursor-pointer transition"
              style={{ cursor: "pointer" }}
              onClick={() => setShowAssignModal(false)}
            >
              <MdClose />
            </button>
          </div>
        </div>
      )}

      {/* مودال إرسال إشعار مخصص */}
      {showNotifModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full relative border border-yellow-200">
            <button
              className="absolute top-2 left-2 text-2xl cursor-pointer text-gray-600 hover:text-gray-900"
              style={{ cursor: "pointer" }}
              onClick={() => setShowNotifModal(false)}
            >
              ×
            </button>

            <div className="font-bold mb-3 text-yellow-700 flex items-center gap-2 text-lg">
              <MdNotificationsActive />
              إرسال إشعار للعميل
            </div>

            <textarea
              className="border rounded-lg w-full px-3 py-2 mb-3 text-sm text-gray-800 focus:ring-2 focus:ring-yellow-400"
              rows={3}
              placeholder="محتوى الإشعار..."
              value={notifContent}
              onChange={(e) => setNotifContent(e.target.value)}
            />

            <button
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold w-full cursor-pointer transition text-sm"
              style={{ cursor: "pointer" }}
              disabled={!notifContent}
              onClick={() =>
                sendCustomNotification(selectedOrder, notifContent)
              }
            >
              إرسال الإشعار
            </button>

            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-2xl font-bold cursor-pointer transition"
              style={{ cursor: "pointer" }}
              onClick={() => setShowNotifModal(false)}
            >
              <MdClose />
            </button>
          </div>
        </div>
      )}

      {/* مودال تأكيد تغيير الحالة */}
      {pendingStatus && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full relative flex flex-col items-center border border-gray-200">
            <button
              className="absolute top-2 left-2 text-2xl cursor-pointer text-gray-700 hover:text-gray-900"
              style={{ cursor: "pointer" }}
              onClick={() => setPendingStatus(null)}
            >
              ×
            </button>

            <div className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2 text-center">
              <span
                className={[
                  "inline-flex items-center gap-1 px-2 py-1 rounded border font-bold text-xs",
                  STATUS_BADGE_STYLE[pendingStatus.newStatus] ||
                    "bg-gray-100 text-gray-900 border-gray-400",
                ].join(" ")}
              >
                <span>
                  {STATUS_ICONS[pendingStatus.newStatus] || "❓"}
                </span>
                <span>
                  {STATUS_LABEL[pendingStatus.newStatus] ||
                    pendingStatus.newStatus}
                </span>
              </span>
              <span>تغيير حالة الطلب</span>
            </div>

            <div className="mb-4 text-center text-sm text-gray-700 font-semibold">
              هل أنت متأكد أنك تريد تعيين هذه الحالة للطلب؟
              سيتم إرسال إشعار تلقائي للعميل.
            </div>

            <div className="flex gap-3 w-full">
              <button
                className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg font-bold w-full cursor-pointer transition"
                style={{ cursor: "pointer" }}
                onClick={confirmChangeStatus}
              >
                تأكيد
              </button>
              <button
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-bold w-full cursor-pointer transition"
                style={{ cursor: "pointer" }}
                onClick={() => setPendingStatus(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* الصوت */}
      <audio
        ref={notifAudioRef}
        src="/sounds/new-order.mp3"
        preload="auto"
        className="hidden"
      />
    </div>
  );
}

// Suspense wrapper
export default function OrdersSection(props) {
  return (
    <Suspense fallback={null}>
      <OrdersSectionInner {...props} />
    </Suspense>
  );
}
