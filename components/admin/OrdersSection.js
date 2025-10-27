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

// التابات حسب نوع العميل
const TYPE_TABS = [
  { key: "all", label: "الكل", icon: <MdPerson /> },
  { key: "resident", label: "المقيمين", icon: <FaUserCheck /> },
  { key: "nonResident", label: "غير المقيمين", icon: <FaUserSlash /> },
  { key: "company", label: "الشركات", icon: <FaBuilding /> },
  { key: "other", label: "أخرى", icon: <FaUserAlt /> },
];

// الموظف الحالي (placeholder)
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

// client type from ID (RES-, NON-, COM-)
function getClientType(clientId) {
  if (!clientId) return "other";
  if (clientId.startsWith("RES-")) return "resident";
  if (clientId.startsWith("NON-")) return "nonResident";
  if (clientId.startsWith("COM-")) return "company";
  return "other";
}

// "منذ 5 دقايق / 2 ساعة"
function timeSince(dateIso) {
  if (!dateIso) return "-";
  const created = new Date(dateIso);
  const diffMs = Date.now() - created.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} دقيقة`;
  const hrs = Math.round(mins / 60);
  return `${hrs} ساعة`;
}

// توحيد شكل بيانات العميل
function formatClient(rawUser) {
  if (!rawUser) return null;

  // اسم واضح
  const fullName =
    rawUser.name ||
    rawUser.nameEn ||
    [
      rawUser.firstName,
      rawUser.middleName,
      rawUser.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    rawUser.customerId ||
    rawUser.userId ||
    "بدون اسم";

  // بناء مرفقات أساسية من هيكل documents عندك
  const coreDocs = [];

  if (rawUser.eidFront?.url) {
    coreDocs.push({
      label: "هوية إمارات (الوجه الأمامي)",
      type: "eidFront",
      url: rawUser.eidFront.url,
    });
  }
  if (rawUser.eidBack?.url) {
    coreDocs.push({
      label: "هوية إمارات (الوجه الخلفي)",
      type: "eidBack",
      url: rawUser.eidBack.url,
    });
  }
  if (rawUser.passport?.url) {
    coreDocs.push({
      label: "جواز السفر",
      type: "passport",
      url: rawUser.passport.url,
    });
  }

  // لو عنده بيانات شركة (يعني accountType === "company" أو فيه license)
  if (
    rawUser.accountType === "company" ||
    rawUser.companyLicenseNumber ||
    rawUser.companyNameEn ||
    rawUser.companyNameAr
  ) {
    if (rawUser.tradeLicenseUrl) {
      coreDocs.push({
        label: "الرخصة التجارية",
        type: "tradeLicense",
        url: rawUser.tradeLicenseUrl,
      });
    }
    // لو عندك مستندات تانية للشركة (مثلاً عقد التأسيس، بطاقة المنشأة...):
    if (rawUser.companyDocs && Array.isArray(rawUser.companyDocs)) {
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
    coreDocuments: coreDocs, // 👈 مهم
  };
}


// توحيد شكل بيانات الطلب
function formatOrder(rawReq) {
  // جهز مرفقات الطلب نفسه
  // انت مرات بتخزن attachments كـ array، ومرات بتحط fields زي fileUrl/fileName
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

  // جهز لستة المطلوب منه (لو الخدمة طالبة مستندات محددة)
  // ممكن يكون عندك rawReq.requiredDocuments أو rawReq.service.requiredDocuments
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

    // مرفقات الطلب الحالية (عشان الموظف يشيّك اللي العميل رفعه فعلاً)
    orderAttachments: orderFiles, // 👈 مهم

    // المستندات المطلوبة من العميل (حتى لو لسا ما رفعهاش)
    requiredDocuments: requiredDocs, // 👈 مهم
  };
}


// =======================
// MAIN COMPONENT
// =======================

function OrdersSectionInner({ lang = "ar" }) {
  // ---------- STATE ----------
  const [ordersRaw, setOrdersRaw] = useState([]); // before normalize
  const [orders, setOrders] = useState([]); // after normalize

  const [clientsRaw, setClientsRaw] = useState({}); // before normalize
  const [clients, setClients] = useState({}); // after normalize

  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState({});

  // UI state
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showClientCard, setShowClientCard] = useState(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTo, setAssignTo] = useState("");

  const [showNewSidebar, setShowNewSidebar] = useState(false);

  // pendingStatus { order, newStatus, note }
  const [pendingStatus, setPendingStatus] = useState(null);

  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifContent, setNotifContent] = useState("");

  const [showChat, setShowChat] = useState(false);
  const [chatPreview, setChatPreview] = useState({});

  // sound
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

  // users (عملاء وموظفين)
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

  // rebuild normalized data whenever raw changes
  useEffect(() => {
    // normalize orders
    const formattedOrders = ordersRaw.map(formatOrder);

    // normalize clients
    const formattedClientsMap = {};
    Object.keys(clientsRaw).forEach((id) => {
      formattedClientsMap[id] = formatClient(clientsRaw[id]);
    });

    setOrders(formattedOrders);
    setClients(formattedClientsMap);
  }, [ordersRaw, clientsRaw]);

  // chat preview / صوت جديد جاهز للمستقبل
  useEffect(() => {
    // مثال: لو عايز صوت لما عدد الطلبات يزيد
    // setPlayNotifSound(true);
  }, [orders.length]);

  useEffect(() => {
    if (playNotifSound && notifAudioRef.current) {
      notifAudioRef.current.play();
      setPlayNotifSound(false);
    }
  }, [playNotifSound]);

  // ---------- DERIVED DATA ----------

  // عداد الحالات
  const statusCounts = {};
  orders.forEach((o) => {
    const s = o.status || "new";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // الطلبات الجديدة (status=new)
  const newOrders = orders
    .filter((o) => (o.status || "new") === "new")
    .sort((a, b) => ((a.createdAt || "") > (b.createdAt || "") ? 1 : -1));

  // فلترة الجدول
  let filteredOrders = orders.filter((o) => {
    const thisClientType = getClientType(o.clientId);

    if (activeTab !== "all" && thisClientType !== activeTab) return false;
    if (statusFilter !== "all" && (o.status || "new") !== statusFilter)
      return false;

    const client = clients[o.clientId] || {};
    const svcFromDB = services[o.serviceId] || {};
    const serviceDisplay =
      o.serviceName || svcFromDB.name || svcFromDB.name_en || o.serviceId;

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

  // ---------- ACTIONS (firestore writes) ----------

  // اشعار تلقائي بعد تغيير الحالة
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

  // حفظ الحالة + history + إشعار
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

    // sync محلي في الـ modal
    setSelectedOrder((prev) =>
      prev && prev.requestId === order.requestId
        ? { ...prev, status: newStatus, statusHistory: updatedHistory }
        : prev
    );

    await sendAutoNotification(order, newStatus);

    setPendingStatus(null);
  }

  // تصدير الطلب لموظف تاني
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

  // اشعار يدوي مخصص
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

  // ---------- SMALL SUB COMPONENTS ----------

function ClientCard({ client }) {
  if (!client) return null;

  return (
    <div className="p-5 rounded-2xl bg-white shadow-xl border border-gray-200 w-full max-w-lg relative">
      {/* close */}
      <button
        className="absolute top-2 left-2 text-2xl text-gray-400 hover:text-gray-900 font-bold cursor-pointer"
        style={{ cursor: "pointer" }}
        onClick={() => setShowClientCard(null)}
      >
        <MdClose />
      </button>

      {/* info */}
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

      {/* core docs */}
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

  // بيانات العميل
  const rawClient = clientsRaw[order.clientId] || {};
  const client = formatClient(rawClient); // فيه coreDocuments
  const assignedEmp = employees.find(
    (e) => e.userId === order.assignedTo
  );

  // اسم الخدمة
  const svcFromDB = services[order.serviceId] || {};
  const serviceDisplay =
    order.serviceName ||
    svcFromDB.name ||
    svcFromDB.name_en ||
    order.serviceId;

  // توقيت
  const createdAtLocal = order.createdAt
    ? new Date(order.createdAt).toLocaleString("ar-EG")
    : "-";
  const sinceTextValue = timeSince(order.createdAt);

  // آخر note لنفس الحالة
  let currentNote = null;
  if (Array.isArray(order.statusHistory)) {
    const lastWithThisStatus = [...order.statusHistory]
      .reverse()
      .find((h) => h.status === order.status && h.note);
    currentNote = lastWithThisStatus?.note || null;
  }

  // روابط تواصل
  const whatsappLink = client?.phone
    ? `https://wa.me/${client.phone.replace(/^0/, "971")}`
    : null;
  const mailtoLink = client?.email
    ? `mailto:${client.email}`
    : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-[1000px] w-full flex flex-col lg:flex-row gap-4 lg:gap-6 overflow-auto max-h-[90vh] relative">
        {/* close button */}
        <button
          className="absolute top-3 left-3 text-2xl text-gray-400 hover:text-gray-900 font-bold cursor-pointer"
          style={{ cursor: "pointer" }}
          onClick={() => setSelectedOrder(null)}
        >
          <MdClose />
        </button>

        {/* LEFT SIDE (Client card + core docs) */}
        <aside className="flex-none bg-gray-50 p-4 lg:p-6 border-b lg:border-b-0 lg:border-r lg:min-w-[300px] lg:max-w-[320px] flex items-start justify-center rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none">
          <ClientCard client={client} />
        </aside>

        {/* RIGHT SIDE */}
        <section className="flex-1 flex flex-col gap-4 p-4 lg:p-6 text-[0.95rem] text-gray-900 font-semibold">
          {/* STATUS */}
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

          {/* CURRENT STATUS NOTE */}
          {currentNote && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded text-yellow-700 font-semibold text-sm">
              <div className="font-bold text-yellow-800 mb-1">
                ملاحظة الموظف الحالية:
              </div>
              <div>{currentNote}</div>
            </div>
          )}

          {/* SECTION: مستندات الحساب الأساسية */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="font-bold text-gray-800 mb-3 text-sm flex items-center justify-between">
              <span>مستندات الحساب الأساسية</span>
              <span className="text-[0.7rem] text-gray-500 font-normal">
                (هوية / باسبور / أوراق شركة)
              </span>
            </div>

            {client?.coreDocuments && client.coreDocuments.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm">
                {client.coreDocuments.map((docItem, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                  >
                    <div className="text-gray-800 font-semibold leading-snug">
                      {docItem.label}
                    </div>
                    <a
                      href={docItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-indigo-600 font-bold"
                      style={{ cursor: "pointer" }}
                    >
                      عرض
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-400 text-xs font-semibold">
                لا يوجد مستندات أساسية مسجلة
              </div>
            )}
          </div>

          {/* SECTION: مرفقات الطلب الحالية */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="font-bold text-gray-800 mb-3 text-sm flex items-center justify-between">
              <span>مرفقات هذا الطلب</span>
              <span className="text-[0.7rem] text-gray-500 font-normal">
                (مرفوع من العميل لهذا الطلب بالذات)
              </span>
            </div>

            {order.orderAttachments && order.orderAttachments.length > 0 ? (
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

          {/* SECTION: المستندات المطلوبة من العميل */}
          {order.requiredDocuments && order.requiredDocuments.length > 0 && (
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
                      : reqItem?.label || reqItem?.name || "مستند مطلوب"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CONTACT + ACTIONS */}
          <div className="flex flex-wrap gap-2 items-center mt-2 text-sm">
            <span className="font-bold text-gray-800">
              تواصل مع العميل:
            </span>

            <button
              className="flex items-center gap-1 bg-gray-900 hover:bg-black text-white font-bold px-3 py-1.5 rounded-lg shadow cursor-pointer text-xs"
              style={{ cursor: "pointer" }}
              onClick={() => setShowChat(!showChat)}
              disabled={!client?.userId}
            >
              <MdOutlineChat /> شات داخلي
            </button>

            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg shadow cursor-pointer text-xs"
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
                className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded-lg shadow cursor-pointer text-xs"
                style={{ cursor: "pointer" }}
              >
                <MdEmail /> إرسال إيميل
              </a>
            )}

            <button
              className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-3 py-1.5 rounded-lg shadow cursor-pointer text-xs"
              style={{ cursor: "pointer" }}
              onClick={() => setShowNotifModal(true)}
            >
              <MdNotificationsActive /> إشعار مخصص
            </button>
          </div>

          {/* Chat box */}
          {showChat && client?.userId && (
            <div className="mt-4 border rounded-xl bg-gray-50 p-2 shadow-inner">
              <ChatWidgetFull
                userId={currentEmployee.userId}
                userName={currentEmployee.name}
                roomId={client.userId}
              />
            </div>
          )}

          {/* Change status form */}
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
              className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg font-bold shadow text-sm cursor-pointer transition-all"
              style={{ cursor: "pointer" }}
            >
              <MdNotificationsActive />
              حفظ الحالة وإشعار العميل
            </button>
          </form>

          {/* Assign to employee */}
          <div className="mt-4">
            <button
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow text-sm cursor-pointer transition-all"
              style={{ cursor: "pointer" }}
              onClick={() => setShowAssignModal(true)}
            >
              <FaUserTie /> تحويل الطلب لموظف آخر
            </button>
          </div>
        </section>

        {/* Assign Modal */}
        {showAssignModal && (
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
                  handleAssign(order, assignTo);
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

        {/* Custom notification modal */}
        {showNotifModal && (
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
                  sendCustomNotification(order, notifContent)
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
      </div>

      {/* pending status confirm modal */}
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
                  {STATUS_ICONS[pendingStatus.newStatus] ||
                    "❓"}
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
    </div>
  );
}

  // ---------- RENDER ----------

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">إدارة الطلبات</h1>
        
        {/* New orders alert */}
        {newOrders.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-blue-800 font-bold">
              <MdNotificationsActive className="text-xl" />
              <span>لديك {newOrders.length} طلب جديد يحتاج للمراجعة</span>
            </div>
          </div>
        )}

        {/* Type tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
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

        {/* Filters */}
        <div className="flex gap-4 items-center flex-wrap">
          <select
            className="border rounded-lg px-3 py-2 bg-white cursor-pointer text-sm"
            style={{ cursor: "pointer" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">جميع الحالات</option>
            {Object.keys(STATUS_LABEL).map((status) => (
              <option key={status} value={status}>
                {STATUS_ICONS[status]} {STATUS_LABEL[status]} ({statusCounts[status] || 0})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="البحث..."
            className="border rounded-lg px-3 py-2 text-sm"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">
                  الطلب
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">
                  العميل
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">
                  الحالة
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">
                  التوقيت
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">
                  الموظف
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const client = clients[order.clientId] || {};
                const svcFromDB = services[order.serviceId] || {};
                const serviceDisplay = order.serviceName || svcFromDB.name || order.serviceId;
                const assignedEmp = employees.find((e) => e.userId === order.assignedTo);

                return (
                  <tr key={order.requestId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-gray-900">
                        {serviceDisplay}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {order.trackingNumber || order.requestId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold border ${
                          STATUS_BADGE_STYLE[order.status] || "bg-gray-100 text-gray-900 border-gray-400"
                        }`}
                      >
                        {STATUS_ICONS[order.status]} {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {timeSince(order.createdAt)} مضت
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {assignedEmp ? assignedEmp.name : order.assignedTo || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm font-bold cursor-pointer"
                          style={{ cursor: "pointer" }}
                          onClick={() => setSelectedOrder(order)}
                        >
                          عرض
                        </button>
                        {client && (
                          <button
                            className="text-gray-600 hover:text-gray-800 text-sm font-bold cursor-pointer"
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedOrder && <OrderDetailsModal order={selectedOrder} />}
      
      {showClientCard && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <ClientCard client={showClientCard} />
        </div>
      )}

      {/* Audio for notifications */}
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
