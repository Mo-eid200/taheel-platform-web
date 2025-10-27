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
  government_processing: "bg-indigo-100 text-indigo-900 border-indigo-400",
  completed: "bg-green-100 text-green-800 border-green-400",
  rejected: "bg-red-100 text-red-800 border-red-400",
  pending_requirements: "bg-orange-100 text-orange-800 border-orange-400",
  archived: "bg-gray-100 text-gray-700 border-gray-400",
};

const TYPE_TABS = [
  { key: "all", label: "الكل", icon: <MdPerson /> },
  { key: "resident", label: "المقيمين", icon: <FaUserCheck /> },
  { key: "nonResident", label: "غير المقيمين", icon: <FaUserSlash /> },
  { key: "company", label: "الشركات", icon: <FaBuilding /> },
  { key: "other", label: "أخرى", icon: <FaUserAlt /> },
];

// الموظف الحالي (مؤقت لحد ما توصلها بـ Auth فعلي)
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
// HELPERS (pure JS)
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
  const mins = Math.floor((Date.now() - created.getTime()) / 60000);
  if (mins < 60) return `${mins} دقيقة`;
  return `${Math.round(mins / 60)} ساعة`;
}

// =======================
// MAIN COMPONENT
// =======================

function OrdersSectionInner({ lang = "ar" }) {
  // ---------- DATA STATE ----------
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState({});
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState({});

  // ---------- UI STATE ----------
  const [activeTab, setActiveTab] = useState("all"); // resident / nonResident / company / other / all
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [showClientCard, setShowClientCard] = useState(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTo, setAssignTo] = useState("");

  const [showNewSidebar, setShowNewSidebar] = useState(false);

  const [pendingStatus, setPendingStatus] = useState(null);
  // shape: { order, newStatus, note }

  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifContent, setNotifContent] = useState("");

  const [showChat, setShowChat] = useState(false);
  const [chatPreview, setChatPreview] = useState({});

  const [playNotifSound, setPlayNotifSound] = useState(false);
  const notifAudioRef = useRef(null);

  // ---------- FIRESTORE LISTENERS ----------

  // الطلبات
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "requests"), (snap) => {
      const list = [];
      snap.forEach((docSnap) => {
        list.push({ ...docSnap.data(), requestId: docSnap.id });
      });
      setOrders(list);
    });
    return () => unsub();
  }, []);

  // المستخدمين (عملاء + موظفين)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const clientMap = {};
      const empArray = [];

      snap.forEach((docSnap) => {
        const u = { ...docSnap.data(), userId: docSnap.id };
        clientMap[u.userId] = u;
        if (u.role === "employee" || u.role === "admin") {
          empArray.push(u);
        }
      });

      setClients(clientMap);
      setEmployees(empArray);
    });

    return () => unsub();
  }, []);

  // الخدمات
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "servicesByClientType"),
      async (snap) => {
        const flat = {};
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          Object.entries(data).forEach(([serviceId, svc]) => {
            flat[serviceId] = { ...svc, type: docSnap.id, id: serviceId };
          });
        }
        setServices(flat);
      }
    );
    return () => unsub();
  }, []);

  // معاينة الشات / صوت جديد (جاهز للتوصيل لما تعمل messages)
  useEffect(() => {
    // لو عايز تشغل صوت لما يجيلك طلب جديد:
    // setPlayNotifSound(true);
    // ولو عايز تحفظ آخر رسالة في chatPreview[requestId] اعمل listener للمحادثات
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

  // طلبات جديدة للسايدبار
  const newOrders = orders
    .filter((o) => (o.status || "new") === "new")
    .sort((a, b) => ((a.createdAt || "") > (b.createdAt || "") ? 1 : -1));

  // فلترة الجدول الرئيسي
  let filteredOrders = orders.filter((o) => {
    const thisClientType = getClientType(o.clientId);
    if (activeTab !== "all" && thisClientType !== activeTab) return false;

    if (statusFilter !== "all" && (o.status || "new") !== statusFilter)
      return false;

    const client = clients[o.clientId] || {};
    const svc = services[o.serviceId] || {};

    const searchable = [
      o.trackingNumber,
      o.requestId,
      o.clientId,
      client.name,
      client.userId,
      client.email,
      client.phone,
      svc.name,
      svc.name_en,
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

  // إشعار تلقائي بعد تغيير الحالة
  async function sendAutoNotification(order, newStatus) {
    const client = clients[order.clientId];
    if (!client) return;

    const statusMsg = `تم تحديث حالة طلبك (${order.trackingNumber || order.requestId}) إلى: ${
      STATUS_LABEL[newStatus] || newStatus
    }`;

    const notifData = {
      title: "تحديث حالة طلبك",
      body: statusMsg,
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

    // تحديث الطلب في Firestore
    await updateDoc(doc(db, "requests", order.requestId), {
      status: newStatus,
      statusHistory: updatedHistory,
    });

    // تحديث الواجهة المحلية لو الـ modal لسه مفتوح على نفس الطلب
    setSelectedOrder((prev) =>
      prev && prev.requestId === order.requestId
        ? { ...prev, status: newStatus, statusHistory: updatedHistory }
        : prev
    );

    // إرسال إشعار للعميل
    await sendAutoNotification(order, newStatus);

    // إغلاق مودال التأكيد
    setPendingStatus(null);
  }

  // اسناد الطلب لموظف آخر
  async function handleAssign(order, empId) {
    const employee = employees.find((e) => e.userId === empId);
    if (!employee) return;

    await updateDoc(doc(db, "requests", order.requestId), {
      assignedTo: employee.userId,
      assignedToName: employee.name || "",
      lastUpdated: new Date().toISOString(),
    });

    // تحديث الـ UI
    setShowAssignModal(false);
    setSelectedOrder((prev) =>
      prev && prev.requestId === order.requestId
        ? { ...prev, assignedTo: empId, assignedToName: employee.name }
        : prev
    );
  }

  // إشعار يدوي مخصص
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

  // ---------- SMALL SUB UIs ----------

  function ClientCard({ client }) {
    if (!client) return null;
    return (
      <div className="p-5 rounded-2xl bg-white shadow-xl border border-emerald-200/60 w-full max-w-lg relative">
        <button
          className="absolute top-2 left-2 text-2xl text-gray-400 hover:text-gray-900 font-bold cursor-pointer"
          onClick={() => setShowClientCard(null)}
        >
          <MdClose />
        </button>

        <div className="flex flex-col items-center">
          <img
            src={client.profilePic || "/default-avatar.png"}
            alt={client.name}
            className="w-24 h-24 rounded-full border-4 border-emerald-100 shadow mb-2 object-cover"
          />
          <div
            className="text-xl font-extrabold text-emerald-800 drop-shadow"
            style={{
              textShadow:
                "0 1px 0 #fff, 0 1px 2px rgba(0,0,0,0.4)",
            }}
          >
            {client.name}
          </div>
          <div className="text-gray-700 font-mono font-semibold">
            {client.userId}
          </div>
          <div className="mt-2 mb-1 flex flex-wrap justify-center gap-2 text-sm font-semibold">
            {client.email && (
              <span className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200/70">
                {client.email}
              </span>
            )}
            {client.phone && (
              <span className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200/70">
                {client.phone}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 w-full">
          <div className="font-bold text-gray-800 mb-1 text-sm">
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
                  className="bg-gray-50 px-3 py-1 rounded text-emerald-800 font-bold text-xs hover:bg-emerald-50 border border-emerald-200/70 shadow-sm cursor-pointer"
                >
                  {docItem.type}
                </a>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-xs">
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
    const service = services[order.serviceId];
    const assignedEmp = employees.find(
      (e) => e.userId === order.assignedTo
    );

    const createdAtLocal = order.createdAt
      ? new Date(order.createdAt).toLocaleString("ar-EG")
      : "-";
    const sinceText = timeSince(order.createdAt);

    // آخر نوت لنفس الحالة الحالية
    let currentNote = null;
    if (Array.isArray(order.statusHistory)) {
      const lastWithThisStatus = [...order.statusHistory]
        .reverse()
        .find(
          (h) => h.status === order.status && h.note
        );
      currentNote = lastWithThisStatus?.note || null;
    }

    const whatsappLink = client?.phone
      ? `https://wa.me/${client.phone.replace(/^0/, "971")}`
      : null;
    const mailtoLink = client?.email
      ? `mailto:${client.email}`
      : null;

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div
          className="
            bg-white rounded-2xl shadow-2xl border border-emerald-200/60
            max-w-[800px] w-full flex flex-col md:flex-row gap-4 md:gap-6
            overflow-auto max-h-[90vh]
          "
        >
          {/* LEFT SIDE: Client */}
          <aside
            className="
              flex-none bg-white p-4 md:p-6 border-b md:border-b-0 md:border-r
              md:min-w-[280px] md:max-w-[320px] flex items-center justify-center
              rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none
            "
          >
            <ClientCard client={client} />
          </aside>

          {/* RIGHT SIDE: Order info */}
          <section className="flex-1 flex flex-col gap-4 p-4 md:p-6 text-[0.95rem] text-gray-900 font-semibold">
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
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

              <button
                className="text-2xl text-gray-400 hover:text-gray-900 font-bold cursor-pointer"
                onClick={() => setSelectedOrder(null)}
              >
                <MdClose />
              </button>
            </div>

            {/* Service name */}
            <div className="font-extrabold text-emerald-800 text-lg mb-2 leading-snug">
              {service?.name || service?.name_en || order.serviceId}
            </div>

            {/* Tracking number */}
            <div>
              <span className="font-bold text-gray-700">
                رقم الطلب:
              </span>{" "}
              <span className="font-mono text-indigo-700 font-bold">
                {order.trackingNumber || order.requestId}
              </span>
            </div>

            {/* Attachments */}
            {(order.fileUrl ||
              (Array.isArray(order.attachments) &&
                order.attachments.length > 0)) && (
              <div>
                <div className="font-bold text-gray-700">
                  المرفقات:
                </div>
                <ul className="list-disc ml-6 text-sm font-semibold text-indigo-700">
                  {Array.isArray(order.attachments) &&
                  order.attachments.length > 0 ? (
                    order.attachments.map((att, i) => (
                      <li key={i}>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-indigo-900"
                          download={att.name}
                        >
                          {att.name || `مرفق ${i + 1}`}
                        </a>
                      </li>
                    ))
                  ) : (
                    <li>
                      <a
                        href={order.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-indigo-900"
                        download={order.fileName}
                      >
                        {order.fileName ||
                          "تحميل المستند"}
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Assigned employee */}
            <div>
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
            <div>
              <span className="font-bold text-gray-700">
                المبلغ:
              </span>{" "}
              <span className="text-green-700 font-bold">
                {order.paidAmount
                  ? `${order.paidAmount} درهم`
                  : "-"}
              </span>
            </div>

            {/* Time */}
            <div className="text-sm text-gray-800">
              <span className="font-bold text-gray-700">
                وقت الطلب:
              </span>{" "}
              {createdAtLocal}{" "}
              <span className="text-gray-500 font-normal">
                ({sinceText} مضت)
              </span>
            </div>

            {/* Last note */}
            {currentNote && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded text-yellow-700 font-semibold text-sm">
                <div className="font-bold text-yellow-800">
                  ملاحظة الموظف:
                </div>
                <div>{currentNote}</div>
              </div>
            )}

            {/* Contact actions */}
            <div className="flex flex-wrap gap-2 items-center mt-2">
              <span className="font-bold text-gray-800">
                تواصل مع العميل:
              </span>

              <button
                className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1 rounded shadow cursor-pointer text-sm"
                onClick={() => setShowChat(!showChat)}
                disabled={!client?.userId}
                style={{
                  cursor: client?.userId
                    ? "pointer"
                    : "not-allowed",
                }}
              >
                <MdOutlineChat /> شات داخلي
              </button>

              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1 rounded shadow cursor-pointer text-sm"
                >
                  <MdWhatsapp /> واتساب
                </a>
              )}

              {mailtoLink && (
                <a
                  href={mailtoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white font-bold px-3 py-1 rounded shadow cursor-pointer text-sm"
                >
                  <MdEmail /> إرسال إيميل
                </a>
              )}

              <button
                className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-3 py-1 rounded shadow cursor-pointer text-sm"
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
              className="flex flex-col gap-2 mt-4"
            >
              <label className="font-bold text-gray-800">
                تغيير الحالة:
              </label>

              <select
                name="status"
                defaultValue={order.status}
                className="border rounded px-2 py-2 cursor-pointer focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-gray-800"
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
                className="border rounded px-2 py-2 text-sm text-gray-800"
                placeholder="ملاحظة الموظف (اختياري)"
              />

              <button
                type="submit"
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-700 hover:to-emerald-500 text-white px-5 py-2 rounded font-bold shadow text-sm cursor-pointer transition-all"
              >
                <MdNotificationsActive />
                حفظ الحالة وإشعار العميل
              </button>
            </form>

            {/* Assign to employee */}
            <div className="mt-4">
              <button
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-400 hover:from-indigo-700 hover:to-indigo-500 text-white px-5 py-2 rounded font-bold shadow text-sm cursor-pointer transition-all"
                onClick={() => setShowAssignModal(true)}
              >
                <FaUserTie /> تصدير الطلب لموظف آخر
              </button>
            </div>
          </section>
        </div>

        {/* Assign Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full relative border border-emerald-200">
              <button
                className="absolute top-2 left-2 text-2xl font-bold text-gray-700 hover:text-emerald-800 transition"
                onClick={() => setShowAssignModal(false)}
              >
                ×
              </button>

              <div className="font-bold mb-3 text-emerald-800 flex items-center gap-2 text-lg">
                <FaUserTie className="text-indigo-600" />
                اختر الموظف
              </div>

              <select
                className="border-2 border-emerald-200 rounded w-full px-3 py-2 mb-3 cursor-pointer text-gray-900 font-bold bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
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
                className="bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 rounded font-bold w-full cursor-pointer mb-2 transition"
                disabled={!assignTo}
                onClick={() => {
                  handleAssign(order, assignTo);
                }}
              >
                تحويل الطلب
              </button>

              <button
                className="absolute top-2 right-2 text-2xl font-bold text-gray-400 hover:text-red-500 cursor-pointer transition"
                onClick={() => setShowAssignModal(false)}
              >
                <MdClose />
              </button>
            </div>
          </div>
        )}

        {/* Custom notification modal */}
        {showNotifModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full relative border border-yellow-200">
              <button
                className="absolute top-2 left-2 text-2xl cursor-pointer text-gray-600 hover:text-gray-900"
                onClick={() => setShowNotifModal(false)}
              >
                ×
              </button>

              <div className="font-bold mb-3 text-yellow-700 flex items-center gap-2 text-lg">
                <MdNotificationsActive />
                إرسال إشعار للعميل
              </div>

              <textarea
                className="border rounded w-full px-3 py-2 mb-3 text-sm text-gray-800 focus:ring-2 focus:ring-yellow-400"
                rows={3}
                placeholder="محتوى الإشعار..."
                value={notifContent}
                onChange={(e) =>
                  setNotifContent(e.target.value)
                }
              />

              <button
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-bold w-full cursor-pointer transition text-sm"
                disabled={!notifContent}
                onClick={() =>
                  sendCustomNotification(order, notifContent)
                }
              >
                إرسال الإشعار
              </button>

              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-2xl font-bold cursor-pointer transition"
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
          "fixed top-0 right-0 h-full z-50 bg-white border-l border-emerald-200/60",
          "shadow-xl w-[330px] max-w-full transition-transform duration-300",
          showNewSidebar ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-emerald-200/60 bg-emerald-50/60">
          <div className="text-lg font-bold text-emerald-900 flex items-center gap-2">
            <MdNotificationsActive className="text-emerald-700" />
            الطلبات الجديدة
          </div>
          <button
            className="text-2xl text-gray-400 hover:text-gray-700 cursor-pointer"
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
            const service = services[ord.serviceId];
            const sinceText = timeSince(ord.createdAt);
            const msgPreview = chatPreview[ord.requestId];

            return (
              <div
                key={ord.requestId}
                className="bg-emerald-50 mb-3 rounded-lg p-3 shadow hover:bg-emerald-100 cursor-pointer border border-emerald-200/60"
                onClick={() => {
                  setSelectedOrder(ord);
                  setShowNewSidebar(false);
                }}
              >
                <div className="font-bold text-emerald-900 text-sm">
                  {service?.name || ord.serviceId}
                </div>

                <div className="text-[0.8rem] text-gray-800 font-bold">
                  {client?.name || ord.clientId}
                </div>

                <div className="text-[0.7rem] text-gray-500 font-mono font-bold">
                  {ord.trackingNumber || ord.requestId}
                </div>

                <div className="text-[0.7rem] mt-1 text-gray-600 font-bold">
                  <span className="font-bold">منذ: </span>
                  {sinceText}
                </div>

                {msgPreview && (
                  <div className="mt-2 flex items-center gap-1 text-[0.7rem] bg-white rounded px-2 py-1 border border-emerald-100 shadow-sm text-gray-800 font-semibold">
                    <MdOutlineChat className="text-emerald-600" />
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

        {/* صوت الإشعار */}
        <audio
          ref={notifAudioRef}
          src="/sounds/new-order.mp3"
          preload="auto"
        />
      </aside>
    );
  }

  // ---------- MAIN RENDER ROOT ----------
  return (
    <div className="relative p-4 md:p-8 bg-gradient-to-b from-[#f8fafc] to-[#eef5f2] text-gray-900">
      {/* FILTER BAR */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        {/* Tabs by client type */}
        <div className="flex gap-2 flex-wrap">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              className={[
                "flex items-center gap-2 px-4 py-2 font-bold rounded-lg border-2 text-sm transition cursor-pointer select-none",
                activeTab === t.key
                  ? "border-emerald-600 bg-white text-emerald-900 shadow"
                  : "border-transparent bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300",
              ].join(" ")}
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
              "rounded px-3 py-1 font-bold shadow text-xs flex items-center gap-1 cursor-pointer border-2",
              statusFilter === "all"
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50",
            ].join(" ")}
            onClick={() => setStatusFilter("all")}
          >
            <span>الكل</span>
            <span className="font-mono">{orders.length}</span>
          </button>

          {Object.keys(STATUS_LABEL).map((key) => (
            <button
              key={key}
              className={[
                "rounded px-3 py-1 font-bold shadow text-xs flex items-center gap-1 cursor-pointer border-2",
                statusFilter === key
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50",
              ].join(" ")}
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
          className="border border-gray-300 rounded px-3 py-2 flex-1 text-sm text-gray-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300 shadow-sm bg-white"
          placeholder="بحث برقم الطلب / العميل / الخدمة / الحالة..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-bold shadow text-sm cursor-pointer transition border border-yellow-600"
            onClick={() => setShowNewSidebar(true)}
          >
            <MdNotificationsActive />
            <span>الطلبات الجديدة</span>
            <span className="font-mono">{newOrders.length}</span>
          </button>

          <button
            className="flex items-center gap-2 bg-white border border-yellow-300 hover:bg-yellow-50 text-yellow-700 px-3 py-2 rounded font-bold shadow text-sm cursor-pointer transition"
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
      <div className="overflow-x-auto rounded-xl shadow bg-white/95 border border-emerald-100">
        <table className="min-w-full text-center text-sm">
          <thead>
            <tr className="bg-emerald-50/80 text-emerald-900 font-bold">
              <th className="py-2 px-3 whitespace-nowrap">رقم الطلب</th>
              <th className="py-2 px-3 whitespace-nowrap">الخدمة</th>
              <th className="py-2 px-3 whitespace-nowrap">العميل</th>
              <th className="py-2 px-3 whitespace-nowrap">الحالة</th>
              <th className="py-2 px-3 whitespace-nowrap">الموظف</th>
              <th className="py-2 px-3 whitespace-nowrap">منذ</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 font-semibold">
            {filteredOrders.map((o) => {
              const client = clients[o.clientId];
              const service = services[o.serviceId];
              const assignedEmp = employees.find(
                (e) => e.userId === o.assignedTo
              );
              const sinceText = timeSince(o.createdAt);

              return (
                <tr
                  key={o.requestId}
                  className="hover:bg-emerald-50 transition border-b cursor-pointer"
                  onClick={() => setSelectedOrder(o)}
                >
                  <td className="py-2 px-3 font-mono font-bold text-indigo-800 text-xs md:text-sm">
                    {o.trackingNumber || o.requestId}
                  </td>

                  <td className="py-2 px-3 text-emerald-900 font-extrabold text-xs md:text-sm">
                    {service?.name || o.serviceId}
                  </td>

                  <td className="py-2 px-3">
                    <button
                      className="text-emerald-700 hover:text-emerald-900 underline font-bold text-xs md:text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowClientCard(client);
                      }}
                    >
                      {client?.name || o.clientId}
                    </button>
                  </td>

                  <td className="py-2 px-3">
                    <span
                      className={[
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[0.7rem] md:text-xs font-bold border",
                        STATUS_BADGE_STYLE[o.status] ||
                          "bg-gray-100 text-gray-900 border-gray-400",
                      ].join(" ")}
                    >
                      <span>
                        {STATUS_ICONS[o.status] || "❓"}
                      </span>
                      <span>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </span>
                  </td>

                  <td className="py-2 px-3 text-indigo-700 font-bold text-xs md:text-sm">
                    {assignedEmp
                      ? assignedEmp.name
                      : o.assignedTo || "-"}
                  </td>

                  <td className="py-2 px-3 text-[0.7rem] md:text-xs text-gray-700">
                    {sinceText}
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
      {selectedOrder && (
        <OrderDetailsModal order={selectedOrder} />
      )}

      {/* كارت العميل المنفصل (لو انت فاتحه لوحده مش من جوه الطلب) */}
      {showClientCard && !selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <ClientCard client={showClientCard} />
        </div>
      )}

      {/* سايدبار الطلبات الجديدة */}
      <NewOrdersSidebar />

      {/* تأكيد تثبيت الحالة وإرسال الإشعار */}
      {pendingStatus && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full relative flex flex-col items-center border border-emerald-200/60">
            <button
              className="absolute top-2 left-2 text-2xl cursor-pointer text-gray-700 hover:text-gray-900"
              onClick={() => setPendingStatus(null)}
            >
              ×
            </button>

            <div className="text-lg font-bold text-emerald-800 mb-3 flex items-center gap-2 text-center">
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
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded font-bold w-full cursor-pointer transition"
                onClick={confirmChangeStatus}
              >
                تأكيد
              </button>
              <button
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded font-bold w-full cursor-pointer transition"
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
