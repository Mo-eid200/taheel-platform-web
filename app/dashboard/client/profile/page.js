"use client";

import { Suspense, useEffect, useRef, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FaSignOutAlt,
  FaEnvelopeOpenText,
  FaWhatsapp,
  FaComments,
  FaBuilding,
  FaTag,
  FaMoon,
  FaSun,
} from "react-icons/fa";
import WeatherTimeWidget from "@/components/WeatherTimeWidget";
import { ResidentCard } from "@/components/cards/ResidentCard";
import CompanyCardGold from "@/components/cards/CompanyCard";
import OwnerCard from "@/components/cards/OwnerCard";
import ChatWidgetFull from "@/components/ClientChat/ChatWidgetFull";
import { NonResidentCard } from "@/components/cards/NonResidentCard";
import ClientOrdersTracking from "@/components/ClientOrdersTracking";
import { firestore, auth } from "@/lib/firebase.client";
import { signOut } from "firebase/auth";
import { GlobalLoader } from "@/components/GlobalLoader";
import Sidebar from "@/components/ProfileSidebarLayout/Sidebar";
import ServiceProfileCard from "@/components/services/ServiceProfileCard";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  deleteDoc,
  onSnapshot,
  limit,
} from "firebase/firestore";
import WalletWidget from "@/components/clientheader/WalletWidget";
import CoinsWidget from "@/components/clientheader/CoinsWidget";
import NotificationWidget from "@/components/clientheader/NotificationWidget";
import { translateServiceFields } from "@/utils/translate";
import CompanySubscriptionsSection from "@/components/subscriptions/CompanySubscriptionsSection";

// =====================================
// Small helpers
// =====================================
function getDayGreeting(lang = "ar") {
  const hour = new Date().getHours();
  if (lang === "ar") {
    if (hour < 12) return "صباح الخير";
    if (hour < 18) return "مساء الخير";
    return "مساء الخير";
  } else {
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }
}

function getFullName(client, lang = "ar") {
  if (!client) return "";
  if (lang === "ar") {
    return [client.firstName, client.lastName].filter(Boolean).join(" ");
  }
  if (client.nameEn) return client.nameEn;
  return [client.firstName, client.lastName].filter(Boolean).join(" ");
}

async function addNotification(customerId, title, body, type = "wallet") {
  const notif = {
    notificationId: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    targetId: customerId,
    title,
    body,
    isRead: false,
    type,
    timestamp: new Date().toISOString(),
  };
  await setDoc(doc(firestore, "notifications", notif.notificationId), notif);
}

function objectToArray(obj) {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") return Object.values(obj);
  return [];
}

// Firestore timestamp / ISO / ms → Date
function toDateSafe(ts) {
  if (ts && typeof ts.toDate === "function") return ts.toDate();
  if (ts != null) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// =====================================
// Section Titles
// =====================================
const sectionTitles = {
  residentServices: { icon: "resident", color: "emerald", ar: "خدمات المقيم", en: "Resident Services" },
  companyServices: { icon: "company", color: "blue", ar: "خدمات الشركات", en: "Company Services" },
  nonresidentServices: { icon: "nonresident", color: "yellow", ar: "خدمات غير المقيم", en: "Non-Resident Services" },
  otherServices: { icon: "other", color: "gray", ar: "خدمات أخرى", en: "Other Services" },
};

const colorStyleMap = {
  emerald: {
    lineLeft: "flex-1 h-px bg-gradient-to-l from-emerald-300 via-emerald-100 to-transparent",
    lineRight: "flex-1 h-px bg-gradient-to-r from-emerald-300 via-emerald-100 to-transparent",
    bubble: "flex items-center gap-2 px-4 py-1 bg-white/80 rounded-full shadow text-emerald-900 font-extrabold text-lg border border-emerald-100",
    icon: "text-emerald-500",
  },
  blue: {
    lineLeft: "flex-1 h-px bg-gradient-to-l from-blue-300 via-blue-100 to-transparent",
    lineRight: "flex-1 h-px bg-gradient-to-r from-blue-300 via-blue-100 to-transparent",
    bubble: "flex items-center gap-2 px-4 py-1 bg-white/80 rounded-full shadow text-blue-900 font-extrabold text-lg border border-blue-100",
    icon: "text-blue-500",
  },
  yellow: {
    lineLeft: "flex-1 h-px bg-gradient-to-l from-yellow-300 via-yellow-100 to-transparent",
    lineRight: "flex-1 h-px bg-gradient-to-r from-yellow-300 via-yellow-100 to-transparent",
    bubble: "flex items-center gap-2 px-4 py-1 bg-white/80 rounded-full shadow text-yellow-900 font-extrabold text-lg border border-yellow-100",
    icon: "text-yellow-500",
  },
  gray: {
    lineLeft: "flex-1 h-px bg-gradient-to-l from-gray-300 via-gray-100 to-transparent",
    lineRight: "flex-1 h-px bg-gradient-to-r from-gray-300 via-gray-100 to-transparent",
    bubble: "flex items-center gap-2 px-4 py-1 bg-white/80 rounded-full shadow text-gray-900 font-extrabold text-lg border border-gray-100",
    icon: "text-gray-500",
  },
};

function SectionTitle({ icon, color = "emerald", children }) {
  const c = colorStyleMap[color] || colorStyleMap.emerald;

  const iconMap = {
    resident: <FaComments className={c.icon} />,
    company: <FaBuilding className={c.icon} />,
    nonresident: <FaEnvelopeOpenText className={c.icon} />,
    other: <FaTag className={c.icon} />,
  };

  return (
    <div className="w-full flex items-center my-10 select-none">
      <div className={c.lineLeft} />
      <span className={c.bubble}>
        {iconMap[icon]} {children}
      </span>
      <div className={c.lineRight} />
    </div>
  );
}

// =====================================
// Hook: open order details if ?order=... or ?pi=...
// =====================================
function useOpenOrderFromQuery(openOrderCallback, onError) {
  const search = useSearchParams();
  const [loadingOrderFromQuery, setLoadingOrderFromQuery] = useState(false);

  useEffect(() => {
    const orderParam = search.get("order");
    const piParam = search.get("pi");
    if (!orderParam && !piParam) return;

    let cancelled = false;
    setLoadingOrderFromQuery(true);

    (async () => {
      try {
        if (orderParam) {
          try {
            const ref = doc(firestore, "requests", String(orderParam));
            const snap = await getDoc(ref);
            if (!cancelled && snap.exists()) {
              openOrderCallback({ id: snap.id, ...snap.data() });
              setLoadingOrderFromQuery(false);
              return;
            }
          } catch (e) {
            console.warn("Direct getDoc failed:", e);
          }
        }

        const qField = piParam ? "paymentIntentId" : "orderNumber";
        const qValue = piParam ? piParam : orderParam;

        const qRef = query(collection(firestore, "requests"), where(qField, "==", String(qValue)));
        const qs = await getDocs(qRef);

        if (!cancelled) {
          if (!qs.empty) {
            const d = qs.docs[0];
            openOrderCallback({ id: d.id, ...d.data() });
          } else {
            onError?.({ code: "NOT_FOUND", message: "Order not found" });
          }
        }
      } catch (err) {
        console.error("Error fetching order from query:", err);
        onError?.(err);
      } finally {
        if (!cancelled) setLoadingOrderFromQuery(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [search, openOrderCallback, onError]);

  return { loadingOrderFromQuery };
}

// =====================================
// Helper: fetch related companies for resident users
// =====================================
async function fetchRelatedCompanies(customerId, user) {
  const out = [];

  try {
    const q1 = query(
      collection(firestore, "users"),
      where("type", "==", "company"),
      where("ownerCustomerIds", "array-contains", customerId)
    );
    const s1 = await getDocs(q1);
    s1.forEach((d) => out.push({ id: d.id, ...d.data(), customerId: d.id }));
    if (out.length > 0) return out;
  } catch {}

  try {
    const q2 = query(
      collection(firestore, "users"),
      where("type", "==", "company"),
      where("ownerCustomerId", "==", customerId)
    );
    const s2 = await getDocs(q2);
    s2.forEach((d) => out.push({ id: d.id, ...d.data(), customerId: d.id }));
    if (out.length > 0) return out;
  } catch {}

  try {
    const ownerVals = [];
    if (user?.name) ownerVals.push(user.name);
    if (user?.userId) ownerVals.push(user.userId);

    if (ownerVals.length > 0) {
      const q3 = query(
        collection(firestore, "users"),
        where("type", "==", "company"),
        where("owner", "in", ownerVals.slice(0, 10))
      );
      const s3 = await getDocs(q3);
      s3.forEach((d) => out.push({ id: d.id, ...d.data(), customerId: d.id }));
    }
  } catch {}

  return out;
}

// =====================================
// Inner page component
// =====================================
function ClientProfilePageInner({ userId }) {
  const router = useRouter();

  // ---------- state ----------
  const [lang, setLang] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("lang") || "ar" : "ar"
  );
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("darkMode") === "true" : false
  );
  const [openChat, setOpenChat] = useState(false);
  const [selectedSection, setSelectedSection] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("selectedSection") || "personal" : "personal"
  );

  const [client, setClient] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [services, setServices] = useState({ resident: [], nonresident: [], company: [], other: [] });
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownerResident, setOwnerResident] = useState(null);
  const [freePrinting, setFreePrinting] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [showCoinsMenu, setShowCoinsMenu] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [showMessagesMenu, setShowMessagesMenu] = useState(false);

  const [search, setSearch] = useState("");
  const [reloadClient, setReloadClient] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const coinsRef = useRef();
  const walletRef = useRef();
  const messagesRef = useRef();

  const [resolvedUserId, setResolvedUserId] = useState(null);
  const [resolving, setResolving] = useState(true);

  const [selectedOrderFromQuery, setSelectedOrderFromQuery] = useState(null);
  const [orderFetchErrorState, setOrderFetchErrorState] = useState(null);

  const openOrderCallback = useCallback((orderData) => {
    setSelectedSection("orders");
    setSelectedOrderFromQuery(orderData);
  }, []);

  const onOrderError = useCallback((err) => {
    setOrderFetchErrorState(err);
  }, []);

  const { loadingOrderFromQuery } = useOpenOrderFromQuery(openOrderCallback, onOrderError);

  // derived basics
  const clientType = (client?.type || client?.accountType || "").toLowerCase();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isCompanyServicesSection = selectedSection === "companyServices";

  // =====================================
  // prevent browser back if logged in
  // =====================================
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.pushState(null, "", window.location.href);

    const onPopState = () => {
      if (client) window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [client]);

  // =====================================
  // Auto logout after 30min
  // =====================================
  useEffect(() => {
    if (!client) return;
    const timer = setTimeout(() => {
      handleLogout();
      alert(lang === "ar" ? "انتهت الجلسة! يرجى تسجيل الدخول مرة أخرى." : "Session expired! Please login again.");
    }, 1800000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, lang]);

  // =====================================
  // if not logged in -> /login
  // =====================================
  useEffect(() => {
    if (client === null && !loading && !resolving) router.replace("/login");
  }, [client, loading, resolving, router]);

  // =====================================
  // Resolve userId → actual Firestore doc.id
  // =====================================
  useEffect(() => {
    let cancelled = false;

    async function resolveId(param) {
      if (!param) {
        setResolvedUserId(null);
        setResolving(false);
        return;
      }

      setResolving(true);
      try {
        // 1) direct doc id
        const directRef = doc(firestore, "users", param);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          if (!cancelled) {
            setResolvedUserId(directSnap.id);
            setResolving(false);
          }
          return;
        }

        // 2) fallback queries
        const usersCol = collection(firestore, "users");
        const tryField = async (field) => {
          const qs = await getDocs(query(usersCol, where(field, "==", param), limit(1)));
          return qs.empty ? null : qs.docs[0].id;
        };

        let found = (await tryField("customerId")) || (await tryField("userId")) || (await tryField("companyId"));

        // 3) last resort: current auth uid
        if (!found && auth?.currentUser?.uid) {
          const qs = await getDocs(query(usersCol, where("uid", "==", auth.currentUser.uid), limit(1)));
          if (!qs.empty) found = qs.docs[0].id;
        }

        if (!cancelled) {
          setResolvedUserId(found);
          setResolving(false);
        }
      } catch {
        if (!cancelled) {
          setResolvedUserId(null);
          setResolving(false);
        }
      }
    }

    resolveId(userId);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // =====================================
  // Live user snapshot + companies
  // =====================================
  useEffect(() => {
    if (!resolvedUserId) return;

    const userRef = doc(firestore, "users", resolvedUserId);

    const unsubscribe = onSnapshot(userRef, async (snap) => {
      if (snap.exists()) {
        const user = snap.data();
        user.customerId = snap.id;
        setClient(user);

        // owner if company
        if (user?.type === "company" || user?.accountType === "company") {
          setOwnerResident({
            firstName: user.ownerFirstName,
            middleName: user.ownerMiddleName,
            lastName: user.ownerLastName,
            birthDate: user.ownerBirthDate,
            gender: user.ownerGender,
            nationality: user.ownerNationality,
            phone: user.phone,
          });
        } else {
          setOwnerResident(null);
        }

        // related companies if resident
        if ((user?.type || user?.accountType || "").toLowerCase() === "resident" && user.customerId) {
          const related = await fetchRelatedCompanies(user.customerId, user);
          const seen = new Set();
          const unique = [];
          for (const c of related) {
            const id = c.customerId || c.id;
            if (id && !seen.has(id)) {
              seen.add(id);
              unique.push(c);
            }
          }
          setCompanies(unique);
        } else {
          setCompanies([]);
        }
      } else {
        setClient(null);
      }
    });

    return () => unsubscribe();
  }, [resolvedUserId]);

  // =====================================
  // Fetch services, orders, notifications
  // =====================================
  useEffect(() => {
    async function fetchData() {
      if (!resolvedUserId) return;
      setLoading(true);

      // services by client type
      const types = ["resident", "company", "nonresident", "other"];
      const servicesByType = { resident: [], nonresident: [], company: [], other: [] };

      for (const type of types) {
        const docRef = doc(firestore, "servicesByClientType", type);
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : {};
        const arr = Object.entries(data)
          .filter(([key]) => key.startsWith("service"))
          .map(([key, val]) => ({ ...val, id: key }));
        servicesByType[type] = arr.filter((srv) => srv.active !== false);
      }
      setServices(servicesByType);

      // orders
      const ordersSnap = await getDocs(
        query(
          collection(firestore, "requests"),
          where("customerId", "==", resolvedUserId),
          orderBy("createdAt", "desc")
        )
      );
      setOrders(ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // notifications
      const notifsSnap = await getDocs(query(collection(firestore, "notifications"), where("targetId", "==", resolvedUserId)));
      const clientNotifs = notifsSnap.docs
        .map((d) => ({ ...d.data(), _date: toDateSafe(d.data().timestamp) }))
        .sort((a, b) => (b._date?.getTime?.() || 0) - (a._date?.getTime?.() || 0));

      setNotifications(clientNotifs);

      setLoading(false);
    }

    fetchData().catch(() => setLoading(false));
  }, [resolvedUserId, reloadClient]);

  // =====================================
  // Close popups if click outside
  // =====================================
  useEffect(() => {
    function handleClickOutside(event) {
      if (coinsRef.current && !coinsRef.current.contains(event.target)) setShowCoinsMenu(false);
      if (walletRef.current && !walletRef.current.contains(event.target)) setShowWalletMenu(false);
      if (messagesRef.current && !messagesRef.current.contains(event.target)) setShowMessagesMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // sync prefs with localStorage
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("lang", lang);
  }, [lang]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("selectedSection", selectedSection);
  }, [selectedSection]);

  // =====================================
  // Services derived + translation
  // =====================================
  const residentServices = useMemo(() => objectToArray(services.resident), [services.resident]);
  const companyServices = useMemo(() => objectToArray(services.company), [services.company]);
  const nonresidentServices = useMemo(() => objectToArray(services.nonresident), [services.nonresident]);
  const otherServices = useMemo(() => objectToArray(services.other), [services.other]);

  const currentServices = useMemo(() => {
    switch (selectedSection) {
      case "residentServices":
        return residentServices;
      case "companyServices":
        return companyServices;
      case "nonresidentServices":
        return nonresidentServices;
      case "otherServices":
        return otherServices;
      default:
        return [];
    }
  }, [selectedSection, residentServices, companyServices, nonresidentServices, otherServices]);

  const isServicesSection = useMemo(() => {
    return ["residentServices", "companyServices", "nonresidentServices", "otherServices"].includes(selectedSection);
  }, [selectedSection]);

  const [translationsMap, setTranslationsMap] = useState({});

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!isServicesSection) return;

      if (!currentServices?.length) {
        if (alive) setTranslationsMap({});
        return;
      }

      // AR: no translation
      if (lang === "ar") {
        const m = {};
        for (const s of currentServices) {
          const sid = s?.serviceId || s?.id || s?.name || `${Math.random()}`;
          m[sid] = {
            name: s?.name || "",
            description: s?.description || "",
            longDescription: s?.longDescription || "",
          };
        }
        if (alive) setTranslationsMap(m);
        return;
      }

      // EN: translate
      const entries = await Promise.all(
        currentServices.map(async (s) => {
          const sid = s?.serviceId || s?.id || s?.name || `${Math.random()}`;
          const tr = await translateServiceFields({
            service: s,
            lang,
            fields: ["name", "description", "longDescription"],
            idKey: "serviceId",
          });
          return [sid, tr];
        })
      );

      if (alive) setTranslationsMap(Object.fromEntries(entries));
    }

    run();
    return () => {
      alive = false;
    };
  }, [lang, isServicesSection, currentServices]);

  // ---------- handlers ----------
  function toggleLang() {
    setLang((l) => {
      const newLang = l === "ar" ? "en" : "ar";
      if (typeof window !== "undefined") localStorage.setItem("lang", newLang);
      return newLang;
    });
  }

  function toggleDarkMode() {
    setDarkMode((dm) => {
      const newVal = !dm;
      if (typeof window !== "undefined") localStorage.setItem("darkMode", String(newVal));
      return newVal;
    });
  }

  function handleSectionChange(section) {
    setSelectedSection(section);
    if (typeof window !== "undefined") localStorage.setItem("selectedSection", section);
  }

  function handleServicePaid() {
    setReloadClient((v) => !v);
  }

  async function handleWalletCharge(amount) {
    if (!client) return;

    window.Paytabs?.open?.({
      secretKey: "PUT_YOUR_SECRET_KEY",
      merchantEmail: "your@email.com",
      amount,
      currency: "AED",
      customer_phone: client.phone || "",
      customer_email: client.email || "",
      order_id: `wallet_${client.customerId}_${Date.now()}`,
      site_url: typeof window !== "undefined" ? window.location.origin : "",
      product_name: "Wallet Topup",
      onSuccess: async () => {
        let bonus = 0;
        if (amount === 100) bonus = 50;
        else if (amount === 500) bonus = 250;
        else if (amount === 1000) bonus = 500;
        else if (amount === 5000) bonus = 2500;

        const newWallet = (client.walletBalance || 0) + amount;
        const newCoins = (client.coins || 0) + bonus;

        await updateDoc(doc(firestore, "users", client.customerId), { walletBalance: newWallet });

        await addNotification(
          client.customerId,
          lang === "ar" ? "تم شحن المحفظة" : "Wallet Charged",
          lang === "ar" ? `تم شحن محفظتك بمبلغ ${amount} درهم.` : `Your wallet was charged with ${amount} AED.`
        );

        if (bonus > 0) {
          await updateDoc(doc(firestore, "users", client.customerId), { coins: newCoins });
          await addNotification(
            client.customerId,
            lang === "ar" ? "تم إضافة كوينات" : "Coins Added",
            lang === "ar"
              ? `تم إضافة ${bonus} كوين لرصيدك كمكافأة شحن المحفظة.`
              : `You received ${bonus} coins as wallet charge bonus.`
          );
        }

        setReloadClient((v) => !v);
        alert(lang === "ar" ? "تم شحن المحفظة بنجاح!" : "Wallet charged successfully!");
      },
      onFailure: () => {
        alert(lang === "ar" ? "فشل الدفع! برجاء المحاولة مرة أخرى" : "Payment failed! Please try again.");
      },
    });
  }

  async function handleLogout() {
    try {
      const roomId = client?.userId || client?.customerId;
      if (roomId) {
        const msgsSnap = await getDocs(collection(firestore, "chatRooms", roomId, "messages"));
        const deletes = [];
        msgsSnap.forEach((msg) => {
          deletes.push(deleteDoc(doc(firestore, "chatRooms", roomId, "messages", msg.id)));
        });
        await Promise.all(deletes);
        await deleteDoc(doc(firestore, "chatRooms", roomId));
      }
    } catch {}

    await signOut(auth);
    router.replace("/login");
  }

  function advancedServiceFilter(service) {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    const sid = service?.serviceId || service?.id || service?.name;
    const tr = translationsMap[sid] || {};

    const fields = [
      service.name || "",
      service.name_en || "",
      service.description || "",
      service.description_en || "",
      service.subcategory || "",
      String(service.price || ""),
      String(service.duration || ""),
      (service.requiredDocuments || []).join(" "),
      tr.name || "",
      tr.description || "",
      tr.longDescription || "",
    ].map((f) => (f || "").toLowerCase());

    return fields.some((f) => f.includes(term));
  }

  // ---------- conditional early render ----------
  if (loading || resolving || resolvedUserId === null) return <GlobalLoader />;

  if (!client) {
    return (
      <div className="flex min-h-screen justify-center items-center bg-gradient-to-br from-[#0b131e] via-[#22304a] to-[#1d4d40]">
        <div className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 flex items-center justify-center animate-bounce">
            <Image
              src="/logo-transparent-large.png"
              alt="شعار الشركة"
              width={80}
              height={80}
              className="rounded-full bg-white ring-2 ring-red-400 shadow-lg"
              priority
            />
          </div>
          <span className="text-red-400 text-2xl font-bold animate-pulse">العميل غير موجود في قاعدة البيانات</span>
        </div>
      </div>
    );
  }

  // ====== Dark mode overlay animation ======
  const darkBgVariants = {
    initial: { opacity: 0 },
    animate: { opacity: darkMode ? 1 : 0, transition: { duration: 0.7 } },
    exit: { opacity: 0, transition: { duration: 0.5 } },
  };

  // ---------- render ----------
  return (
    <div
      className={`min-h-screen flex font-sans relative transition-colors duration-700 ${
        darkMode ? "bg-gray-900 text-white" : "bg-gradient-to-br from-[#0b131e] via-[#22304a] to-[#1d4d40] text-gray-900"
      }`}
      dir={dir}
      lang={lang}
    >
      {/* Dark overlay */}
      <AnimatePresence>
        {darkMode && (
          <motion.div
            key="dark-bg"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={darkBgVariants}
            className="fixed inset-0 z-[1] bg-gray-900 pointer-events-none"
            style={{ transition: "opacity 0.7s" }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <Sidebar
        selected={selectedSection}
        onSelect={handleSectionChange}
        lang={lang}
        clientType={clientType}
        selectedSubcategory={selectedSubcategory}
        onSelectSubcategory={setSelectedSubcategory}
      />

      <div className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <header
          className={`w-full z-30 ${
            darkMode ? "bg-gray-900/95" : "bg-gradient-to-b from-[#0b131e]/95 to-[#22304a]/90"
          } flex items-center justify-between px-2 sm:px-8 py-4 border-b border-emerald-900 shadow-xl sticky top-0 transition-colors duration-700`}
        >
          {/* Logo + info */}
          <div className="flex items-center gap-3 min-w-[230px]">
            <Image
              src="/logo-transparent-large.png"
              alt="شعار تأهيل"
              width={54}
              height={54}
              className="rounded-full bg-white ring-2 ring-emerald-400 shadow"
              priority
            />
            <div className="flex flex-col items-center text-center">
              <span className={`${darkMode ? "text-emerald-300" : "text-emerald-400"} text-2xl sm:text-3xl font-extrabold`}>
                تأهيل
              </span>
              <span className={`${darkMode ? "text-gray-200" : "text-gray-100"} text-lg sm:text-xl font-bold tracking-widest`}>
                TAHEEL
              </span>
              <span className={`${darkMode ? "text-emerald-100" : "text-emerald-200"} text-sm sm:text-base font-semibold my-1`}>
                لمتابعة المعلومات والمعاملات والخدمات
              </span>
            </div>
          </div>

          {/* Greeting */}
          <div className="flex-1 flex flex-col justify-center items-center px-2">
            <span className={`${darkMode ? "text-gray-100" : "text-white"} text-base sm:text-lg font-bold whitespace-nowrap`}>
              {`${getDayGreeting(lang)}, ${lang === "ar" ? "مرحباً" : "Welcome"} ${getFullName(client, lang)}`}
            </span>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Coins */}
            <div ref={coinsRef} className="relative group cursor-pointer" onClick={() => setShowCoinsMenu((v) => !v)}>
              <CoinsWidget coins={client.coins || 0} lang={lang} />
              <span
                className={`absolute z-10 left-1/2 -translate-x-1/2 top-7 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none ${
                  darkMode ? "bg-gray-800 text-white" : "bg-black/70 text-white"
                }`}
              >
                {lang === "ar" ? "الرصيد" : "Coins"}
              </span>
              {showCoinsMenu && (
                <div className={`absolute top-10 right-0 w-56 shadow-xl rounded-lg p-4 z-50 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
                  <div className="font-bold text-yellow-600 mb-2">{lang === "ar" ? "رصيد الكوينات" : "Coins Balance"}</div>
                  <div className="text-2xl font-black text-yellow-500">{client.coins || 0}</div>
                  <div className="text-xs text-gray-600 mt-2">
                    {lang === "ar" ? "يمكنك استخدام الكوينات في خدمات مختارة." : "You can use coins in selected services."}
                  </div>
                </div>
              )}
            </div>

            {/* Wallet */}
            <div ref={walletRef} className="relative group cursor-pointer" onClick={() => setShowWalletMenu((v) => !v)}>
              <WalletWidget
                balance={client.walletBalance || 0}
                coins={client.coins || 0}
                userId={client.customerId}
                customerId={client.customerId}
                userEmail={client.email}
                lang={lang}
                onBalanceChange={handleWalletCharge}
                onCoinsChange={null}
              />
              <span
                className={`absolute z-10 left-1/2 -translate-x-1/2 top-7 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none ${
                  darkMode ? "bg-gray-800 text-white" : "bg-black/70 text-white"
                }`}
              >
                {lang === "ar" ? "المحفظة" : "Wallet"}
              </span>
            </div>

            {/* Notifications */}
            <NotificationWidget userId={client.customerId} lang={lang} darkMode={darkMode} />

            {/* Messages */}
            <div ref={messagesRef} className="relative group cursor-pointer" onClick={() => setShowMessagesMenu((v) => !v)}>
              <motion.button
                type="button"
                className="relative flex items-center justify-center bg-transparent border-none p-0 m-0 rounded-full focus:outline-none cursor-pointer"
                tabIndex={0}
                style={{ minWidth: 36, minHeight: 36 }}
                whileHover={{ scale: 1.18, rotate: -8, filter: "brightness(1.12)" }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 250, damping: 18 }}
              >
                <FaEnvelopeOpenText
                  className={`text-[27px] sm:text-[29px] lg:text-[32px] ${darkMode ? "text-cyan-300" : "text-cyan-400"} drop-shadow-lg transition-all duration-150`}
                  style={{ filter: "drop-shadow(0 2px 8px #06b6d455)" }}
                />
                {client.unreadMessages > 0 && (
                  <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1 shadow">
                    {client.unreadMessages}
                  </span>
                )}
              </motion.button>

              <span
                className={`absolute z-10 left-1/2 -translate-x-1/2 top-7 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none ${
                  darkMode ? "bg-gray-800 text-white" : "bg-black/70 text-white"
                }`}
              >
                {lang === "ar" ? "الرسائل الواردة" : "Admin Messages"}
              </span>

              {showMessagesMenu && (
                <div className={`absolute top-10 right-0 w-64 shadow-xl rounded-lg p-4 z-50 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
                  <div className="font-bold text-cyan-800 mb-2">{lang === "ar" ? "الرسائل" : "Messages"}</div>

                  {client.messages && client.messages.length > 0 ? (
                    <ul className="space-y-2 max-h-60 overflow-y-auto">
                      {client.messages.map((msg, i) => (
                        <li key={i} className="border-b pb-2">
                          <div className="font-bold text-cyan-700">{msg.title || ""}</div>
                          <div className={`${darkMode ? "text-gray-200" : "text-gray-700"}`}>{msg.body || ""}</div>
                          <div className="text-gray-400 text-[10px] mt-1">{msg.time || ""}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-400 text-center">{lang === "ar" ? "لا توجد رسائل" : "No messages"}</div>
                  )}
                </div>
              )}
            </div>

            {/* Weather/time */}
            <span className="hidden sm:inline">
              <WeatherTimeWidget isArabic={lang === "ar"} />
            </span>

            {/* Dark / light mode */}
            <button
              onClick={toggleDarkMode}
              className={`relative flex items-center justify-center bg-transparent border-none p-0 m-0 rounded-full focus:outline-none cursor-pointer transition w-9 h-9 ${
                darkMode ? "hover:bg-emerald-700" : "hover:bg-emerald-200"
              }`}
              title={darkMode ? (lang === "ar" ? "الوضع النهاري" : "Light Mode") : lang === "ar" ? "الوضع المظلم" : "Dark Mode"}
            >
              {darkMode ? <FaSun className="text-yellow-400 text-[22px] drop-shadow" /> : <FaMoon className="text-gray-700 text-[22px] drop-shadow" />}
            </button>

            {/* Lang toggle */}
            <button
              onClick={toggleLang}
              className="px-3 py-1.5 rounded-full border border-emerald-500 bg-[#16222c] text-emerald-200 hover:bg-emerald-500 hover:text-white text-xs sm:text-sm font-bold shadow transition cursor-pointer"
              title={lang === "ar" ? "English" : "عربي"}
            >
              {lang === "ar" ? "ENGLISH" : "عربي"}
            </button>

            {/* Logout */}
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-full font-bold bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-700 text-white shadow hover:scale-105 hover:brightness-110 border border-emerald-200 transition"
              style={{ minHeight: 38, fontSize: 15, cursor: "pointer" }}
              onClick={handleLogout}
            >
              <FaSignOutAlt size={18} />
              تسجيل الخروج
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-4xl mx-auto p-4 z-10 relative flex flex-col items-center justify-center">
          {selectedSection === "personal" && (
            <>
              {clientType === "resident" && (
                <>
                  <ResidentCard client={client} lang={lang} />

                  {companies.length > 0 && (
                    <div className="w-full mt-8">
                      <SectionTitle icon="company" color="blue">
                        {lang === "ar" ? "شركاتي" : "My Companies"}
                      </SectionTitle>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {companies.map((cmp, idx) => {
                          const cmpId = cmp.customerId || cmp.id;
                          return (
                            <div key={(cmpId || "cmp") + idx} className="flex flex-col gap-3">
                              <CompanyCardGold companyId={cmpId} lang={lang} />
                              <OwnerCard companyId={cmpId} lang={lang} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {(client.type === "nonResident" || client.type === "nonresident" || clientType === "nonresident") && (
                <NonResidentCard client={client} lang={lang} />
              )}

              {clientType === "company" && (
                <>
                  <CompanyCardGold companyId={client.customerId} lang={lang} />
                  <OwnerCard companyId={client.customerId} lang={lang} />
                </>
              )}
            </>
          )}

          {selectedSection === "orders" && (
            <>
              <div className="w-full flex items-center my-8 select-none" />
              <ClientOrdersTracking clientId={client.customerId} lang={lang} orders={orders} showStatus />
            </>
          )}

          {selectedSection === "subscriptions" && clientType === "company" && (
  <>
    <SectionTitle icon="company" color="blue">
      {lang === "ar" ? "الاشتراكات" : "Subscriptions"}
    </SectionTitle>

    <div className="w-full">
<CompanySubscriptionsSection
  lang={lang}
  darkMode={darkMode}
/>
    </div>
  </>
)}


          {["residentServices", "companyServices", "nonresidentServices", "otherServices"].includes(selectedSection) && (
            <>
              <SectionTitle icon={sectionTitles[selectedSection].icon} color={sectionTitles[selectedSection].color}>
                {lang === "ar" ? sectionTitles[selectedSection].ar : sectionTitles[selectedSection].en}
              </SectionTitle>


              {/* Search box */}
              <div className="w-full flex items-center gap-2 mb-5">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={lang === "ar" ? "ابحث عن خدمة أو كلمة..." : "Search for any service..."}
                  className={`flex-1 px-5 py-3 rounded-full border-2 ${
                    darkMode
                      ? "border-gray-700 bg-gray-900 text-white placeholder:text-gray-400"
                      : "border-emerald-400 bg-white text-gray-700"
                  } shadow-lg outline-none focus:border-emerald-500 transition-all duration-300 text-lg font-semibold`}
                  style={{ minWidth: 0 }}
                  autoFocus
                />
                <button
                  className="px-2 py-2 rounded-full bg-emerald-500 text-white text-xl flex items-center justify-center shadow transition"
                  tabIndex={-1}
                  type="button"
                  disabled
                  style={{ cursor: "default" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <line x1="17" y1="17" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {currentServices
                  .filter((srv) => {
                    const matchesSearch = advancedServiceFilter(srv);
                    const matchesSubcat = !selectedSubcategory || srv.subcategory === selectedSubcategory;
                    return matchesSearch && matchesSubcat;
                  })
                  .map((srv, i) => {
                    const sid = srv?.serviceId || srv?.id || srv?.name;
                    const tr = translationsMap[sid] || {};

                    const displayName =
                      lang === "ar" ? srv.name || "" : tr?.name || srv.name_en || srv.name || "";
                    const displayDesc =
                      lang === "ar" ? srv.description || "" : tr?.description || srv.description_en || srv.description || "";
                    const displayLong =
                      lang === "ar"
                        ? srv.longDescription || ""
                        : tr?.longDescription || srv.longDescription_en || srv.longDescription || "";

                    return (
                      <ServiceProfileCard
                        key={(srv.name || "") + i}
                        category={selectedSection.replace("Services", "")}
                        name={displayName}
                        name_en={displayName}
                        description={displayDesc}
                        description_en={displayDesc}
                        price={srv.price}
                        printingFee={freePrinting && isCompanyServicesSection ? 0 : srv.printingFee}
                        tax={srv.tax}
                        clientPrice={srv.clientPrice}
                        duration={srv.duration}
                        requiredDocuments={srv.requiredDocuments || srv.documents || []}
                        requireUpload={srv.requireUpload}
                        coins={srv.coins || 0}
                        lang={lang}
                        userId={client.userId || client.customerId}
                        userWallet={client.walletBalance || 0}
                        userCoins={client.coins || 0}
                        userEmail={client.email}
                        longDescription={displayLong}
                        longDescription_en={displayLong}
                        setCoinsBalance={(val) => setClient((c) => ({ ...c, coins: val }))}
                        onPaid={handleServicePaid}
                        coinsPercent={0.1}
                        addNotification={addNotification}
                        serviceId={srv.serviceId}
                        repeatable={srv.repeatable}
                        allowPaperCount={srv.allowPaperCount}
                        pricePerPage={srv.pricePerPage}
                        customerId={client.customerId}
                        accountType={clientType}
                      />
                    );
                  })}
              </div>
            </>
          )}
        </main>

        {/* Footer / rights */}
        <footer className="w-full flex flex-col items-center justify-center mt-10 mb-4 z-10">
          <Image
            src="/logo-transparent-large.png"
            alt="شعار تأهيل"
            width={48}
            height={48}
            className="rounded-full bg-white ring-2 ring-emerald-400 shadow mb-3"
          />
          <div className="text-gray-400 text-xs mt-2">© 2025 تأهيل. جميع الحقوق محفوظة</div>
        </footer>
      </div>

      {/* Floating chat + WhatsApp */}
      <div className="fixed z-50 bottom-6 right-6 flex flex-col items-end gap-3">
        <button
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg w-14 h-14 flex items-center justify-center text-3xl cursor-pointer transition"
          title={lang === "ar" ? "محادثة موظف خدمة العملاء" : "Chat with Support"}
          onClick={() => setOpenChat(true)}
        >
          <FaComments />
        </button>

        <a
          href="https://wa.me/9665XXXXXXXX"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg w-14 h-14 flex items-center justify-center text-3xl cursor-pointer transition"
          title={lang === "ar" ? "تواصل واتساب" : "WhatsApp"}
        >
          <FaWhatsapp />
        </a>
      </div>

      {openChat && (
        <div className="fixed z-[100] bottom-28 right-6 shadow-2xl">
          <ChatWidgetFull userId={client.userId || client.customerId} userName={client.name} roomId={client.userId || client.customerId} />
          <button
            onClick={() => setOpenChat(false)}
            className="absolute -top-3 -left-3 bg-red-600 hover:bg-red-800 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg"
            title="إغلاق المحادثة"
            tabIndex={0}
          >
            ×
          </button>
        </div>
      )}

      {/* Order modal from ?order / ?pi */}
      {loadingOrderFromQuery && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-lg w-full text-center">
            <div className="text-lg font-bold mb-2">{lang === "ar" ? "جاري جلب تفاصيل الطلب..." : "Fetching order details..."}</div>
            <div className="text-sm text-gray-600">{lang === "ar" ? "الرجاء الانتظار..." : "Please wait..."}</div>
          </div>
        </div>
      )}

      {orderFetchErrorState && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-lg w-full text-center">
            <div className="text-lg font-bold mb-2 text-red-600">{lang === "ar" ? "خطأ في جلب الطلب" : "Error fetching order"}</div>
            <div className="text-sm text-gray-600 mb-4">{String(orderFetchErrorState.message || orderFetchErrorState)}</div>
            <div className="flex justify-center gap-3">
              <button onClick={() => setOrderFetchErrorState(null)} className="px-4 py-2 bg-emerald-600 text-white rounded">
                {lang === "ar" ? "حسناً" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrderFromQuery && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-lg w-full text-gray-800 text-sm relative">
            <button
              onClick={() => setSelectedOrderFromQuery(null)}
              className="absolute -top-3 -left-3 bg-red-600 hover:bg-red-800 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg"
            >
              ×
            </button>

            <div className="text-lg font-bold mb-4 text-emerald-700">{lang === "ar" ? "تفاصيل الطلب" : "Order Details"}</div>

            <pre className="bg-gray-100 text-gray-800 text-left p-3 rounded max-h-[50vh] overflow-y-auto text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(selectedOrderFromQuery, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================
// Page wrapper: read userId from query
// =====================================
export default function ClientProfilePage() {
  return (
    <Suspense fallback={null}>
      <ClientProfilePageInnerWrapper />
    </Suspense>
  );
}

function ClientProfilePageInnerWrapper() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  return <ClientProfilePageInner userId={userId} />;
}
