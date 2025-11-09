import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
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

/* =========================
   Helpers
========================= */
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

function humanType(t, lang = "ar") {
  if (t === "company") return lang === "ar" ? "شركة" : "Company";
  if (t === "resident") return lang === "ar" ? "مقيم" : "Resident";
  if (t === "nonresident") return lang === "ar" ? "غير مقيم" : "Non-resident";
  return "-";
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
  const phone = toE164(client.phone || client.phoneE164);
  const msg = encodeURIComponent(
    lang === "ar" ? "مرحباً، لديك إشعار جديد من منصة تأهيل." : "Hello, you have a new notification from Taheel."
  );
  const subject = encodeURIComponent(lang === "ar" ? "إشعار جديد" : "New Notification");
  return (
    <span className="flex gap-2 ml-1 text-sm">
      {phone ? (
        <a
          href={`https://wa.me/${phone.replace("+", "")}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          className="hover:bg-emerald-50 rounded-md p-1 transition text-emerald-700 cursor-pointer"
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
          className="hover:bg-sky-50 rounded-md p-1 transition text-sky-700 cursor-pointer"
        >
          ✉️
        </a>
      ) : null}
    </span>
  );
}

/* اسم + #رقم العميل + الهاتف (للاستخدام في الـ <option>) */
function clientLabel(c) {
  const name = c?.name || c?.displayName || c?.userId || "-";
  const cid = c?.customerId ? `#${c.customerId}` : (c?.userId ? `#${c.userId}` : "");
  const phone = toE164(c?.phone || c?.phoneE164);
  return `${name} — ${cid}${phone ? ` • ${phone}` : ""}`;
}

/* =========================
   Main compact control panel
========================= */
export default function NotificationsSection({ lang = "ar" }) {
  const [notifications, setNotifications] = useState([]);
  const [clients, setClients] = useState([]);
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [loading, setLoading] = useState(false);

  const [notifTypeFilter, setNotifTypeFilter] = useState("all");
  const [notifSearch, setNotifSearch] = useState("");

  const [clientSearch, setClientSearch] = useState("");
  const [clientTypeTab, setClientTypeTab] = useState("all");

  const [scheduleAt, setScheduleAt] = useState("");
  const [priority, setPriority] = useState("high"); // default high
  const [targetTokenCount, setTargetTokenCount] = useState(null);

  // Load notifications + clients
  useEffect(() => {
    const qNotifs = query(
      collection(db, "notifications"),
      orderBy("timestamp", "desc"),
      limit(300)
    );
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

  // -------- Tokens Reader (fixed): read from BOTH expoPushTokens & pushTokens + root fallbacks --------
  async function getActiveTokensForUser(userDocId) {
    const tokens = [];

    // 1) expoPushTokens
    try {
      const q1 = query(
        collection(db, "users", userDocId, "expoPushTokens"),
        where("active", "==", true)
      );
      const s1 = await getDocs(q1);
      s1.forEach((d) => {
        const v = d.data() || {};
        // لو موجود ownerDocId، فلتره يساوي نفس المستخدم الحالي
        if (v?.token && (v.ownerDocId ? v.ownerDocId === userDocId : true)) {
          tokens.push(v.token);
        }
      });
    } catch {}

    // 2) pushTokens (compat)
    try {
      const q2 = query(
        collection(db, "users", userDocId, "pushTokens"),
        where("active", "==", true)
      );
      const s2 = await getDocs(q2);
      s2.forEach((d) => {
        const v = d.data() || {};
        if (v?.token && (v.ownerDocId ? v.ownerDocId === userDocId : true)) {
          tokens.push(v.token);
        }
      });
    } catch {}

    // 3) root fallbacks (قديم)
    try {
      const userSnap = await getDoc(doc(db, "users", userDocId));
      if (userSnap.exists()) {
        const u = userSnap.data() || {};
        if (u?.expoPushToken) tokens.push(u.expoPushToken);
        if (Array.isArray(u?.expoPushTokens)) {
          u.expoPushTokens.forEach((t) => t && tokens.push(t));
        }
      }
    } catch {}

    // unique + نظّف القيم الفارغة
    return Array.from(new Set(tokens.filter(Boolean)));
  }

  // لمجرد عرض عدد التوكنات للمستهدف الحالي (UI hint)
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!target || target === "all") {
        setTargetTokenCount(null);
        return;
      }
      const toks = await getActiveTokensForUser(String(target));
      if (!cancelled) setTargetTokenCount(toks.length);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [target]);

  async function sendNotification() {
    if (!message.trim()) {
      alert(lang === "ar" ? "من فضلك اكتب نص الإشعار." : "Please write a message.");
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      const pushAtValue = scheduleAt
        ? Timestamp.fromDate(new Date(scheduleAt))
        : Timestamp.fromDate(now); // نخزن pushAt واضح حتى في الإرسال الفوري

      const payload = {
        title: lang === "ar" ? "إشعار جديد" : "New Notification",
        body: message.trim(),
        targetId: target === "all" ? "all" : String(target),
        timestamp: serverTimestamp(), // لإنشاء السجلّ بوقت السيرفر
        pushAt: pushAtValue,          // الوقت المقصود للإرسال (فوري أو مجدول)
        type: target === "all" ? "general" : "custom",
        status: "queued",
        pushed: false,
        attempts: 0,
        lastError: null,
        priority: priority || "high",
        data: {},
      };

      if (target !== "all") {
        const tokens = await getActiveTokensForUser(String(target));
        if (tokens?.length) {
          payload.tokens = tokens;
        } else {
          payload.status = "no_tokens";
        }
      }

      await addDoc(collection(db, "notifications"), payload);

      setMessage("");
      setTarget("all");
      setScheduleAt("");
      setPriority("high");
      setTargetTokenCount(null);

      alert(lang === "ar" ? "تمت إضافة الإشعار إلى قائمة الانتظار." : "Notification queued.");
    } catch (e) {
      console.error(e);
      alert(lang === "ar" ? "فشل إضافة الإشعار." : "Failed to queue notification.");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     Filters / Searches
  ========================= */
  const filteredNotifications = useMemo(() => {
    const search = notifSearch.trim().toLowerCase();
    return notifications.filter((n) => {
      if (notifTypeFilter !== "all" && n.type !== notifTypeFilter) return false;
      if (!search) return true;
      const client = clientsMap.get(n.targetId || "");
      const name = (client?.name || client?.displayName || "").toLowerCase();
      const phone = client?.phone || client?.phoneE164 || "";
      const cid = (client?.customerId || "").toLowerCase();
      return (
        (n.body || "").toLowerCase().includes(search) ||
        name.includes(search) ||
        String(phone).includes(search) ||
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

  /* =========================
     UI
  ========================= */
  return (
    <div className="max-w-5xl mx-auto py-6 px-3 md:px-6 text-sm text-slate-900">
      {/* Compose / Queue */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendNotification();
        }}
        className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4 flex flex-col md:flex-row gap-3 md:items-center"
      >
        <textarea
          className="w-full md:w-96 min-h-[48px] p-2 rounded-md border border-slate-200 focus:ring-1 focus:ring-emerald-500 text-sm text-slate-900"
          placeholder={lang === "ar" ? "اكتب نص الإشعار..." : "Write notification message..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          aria-label={lang === "ar" ? "نص الإشعار" : "Notification message"}
        />

        <div className="flex flex-col gap-1">
          <select
            className="p-2 rounded-md border border-slate-200 bg-white text-sm min-w-[260px] cursor-pointer"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            title={lang === "ar" ? "المستلم" : "Recipient"}
          >
            <option value="all">{lang === "ar" ? "كل العملاء" : "All Clients"}</option>
            {clients.map((cl) => (
              <option value={cl.userId} key={cl.userId}>
                {clientLabel(cl)}
              </option>
            ))}
          </select>

          {target !== "all" && (
            <div className="text-xs text-slate-500">
              {lang === "ar"
                ? `توكنات نشطة: ${targetTokenCount === null ? "..." : targetTokenCount}`
                : `Active tokens: ${targetTokenCount === null ? "..." : targetTokenCount}`}
            </div>
          )}
        </div>

        <div className="flex gap-2 items-center flex-1 flex-wrap">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="p-2 rounded-md border border-slate-200 bg-white text-sm cursor-pointer"
            title={lang === "ar" ? "الأولوية" : "Priority"}
          >
            <option value="high">{lang === "ar" ? "عالية" : "High"}</option>
            <option value="normal">{lang === "ar" ? "عادية" : "Normal"}</option>
          </select>

          <div className="text-xs text-slate-500">
            {priority === "high"
              ? (lang === "ar" ? "عالية — تصل فورًا وبأولوية." : "High — delivered immediately with priority.")
              : (lang === "ar" ? "عادية — تصل طبيعيًا." : "Normal — delivered normally.")}
          </div>

          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="p-2 rounded-md border border-slate-200 bg-white text-sm cursor-pointer"
            title={lang === "ar" ? "موعد الإرسال" : "Schedule send time"}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm shadow transition cursor-pointer"
        >
          {loading ? (lang === "ar" ? "جارٍ الإرسال..." : "Sending...") : (lang === "ar" ? "إرسال إشعار" : "Send Notification")}
        </button>
      </form>

      {/* Notifications filter row */}
      <div className="flex flex-col md:flex-row gap-2 items-center mt-4 mb-3">
        <div className="flex gap-1">
          {["all", "general", "custom"].map((k) => (
            <button
              key={k}
              className={`px-2 py-1 rounded-md text-sm font-medium ${
                notifTypeFilter === k
                  ? "bg-emerald-700 text-white"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
              } cursor-pointer`}
              onClick={() => setNotifTypeFilter(k)}
            >
              {k === "all"
                ? (lang === "ar" ? "الكل" : "All")
                : k === "general"
                ? (lang === "ar" ? "عام" : "General")
                : (lang === "ar" ? "مخصص" : "Custom")}
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

      {/* Notifications Table */}
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
                <td colSpan={5} className="py-6 text-slate-400">
                  {lang === "ar" ? "لا يوجد إشعارات" : "No notifications"}
                </td>
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
                      <span className="font-medium text-slate-700">
                        {lang === "ar" ? "كل العملاء" : "All Clients"}
                      </span>
                    ) : (
                      (() => {
                        const t = clientsMap.get(n.targetId || "");
                        return t ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-medium">{t.name || t.displayName || t.userId}</span>
                            <span className="text-xs text-slate-500 font-mono">#{t.customerId || t.userId}</span>
                            <Badge intent="muted">{humanType(t.accountType, lang)}</Badge>
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
                    {n.pushAt && n.pushAt !== n.timestamp ? (
                      <div className="text-[10px] text-slate-400">
                        {lang === "ar" ? "مجدول لِـ " : "Scheduled for "} {formatDate(n.pushAt, lang)}
                      </div>
                    ) : null}
                    {n.sentAt ? (
                      <div className="text-[10px] text-slate-400">
                        {lang === "ar" ? "أُرسل: " : "sentAt: "}
                        {formatDate(n.sentAt, lang)}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clients header: tabs + search */}
      <div className="mt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
          <div className="flex gap-1">
            {[
              { k: "all", label: lang === "ar" ? "الكل" : "All" },
              { k: "resident", label: lang === "ar" ? "مقيم" : "Resident" },
              { k: "nonresident", label: lang === "ar" ? "غير مقيم" : "Non-resident" },
              { k: "company", label: lang === "ar" ? "شركة" : "Company" },
            ].map((t) => (
              <button
                key={t.k}
                className={`px-2 py-1 rounded-md text-sm font-medium ${
                  clientTypeTab === t.k
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                } cursor-pointer`}
                onClick={() => setClientTypeTab(t.k)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            className="p-2 rounded-md border border-slate-200 min-w-[220px] text-sm"
            placeholder={
              lang === "ar"
                ? "بحث بالاسم / الهاتف / الإيميل / رقم العميل..."
                : "Search name / phone / email / customerId..."
            }
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
          />
        </div>

        {/* Clients grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredClients.length === 0 ? (
            <div className="text-slate-400 text-center col-span-2 py-4">
              {lang === "ar" ? "لا يوجد عملاء" : "No clients found"}
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.userId}
                className="flex items-center justify-between bg-emerald-50 p-3 rounded-lg border border-emerald-200 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-slate-900 text-sm">
                      {client.name || client.displayName || client.userId}
                      <span className="ml-2 text-xs text-slate-500 font-mono">
                        #{client.customerId || client.userId}
                      </span>
                    </div>
                    <Badge intent="muted">{humanType(client.accountType, lang)}</Badge>
                  </div>
                  <div className="text-xs text-slate-600">
                    {toE164(client.phone || client.phoneE164) || "-"}
                    {client.email ? ` | ${client.email}` : ""}
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
