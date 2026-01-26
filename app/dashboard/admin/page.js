"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, firestore } from "@/lib/firebase.client";
import { onAuthStateChanged, signOut } from "firebase/auth"; // أضفنا signOut هنا
import { doc, getDoc } from "firebase/firestore";
import WeatherTimeWidget from "@/components/WeatherTimeWidget";
import DashboardSection from "@/components/admin/DashboardSection";
import UsersSection from "@/components/admin/UsersSection";
import CompaniesSection from "@/components/admin/CompaniesSection";
import StaffSection from "@/components/admin/StaffSection";
import OrdersSection from "@/components/admin/OrdersSection";
import FinanceSection from "@/components/admin/FinanceSection";
import NotificationsSection from "@/components/admin/NotificationsSection";

// Force dynamic rendering to prevent static export issues
export const dynamic = 'force-dynamic';
import ServicesSection from "@/components/admin/ServicesSection";
import SocialSection from "@/components/admin/SocialSection";
import SubscriptionsSection from "@/components/admin/SubscriptionsSection";
import ArchiveSection from "@/components/admin/ArchiveSection";
import ChatWidget from "@/components/admin/ChatWidget";
import {
  FaUsers,
  FaMoneyBillWave,
  FaBuilding,
  FaClipboardList,
  FaBell,
  FaCogs,
  FaChartPie,
  FaSignOutAlt,
  FaEnvelopeOpenText,
  FaGlobe,
  FaChevronRight,
  FaChevronLeft,
  FaUserTie,
  FaArchive,
  FaComments
} from "react-icons/fa";

// ---------- الحماية ----------
function AdminGuard({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminData, setAdminData] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?prev=/dashboard/admin");
        return;
      }
      const snap = await getDoc(doc(firestore, "users", user.uid));
      if (snap.exists() && (snap.data().role === "admin" || snap.data().role === "superadmin")) {
        setAllowed(true);
        setAdminData({ id: user.uid, ...snap.data() });
      } else {
        router.replace("/unauthorized");
      }
      setChecking(false);
    });
    return () => unsub();
  }, [router]);

  if (checking) return <div className="p-10 text-center">جاري التأكد من الصلاحية...</div>;
  if (!allowed) return null;
  return typeof children === "function" ? children(adminData) : children;
}

// ---------------------------------

const GRADIENT_BG =
  "bg-gradient-to-br from-emerald-400 via-emerald-700 to-blue-900";

function getDayGreeting(lang = "ar") {
  const hour = new Date().getHours();
  if (lang === "ar") {
    if (hour >= 0 && hour < 12) return "صباح الخير";
    if (hour >= 12 && hour < 18) return "مساء الخير";
    return "مرحبًا";
  } else {
    if (hour >= 0 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 18) return "Good afternoon";
    return "Welcome";
  }
}

function getWelcome(name = "المدير", lang = "ar") {
  if (lang === "ar") {
    return `مرحباً ${name}`;
  } else {
    return `Welcome, ${name}`;
  }
}

const SIDEBAR_LINKS = [
  {
    key: "dashboard",
    icon: <FaChartPie />,
    labelAr: "الإحصائيات",
    labelEn: "Dashboard"
  },
  {
    key: "users",
    icon: <FaUsers />,
    labelAr: "إدارة العملاء ",
    labelEn: "Clients Management (Residents/Non-Residents/Companies)"
  },
  {
    key: "staff",
    icon: <FaUserTie />,
    labelAr: "الموظفين والمدراء",
    labelEn: "Staff & Admins"
  },
  {
    key: "orders",
    icon: <FaClipboardList />,
    labelAr: "الطلبات",
    labelEn: "Orders"
  },
  {
    key: "finance",
    icon: <FaMoneyBillWave />,
    labelAr: "الماليات",
    labelEn: "Finance & E-Wallets"
  },
  {
    key: "notifications",
    icon: <FaBell />,
    labelAr: "الإشعارات",
    labelEn: "Notifications"
  },
  {
    key: "messages",
    icon: <FaEnvelopeOpenText />,
    labelAr: "إدارة الخدمات",
    labelEn: "Messages"
  },
  {
    key: "social",
    icon: <FaGlobe />,
    labelAr: "السوشيال ميديا",
    labelEn: "Social Media"
  },
  {
    key: "settings",
    icon: <FaCogs />,
    labelAr: "إدارة الباقات والإضافات",
    labelEn: "Plans & Add-ons"
  },
  {
    key: "archive",
    icon: <FaArchive />,
    labelAr: "الأرشيف",
    labelEn: "Archive"
  }
];

function AdminDashboardPage({ adminData }) {
  const [lang, setLang] = useState("ar");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [openChat, setOpenChat] = useState(false);
  const router = useRouter(); // لإعادة التوجيه بعد تسجيل الخروج

  const adminId = adminData?.id || "ADMIN-001";
  const adminName = adminData?.name || (lang === "ar" ? "المدير العام" : "Super Admin");
  const dir = lang === "ar" ? "rtl" : "ltr";

  // دالة تسجيل الخروج
  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  function renderSection() {
    switch (activeSection) {
      case "dashboard":
        return <DashboardSection lang={lang} />;
      case "users":
        return <UsersSection lang={lang} />;
      case "companies":
        return <CompaniesSection lang={lang} />;
      case "staff":
        return <StaffSection lang={lang} />;
      case "orders":
        return <OrdersSection lang={lang} />;
      case "finance":
        return <FinanceSection lang={lang} />;
      case "notifications":
        return <NotificationsSection lang={lang} />;
      case "messages":
        return <ServicesSection lang={lang} />;
      case "social":
        return <SocialSection lang={lang} />;
      case "settings":
        return <SubscriptionsSection lang={lang} />;
      case "archive":
        return <ArchiveSection lang={lang} />;
      default:
        return null;
    }
  }

  return (
    <div className={`min-h-screen flex font-sans ${GRADIENT_BG}`} dir={dir} lang={lang}>
      {/* Sidebar */}
      <aside className={`
          h-screen fixed top-0 z-30 flex flex-col
          transition-all duration-300
          ${sidebarOpen ? "w-64 left-0" : "w-16 -left-0"}
          bg-emerald-950/95 border-l border-emerald-800
          shadow-2xl
        `}
        style={{ minWidth: sidebarOpen ? "16rem" : "4rem", height: "100vh" }}
      >
        <div className="flex items-center gap-3 px-4 py-6">
          <Image src="/logo-transparent-large.png" alt="شعار تأهيل"
            width={sidebarOpen ? 48 : 38} height={sidebarOpen ? 48 : 38}
            className="rounded-full bg-white ring-2 ring-emerald-400 shadow" priority />
          {sidebarOpen && (
            <div className="flex flex-col">
              <span className="text-emerald-400 text-lg font-extrabold">تأهيل</span>
              <span className="text-gray-100 text-base font-bold tracking-widest">TAHEEL</span>
            </div>
          )}
        </div>
        <button
          className={`
            absolute ${lang === "ar" ? "left-full" : "right-full"}
            top-9 z-50 bg-emerald-400 hover:bg-emerald-600 text-white
            p-1 rounded-full shadow-lg transition cursor-pointer
          `}
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? (lang === "ar" ? "إخفاء القائمة" : "Hide Sidebar") : (lang === "ar" ? "عرض القائمة" : "Show Sidebar")}
        >
          {sidebarOpen
            ? lang === "ar"
              ? <FaChevronRight />
              : <FaChevronLeft />
            : lang === "ar"
              ? <FaChevronLeft />
              : <FaChevronRight />
          }
        </button>
        <nav className="flex-1 px-2 pt-3">
          <ul className="space-y-2">
            {SIDEBAR_LINKS.map((item, i) => (
              <li key={i}>
                <button
                  className={`
                    w-full flex items-center gap-3 px-4 py-2 rounded-lg
                    text-emerald-100 hover:bg-emerald-800/80 transition
                    font-bold text-base cursor-pointer
                    ${activeSection === item.key ? 'bg-emerald-700/80 font-extrabold' : ''}
                  `}
                  tabIndex={0}
                  onClick={() => setActiveSection(item.key)}
                >
                  {item.icon}
                  {sidebarOpen && (
                    <span className="whitespace-nowrap">{lang === "ar" ? item.labelAr : item.labelEn}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="px-4 pb-6 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 justify-center bg-emerald-500 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-full shadow transition cursor-pointer"
            title={lang === "ar" ? "تسجيل الخروج" : "Logout"}
          >
            <FaSignOutAlt />
            {sidebarOpen && (lang === "ar" ? "تسجيل الخروج" : "Logout")}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col relative z-10 ${sidebarOpen ? "ml-64" : "ml-16"} transition-all duration-300`}>
        {/* Header */}
        <header className="w-full z-20 px-4 sm:px-10 py-5 flex items-center justify-between bg-gradient-to-b from-emerald-500/90 to-blue-900/90 shadow border-b border-emerald-900 sticky top-0">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-transparent-large.png"
              alt="شعار تأهيل"
              width={48}
              height={48}
              className="rounded-full bg-white ring-2 ring-emerald-400 shadow"
              priority
            />
            <div className="flex flex-col items-center text-center">
              <span className="text-emerald-400 text-2xl font-extrabold">تأهيل</span>
              <span className="text-gray-100 text-lg font-bold tracking-widest">TAHEEL</span>
              <span className="text-emerald-200 text-sm font-semibold my-1 whitespace-nowrap">
                {lang === "ar" ? "لوحة تحكم المدير العام" : "Admin Dashboard"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-white text-lg font-bold whitespace-nowrap">
              {getDayGreeting(lang)}
            </span>
            <span className="text-emerald-200 text-base font-bold whitespace-nowrap mt-1">
              {getWelcome(adminName, lang)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative cursor-pointer">
              <FaBell className="text-yellow-400 text-xl hover:text-yellow-600 transition" />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1">3</span>
            </div>
            <WeatherTimeWidget isArabic={lang === "ar"} />
            <button
              onClick={() => setLang((l) => (l === "ar" ? "en" : "ar"))}
              className="px-3 py-2 rounded-full border border-emerald-500 bg-[#16222c] text-emerald-200 hover:bg-emerald-500 hover:text-white text-xs font-bold shadow transition cursor-pointer"
              title={lang === "ar" ? "English" : "عربي"}
            >
              {lang === "ar" ? "ENGLISH" : "عربي"}
            </button>
          </div>
        </header>

        <div className="w-full max-w-6xl mx-auto pt-6 px-2 md:px-8">
          <h1 className="text-2xl font-extrabold text-emerald-800 mb-4">
            {lang === "ar"
              ? SIDEBAR_LINKS.find(l => l.key === activeSection)?.labelAr
              : SIDEBAR_LINKS.find(l => l.key === activeSection)?.labelEn}
          </h1>
        </div>

        <main className="flex-1 w-full max-w-6xl mx-auto pb-10 px-2 md:px-8 flex flex-col gap-10">
          {renderSection()}
        </main>
        <footer className="w-full flex flex-col items-center justify-center text-center mt-8 mb-4 z-10 relative">
          <Image
            src="/logo-transparent-large.png"
            alt="شعار تأهيل"
            width={44}
            height={44}
            className="rounded-full bg-white ring-2 ring-emerald-400 shadow mb-2"
          />
          <div className="text-gray-400 text-xs mt-1">
            © 2025 تأهيل. جميع الحقوق محفوظة
          </div>
        </footer>
      </div>
      {/* ويدجت الشات الإداري (الموظفين والمدراء فقط) */}
      <div className="fixed z-[1000] bottom-8 right-8">
        <button
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg w-14 h-14 flex items-center justify-center text-3xl cursor-pointer transition"
          title={lang === "ar" ? "شات الموظفين/المدير" : "Staff/Admin Chat"}
          onClick={() => setOpenChat(true)}
          style={{ zIndex: 1000 }}
        >
          <FaComments />
        </button>
        {openChat && (
          <div className="fixed z-[1100] bottom-28 right-8 shadow-2xl">
            <ChatWidget
              userId={adminId}
              userName={adminName}
              roomId="staff-room"
              onClose={() => setOpenChat(false)}
            />
            <button
              onClick={() => setOpenChat(false)}
              className="absolute -top-3 -left-3 bg-red-600 hover:bg-red-800 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg"
              title="إغلاق المحادثة"
              tabIndex={0}
              style={{ zIndex: 1200 }}
            >×</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------- Export default الصفحة -----------
export default function AdminDashboardWrapper() {
  return (
    <AdminGuard>
      {(adminData) => <AdminDashboardPage adminData={adminData} />}
    </AdminGuard>
  );
}