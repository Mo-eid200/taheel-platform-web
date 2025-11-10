"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  collectionGroup,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { firestore as db } from "@/lib/firebase.client";

/* =========================
   Helpers & Small UI Bits
   ========================= */
const DEFAULT_LANG = "ar";

function formatDate(ts, lang = DEFAULT_LANG) {
  if (!ts) return "-";
  const d = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
  return d.toLocaleString(lang === "ar" ? "ar-AE" : "en-US", { timeZone: "Asia/Dubai" });
}

function toE164(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (String(raw).startsWith("+")) return `+${digits}`;
  if (digits.startsWith("971")) return `+${digits}`;
  return `+971${digits}`;
}

function Badge({ children, intent = "default" }) {
  const map = {
    success: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    error: "bg-rose-100 text-rose-800",
    muted: "bg-slate-100 text-slate-700",
    default: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${map[intent] || map.default}`}>
      {children}
    </span>
  );
}

function Tabs({ value, onChange, isAr }) {
  const tabs = [
    { id: "all", label: isAr ? "الكل" : "All" },
    { id: "resident", label: isAr ? "مقيم" : "Resident" },
    { id: "nonresident", label: isAr ? "غير مقيم" : "Non-resident" },
    { id: "company", label: isAr ? "شركة" : "Company" },
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`cursor-pointer px-3 py-1.5 rounded-full text-sm transition duration-150 ease-in-out focus:outline-none ${
              active
                ? "bg-emerald-700 text-white shadow-md"
                : "bg-white text-slate-700 border border-slate-200 hover:shadow-sm"
            }`}
            aria-pressed={active}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ClientRow({ client, active, onSelect }) {
  const name = client?.name || client?.displayName || "-";
  const cid = client?.__cid || client?.customerId || "-";
  const tokens = client.__tokens || 0;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-3 rounded-lg border flex items-center justify-between transition-all duration-150 ease-in-out cursor-pointer ${
        active ? "border-emerald-500 bg-emerald-50 shadow-md" : "border-slate-200 bg-white hover:shadow-sm hover:scale-[1.01]"
      }`}
      aria-current={active ? "true" : "false"}
      title={name + " • #" + cid}
    >
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-slate-900 text-sm">{name}</span>
          <span className="text-xs font-mono text-emerald-700">#{cid}</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">{client.email ? client.email : toE164(client.phone || client.phoneE164) || "-"}</div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-[12px] px-2 py-0.5 rounded-full ${tokens > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
          {tokens}
        </span>
        <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M7 7l5 3-5 3V7z" />
        </svg>
      </div>
    </button>
  );
}

/* =========================
   Main Component (JS only)
   ========================= */
export default function NotificationsSection({ lang = DEFAULT_LANG }) {
  const isAr = lang === "ar";

  // Data
  const [notifications, setNotifications] = useState([]);
  const [clients, setClients] = useState([]);

  // Compose
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all"); // customerId | "all"
  const [scheduleAt, setScheduleAt] = useState("");
  const [priority, setPriority] = useState("high");
  const [loading, setLoading] = useState(false);

  // Filters & UI
  const [notifTypeFilter, setNotifTypeFilter] = useState("all");
  const [notifSearch, setNotifSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientTypeTab, setClientTypeTab] = useState("all");
  const [onlyWithTokens, setOnlyWithTokens] = useState(false);
  const [tokensFirst, setTokensFirst] = useState(true);

  // Token UX
  const [targetTokenCount, setTargetTokenCount] = useState(null);
  const [resolvingTokens, setResolvingTokens] = useState(false);
  const [tokenPreviewOpen, setTokenPreviewOpen] = useState(false);
  const [tokenPreviewList, setTokenPreviewList] = useState([]);

  // Live counts
  const [tokenCounts, setTokenCounts] = useState(new Map());
  const [pendingMap, setPendingMap] = useState(new Map());

  /* Subscriptions */
  useEffect(() => {
    const qNotifs = query(collection(db, "notifications"), orderBy("timestamp", "desc"), limit(500));
    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setNotifications(list);
    });

    const unsubClients = onSnapshot(collection(db, "users"), (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        const cid = data.customerId || d.id;
        list.push({
          userId: d.id,
          customerId: data.customerId || "",
          __cid: cid,
          ...data,
        });
      });
      setClients(list);
    });

    const qPending = query(collectionGroup(db, "pendingNotifications"), orderBy("createdAt", "desc"));
    const unsubPending = onSnapshot(qPending, (snap) => {
      const m = new Map();
      snap.forEach((d) => {
        const userDoc = d.ref?.parent?.parent;
        const cid = userDoc?.id;
        if (!cid) return;
        m.set(cid, (m.get(cid) || 0) + 1);
      });
      setPendingMap(m);
    });

    // token watchers - rebuild counts when tokens change
    const expoQ = query(collectionGroup(db, "expoPushTokens"), where("active", "==", true));
    const unsubExpo = onSnapshot(expoQ, () => rebuildAllTokenCounts());
    const pushQ = query(collectionGroup(db, "pushTokens"), where("active", "==", true));
    const unsubPush = onSnapshot(pushQ, () => rebuildAllTokenCounts());

    // initial build
    rebuildAllTokenCounts();

    return () => {
      unsubNotifs();
      unsubClients();
      unsubPending();
      unsubExpo();
      unsubPush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Rebuild token counts (collectionGroup) */
  async function rebuildAllTokenCounts() {
    const m = new Map();

    try {
      const s1 = await getDocs(query(collectionGroup(db, "expoPushTokens"), where("active", "==", true)));
      s1.forEach((d) => {
        const v = d.data() || {};
        const fg = typeof v.foreground === "boolean" ? v.foreground : true;
        if (!v.token || !fg) return;
        const cid = d.ref?.parent?.parent?.id;
        if (!cid) return;
        m.set(cid, (m.get(cid) || 0) + 1);
      });
    } catch {}

    try {
      const s2 = await getDocs(query(collectionGroup(db, "pushTokens"), where("active", "==", true)));
      s2.forEach((d) => {
        const v = d.data() || {};
        const fg = typeof v.foreground === "boolean" ? v.foreground : true;
        if (!v.token || !fg) return;
        const cid = d.ref?.parent?.parent?.id;
        if (!cid) return;
        m.set(cid, (m.get(cid) || 0) + 1);
      });
    } catch {}

    setTokenCounts(m);
  }

  /* Quick token count for selected target */
  useEffect(() => {
    if (!target || target === "all") setTargetTokenCount(null);
    else setTargetTokenCount(tokenCounts.get(String(target)) || 0);
  }, [target, tokenCounts]);

  /* Preview tokens for a given customerId */
  async function getActiveTokensForUserDoc(customerId) {
    if (!customerId) return [];
    setResolvingTokens(true);
    const tokens = new Set();
    try {
      try {
        const s1 = await getDocs(query(collection(db, "users", customerId, "expoPushTokens"), where("active", "==", true)));
        s1.forEach((d) => {
          const v = d.data() || {};
          const fg = typeof v.foreground === "boolean" ? v.foreground : true;
          if (fg && v.token) tokens.add(v.token);
        });
      } catch {}
      try {
        const s2 = await getDocs(query(collection(db, "users", customerId, "pushTokens"), where("active", "==", true)));
        s2.forEach((d) => {
          const v = d.data() || {};
          const fg = typeof v.foreground === "boolean" ? v.foreground : true;
          if (fg && v.token) tokens.add(v.token);
        });
      } catch {}
    } finally {
      setResolvingTokens(false);
    }
    return Array.from(tokens);
  }

  /* Send notification (uses customerId as targetId) */
  async function sendNotification() {
    if (!message.trim()) {
      alert(isAr ? "من فضلك اكتب نص الإشعار." : "Please write a message.");
      return;
    }
    setLoading(true);
    try {
      const pushAtValue = scheduleAt ? Timestamp.fromDate(new Date(scheduleAt)) : Timestamp.fromDate(new Date());

      await addDoc(collection(db, "notifications"), {
        title: isAr ? "إشعار جديد" : "New Notification",
        body: message.trim(),
        data: {},
        priority,
        targetId: target === "all" ? "all" : String(target),
        type: target === "all" ? "general" : "custom",
        timestamp: serverTimestamp(),
        pushAt: pushAtValue,
        status: "queued",
        pushed: false,
        attempts: 0,
        lastError: null,
      });

      // UX reset
      setMessage("");
      setTarget("all");
      setScheduleAt("");
      setPriority("high");
      setTargetTokenCount(null);

      alert(isAr ? "تمت إضافة الإشعار إلى قائمة الانتظار." : "Notification queued.");
    } catch (err) {
      console.error(err);
      alert(isAr ? "فشل إضافة الإشعار." : "Failed to queue notification.");
    } finally {
      setLoading(false);
    }
  }

  /* Derived / filtered lists */
  const clientsMap = useMemo(() => {
    const m = new Map();
    clients.forEach((c) => {
      const cid = c.__cid || c.customerId || c.userId;
      if (cid) m.set(String(cid), c);
    });
    return m;
  }, [clients, tokenCounts]);

  const clientsWithTokens = useMemo(() => {
    return clients.map((c) => {
      const cid = c.__cid || c.customerId || c.userId;
      return { ...c, __tokens: tokenCounts.get(String(cid)) || 0 };
    });
  }, [clients, tokenCounts]);

  const filteredClients = useMemo(() => {
    const s = clientSearch.trim().toLowerCase();
    let list = clientsWithTokens.filter((c) => {
      if (clientTypeTab !== "all" && (c.accountType || "") !== clientTypeTab) return false;
      if (onlyWithTokens && (c.__tokens || 0) === 0) return false;
      if (!s) return true;
      const name = (c.name || c.displayName || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = String(c.phone || c.phoneE164 || "");
      const customerId = (c.__cid || c.customerId || "").toLowerCase();
      return (name && name.includes(s)) || (email && email.includes(s)) || phone.includes(s) || customerId.includes(s);
    });

    if (tokensFirst) {
      list = list.sort((a, b) => {
        const ta = a.__tokens || 0;
        const tb = b.__tokens || 0;
        if (tb !== ta) return tb - ta;
        const na = (a.name || a.displayName || "").toLowerCase();
        const nb = (b.name || b.displayName || "").toLowerCase();
        return na.localeCompare(nb);
      });
    } else {
      list = list.sort((a, b) => {
        const na = (a.name || a.displayName || "").toLowerCase();
        const nb = (b.name || b.displayName || "").toLowerCase();
        return na.localeCompare(nb);
      });
    }

    return list;
  }, [clientsWithTokens, clientSearch, clientTypeTab, onlyWithTokens, tokensFirst]);

  const filteredNotifications = useMemo(() => {
    const search = notifSearch.trim().toLowerCase();
    return notifications.filter((n) => {
      if (notifTypeFilter !== "all" && n.type !== notifTypeFilter) return false;
      if (!search) return true;
      const client = n.targetId && n.targetId !== "all" ? clientsMap.get(n.targetId) : null;
      const name = (client?.name || client?.displayName || "").toLowerCase();
      const phone = String(client?.phone || client?.phoneE164 || "");
      const cid = (client?.__cid || client?.customerId || "").toLowerCase();
      return (n.body || "").toLowerCase().includes(search) || name.includes(search) || phone.includes(search) || cid.includes(search);
    });
  }, [notifications, notifTypeFilter, notifSearch, clientsMap]);

  /* ============================
     Render (New Layout)
  ============================ */
  return (
    <div className="max-w-7xl mx-auto py-6 px-6 text-sm text-slate-900">
      {/* ===== Top Compose Bar ===== */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 mb-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Message */}
          <div className="xl:col-span-5">
            <label className="block text-xs text-slate-600 mb-1">{isAr ? "نص الإشعار" : "Message"}</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isAr ? "اكتب نص الإشعار..." : "Write notification message..."}
              className="w-full p-3 rounded-lg border border-slate-200 text-sm resize-none min-h-[96px] focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          {/* Recipient + client filters */}
          <div className="xl:col-span-5">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setTarget("all")}
                className={`cursor-pointer px-3 py-2 rounded-lg text-sm font-medium ${
                  target === "all" ? "bg-emerald-700 text-white shadow-md" : "bg-white border border-slate-200 hover:shadow-sm"
                }`}
              >
                {isAr ? "كل العملاء" : "All Clients"}
              </button>
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder={isAr ? "ابحث عن عميل..." : "Search client..."}
                className="w-full p-2 rounded-lg border border-slate-200 text-sm focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between mb-2">
              <Tabs value={clientTypeTab} onChange={setClientTypeTab} isAr={isAr} />
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={onlyWithTokens} onChange={(e) => setOnlyWithTokens(e.target.checked)} className="cursor-pointer" />
                  {isAr ? "توكنات فقط" : "With tokens only"}
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={tokensFirst} onChange={(e) => setTokensFirst(e.target.checked)} className="cursor-pointer" />
                  {isAr ? "رتّب التوكنات أولاً" : "Tokens first"}
                </label>
              </div>
            </div>

            <div className="max-h-40 overflow-auto border rounded-lg p-2 bg-slate-50 space-y-2">
              {filteredClients.slice(0, 120).map((cl) => (
                <ClientRow key={cl.__cid} client={cl} active={target === cl.__cid} onSelect={() => setTarget(cl.__cid)} />
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={async () => {
                  if (!target || target === "all") return;
                  setResolvingTokens(true);
                  const toks = await getActiveTokensForUserDoc(String(target));
                  setTokenPreviewList(toks);
                  setTokenPreviewOpen(true);
                  setResolvingTokens(false);
                }}
                disabled={!target || target === "all" || resolvingTokens}
                className="cursor-pointer px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm hover:shadow-sm transition"
              >
                {resolvingTokens ? (isAr ? "جاري التحضير..." : "Preparing...") : (isAr ? "عرض التوكنات" : "View tokens")}
              </button>

              <div className="ml-auto text-xs text-slate-600">
                {isAr ? "توكنات نشطة:" : "Active tokens:"} <strong>{targetTokenCount === null ? "—" : targetTokenCount}</strong>
              </div>
            </div>
          </div>

          {/* Priority / schedule / send */}
          <div className="xl:col-span-2 flex flex-col justify-between">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-600">{isAr ? "الأولوية" : "Priority"}</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="p-2 rounded-lg border border-slate-200 text-sm cursor-pointer">
                <option value="high">{isAr ? "عالية" : "High"}</option>
                <option value="normal">{isAr ? "عادية" : "Normal"}</option>
              </select>

              <label className="text-xs text-slate-600 mt-2">{isAr ? "موعد الإرسال (اختياري)" : "Schedule (optional)"}</label>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="p-2 rounded-lg border border-slate-200 text-sm cursor-pointer"
              />
            </div>

            <button
              onClick={sendNotification}
              disabled={loading || !message.trim()}
              className="cursor-pointer w-full mt-3 py-3 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-lg transition disabled:opacity-60"
              title={isAr ? "إرسال إشعار" : "Send notification"}
            >
              {loading ? (isAr ? "جارٍ الإرسال..." : "Sending...") : (isAr ? "إرسال" : "Send")}
            </button>
          </div>
        </div>
      </div>

      {/* ===== Content Row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (wide): Notifications table */}
        <main className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <select
                  value={notifTypeFilter}
                  onChange={(e) => setNotifTypeFilter(e.target.value)}
                  className="p-2 rounded-lg border border-slate-200 text-sm cursor-pointer"
                >
                  <option value="all">{isAr ? "الكل" : "All"}</option>
                  <option value="general">{isAr ? "عام" : "General"}</option>
                  <option value="custom">{isAr ? "مخصص" : "Custom"}</option>
                </select>

                <input
                  value={notifSearch}
                  onChange={(e) => setNotifSearch(e.target.value)}
                  placeholder={isAr ? "بحث في الإشعارات..." : "Search notifications..."}
                  className="w-full p-2 rounded-lg border border-slate-200 text-sm focus:outline-none"
                />
              </div>

              <div className="text-xs text-slate-600">
                {isAr ? "العرض" : "Showing"}: <strong>{filteredNotifications.length}</strong>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md">
              <table className="w-full text-left table-fixed">
                <thead className="bg-emerald-50 text-emerald-900">
                  <tr>
                    <th className="py-3 px-4 font-semibold w-1/3">{isAr ? "النص" : "Message"}</th>
                    <th className="py-3 px-4 font-semibold">{isAr ? "النوع" : "Type"}</th>
                    <th className="py-3 px-4 font-semibold">{isAr ? "الحالة" : "Status"}</th>
                    <th className="py-3 px-4 font-semibold">{isAr ? "إلى" : "To"}</th>
                    <th className="py-3 px-4 font-semibold">{isAr ? "التواريخ" : "Dates"}</th>
                    <th className="py-3 px-4 font-semibold">{isAr ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        {isAr ? "لا يوجد إشعارات" : "No notifications"}
                      </td>
                    </tr>
                  ) : (
                    filteredNotifications.map((n) => {
                      const targetClient = n.targetId && n.targetId !== "all" ? clientsMap.get(n.targetId) : null;
                      return (
                        <tr key={n.id} className="hover:bg-emerald-50/30 transition">
                          <td className="py-3 px-4 align-top max-w-[420px] break-words text-slate-800">{n.body}</td>
                          <td className="py-3 px-4 align-top">
                            <Badge intent={n.type === "general" ? "success" : "default"}>
                              {n.type === "general" ? (isAr ? "عام" : "General") : (isAr ? "مخصص" : "Custom")}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 align-top">
                            {n.status === "sent" && <Badge intent="success">{isAr ? "مرسل" : "sent"}</Badge>}
                            {n.status === "queued" && <Badge intent="warn">{isAr ? "قيد الانتظار" : "queued"}</Badge>}
                            {n.status === "sending" && <Badge intent="muted">{isAr ? "جاري الإرسال" : "sending"}</Badge>}
                            {n.status === "failed" && <Badge intent="error">{isAr ? "فشل" : "failed"}</Badge>}
                            {!n.status && <Badge>—</Badge>}
                          </td>
                          <td className="py-3 px-4 align-top">
                            {n.targetId === "all" ? (
                              <div className="font-medium">{isAr ? "كل العملاء" : "All Clients"}</div>
                            ) : targetClient ? (
                              <div>
                                <div className="font-medium">{targetClient.name || targetClient.displayName || targetClient.__cid}</div>
                                <div className="text-xs font-mono text-emerald-700">#{targetClient.__cid}</div>
                              </div>
                            ) : (
                              <div className="text-xs">{n.targetId}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500 align-top whitespace-nowrap">
                            <div>{formatDate(n.timestamp, lang)}</div>
                            {n.pushAt && <div className="mt-1">{isAr ? "مجدول: " : "Scheduled: "}{formatDate(n.pushAt, lang)}</div>}
                            {n.sentAt && <div className="mt-1">{isAr ? "أُرسل: " : "Sent: "}{formatDate(n.sentAt, lang)}</div>}
                          </td>
                          <td className="py-3 px-4 align-top">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={async () => {
                                  await addDoc(collection(db, "notifications"), {
                                    title: n.title,
                                    body: n.body,
                                    data: n.data || {},
                                    targetId: n.targetId || "all",
                                    priority: n.priority || "high",
                                    timestamp: serverTimestamp(),
                                    pushAt: Timestamp.fromDate(new Date()),
                                    type: n.type || (n.targetId === "all" ? "general" : "custom"),
                                    status: "queued",
                                    pushed: false,
                                    attempts: 0,
                                    lastError: null,
                                  });
                                  alert(isAr ? "تم إنشاء إعادة إرسال." : "Re-send enqueued.");
                                }}
                                className="cursor-pointer px-3 py-2 rounded-md bg-white border border-slate-200 hover:shadow-sm text-sm"
                              >
                                {isAr ? "إعادة إرسال" : "Re-send"}
                              </button>

                              <button
                                onClick={async () => {
                                  await addDoc(collection(db, "notifications"), {
                                    title: n.title,
                                    body: n.body,
                                    data: n.data || {},
                                    targetId: n.targetId || "all",
                                    priority: n.priority || "high",
                                    timestamp: serverTimestamp(),
                                    pushAt: Timestamp.fromDate(new Date()),
                                    type: n.type || (n.targetId === "all" ? "general" : "custom"),
                                    status: "queued",
                                    pushed: false,
                                    attempts: 0,
                                    lastError: null,
                                  });
                                  alert(isAr ? "تم إلغاء الجدولة بإنشاء نسخة فورية." : "Schedule canceled via clone.");
                                }}
                                className="cursor-pointer px-3 py-2 rounded-md bg-white border border-slate-200 hover:shadow-sm text-sm"
                              >
                                {isAr ? "نسخ فوري" : "Clone (now)"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Right (narrow): summary + pending */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
            <h3 className="font-bold mb-3">{isAr ? "ملخص سريع" : "Quick summary"}</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex justify-between">
                <span>{isAr ? "عملاء مسجلين" : "Clients"}</span>
                <span className="font-semibold">{clients.length}</span>
              </div>
              <div className="flex justify-between">
                <span>{isAr ? "إجمالي توكنات نشطة" : "Total active tokens"}</span>
                <span className="font-semibold">{Array.from(tokenCounts.values()).reduce((a, b) => a + b, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>{isAr ? "إشعارات في الطابور" : "Notifications queued"}</span>
                <span className="font-semibold">{notifications.filter((n) => n.status === "queued").length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
            <h3 className="font-bold mb-3">{isAr ? "الإشعارات المعلّقة حسب العميل" : "Pending by customer"}</h3>
            {pendingMap.size === 0 ? (
              <div className="text-slate-500">{isAr ? "لا يوجد إشعارات معلّقة." : "No pending notifications."}</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {Array.from(pendingMap.entries()).map(([cid, count]) => {
                  const c = clientsMap.get(cid);
                  return (
                    <div key={cid} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div>
                        <div className="font-medium">{c ? (c.name || c.displayName || cid) : cid}</div>
                        <div className="text-xs font-mono text-emerald-700 mt-1">#{c?.__cid || cid}</div>
                      </div>
                      <Badge intent="warn">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Token preview modal */}
      {tokenPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold">{isAr ? "التوكنات النشطة" : "Active tokens"}</h4>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">{tokenPreviewList.length} {isAr ? "توكن" : "tokens"}</span>
                <button onClick={() => { setTokenPreviewOpen(false); setTokenPreviewList([]); }} className="cursor-pointer px-3 py-1 rounded-md border">
                  {isAr ? "إغلاق" : "Close"}
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-auto border rounded-lg p-3 bg-slate-50">
              {tokenPreviewList.length === 0 ? (
                <div className="text-slate-500">{isAr ? "لا توجد توكنات نشطة لهذا العميل." : "No active tokens for this customer."}</div>
              ) : (
                tokenPreviewList.map((t, i) => (
                  <div key={i} className="mb-2 p-2 bg-white border rounded text-xs break-all">
                    {t}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
