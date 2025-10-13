"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { firestore as db } from "@/lib/firebase.client";

// =============== Helpers ===============
function formatDate(ts, lang = "ar") {
  const d = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts || Date.now());
  return d.toLocaleString(lang === "ar" ? "ar-AE" : "en-US", { timeZone: "Asia/Dubai" });
}

function toE164(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (String(raw).startsWith("+")) return `+${digits}`;
  if (digits.startsWith("971")) return `+${digits}`;
  return `+971${digits}`; // fallback لو مفيش كود دولة
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
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${map[intent || "default"]}`}>
      {children}
    </span>
  );
}

function ClientActions({ client, lang }) {
  if (!client) return null;
  const phone = toE164(client.phone);
  const msg = encodeURIComponent(
    lang === "ar"
      ? "مرحباً، لديك إشعار جديد من منصة تأهيل."
      : "Hello, you have a new notification from Taheel."
  );
  const subject = encodeURIComponent(lang === "ar" ? "إشعار جديد" : "New Notification");
  return (
    <span className="flex gap-2 ml-1">
      {phone ? (
        <a
          href={`https://wa.me/${phone.replace("+", "")}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          className="hover:bg-emerald-50 rounded-full p-1 transition text-emerald-700"
        >
          <span role="img" aria-label="WhatsApp" className="text-xl">📱</span>
        </a>
      ) : null}
      {client.email ? (
        <a
          href={`mailto:${client.email}?subject=${subject}&body=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Email"
          className="hover:bg-sky-50 rounded-full p-1 transition text-sky-700"
        >
          <span role="img" aria-label="Email" className="text-xl">✉️</span>
        </a>
      ) : null}
    </span>
  );
}

// =============== Main ===============
export default function NotificationsSection({ lang = "ar" }) {
  const [notifications, setNotifications] = useState([]);
  const [clients, setClients] = useState([]);
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [loading, setLoading] = useState(false);

  // Filters
  const [notifTypeFilter, setNotifTypeFilter] = useState("all"); // "all" | "general" | "custom"
  const [notifSearch, setNotifSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  // ===== Live Firestore Streams =====
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

  // ===== Send Notification =====
  async function sendNotification() {
    if (!message.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "notifications"), {
        title: lang === "ar" ? "إشعار جديد" : "New Notification",
        body: message.trim(),
        targetId: target === "all" ? "all" : String(target),
        timestamp: serverTimestamp(),
        type: target === "all" ? "general" : "custom",
        status: "queued", // هتبقي sent/error بعد ما نضيف الـ Cloud Function
      });
      setMessage("");
      setTarget("all");
    } catch (e) {
      console.error(e);
      alert(lang === "ar" ? "فشل إرسال الإشعار." : "Failed to send notification.");
    } finally {
      setLoading(false);
    }
  }

  // ===== Filtering =====
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

  // ===== UI =====
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 md:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-800">
            {lang === "ar" ? "لوحة الإشعارات" : "Notifications Dashboard"}
          </h1>
          <p className="text-sm text-slate-500">
            {lang === "ar" ? "أرسل إشعارًا فورياً وراجع السجل لحظيًا." : "Send instant notifications and review the live log."}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendNotification();
          }}
          className="w-full md:w-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-3 md:p-4 flex flex-col md:flex-row gap-2 md:items-center"
        >
          <textarea
            className="w-full md:w-96 min-h-[48px] p-2 rounded-lg border border-slate-300 focus:outline-emerald-600/70 text-slate-900"
            placeholder={lang === "ar" ? "اكتب نص الإشعار..." : "Write notification message..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
          />
          <select
            className="p-2 rounded-lg border border-slate-300 bg-white text-slate-900 min-w-[200px]"
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
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow transition min-w-[140px]"
          >
            {loading ? (lang === "ar" ? "جارٍ الإرسال..." : "Sending...") : (lang === "ar" ? "إرسال إشعار" : "Send Notification")}
          </button>
        </form>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-7 md:items-center">
        <div className="flex gap-2">
          {["all", "general", "custom"].map((k) => (
            <button
              key={k}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                notifTypeFilter === k ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
              }`}
              onClick={() => setNotifTypeFilter(k)}
            >
              {k === "all" ? (lang === "ar" ? "الكل" : "All") : k === "general" ? (lang === "ar" ? "عام" : "General") : (lang === "ar" ? "مخصص" : "Custom")}
            </button>
          ))}
        </div>
        <input
          className="flex-1 p-2 rounded-lg border border-slate-300 min-w-[220px] max-w-sm"
          placeholder={lang === "ar" ? "بحث في الإشعارات أو العملاء..." : "Search notifications or clients..."}
          value={notifSearch}
          onChange={(e) => setNotifSearch(e.target.value)}
        />
      </div>

      {/* Notifications Table */}
      <div className="rounded-2xl bg-white shadow border border-slate-200 overflow-x-auto">
        <table className="w-full text-center border-separate border-spacing-0">
          <thead className="bg-emerald-50 text-emerald-900 sticky top-0 z-10">
            <tr>
              <th className="py-3 px-3 font-bold text-left">{lang === "ar" ? "النص" : "Message"}</th>
              <th className="py-3 px-2 font-bold">{lang === "ar" ? "النوع" : "Type"}</th>
              <th className="py-3 px-2 font-bold">{lang === "ar" ? "الحالة" : "Status"}</th>
              <th className="py-3 px-2 font-bold">{lang === "ar" ? "إلى" : "To"}</th>
              <th className="py-3 px-2 font-bold">{lang === "ar" ? "التاريخ" : "Date"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredNotifications.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-9 text-slate-400 text-lg">
                  {lang === "ar" ? "لا يوجد إشعارات" : "No notifications"}
                </td>
              </tr>
            ) : (
              filteredNotifications.map((n) => (
                <tr key={n.id} className="border-b hover:bg-emerald-50/40 transition">
                  <td className="py-3 px-3 text-slate-900 text-left max-w-[520px] break-words">{n.body}</td>
                  <td className="py-3 px-2">
                    <Badge intent={n.type === "general" ? "success" : "default"}>
                      {n.type === "general" ? (lang === "ar" ? "عام" : "General") : (lang === "ar" ? "مخصص" : "Custom")}
                    </Badge>
                  </td>
                  <td className="py-3 px-2">
                    {n.status === "sent" && <Badge intent="success">sent</Badge>}
                    {n.status === "queued" && <Badge intent="warn">queued</Badge>}
                    {n.status === "no_tokens" && <Badge intent="muted">no_tokens</Badge>}
                    {n.status === "error" && <Badge intent="error">error</Badge>}
                    {!n.status && <Badge>—</Badge>}
                  </td>
                  <td className="py-3 px-2 text-slate-900">
                    {n.targetId === "all" ? (
                      <span className="font-semibold text-slate-700">{lang === "ar" ? "كل العملاء" : "All Clients"}</span>
                    ) : (
                      (() => {
                        const t = clientsMap.get(n.targetId || "");
                        return t ? (
                          <span className="inline-flex items-center justify-center gap-1">
                            <span className="font-semibold">{t.name || t.userId}</span>
                            <ClientActions client={t} lang={lang} />
                          </span>
                        ) : (
                          <span>{n.targetId}</span>
                        );
                      })()
                    )}
                  </td>
                  <td className="py-3 px-2 text-slate-500 text-xs whitespace-nowrap">{formatDate(n.timestamp, lang)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clients */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-semibold text-emerald-800">{lang === "ar" ? "العملاء" : "Clients"}</span>
          <input
            className="p-2 rounded-lg border border-slate-300 min-w-[180px]"
            placeholder={lang === "ar" ? "بحث بالاسم أو الهاتف أو الإيميل..." : "Search by name, phone or email..."}
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.length === 0 ? (
            <div className="text-slate-400 text-center col-span-2 py-8">
              {lang === "ar" ? "لا يوجد عملاء" : "No clients found"}
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.userId}
                className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm hover:shadow-md transition"
              >
                <div>
                  <div className="font-bold text-slate-900">{client.name || client.userId}</div>
                  <div className="text-sm text-slate-600">
                    {client.phone}{client.email ? ` | ${client.email}` : ""}
                  </div>
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
