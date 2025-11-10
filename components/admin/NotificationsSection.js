"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
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

/* ============ Helpers ============ */
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

function humanType(t, lang = DEFAULT_LANG) {
  if (t === "company") return lang === "ar" ? "شركة" : "Company";
  if (t === "resident") return lang === "ar" ? "مقيم" : "Resident";
  if (t === "nonresident") return lang === "ar" ? "غير مقيم" : "Non-resident";
  return "-";
}

function clientLabel(c) {
  const name = c?.name || c?.displayName || c?.userId || "-";
  const cid = c?.customerId ? `#${c.customerId}` : c?.userId ? `#${c.userId}` : "";
  const phone = toE164(c?.phone || c?.phoneE164);
  return `${name} ${cid}${phone ? ` • ${phone}` : ""}`;
}

/* ============ Component ============ */
export default function NotificationsSection({ lang = DEFAULT_LANG }) {
  const isAr = lang === "ar";

  // Data
  const [notifications, setNotifications] = useState([]);
  const [clients, setClients] = useState([]);

  // Compose state
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [scheduleAt, setScheduleAt] = useState("");
  const [priority, setPriority] = useState("high");
  const [loading, setLoading] = useState(false);

  // Filters
  const [notifTypeFilter, setNotifTypeFilter] = useState("all");
  const [notifSearch, setNotifSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientTypeTab, setClientTypeTab] = useState("all");

  // Tokens preview
  const [targetTokenCount, setTargetTokenCount] = useState(null);
  const [resolvingTokens, setResolvingTokens] = useState(false);
  const [tokenPreviewOpen, setTokenPreviewOpen] = useState(false);
  const [tokenPreviewList, setTokenPreviewList] = useState([]);

  // Pending count (collectionGroup)
  const [pendingMap, setPendingMap] = useState(new Map());

  /* ============ Subscriptions ============ */
  useEffect(() => {
    const qNotifs = query(collection(db, "notifications"), orderBy("timestamp", "desc"), limit(500));
    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setNotifications(list);
    });

    const unsubClients = onSnapshot(collection(db, "users"), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ userId: d.id, ...d.data() }));
      setClients(list);
    });

    const qPending = query(collectionGroup(db, "pendingNotifications"), orderBy("createdAt", "desc"));
    const unsubPending = onSnapshot(qPending, (snap) => {
      const m = new Map();
      snap.forEach((d) => {
        const userDoc = d.ref.parent?.parent; // users/{docId}
        const uid = userDoc?.id;
        if (!uid) return;
        m.set(uid, (m.get(uid) || 0) + 1);
      });
      setPendingMap(m);
    });

    return () => {
      unsubNotifs();
      unsubClients();
      unsubPending();
    };
  }, []);

  /* ============ Clients map ============ */
  const clientsMap = useMemo(() => {
    const m = new Map();
    clients.forEach((c) => m.set(String(c.userId), c));
    return m;
  }, [clients]);

  /* ============ Tokens (docId-only) ============ */
  async function getActiveTokensForUserDoc(docId) {
    if (!docId) return [];
    setResolvingTokens(true);
    const tokens = new Set();
    try {
      // expoPushTokens
      try {
        const q1 = query(
          collection(db, "users", docId, "expoPushTokens"),
          where("active", "==", true)
        );
        const s1 = await getDocs(q1);
        s1.forEach((d) => {
          const v = d.data() || {};
          // foreground: treat missing as true (توافُق)
          const fg = (typeof v.foreground === "boolean") ? v.foreground : true;
          if (fg && v?.token) tokens.add(v.token);
        });
      } catch {}

      // pushTokens (اختياري)
      try {
        const q2 = query(
          collection(db, "users", docId, "pushTokens"),
          where("active", "==", true)
        );
        const s2 = await getDocs(q2);
        s2.forEach((d) => {
          const v = d.data() || {};
          const fg = (typeof v.foreground === "boolean") ? v.foreground : true;
          if (fg && v?.token) tokens.add(v.token);
        });
      } catch {}
    } finally {
      setResolvingTokens(false);
    }
    return Array.from(tokens);
  }

  /* ============ Resolve token count when target changes ============ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!target || target === "all") {
        setTargetTokenCount(null);
        return;
      }
      const toks = await getActiveTokensForUserDoc(String(target));
      if (!cancelled) setTargetTokenCount(toks.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  /* ============ Send notification (targetId only) ============ */
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

  /* ============ Derived lists ============ */
  const filteredNotifications = useMemo(() => {
    const search = notifSearch.trim().toLowerCase();
    return notifications.filter((n) => {
      if (notifTypeFilter !== "all" && n.type !== notifTypeFilter) return false;
      if (!search) return true;
      const client = n.targetId && n.targetId !== "all" ? clientsMap.get(n.targetId) : null;
      const name = (client?.name || client?.displayName || "").toLowerCase();
      const phone = String(client?.phone || client?.phoneE164 || "");
      const cid = (client?.customerId || "").toLowerCase();
      return (
        (n.body || "").toLowerCase().includes(search) ||
        name.includes(search) ||
        phone.includes(search) ||
        cid.includes(search)
      );
    });
  }, [notifications, notifTypeFilter, notifSearch, clientsMap]);

  const filteredClients = useMemo(() => {
    const s = clientSearch.trim().toLowerCase();
    return clients.filter((c) => {
      if (clientTypeTab !== "all" && (c.accountType || "") !== clientTypeTab) return false;
      if (!s) return true;
      const name = (c.name || c.displayName || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = String(c.phone || c.phoneE164 || "");
      const customerId = (c.customerId || "").toLowerCase();
      return (
        (name && name.includes(s)) ||
        (email && email.includes(s)) ||
        (phone && phone.includes(s)) ||
        (customerId && customerId.includes(s))
      );
    });
  }, [clients, clientSearch, clientTypeTab]);

  /* ============ UI ============ */
  return (
    <div className="max-w-7xl mx-auto py-6 px-4 text-sm text-slate-900">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-extrabold">{isAr ? "لوحة الإشعارات" : "Notifications"}</h2>
          <p className="text-slate-500 mt-1">
            {isAr
              ? "أرسل إشعارات عامة أو موجهة لعملائك. يمكنك معاينة التوكنات النشطة قبل الإرسال."
              : "Send broadcast or targeted notifications. Preview active tokens before sending."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT: List (takes 2 cols) */}
        <div className="xl:col-span-2 space-y-4">
          {/* Toolbar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">{isAr ? "نوع:" : "Type:"}</label>
              <select
                value={notifTypeFilter}
                onChange={(e) => setNotifTypeFilter(e.target.value)}
                className="p-2 border border-slate-200 rounded-md"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                <option value="general">{isAr ? "عام" : "General"}</option>
                <option value="custom">{isAr ? "مخصص" : "Custom"}</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <input
                value={notifSearch}
                onChange={(e) => setNotifSearch(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-md"
                placeholder={isAr ? "بحث في الإشعارات..." : "Search notifications..."}
              />
            </div>

            <div className="text-xs text-slate-500">
              {isAr ? "إجمالي:" : "Total:"} <strong>{notifications.length}</strong>
            </div>
          </div>

          {/* List */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-emerald-50 text-emerald-900">
                  <tr>
                    <th className="py-2 px-3 font-semibold">{isAr ? "النص" : "Message"}</th>
                    <th className="py-2 px-3 font-semibold">{isAr ? "النوع" : "Type"}</th>
                    <th className="py-2 px-3 font-semibold">{isAr ? "الحالة" : "Status"}</th>
                    <th className="py-2 px-3 font-semibold">{isAr ? "إلى" : "To"}</th>
                    <th className="py-2 px-3 font-semibold">{isAr ? "التواريخ" : "Dates"}</th>
                    <th className="py-2 px-3 font-semibold">{isAr ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-slate-400 text-center">
                        {isAr ? "لا يوجد إشعارات" : "No notifications"}
                      </td>
                    </tr>
                  ) : (
                    filteredNotifications.map((n) => {
                      const targetClient = n.targetId && n.targetId !== "all" ? clientsMap.get(n.targetId) : null;
                      return (
                        <tr key={n.id} className="border-b last:border-b-0 hover:bg-emerald-50/20">
                          <td className="py-3 px-3 max-w-[520px] break-words">{n.body}</td>

                          <td className="py-3 px-3">
                            <Badge intent={n.type === "general" ? "success" : "default"}>
                              {n.type === "general" ? (isAr ? "عام" : "General") : (isAr ? "مخصص" : "Custom")}
                            </Badge>
                          </td>

                          <td className="py-3 px-3">
                            {n.status === "sent" && <Badge intent="success">{isAr ? "مرسل" : "sent"}</Badge>}
                            {n.status === "queued" && <Badge intent="warn">{isAr ? "قيد الانتظار" : "queued"}</Badge>}
                            {n.status === "queued_for_user" && <Badge intent="warn">{isAr ? "معلّق للمستخدم" : "queued_for_user"}</Badge>}
                            {n.status === "scheduled" && <Badge intent="muted">{isAr ? "مجدول" : "scheduled"}</Badge>}
                            {n.status === "sending" && <Badge intent="muted">{isAr ? "جاري الإرسال" : "sending"}</Badge>}
                            {n.status === "no_response" && <Badge intent="muted">{isAr ? "لا استجابة" : "no_response"}</Badge>}
                            {n.status === "failed" && <Badge intent="error">{isAr ? "فشل" : "failed"}</Badge>}
                            {!n.status && <Badge>—</Badge>}
                          </td>

                          <td className="py-3 px-3">
                            {n.targetId === "all" ? (
                              <div className="font-medium">{isAr ? "كل العملاء" : "All Clients"}</div>
                            ) : targetClient ? (
                              <div className="flex items-center gap-3">
                                <div>
                                  <div className="font-medium">
                                    {targetClient.name || targetClient.displayName || targetClient.userId}
                                  </div>
                                  <div className="text-xs text-slate-500">#{targetClient.customerId || targetClient.userId}</div>
                                </div>
                                <Badge intent="muted">{humanType(targetClient.accountType, lang)}</Badge>
                              </div>
                            ) : (
                              <div className="text-xs">{n.targetId}</div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-slate-600 text-xs whitespace-nowrap">
                            <div>{formatDate(n.timestamp, lang)}</div>
                            {n.pushAt && (
                              <div className="text-[11px] text-slate-400 mt-1">
                                {isAr ? "مجدول: " : "Scheduled: "} {formatDate(n.pushAt, lang)}
                              </div>
                            )}
                            {n.sentAt && (
                              <div className="text-[11px] text-slate-400 mt-1">
                                {isAr ? "أُرسل: " : "Sent: "} {formatDate(n.sentAt, lang)}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="px-2 py-1 text-xs rounded border"
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
                              >
                                {isAr ? "إعادة إرسال" : "Re-send"}
                              </button>

                              {n.pushAt && (
                                <button
                                  className="px-2 py-1 text-xs rounded border"
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
                                >
                                  {isAr ? "إلغاء الجدولة" : "Cancel schedule"}
                                </button>
                              )}
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

          {/* Pending widget */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h4 className="font-bold mb-2">{isAr ? "الإشعارات المعلّقة" : "Pending notifications"}</h4>
            {pendingMap.size === 0 ? (
              <div className="text-sm text-slate-500">
                {isAr ? "لا يوجد إشعارات معلّقة." : "No pending notifications."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Array.from(pendingMap.entries()).map(([docId, count]) => {
                  const c = clientsMap.get(docId);
                  return (
                    <div key={docId} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div className="text-sm">
                        <div className="font-medium">{c ? (c.name || c.displayName || docId) : docId}</div>
                        <div className="text-xs text-slate-500">#{c?.customerId || docId}</div>
                      </div>
                      <Badge intent="warn">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Compose (sticky) */}
        <div className="xl:col-span-1">
          <div className="xl:sticky xl:top-6 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">{isAr ? "إنشاء إشعار" : "Compose"}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {isAr ? "اكتب الرسالة واختر المستلم." : "Write message & choose recipient."}
                </p>
              </div>
              <Badge intent="muted">
                {priority === "high" ? (isAr ? "عالية" : "High") : (isAr ? "عادية" : "Normal")}
              </Badge>
            </div>

            <textarea
              className="w-full min-h-[110px] p-3 rounded-md border border-slate-200 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder={isAr ? "اكتب نص الإشعار..." : "Write notification message..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <label className="block text-xs text-slate-600 mb-2">{isAr ? "المستلم" : "Recipient"}</label>
            <div className="mb-2">
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-md mb-2"
                placeholder={isAr ? "ابحث عن عميل..." : "Search client..."}
              />
              <select
                value={target}
                onChange={async (e) => {
                  const id = e.target.value;
                  setTarget(id);
                  if (id && id !== "all") {
                    setResolvingTokens(true);
                    const toks = await getActiveTokensForUserDoc(String(id));
                    setTargetTokenCount(toks.length);
                    setResolvingTokens(false);
                  } else {
                    setTargetTokenCount(null);
                  }
                }}
                className="w-full p-2 rounded-md border border-slate-200"
              >
                <option value="all">{isAr ? "كل العملاء" : "All clients"}</option>
                {filteredClients.slice(0, 300).map((cl) => (
                  <option key={cl.userId} value={cl.userId}>
                    {clientLabel(cl)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={async () => {
                  if (!target || target === "all") return;
                  setResolvingTokens(true);
                  const toks = await getActiveTokensForUserDoc(String(target));
                  setTokenPreviewList(toks);
                  setTokenPreviewOpen(true);
                  setResolvingTokens(false);
                }}
                disabled={!target || target === "all" || resolvingTokens}
                className="px-3 py-2 rounded-md bg-emerald-600 text-white font-semibold text-sm disabled:opacity-60"
              >
                {resolvingTokens ? (isAr ? "جاري التحضير..." : "Preparing...") : (isAr ? "عرض التوكنات" : "View tokens")}
              </button>

              <div className="ml-auto text-xs text-slate-600">
                {isAr ? "توكنات نشطة:" : "Active tokens:"}{" "}
                <strong>{targetTokenCount === null ? "—" : targetTokenCount}</strong>
              </div>
            </div>

            <div className="flex gap-2 items-center mb-3">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="p-2 rounded-md border border-slate-200"
              >
                <option value="high">{isAr ? "عالية" : "High"}</option>
                <option value="normal">{isAr ? "عادية" : "Normal"}</option>
              </select>

              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="p-2 rounded-md border border-slate-200 ml-auto"
                title={isAr ? "موعد الإرسال" : "Schedule send time"}
              />
            </div>

            <button
              onClick={sendNotification}
              disabled={loading || !message.trim()}
              className="w-full px-4 py-3 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-60"
            >
              {loading ? (isAr ? "جارٍ الإرسال..." : "Sending...") : (isAr ? "إرسال إشعار" : "Send Notification")}
            </button>
          </div>
        </div>
      </div>

      {/* Token preview modal */}
      {tokenPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold">{isAr ? "التوكنات النشطة" : "Active tokens"}</h4>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">
                  {tokenPreviewList.length} {isAr ? "توكن" : "tokens"}
                </span>
                <button
                  onClick={() => { setTokenPreviewOpen(false); setTokenPreviewList([]); }}
                  className="px-3 py-1 rounded-md border"
                >
                  {isAr ? "إغلاق" : "Close"}
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-auto border rounded-md p-3 bg-slate-50">
              {tokenPreviewList.length === 0 ? (
                <div className="text-slate-500">
                  {isAr ? "لا توجد توكنات نشطة لهذا المستخدم." : "No active tokens for this user."}
                </div>
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
