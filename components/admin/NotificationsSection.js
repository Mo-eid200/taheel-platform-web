import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { firestore as db } from "@/lib/firebase.client";

// Helpers (compact/unchanged logic)
function formatDate(ts, lang = "ar") {
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
function Badge({ children, intent }) {
  const map = {
    success: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-700",
    error: "bg-rose-100 text-rose-700",
    muted: "bg-slate-100 text-slate-700",
    default: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[intent || "default"]}`}>
      {children}
    </span>
  );
}
function ClientActions({ client, lang }) {
  if (!client) return null;
  const phone = toE164(client.phone);
  const msg = encodeURIComponent(lang === "ar" ? "مرحباً، لديك إشعار جديد من منصة تأهيل." : "Hello, you have a new notification from Taheel.");
  const subject = encodeURIComponent(lang === "ar" ? "إشعار جديد" : "New Notification");
  return (
    <span className="flex gap-2 ml-1 text-sm">
      {phone ? (
        <a
          href={`https://wa.me/${phone.replace("+", "")}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          className="hover:bg-emerald-50 rounded-md p-1 transition text-emerald-700"
        >
          📱
        </a>
      ) : null}
      {client.email ? (
        <a
          href={`mailto:${client.email}?subject=${subject}&body=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Email"
          className="hover:bg-sky-50 rounded-md p-1 transition text-sky-700"
        >
          ✉️
        </a>
      ) : null}
    </span>
  );
}

// Main (compact UI, header removed, spacing reduced)
export default function NotificationsSection({ lang = "ar" }) {
  const [notifications, setNotifications] = useState([]);
  const [clients, setClients] = useState([]);
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [loading, setLoading] = useState(false);

  // Filters
  const [notifTypeFilter, setNotifTypeFilter] = useState("all");
  const [notifSearch, setNotifSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  // Scheduling & priority
  const [scheduleAt, setScheduleAt] = useState("");
  const [priority, setPriority] = useState("high");

  useEffect(() => {
    const qNotifs = query(collection(db, "notifications"), orderBy("timestamp", "desc"), limit(300));
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
    return () => {
      unsubNotifs();
      unsubClients();
    };
  }, []);

  const clientsMap = useMemo(() => {
    const m = new Map();
    clients.forEach((c) => m.set(c.userId, c));
    return m;
  }, [clients]);

  async function sendNotification() {
    if (!message.trim()) {
      alert(lang === "ar" ? "من فضلك اكتب نص الإشعار." : "Please write a message.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title: lang === "ar" ? "إشعار جديد" : "New Notification",
        body: message.trim(),
        targetId: target === "all" ? "all" : String(target),
        timestamp: serverTimestamp(),
        pushAt: scheduleAt ? new Date(scheduleAt) : serverTimestamp(),
        type: target === "all" ? "general" : "custom",
        status: "queued",
        pushed: false,
        attempts: 0,
        lastError: null,
        priority: priority || "high",
        data: {},
      };
      if (target !== "all") {
        const userRef = doc(db, "users", target);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const tokens = [];
          if (userData?.expoPushToken) tokens.push(userData.expoPushToken);
          if (Array.isArray(userData?.expoPushTokens)) tokens.push(...userData.expoPushTokens);
          if (tokens.length) payload.tokens = tokens;
        }
      }
      await addDoc(collection(db, "notifications"), payload);
      setMessage("");
      setTarget("all");
      setScheduleAt("");
      setPriority("high");
      alert(lang === "ar" ? "تمت إضافة الإشعار إلى قائمة الانتظار." : "Notification queued.");
    } catch (e) {
      console.error(e);
      alert(lang === "ar" ? "فشل إضافة الإشعار." : "Failed to queue notification.");
    } finally {
      setLoading(false);
    }
  }

  const filteredNotifications = useMemo(() => {
    const search = notifSearch.trim().toLowerCase();
    return notifications.filter((n) => {
      if (notifTypeFilter !== "all" && n.type !== notifTypeFilter) return false;
      if (!search) return true;
      const client = clientsMap.get(n.targetId || "");
      const name = (client?.name || "").toLowerCase();
      const phone = client?.phone || "";
      return (n.body || "").toLowerCase().includes(search) || name.includes(search) || phone.includes(search);
    });
  }, [notifications, notifTypeFilter, notifSearch, clientsMap]);

  const filteredClients = useMemo(() => {
    const search = clientSearch.trim().toLowerCase();
    if (!search) return clients;
    return clients.filter((c) => {
      return (
        (c.name && c.name.toLowerCase().includes(search)) ||
        (c.phone && c.phone.includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search))
      );
    });
  }, [clients, clientSearch]);

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 md:px-6 text-sm">
      {/* Compact form (no big title) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendNotification();
        }}
        className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-2 md:p-3 flex flex-col md:flex-row gap-2 md:items-center"
      >
        <textarea
          className="w-full md:w-96 min-h-[44px] p-2 rounded-md border border-slate-200 focus:ring-1 focus:ring-emerald-500 text-sm"
          placeholder={lang === "ar" ? "اكتب نص الإشعار..." : "Write notification message..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          aria-label={lang === "ar" ? "نص الإشعار" : "Notification message"}
        />
        <select
          className="p-2 rounded-md border border-slate-200 bg-white text-sm min-w-[160px]"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          title={lang === "ar" ? "المستلم" : "Recipient"}
        >
          <option value="all">{lang === "ar" ? "كل العملاء" : "All Clients"}</option>
          {clients.map((cl) => (
            <option value={cl.userId} key={cl.userId}>
              {(cl.name || cl.userId) + (cl.phone ? ` (${cl.phone})` : "")}
            </option>
          ))}
        </select>

        <div className="flex gap-2 items-center">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="p-2 rounded-md border border-slate-200 bg-white text-sm"
            title={lang === "ar" ? "الأولوية" : "Priority"}
          >
            <option value="high">{lang === "ar" ? "عالية" : "High"}</option>
            <option value="normal">{lang === "ar" ? "عادية" : "Normal"}</option>
          </select>

          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="p-2 rounded-md border border-slate-200 bg-white text-sm"
            title={lang === "ar" ? "موعد الإرسال" : "Schedule send time"}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm shadow transition"
        >
          {loading ? (lang === "ar" ? "جارٍ الإرسال..." : "Sending...") : (lang === "ar" ? "إرسال إشعار" : "Send Notification")}
        </button>
      </form>

      {/* Filters row (compact) */}
      <div className="flex flex-col md:flex-row gap-2 items-center mt-4 mb-3">
        <div className="flex gap-1">
          {["all", "general", "custom"].map((k) => (
            <button
              key={k}
              className={`px-2 py-1 rounded-md text-sm font-medium ${notifTypeFilter === k ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800 border border-emerald-200"}`}
              onClick={() => setNotifTypeFilter(k)}
            >
              {k === "all" ? (lang === "ar" ? "الكل" : "All") : k === "general" ? (lang === "ar" ? "عام" : "General") : (lang === "ar" ? "مخصص" : "Custom")}
            </button>
          ))}
        </div>
        <input
          className="flex-1 p-2 rounded-md border border-slate-200 text-sm"
          placeholder={lang === "ar" ? "بحث في الإشعارات أو العملاء..." : "Search notifications or clients..."}
          value={notifSearch}
          onChange={(e) => setNotifSearch(e.target.value)}
        />
      </div>

      {/* Notifications Table (compact sizes) */}
      <div className="rounded-xl bg-white shadow border border-slate-200 overflow-x-auto">
        <table className="w-full text-center border-separate border-spacing-0 text-sm">
          <thead className="bg-emerald-50 text-emerald-900">
            <tr>
              <th className="py-2 px-2 font-semibold text-left">{lang === "ar" ? "النص" : "Message"}</th>
              <th className="py-2 px-2 font-semibold">{lang === "ar" ? "النوع" : "Type"}</th>
              <th className="py-2 px-2 font-semibold">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="py-2 px-2 font-semibold">{lang === "ar" ? "إلى" : "To"}</th>
              <th className="py-2 px-2 font-semibold">{lang === "ar" ? "التاريخ" : "Date"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredNotifications.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-slate-400">{lang === "ar" ? "لا يوجد إشعارات" : "No notifications"}</td>
              </tr>
            ) : (
              filteredNotifications.map((n) => (
                <tr key={n.id} className="border-b last:border-b-0 hover:bg-emerald-50/30">
                  <td className="py-2 px-2 text-left max-w-[480px] break-words text-sm">{n.body}</td>
                  <td className="py-2 px-2">
                    <Badge intent={n.type === "general" ? "success" : "default"}>
                      {n.type === "general" ? (lang === "ar" ? "عام" : "General") : (lang === "ar" ? "مخصص" : "Custom")}
                    </Badge>
                  </td>
                  <td className="py-2 px-2">
                    {n.status === "sent" && <Badge intent="success">{lang === "ar" ? "مرسَل" : "sent"}</Badge>}
                    {n.status === "queued" && <Badge intent="warn">{lang === "ar" ? "قيد الانتظار" : "queued"}</Badge>}
                    {n.status === "sending" && <Badge intent="muted">{lang === "ar" ? "جاري الإرسال" : "sending"}</Badge>}
                    {n.status === "no_tokens" && <Badge intent="muted">{lang === "ar" ? "لا يوجد توكنات" : "no_tokens"}</Badge>}
                    {n.status === "failed" && <Badge intent="error">{lang === "ar" ? "فشل" : "failed"}</Badge>}
                    {!n.status && <Badge>—</Badge>}
                  </td>
                  <td className="py-2 px-2 text-sm">
                    {n.targetId === "all" ? (
                      <span className="font-medium text-slate-700">{lang === "ar" ? "كل العملاء" : "All Clients"}</span>
                    ) : (
                      (() => {
                        const t = clientsMap.get(n.targetId || "");
                        return t ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-medium">{t.name || t.userId}</span>
                            <ClientActions client={t} lang={lang} />
                          </span>
                        ) : (
                          <span>{n.targetId}</span>
                        );
                      })()
                    )}
                  </td>
                  <td className="py-2 px-2 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(n.timestamp, lang)}
                    {n.sentAt ? <div className="text-[10px] text-slate-400">{lang === "ar" ? "أُرسل: " : "sentAt: "}{formatDate(n.sentAt, lang)}</div> : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clients (compact cards) */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-emerald-800">{lang === "ar" ? "العملاء" : "Clients"}</span>
          <input
            className="p-2 rounded-md border border-slate-200 min-w-[140px] text-sm"
            placeholder={lang === "ar" ? "بحث بالاسم أو الهاتف أو الإيميل..." : "Search by name, phone or email..."}
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredClients.length === 0 ? (
            <div className="text-slate-400 text-center col-span-2 py-4">{lang === "ar" ? "لا يوجد عملاء" : "No clients found"}</div>
          ) : (
            filteredClients.map((client) => (
              <div key={client.userId} className="flex items-center justify-between bg-emerald-50 p-3 rounded-lg border border-emerald-200 shadow-sm">
                <div>
                  <div className="font-medium text-slate-900 text-sm">{client.name || client.userId}</div>
                  <div className="text-xs text-slate-600">{client.phone}{client.email ? ` | ${client.email}` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <ClientActions client={client} lang={lang} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}