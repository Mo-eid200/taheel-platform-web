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

/* =========================
   Helpers / Localization
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

function humanType(t, lang = DEFAULT_LANG) {
  if (t === "company") return lang === "ar" ? "شركة" : "Company";
  if (t === "resident") return lang === "ar" ? "مقيم" : "Resident";
  if (t === "nonresident") return lang === "ar" ? "غير مقيم" : "Non-resident";
  return "-";
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

function clientLabel(c) {
  const name = c?.name || c?.displayName || c?.userId || "-";
  const cid = c?.customerId ? `#${c.customerId}` : c?.userId ? `#${c.userId}` : "";
  const phone = toE164(c?.phone || c?.phoneE164);
  const uid = c?.uid ? ` uid:${c.uid}` : "";
  return `${name} ${cid}${phone ? ` • ${phone}` : ""}${uid ? ` • ${uid}` : ""}`;
}

/* =========================
   Component
========================= */
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

  // Filters & UI
  const [notifTypeFilter, setNotifTypeFilter] = useState("all");
  const [notifSearch, setNotifSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientTypeTab, setClientTypeTab] = useState("all");

  // Token hints / preview
  const [targetTokenCount, setTargetTokenCount] = useState(null);
  const [resolvingTokens, setResolvingTokens] = useState(false);
  const [tokenPreviewOpen, setTokenPreviewOpen] = useState(false);
  const [tokenPreviewList, setTokenPreviewList] = useState([]);

  // Debug selection
  const [selectedClientInfo, setSelectedClientInfo] = useState(null);

  // Pending counter per user (from collectionGroup)
  const [pendingMap, setPendingMap] = useState(new Map());

  /* =========================
     Realtime subscriptions
  ========================= */
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

    // Pending from collectionGroup: users/*/pendingNotifications/*
    const qPending = query(collectionGroup(db, "pendingNotifications"), orderBy("createdAt", "desc"));
    const unsubPending = onSnapshot(qPending, (snap) => {
      const m = new Map();
      snap.forEach((d) => {
        const parent = d.ref.parent; // pendingNotifications
        const userDoc = parent?.parent; // users/{uid}
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

  /* =========================
     Clients map (docId, customerId, uid)
  ========================= */
  const clientsMap = useMemo(() => {
    const m = new Map();
    clients.forEach((c) => {
      const docId = String(c.userId);
      m.set(docId, c);
      if (c.customerId) m.set(String(c.customerId), c);
      if (c.uid) m.set(String(c.uid), c);
    });
    return m;
  }, [clients]);

  /* =========================
     Robust token resolver
     - subcollections -> root fields -> collectionGroup(ownerDocId)
  ========================= */
  async function readSubcollectionTokens(userDocId, subName, tokens) {
    try {
      const qy = query(collection(db, "users", userDocId, subName), where("active", "==", true));
      const snap = await getDocs(qy);
      snap.forEach((d) => {
        const v = d.data() || {};
        if (!v?.token) return;
        if (v.ownerDocId && String(v.ownerDocId) !== String(userDocId)) return;
        tokens.add(v.token);
      });
    } catch (err) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.debug(`[tokens] read ${subName} failed for ${userDocId}:`, err?.message || err);
      }
    }
  }

  async function getActiveTokensForUser(userDocId) {
    if (!userDocId) return [];
    setResolvingTokens(true);
    const tokens = new Set();

    try {
      if (typeof __DEV__ !== "undefined" && __DEV__) console.debug("[tokens] resolving for", userDocId);

      // 1) subcollections under this user doc
      try {
        const s1 = await getDocs(query(collection(db, "users", userDocId, "expoPushTokens"), where("active", "==", true)));
        s1.forEach((d) => {
          const v = d.data() || {};
          if (v?.token && (v.ownerDocId ? String(v.ownerDocId) === String(userDocId) : true)) tokens.add(v.token);
        });
      } catch (e) {
        if (typeof __DEV__ !== "undefined" && __DEV__) console.debug("[tokens] read expoPushTokens failed:", e);
      }

      try {
        const s2 = await getDocs(query(collection(db, "users", userDocId, "pushTokens"), where("active", "==", true)));
        s2.forEach((d) => {
          const v = d.data() || {};
          if (v?.token && (v.ownerDocId ? String(v.ownerDocId) === String(userDocId) : true)) tokens.add(v.token);
        });
      } catch (e) {
        if (typeof __DEV__ !== "undefined" && __DEV__) console.debug("[tokens] read pushTokens failed:", e);
      }

      // 2) root fields (legacy)
      try {
        const userSnap = await getDoc(doc(db, "users", userDocId));
        if (userSnap.exists()) {
          const u = userSnap.data() || {};
          if (u?.expoPushToken) tokens.add(u.expoPushToken);
          if (Array.isArray(u?.expoPushTokens)) u.expoPushTokens.forEach((t) => t && tokens.add(t));
          if (Array.isArray(u?.pushTokens)) u.pushTokens.forEach((t) => t && tokens.add(t));
          if (u?.pushToken) tokens.add(u.pushToken);

          // try alternate ids if nothing yet
          const altUid = u.uid || u.userId || null;
          const altCustomerId = u.customerId || null;

          if (tokens.size === 0) {
            if (altUid && String(altUid) !== String(userDocId)) {
              await readSubcollectionTokens(altUid, "pushTokens", tokens);
              await readSubcollectionTokens(altUid, "expoPushTokens", tokens);
              try {
                const altSnap = await getDoc(doc(db, "users", altUid));
                if (altSnap.exists()) {
                  const ad = altSnap.data() || {};
                  if (ad?.expoPushToken) tokens.add(ad.expoPushToken);
                  if (Array.isArray(ad?.expoPushTokens)) ad.expoPushTokens.forEach((t) => t && tokens.add(t));
                }
              } catch {}
            }
            if (altCustomerId && String(altCustomerId) !== String(userDocId)) {
              await readSubcollectionTokens(altCustomerId, "pushTokens", tokens);
              await readSubcollectionTokens(altCustomerId, "expoPushTokens", tokens);
              try {
                const altSnap2 = await getDoc(doc(db, "users", altCustomerId));
                if (altSnap2.exists()) {
                  const ad2 = altSnap2.data() || {};
                  if (ad2?.expoPushToken) tokens.add(ad2.expoPushToken);
                  if (Array.isArray(ad2?.expoPushTokens)) ad2.expoPushTokens.forEach((t) => t && tokens.add(t));
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.debug("[tokens] root read failed for", userDocId, err?.message || err);
        }
      }

      // 3) collectionGroup fallback by ownerDocId
      try {
        const cgPush = await getDocs(
          query(collectionGroup(db, "pushTokens"), where("ownerDocId", "==", userDocId), where("active", "==", true))
        );
        cgPush.forEach((d) => {
          const v = d.data() || {};
          if (v?.token) tokens.add(v.token);
        });

        const cgExpo = await getDocs(
          query(collectionGroup(db, "expoPushTokens"), where("ownerDocId", "==", userDocId), where("active", "==", true))
        );
        cgExpo.forEach((d) => {
          const v = d.data() || {};
          if (v?.token) tokens.add(v.token);
        });
      } catch (e) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.debug("[tokens] collectionGroup fallback failed:", e?.message || e);
        }
      }
    } finally {
      setResolvingTokens(false);
    }

    const out = Array.from(tokens).filter(Boolean);
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.debug("[tokens] resolved", out.length, "for", userDocId, "preview:", out.slice(0, 5).map((t) => (t || "").slice(0, 40)));
    }
    return out;
  }

  /* =========================
     Resolve token count for selected target
  ========================= */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!target || target === "all") {
        setTargetTokenCount(null);
        setSelectedClientInfo(null);
        return;
      }
      const resolvedClient = clientsMap.get(String(target)) || null;
      if (resolvedClient) setSelectedClientInfo({ key: String(target), client: resolvedClient });
      else setSelectedClientInfo({ key: String(target), client: null });

      const toks = await getActiveTokensForUser(String(target));
      if (!cancelled) setTargetTokenCount(toks.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [target, clientsMap]);

  /* =========================
     Queue notification
     - client does NOT set "no_tokens"
     - server will enqueue to pending if needed
  ========================= */
  async function sendNotification() {
    if (!message.trim()) {
      alert(isAr ? "من فضلك اكتب نص الإشعار." : "Please write a message.");
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      const pushAtValue = scheduleAt ? Timestamp.fromDate(new Date(scheduleAt)) : Timestamp.fromDate(now);

      const payload = {
        title: isAr ? "إشعار جديد" : "New Notification",
        body: message.trim(),
        targetId: target === "all" ? "all" : String(target),
        timestamp: serverTimestamp(),
        pushAt: pushAtValue,
        type: target === "all" ? "general" : "custom",
        status: "queued",
        pushed: false,
        attempts: 0,
        lastError: null,
        priority,
        data: {},
      };

      if (target !== "all") {
        const toks = await getActiveTokensForUser(String(target));
        if (toks?.length) payload.tokens = toks; // let server decide if 0 tokens (pending/queued_for_user)
      }

      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.debug("[notif] enqueue", {
          target: payload.targetId,
          tokensCount: (payload.tokens || []).length,
          tokensPreview: (payload.tokens || []).slice(0, 5).map((t) => t.slice(0, 40)),
        });
      }

      await addDoc(collection(db, "notifications"), payload);

      // Reset UI
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

  /* =========================
     Derived lists (filters)
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
    <div className="max-w-6xl mx-auto py-6 px-4 text-sm text-slate-900">
      <h2 className="text-2xl font-extrabold mb-2">{isAr ? "لوحة الإشعارات" : "Notifications"}</h2>
      <p className="text-sm text-slate-500 mb-6">
        {isAr
          ? "أرسل إشعارات موجهة أو عامة للعملاء. يمكنك معاينة التوكنات النشطة قبل الإرسال."
          : "Send targeted or broadcast notifications to clients. Preview active tokens before sending."}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose */}
        <div className="col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg">{isAr ? "إنشاء إشعار" : "Compose Notification"}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {isAr ? "أضف نصًا واختر المستلم." : "Add message and pick recipient."}
              </p>
            </div>
            <div className="text-xs text-slate-500">
              <Badge intent="muted">
                {priority === "high" ? (isAr ? "عالية" : "High") : (isAr ? "عادية" : "Normal")}
              </Badge>
            </div>
          </div>

          <textarea
            className="w-full min-h-[96px] p-3 rounded-md border border-slate-200 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder={isAr ? "اكتب نص الإشعار..." : "Write notification message..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <label className="block text-xs text-slate-600 mb-2">{isAr ? "المستلم" : "Recipient"}</label>
          <select
            value={target}
            onChange={async (e) => {
              const id = e.target.value;
              setTarget(id);
              try {
                setResolvingTokens(true);
                const toks = await getActiveTokensForUser(String(id));
                setTargetTokenCount(toks.length);
              } catch {
                setTargetTokenCount(null);
              } finally {
                setResolvingTokens(false);
              }
            }}
            className="w-full p-2 rounded-md border border-slate-200 mb-2"
          >
            <option value="all">{isAr ? "كل العملاء" : "All Clients"}</option>
            {clients.map((cl) => (
              <option key={cl.userId} value={cl.userId}>
                {clientLabel(cl)}
              </option>
            ))}
          </select>

          <div className="text-xs text-slate-500 mb-3">
            {target !== "all" && (
              <>
                {clientsMap.get(String(target)) ? (
                  <div>
                    <div>
                      <strong>{isAr ? "محدَّد:" : "Selected:"}</strong>{" "}
                      {clientLabel(clientsMap.get(String(target)))}
                    </div>
                    <div>
                      <strong>docId:</strong> {String(target)}
                    </div>
                  </div>
                ) : (
                  <div>{isAr ? "لم يتم إيجاد عميل مطابق للقيمة المحددة." : "No client matched the selected value."}</div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={async () => {
                if (!target || target === "all") return;
                setResolvingTokens(true);
                const toks = await getActiveTokensForUser(String(target));
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
              <strong>{targetTokenCount === null ? "..." : targetTokenCount}</strong>
            </div>
          </div>

          <div className="flex gap-2 items-center">
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

          <div className="mt-4">
            <button
              onClick={sendNotification}
              disabled={loading || !message.trim()}
              className="w-full px-4 py-3 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-60"
            >
              {loading ? (isAr ? "جارٍ الإرسال..." : "Sending...") : (isAr ? "إرسال إشعار" : "Send Notification")}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{isAr ? "الإشعارات" : "Notifications"}</h3>
              <span className="text-xs text-slate-500">({notifications.length})</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={notifTypeFilter}
                onChange={(e) => setNotifTypeFilter(e.target.value)}
                className="p-2 border border-slate-200 rounded-md"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                <option value="general">{isAr ? "عام" : "General"}</option>
                <option value="custom">{isAr ? "مخصص" : "Custom"}</option>
              </select>

              <input
                value={notifSearch}
                onChange={(e) => setNotifSearch(e.target.value)}
                className="p-2 border border-slate-200 rounded-md"
                placeholder={isAr ? "بحث في الإشعارات..." : "Search notifications..."}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-emerald-50 text-emerald-900">
                <tr>
                  <th className="py-2 px-3 font-semibold">{isAr ? "النص" : "Message"}</th>
                  <th className="py-2 px-3 font-semibold">{isAr ? "النوع" : "Type"}</th>
                  <th className="py-2 px-3 font-semibold">{isAr ? "الحالة" : "Status"}</th>
                  <th className="py-2 px-3 font-semibold">{isAr ? "إلى" : "To"}</th>
                  <th className="py-2 px-3 font-semibold">{isAr ? "التاريخ" : "Date"}</th>
                  <th className="py-2 px-3 font-semibold">{isAr ? "أفعال" : "Actions"}</th>
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
                        <td className="py-3 px-3 max-w-[480px] break-words">{n.body}</td>

                        <td className="py-3 px-3">
                          <Badge intent={n.type === "general" ? "success" : "default"}>
                            {n.type === "general" ? (isAr ? "عام" : "General") : (isAr ? "مخصص" : "Custom")}
                          </Badge>
                        </td>

                        <td className="py-3 px-3">
                          {n.status === "sent" && <Badge intent="success">{isAr ? "مرسَل" : "sent"}</Badge>}
                          {n.status === "queued" && <Badge intent="warn">{isAr ? "قيد الانتظار" : "queued"}</Badge>}
                          {n.status === "queued_for_user" && <Badge intent="warn">{isAr ? "معلّق للمستخدم" : "queued_for_user"}</Badge>}
                          {n.status === "scheduled" && <Badge intent="muted">{isAr ? "مجدول" : "scheduled"}</Badge>}
                          {n.status === "sending" && <Badge intent="muted">{isAr ? "جاري الإرسال" : "sending"}</Badge>}
                          {n.status === "no_tokens" && <Badge intent="muted">{isAr ? "لا يوجد توكنات" : "no_tokens"}</Badge>}
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
                            <div>{n.targetId}</div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-slate-500 text-xs whitespace-nowrap">
                          {formatDate(n.timestamp, lang)}
                          {n.pushAt && n.pushAt !== n.timestamp ? (
                            <div className="text-[11px] text-slate-400 mt-1">
                              {isAr ? "مجدول لِـ " : "Scheduled for "} {formatDate(n.pushAt, lang)}
                            </div>
                          ) : null}
                          {n.sentAt ? (
                            <div className="text-[11px] text-slate-400 mt-1">
                              {isAr ? "أُرسل: " : "sentAt: "} {formatDate(n.sentAt, lang)}
                            </div>
                          ) : null}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="px-2 py-1 text-xs rounded border"
                              title={isAr ? "إعادة إرسال فورية" : "Immediate re-send"}
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
                                title={isAr ? "إلغاء الجدولة عبر نسخة فورية" : "Cancel schedule via instant clone"}
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

          {/* Pending widget */}
          <div className="mt-6 bg-white rounded-xl border p-4">
            <h4 className="font-bold mb-2">{isAr ? "إشعارات معلّقة" : "Pending Notifications"}</h4>
            {pendingMap.size === 0 ? (
              <div className="text-sm text-slate-500">
                {isAr ? "لا يوجد إشعارات معلّقة." : "No pending notifications."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Array.from(pendingMap.entries()).map(([uid, count]) => {
                  const c = clientsMap.get(uid);
                  return (
                    <div
                      key={uid}
                      className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3"
                    >
                      <div className="text-sm">
                        <div className="font-medium">{c ? (c.name || c.displayName || uid) : uid}</div>
                        <div className="text-xs text-slate-500">#{c?.customerId || uid}</div>
                      </div>
                      <Badge intent="warn">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
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
                  onClick={() => {
                    setTokenPreviewOpen(false);
                    setTokenPreviewList([]);
                  }}
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
