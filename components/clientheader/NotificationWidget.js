import { useState, useEffect, useRef, useMemo } from "react";
import { FaBell } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { firestore as db } from "@/lib/firebase.client";
import {
  query,
  collection,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc
} from "firebase/firestore";

export default function NotificationWidget({ userId, lang = "ar", darkMode = false }) {
  const [notifications, setNotifications] = useState([]);     // إشعارات المستخدم + العامة
  const [reads, setReads] = useState({});                     // قاموس { notifId: true }
  const [showMenu, setShowMenu] = useState(false);
  const [activeNotif, setActiveNotif] = useState(null);
  const menuRef = useRef(null);

  // ========== جلب الإشعارات (المستخدم + العامة) لحظيًا ==========
  useEffect(() => {
    if (!userId) return;

    // نجيب: targetId == userId أو targetId == "all" + ترتيب أحدث أولاً
    const qUserOrAll = query(
      collection(db, "notifications"),
      where("targetId", "in", [userId, "all"]), // يتطلب index؛ شغّله لو Firebase طلب
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsubNotifs = onSnapshot(qUserOrAll, (snap) => {
      const list = [];
      const now = Date.now();
      snap.forEach((d) => {
        const data = d.data();
        const ts = typeof data.timestamp?.toDate === "function"
          ? data.timestamp.toDate()
          : (data.timestamp ? new Date(data.timestamp) : null);

        // آخر 15 يوم فقط
        if (ts && (now - ts.getTime()) / (1000 * 60 * 60 * 24) > 15) return;

        list.push({
          ...data,
          notificationId: d.id,
          _date: ts ? ts : null
        });
      });
      // fallback لو مفيش timestamp
      list.sort((a, b) => (b._date?.getTime?.() || 0) - (a._date?.getTime?.() || 0));
      setNotifications(list);
    });

    // ========== جلب حالات القراءة للمستخدم ==========
    // نخزّن حالة القراءة في users/{uid}/reads/{notifId}: { isRead: true, readAt: serverTimestamp() }
    const readsRef = collection(db, `users/${userId}/reads`);
    const unsubReads = onSnapshot(readsRef, (snap) => {
      const map = {};
      snap.forEach((d) => {
        const r = d.data();
        if (r?.isRead) map[d.id] = true;
      });
      setReads(map);
    });

    return () => {
      unsubNotifs();
      unsubReads();
    };
  }, [userId]);

  // إغلاق المنيو عند الضغط خارجها
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setActiveNotif(null);
      }
    }
    if (showMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  // ========== تمييز كمقروء (بدون تعديل وثيقة الإشعار الأصلية) ==========
  async function markNotifAsRead(notifId) {
    if (!userId || !notifId) return;
    try {
      await setDoc(
        doc(db, `users/${userId}/reads/${notifId}`),
        { isRead: true, readAt: new Date() }, // ممكن تبدّلها بـ serverTimestamp() لو حابب
        { merge: true }
      );
    } catch (_) {}
  }

  const unreadCount = useMemo(() => notifications.filter(n => !reads[n.notificationId]).length, [notifications, reads]);

  // حركة الجرس
  const bellVariants = {
    initial: { rotate: 0 },
    ringing: {
      rotate: [0, -30, 30, -25, 25, -15, 15, -7, 7, 0],
      transition: { duration: 0.9, ease: "easeInOut" }
    }
  };

  const palette = {
    bell: darkMode ? "text-emerald-300" : "text-emerald-500",
    panel: darkMode ? "bg-gray-900 text-white border-gray-800" : "bg-white text-gray-900 border-slate-200",
    title: "text-emerald-700",
    meta: darkMode ? "text-gray-400" : "text-gray-500",
    body: darkMode ? "text-gray-200" : "text-gray-700",
    hoverRow: darkMode ? "hover:bg-emerald-950/40" : "hover:bg-emerald-50/60",
  };

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        type="button"
        className="relative flex items-center justify-center bg-transparent border-none p-0 m-0 focus:outline-none cursor-pointer"
        tabIndex={0}
        title={lang === "ar" ? "الإشعارات" : "Notifications"}
        onClick={() => setShowMenu(v => !v)}
        whileHover={{ scale: 1.18, filter: "brightness(1.12)" }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 250, damping: 18 }}
        style={{ minWidth: 36, minHeight: 36 }}
      >
        <motion.span variants={bellVariants} animate={showMenu ? "ringing" : "initial"} style={{ display: "inline-block" }}>
          <FaBell
            className={`text-[26px] sm:text-[28px] lg:text-[32px] drop-shadow-lg transition-all duration-150 ${palette.bell}`}
            style={{ filter: "drop-shadow(0 2px 7px #10b98166)" }}
          />
        </motion.span>
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[11px] font-bold rounded-full px-[6px] py-[2px] shadow border-2 border-white/80">
            {unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className={`absolute top-10 right-0 w-80 z-50 shadow-xl rounded-xl border ${palette.panel} p-4`}
            style={{ maxHeight: "360px", overflowY: "auto" }}
          >
            <div className={`font-bold ${palette.title} mb-3`}>
              {lang === "ar" ? "الإشعارات" : "Notifications"}
            </div>

            {notifications.length === 0 ? (
              <div className={`${palette.meta} text-center`}>
                {lang === "ar" ? "لا توجد إشعارات خلال آخر 15 يوم" : "No notifications in last 15 days"}
              </div>
            ) : (
              <ul className="space-y-2">
                {notifications.map((n) => {
                  const isRead = !!reads[n.notificationId];
                  return (
                    <li
                      key={n.notificationId}
                      className={`text-xs border-b pb-2 cursor-pointer transition-all rounded-md px-1 ${isRead ? "opacity-80" : "opacity-100"} ${palette.hoverRow}`}
                      onClick={async () => {
                        if (!isRead) await markNotifAsRead(n.notificationId);
                        setActiveNotif({ ...n, isRead: true });
                      }}
                      title={!isRead ? (lang === "ar" ? "اضغط لتمييز كمقروء وفتح التفاصيل" : "Mark as read and view details") : ""}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className={`font-bold ${palette.title}`}>{n.title || (lang === "ar" ? "إشعار" : "Notification")}</div>
                        {!isRead && (
                          <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-[10px] rounded-full">
                            {lang === "ar" ? "جديد" : "New"}
                          </span>
                        )}
                      </div>
                      <div className={`${palette.body} mt-0.5`}>{n.body}</div>
                      <div className={`${palette.meta} text-[10px] mt-1`}>
                        {n._date ? n._date.toLocaleString(lang === "ar" ? "ar-AE" : "en-US", { timeZone: "Asia/Dubai" }) : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <AnimatePresence>
              {activeNotif && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
                  onClick={() => setActiveNotif(null)}
                >
                  <div
                    className="bg-white rounded-xl shadow-xl border p-6 relative max-w-md w-full text-gray-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setActiveNotif(null)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-700 text-2xl px-2"
                      aria-label="Close"
                    >
                      ×
                    </button>
                    <div className="font-bold text-emerald-700 mb-2">{activeNotif.title}</div>
                    <div className="text-gray-700 mb-3">{activeNotif.body}</div>
                    <div className="text-gray-500 text-xs">
                      {activeNotif._date
                        ? activeNotif._date.toLocaleString(lang === "ar" ? "ar-AE" : "en-US", { timeZone: "Asia/Dubai" })
                        : ""}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
