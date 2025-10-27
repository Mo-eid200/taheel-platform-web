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

  // اسم العميل: حاول نبني اسم واحد نظيف
  const fullName =
    rawUser.name ||
    rawUser.nameEn ||
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

  // المرفقات: انت حالياً مخزن eidFront/eidBack/passport كماب،
  // أنا هجمعهم في array علشان الكارت يعرضهم.
  const docs = [];
  if (rawUser.eidFront?.url) {
    docs.push({
      type: "بطاقة الهوية - الأمام",
      url: rawUser.eidFront.url,
    });
  }
  if (rawUser.eidBack?.url) {
    docs.push({
      type: "بطاقة الهوية - الخلف",
      url: rawUser.eidBack.url,
    });
  }
  if (rawUser.passport?.url) {
    docs.push({
      type: "جواز السفر",
      url: rawUser.passport.url,
    });
  }

  return {
    userId: rawUser.userId || rawUser.customerId,
    profilePic: rawUser.profilePic || "",
    name: fullName,
    email: rawUser.email || "",
    phone: rawUser.phone || "",
    documents: docs,
  };
}

// توحيد شكل بيانات الطلب
function formatOrder(rawReq) {
  return {
    requestId: rawReq.requestId || rawReq.id,
    trackingNumber: rawReq.trackingNumber || rawReq.requestId,
    clientId: rawReq.clientId || rawReq.customerId,
    serviceId: rawReq.serviceId || "",
    serviceName: rawReq.serviceName || rawReq.serviceId || "",
    status: rawReq.status || "new",
    createdAt: rawReq.createdAt || rawReq.lastUpdated || "",
    assignedTo: rawReq.assignedTo || "",
    assignedToName: rawReq.assignedToName || "",
    paidAmount:
      typeof rawReq.paidAmount === "number" ? rawReq.paidAmount : null,
    statusHistory: Array.isArray(rawReq.statusHistory)
      ? rawReq.statusHistory
      : [],
    attachments:
      Array.isArray(rawReq.attachments) && rawReq.attachments.length > 0
        ? rawReq.attachments
        : rawReq.fileUrl
        ? [
            {
              name: rawReq.fileName || "مرفق",
              url: rawReq.fileUrl,
            },
          ]
        : [],
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
        <button
          className="absolute top-2 left-2 text-2xl text-gray-400 hover:text-gray-900 font-bold cursor-pointer"
          style={{ cursor: "pointer" }}
          onClick={() => setShowClientCard(null)}
        >
          <MdClose />
        </button>

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

        <div className="mt-4 w-full text-left">
          <div className="font-bold text-gray-800 mb-2 text-sm">
            مرفقات العميل:
          </div>

          {client.documents && client.documents.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {client.documents.map((docItem, i) => (
                <a
                  key={i}
                  href={docItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white px-3 py-1 rounded text-indigo-700 font-bold text-xs hover:bg-indigo-50 border border-indigo-200 shadow-sm"
                  style={{ cursor: "pointer" }}
                >
                  {docItem.type}
                </a>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-xs font-semibold">
              لا يوجد مرفقات
            </div>
          )}
        </div>
      </div>
    );
  }

  function OrderDetailsModal({ order }) {
    if (!order) return null;

    const client = clients[order.clientId];
    const clientFull = formatClient(clientsRaw[order.clientId] || {});
    const assignedEmp = employees.find(
      (e) => e.userId === order.assignedTo
    );

    // إسم الخدمة لعرضه بشكل نظيف
    const svcFromDB = services[order.serviceId] || {};
    const serviceDisplay =
      order.serviceName ||
      svcFromDB.name ||
      svcFromDB.name_en ||
      order.serviceId;

    const createdAtLocal = order.createdAt
      ? new Date(order.createdAt).toLocaleString("ar-EG")
      : "-";
    const sinceTextValue = timeSince(order.createdAt);

    // آخر ملاحظة لنفس الحالة الحالية
    let currentNote = null;
    if (Array.isArray(order.statusHistory)) {
      const lastWithThisStatus = [...order.statusHistory]
        .reverse()
        .find(
          (h) => h.status === order.status && h.note
        );
      currentNote = lastWithThisStatus?.note || null;
    }

    // روابط التواصل
    const whatsappLink = clientFull?.phone
      ? `https://wa.me/${clientFull.phone.replace(/^0/, "971")}`
      : null;
    const mailtoLink = clientFull?.email
      ? `mailto:${clientFull.email}`
      : null;

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-[900px] w-full flex flex-col md:flex-row gap-4 md:gap-6 overflow-auto max-h-[90vh]">
          {/* LEFT SIDE: Client card */}
          <aside className="flex-none bg-gray-50 p-4 md:p-6 border-b md:border-b-0 md:border-r md:min-w-[280px] md:max-w-[320px] flex items-center justify-center rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none">
            <ClientCard client={clientFull} />
          </aside>

          {/* RIGHT SIDE: order info */}
          <section className="flex-1 flex flex-col gap-4 p-4 md:p-6 text-[0.95rem] text-gray-900 font-semibold relative">
            {/* close */}
            <button
              className="absolute top-3 left-3 text-2xl text-gray-400 hover:text-gray-900 font-bold cursor-pointer"
              style={{ cursor: "pointer" }}
              onClick={() => setSelectedOrder(null)}
            >
              <MdClose />
            </button>

            {/* STATUS + SERVICE */}
            <div className="flex items-start justify-between mb-2 pr-8">
              <div
                className={
                  "inline-flex items-center gap-1 px-2 py-1 rounded border font-bold text-xs " +
                  (STATUS_BADGE_STYLE[order.status] ||
                    "bg-gray-100 text-gray-900 border-gray-400")
                }
              >
                {STATUS_ICONS[order.status] || "❓"}{" "}
                {STATUS_LABEL[order.status] || order.status}
              </div>
            </div>

            {/* Service name */}
            <div className="font-extrabold text-gray-900 text-lg mb-1 leading-snug">
              {serviceDisplay}
            </div>

            {/* Tracking number */}
            <div className="text-sm">
              <span className="font-bold text-gray-700">
                رقم الطلب:
              </span>{" "}
              <span className="font-mono text-indigo-700 font-bold">
                {order.trackingNumber || order.requestId}
              </span>
            </div>

            {/* Attachments */}
            {order.attachments && order.attachments.length > 0 && (
              <div>
                <div className="font-bold text-gray-700 mb-1">
                  مرفقات الطلب:
                </div>
                <ul className="list-disc ml-6 text-sm font-semibold text-indigo-700">
                  {order.attachments.map((att, i) => (
                    <li key={i}>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-indigo-900"
                        style={{ cursor: "pointer" }}
                        download={att.name}
                      >
                        {att.name || `مرفق ${i + 1}`}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Assigned employee */}
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

            {/* Paid amount */}
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

            {/* Time */}
            <div className="text-xs text-gray-700">
              <span className="font-bold text-gray-700">
                وقت الطلب:
              </span>{" "}
              {createdAtLocal}{" "}
              <span className="text-gray-500 font-normal">
                ({sinceTextValue} مضت)
              </span>
            </div>

            {/* Last employee note for current status */}
            {currentNote && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded text-yellow-700 font-semibold text-sm">
                <div className="font-bold text-yellow-800 mb-1">
                  ملاحظة الموظف الحالية:
                </div>
                <div>{currentNote}</div>
              </div>
            )}

            {/* Contact actions */}
            <div className="flex flex-wrap gap-2 items-center mt-2 text-sm">
              <span className="font-bold text-gray-800">
                تواصل مع العميل:
              </span>

              <button
                className="flex items-center gap-1 bg-gray-900 hover:bg-black text-white font-bold px-3 py-1.5 rounded-lg shadow cursor-pointer text-xs"
                style={{ cursor: "pointer" }}
                onClick={() => setShowChat(!showChat)}
                disabled={!clientFull?.userId}
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
            {showChat && clientFull?.userId && (
              <div className="mt-4 border rounded-xl bg-gray-50 p-2 shadow-inner">
                <ChatWidgetFull
                  userId={currentEmployee.userId}
                  userName={currentEmployee.name}
                  roomId={clientFull.userId}
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
        </div>

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
    );
  }

  // سايدبار الطلبات الجديدة
  function NewOrdersSidebar() {
    return (
      <aside
        className={[
          "fixed top-0 right-0 h-full z-50 bg-white border-l border-gray-200 shadow-xl w-[330px] max-w-full transition-transform duration-300",
          showNewSidebar ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50/70">
          <div className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MdNotificationsActive className="text-yellow-600" />
            الطلبات الجديدة
          </div>
          <button
            className="text-2xl text-gray-400 hover:text-gray-700 cursor-pointer"
            style={{ cursor: "pointer" }}
            onClick={() => setShowNewSidebar(false)}
          >
            ×
          </button>
        </div>

        {/* List */}
        <div className="p-3 overflow-y-auto h-[calc(100%-60px)]">
          {newOrders.length === 0 && (
            <div className="text-center text-gray-400 mt-6 text-sm font-semibold">
              لا يوجد طلبات جديدة
            </div>
          )}

          {newOrders.map((ord) => {
            const client = clients[ord.clientId];
            const svcFromDB = services[ord.serviceId] || {};
            const serviceDisplay =
              ord.serviceName ||
              svcFromDB.name ||
              svcFromDB.name_en ||
              ord.serviceId;
            const sinceTextValue = timeSince(ord.createdAt);
            const msgPreview = chatPreview[ord.requestId];

            return (
              <div
                key={ord.requestId}
                className="bg-white mb-3 rounded-xl p-3 shadow border border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setSelectedOrder(ord);
                  setShowNewSidebar(false);
                }}
              >
                <div className="font-bold text-gray-900 text-sm">
                  {serviceDisplay}
                </div>

                <div className="text-[0.8rem] text-gray-700 font-bold">
                  {client?.name || ord.clientId}
                </div>

                <div className="text-[0.7rem] text-gray-500 font-mono font-bold">
                  {ord.trackingNumber || ord.requestId}
                </div>

                <div className="text-[0.7rem] mt-1 text-gray-600 font-bold">
                  <span className="font-bold">منذ: </span>
                  {sinceTextValue}
                </div>

                {msgPreview && (
                  <div className="mt-2 flex items-center gap-1 text-[0.7rem] bg-gray-100 rounded px-2 py-1 border border-gray-200 shadow-sm text-gray-800 font-semibold">
                    <MdOutlineChat className="text-gray-700" />
                    <span>{msgPreview.text}</span>
                    {msgPreview.senderName && (
                      <span className="text-gray-400 font-mono ml-1">
                        ({msgPreview.senderName})
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* sound ref */}
        <audio
          ref={notifAudioRef}
          src="/sounds/new-order.mp3"
          preload="auto"
        />
      </aside>
    );
  }

  // ---------- MAIN RENDER ----------
  return (
    <div className="relative p-4 md:p-8 bg-gradient-to-b from-[#f8f9fa] to-[#f1f5f9] text-gray-900 font-sans">
      {/* FILTER BAR */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        {/* Tabs by client type */}
        <div className="flex gap-2 flex-wrap">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              className={[
                "flex items-center gap-2 px-4 py-2 font-bold rounded-xl border text-sm transition select-none",
                activeTab === t.key
                  ? "border-gray-900 bg-white text-gray-900 shadow"
                  : "border-transparent bg-gray-100 text-gray-600 hover:bg-white hover:text-gray-900 hover:border-gray-300 shadow-sm",
              ].join(" ")}
              style={{ cursor: "pointer" }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Status filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            className={[
              "rounded-xl px-3 py-1.5 font-bold shadow text-xs flex items-center gap-1 border",
              statusFilter === "all"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-900 border-gray-300 hover:bg-gray-100",
            ].join(" ")}
            style={{ cursor: "pointer" }}
            onClick={() => setStatusFilter("all")}
          >
            <span>الكل</span>
            <span className="font-mono">{orders.length}</span>
          </button>

          {Object.keys(STATUS_LABEL).map((key) => (
            <button
              key={key}
              className={[
                "rounded-xl px-3 py-1.5 font-bold shadow text-[0.7rem] flex items-center gap-1 border",
                statusFilter === key
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-900 border-gray-300 hover:bg-gray-100",
              ].join(" ")}
              style={{ cursor: "pointer" }}
              onClick={() => setStatusFilter(key)}
            >
              <span>{STATUS_ICONS[key]}</span>
              <span>{STATUS_LABEL[key]}</span>
              <span className="font-mono">{statusCounts[key] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH + NEW ORDERS BUTTONS */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <input
          className="border border-gray-300 rounded-xl px-3 py-2 flex-1 text-sm text-gray-800 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 shadow-sm bg-white"
          placeholder="بحث برقم الطلب / العميل / الخدمة / الحالة..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl font-bold shadow text-sm cursor-pointer transition border border-yellow-600"
            style={{ cursor: "pointer" }}
            onClick={() => setShowNewSidebar(true)}
          >
            <MdNotificationsActive />
            <span>الطلبات الجديدة</span>
            <span className="font-mono">{newOrders.length}</span>
          </button>

          <button
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-xl font-bold shadow text-sm cursor-pointer transition"
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

      {/* MAIN TABLE */}
      <div className="overflow-x-auto rounded-2xl shadow bg-white border border-gray-200">
        <table className="min-w-full text-center text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-900 font-bold text-xs uppercase tracking-wide">
              <th className="py-3 px-3 whitespace-nowrap text-gray-700">
                رقم الطلب
              </th>
              <th className="py-3 px-3 whitespace-nowrap text-gray-700">
                الخدمة
              </th>
              <th className="py-3 px-3 whitespace-nowrap text-gray-700">
                العميل
              </th>
              <th className="py-3 px-3 whitespace-nowrap text-gray-700">
                الحالة
              </th>
              <th className="py-3 px-3 whitespace-nowrap text-gray-700">
                الموظف
              </th>
              <th className="py-3 px-3 whitespace-nowrap text-gray-700">
                منذ
              </th>
            </tr>
          </thead>

          <tbody className="text-gray-800 font-semibold">
            {filteredOrders.map((o) => {
              const client = clients[o.clientId];
              const assignedEmp = employees.find(
                (e) => e.userId === o.assignedTo
              );
              const svcFromDB = services[o.serviceId] || {};
              const serviceDisplay =
                o.serviceName ||
                svcFromDB.name ||
                svcFromDB.name_en ||
                o.serviceId;

              const sinceTextValue = timeSince(o.createdAt);

              return (
                <tr
                  key={o.requestId}
                  className="hover:bg-gray-50 transition border-b cursor-pointer"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedOrder(o)}
                >
                  {/* رقم الطلب */}
                  <td className="py-2 px-3 font-mono font-bold text-indigo-800 text-xs md:text-sm">
                    {o.trackingNumber || o.requestId}
                  </td>

                  {/* الخدمة */}
                  <td className="py-2 px-3 text-gray-900 font-extrabold text-xs md:text-sm">
                    {serviceDisplay || "—"}
                  </td>

                  {/* العميل */}
                  <td className="py-2 px-3">
                    <button
                      className="text-gray-800 hover:text-gray-900 underline font-bold text-xs md:text-sm"
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowClientCard(client);
                      }}
                    >
                      {client?.name || o.clientId}
                    </button>
                  </td>

                  {/* الحالة */}
                  <td className="py-2 px-3">
                    <span
                      className={[
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[0.7rem] md:text-xs font-bold border",
                        STATUS_BADGE_STYLE[o.status] ||
                          "bg-gray-100 text-gray-900 border-gray-400",
                      ].join(" ")}
                    >
                      <span>{STATUS_ICONS[o.status] || "❓"}</span>
                      <span>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </span>
                  </td>

                  {/* الموظف */}
                  <td className="py-2 px-3 text-indigo-700 font-bold text-xs md:text-sm">
                    {assignedEmp
                      ? assignedEmp.name
                      : o.assignedTo || "—"}
                  </td>

                  {/* الوقت */}
                  <td className="py-2 px-3 text-[0.7rem] md:text-xs text-gray-700">
                    {sinceTextValue}
                  </td>
                </tr>
              );
            })}

            {filteredOrders.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-gray-400 text-sm font-bold"
                >
                  لا يوجد طلبات بهذه البيانات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* تفاصيل الطلب */}
      {selectedOrder && <OrderDetailsModal order={selectedOrder} />}

      {/* كارت العميل لوحده */}
      {showClientCard && !selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <ClientCard client={showClientCard} />
        </div>
      )}

      {/* سايدبار الطلبات الجديدة */}
      <NewOrdersSidebar />

      {/* تأكيد تغيير الحالة + إرسال الإشعار */}
      {pendingStatus && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
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
              هل أنت متأكد أنك تريد تعيين هذه الحالة
              للطلب؟ سيتم إرسال إشعار تلقائي للعميل.
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

      {/* refs المهمين */}
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
