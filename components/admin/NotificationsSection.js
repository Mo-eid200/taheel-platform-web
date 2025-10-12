"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { firestore as db } from "@/lib/firebase.client";

// Format date helper
function formatDate(ts, lang = "ar") {
  if (!ts) return "";
  if (typeof ts.toDate === "function") return ts.toDate().toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
  if (typeof ts === "number" || typeof ts === "string") return new Date(ts).toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
  return "";
}

// WhatsApp & Email action buttons
function ClientActions({ client, lang }) {
  if (!client) return null;
  const phone = client.phone?.replace(/^0/, "+2");
  const msg = encodeURIComponent(lang === "ar" ? "مرحباً، لديك إشعار جديد من النظام." : "Hello, you have a new notification from the system.");
  const subject = encodeURIComponent(lang === "ar" ? "إشعار جديد" : "New Notification");
  return (
    <span className="flex gap-2 ml-1">
      {phone && (
        <a
          href={`https://wa.me/${phone}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          className="text-green-600 hover:bg-green-100 rounded-full p-1 transition"
        >
          <span role="img" aria-label="WhatsApp" className="text-xl">📱</span>
        </a>
      )}
      {client.email && (
        <a
          href={`mailto:${client.email}?subject=${subject}&body=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Email"
          className="text-blue-600 hover:bg-blue-100 rounded-full p-1 transition"
        >
          <span role="img" aria-label="Email" className="text-xl">✉️</span>
        </a>
      )}
    </span>
  );
}

export default function NotificationsSection({ lang = "ar" }) {
  const [notifications, setNotifications] = useState([]);
  const [clients, setClients] = useState([]);
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [notifTypeFilter, setNotifTypeFilter] = useState("all");
  const [notifSearch, setNotifSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  // Fetch notifications/clients
  useEffect(() => {
    async function fetchData() {
      const notifSnap = await getDocs(collection(db, "notifications"));
      const notifs = [];
      notifSnap.forEach(doc => notifs.push({ ...doc.data(), id: doc.id }));
      setNotifications(
        notifs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
      );
      const usersSnap = await getDocs(collection(db, "users"));
      const users = [];
      usersSnap.forEach(doc => users.push({ ...doc.data(), userId: doc.id }));
      setClients(users);
    }
    fetchData();
  }, []);

  // Send notification (internal & triggers push if backend/cloud function is set up)
  async function sendNotification() {
    if (!message) return;
    setLoading(true);
    await addDoc(collection(db, "notifications"), {
      title: lang === "ar" ? "إشعار جديد" : "New Notification",
      body: message,
      targetId: target === "all" ? "all" : target,
      timestamp: serverTimestamp(),
      type: target === "all" ? "general" : "custom"
    });
    setMessage("");
    setTarget("all");
    setLoading(false);
    // Refresh list
    const notifSnap = await getDocs(collection(db, "notifications"));
    const notifs = [];
    notifSnap.forEach(doc => notifs.push({ ...doc.data(), id: doc.id }));
    setNotifications(
      notifs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
    );
  }

  // Filtered notifications
  const filteredNotifications = notifications.filter(n => {
    if (notifTypeFilter !== "all" && n.type !== notifTypeFilter) return false;
    if (!notifSearch.trim()) return true;
    const client = clients.find(c => c.userId === n.targetId);
    const name = client?.name || "";
    const phone = client?.phone || "";
    const searchText = notifSearch.toLowerCase();
    return (n.body?.toLowerCase().includes(searchText))
      || (name.toLowerCase().includes(searchText))
      || (phone.includes(searchText));
  });

  // Filtered clients
  const filteredClients = clients.filter(c => {
    if (!clientSearch.trim()) return true;
    const searchText = clientSearch.toLowerCase();
    return (c.name && c.name.toLowerCase().includes(searchText))
      || (c.phone && c.phone.includes(searchText))
      || (c.email && c.email.toLowerCase().includes(searchText));
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 md:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div className="text-3xl font-extrabold text-yellow-800 tracking-tight">
          {lang === "ar" ? "لوحة الإشعارات" : "Notifications Dashboard"}
        </div>
        <form
          onSubmit={e => { e.preventDefault(); sendNotification(); }}
          className="flex flex-col md:flex-row gap-2 items-center bg-yellow-50 rounded-lg px-4 py-3 shadow w-full md:w-auto"
        >
          <textarea
            className="w-full md:w-64 p-2 rounded border border-yellow-300 focus:outline-yellow-400 text-gray-900"
            placeholder={lang === "ar" ? "اكتب نص الإشعار..." : "Write notification message..."}
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={1}
            style={{ minHeight: 36 }}
          />
          <select
            className="p-2 rounded border border-yellow-300 bg-white text-gray-900"
            value={target}
            onChange={e => setTarget(e.target.value)}
          >
            <option value="all">{lang === "ar" ? "كل العملاء" : "All Clients"}</option>
            {clients.map(cl => (
              <option value={cl.userId} key={cl.userId}>
                {cl.name} ({cl.phone})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !message}
            className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 text-white font-bold shadow min-w-[120px] transition"
          >
            {loading ? (lang === "ar" ? "جارٍ الإرسال..." : "Sending...") : (lang === "ar" ? "إرسال إشعار" : "Send Notification")}
          </button>
        </form>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-7 items-center">
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${notifTypeFilter === "all" ? "bg-yellow-700 text-white" : "bg-yellow-100 text-yellow-800 border border-yellow-300"}`}
            onClick={() => setNotifTypeFilter("all")}
          >{lang === "ar" ? "الكل" : "All"}</button>
          <button
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${notifTypeFilter === "general" ? "bg-yellow-700 text-white" : "bg-yellow-100 text-yellow-800 border border-yellow-300"}`}
            onClick={() => setNotifTypeFilter("general")}
          >{lang === "ar" ? "عام" : "General"}</button>
          <button
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${notifTypeFilter === "custom" ? "bg-yellow-700 text-white" : "bg-yellow-100 text-yellow-800 border border-yellow-300"}`}
            onClick={() => setNotifTypeFilter("custom")}
          >{lang === "ar" ? "مخصص" : "Custom"}</button>
        </div>
        <input
          className="flex-1 p-2 rounded border border-yellow-300 min-w-[200px] max-w-xs"
          placeholder={lang === "ar" ? "بحث في الإشعارات أو العملاء..." : "Search notifications or clients..."}
          value={notifSearch}
          onChange={e => setNotifSearch(e.target.value)}
        />
      </div>

      {/* Notifications Table */}
      <div className="rounded-xl bg-white shadow mb-10 overflow-x-auto">
        <table className="w-full text-center border-separate border-spacing-0">
          <thead className="bg-yellow-100 text-yellow-900 sticky top-0 z-10">
            <tr>
              <th className="py-3 px-2 font-bold">{lang === "ar" ? "النص" : "Message"}</th>
              <th className="py-3 px-2 font-bold">{lang === "ar" ? "النوع" : "Type"}</th>
              <th className="py-3 px-2 font-bold">{lang === "ar" ? "إلى" : "To"}</th>
              <th className="py-3 px-2 font-bold">{lang === "ar" ? "التاريخ" : "Date"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredNotifications.length === 0 && (
              <tr>
                <td colSpan={4} className="py-9 text-gray-400 text-lg">{lang === "ar" ? "لا يوجد إشعارات" : "No notifications"}</td>
              </tr>
            )}
            {filteredNotifications.map(n => (
              <tr key={n.id} className="border-b hover:bg-yellow-50 transition">
                <td className="py-2 px-2 text-gray-900 text-left max-w-[320px] break-words">{n.body}</td>
                <td className="py-2 px-2">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold
                    ${n.type === "general" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                    {n.type === "general" ? (lang === "ar" ? "عام" : "General") : (lang === "ar" ? "مخصص" : "Custom")}
                  </span>
                </td>
                <td className="py-2 px-2 text-gray-900">
                  {n.targetId === "all"
                    ? <span className="font-semibold text-slate-700">{lang === "ar" ? "كل العملاء" : "All Clients"}</span>
                    : (() => {
                      const t = clients.find(c => c.userId === n.targetId);
                      return t
                        ? <span className="flex items-center justify-center gap-1">
                            <span className="font-semibold">{t.name}</span>
                            <ClientActions client={t} lang={lang} />
                          </span>
                        : n.targetId;
                    })()
                  }
                </td>
                <td className="py-2 px-2 text-gray-500 text-xs whitespace-nowrap">{formatDate(n.timestamp, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Clients Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-semibold text-yellow-700">{lang === "ar" ? "العملاء" : "Clients"}</span>
          <input
            className="p-1.5 rounded border border-yellow-300 min-w-[150px]"
            placeholder={lang === "ar" ? "بحث بالاسم أو الهاتف أو الإيميل..." : "Search by name, phone or email..."}
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
            style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map(client => (
            <div key={client.userId} className="flex items-center justify-between bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm hover:shadow-md transition">
              <div>
                <div className="font-bold text-gray-900">{client.name}</div>
                <div className="text-sm text-gray-600">{client.phone} | {client.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <ClientActions client={client} lang={lang} />
              </div>
            </div>
          ))}
          {filteredClients.length === 0 && (
            <div className="text-gray-400 text-center col-span-2 py-8">{lang === "ar" ? "لا يوجد عملاء" : "No clients found"}</div>
          )}
        </div>
      </div>
    </div>
  );
}