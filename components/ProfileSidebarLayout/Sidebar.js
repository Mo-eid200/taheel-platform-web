import { useEffect, useRef, useState } from "react";
import {
  FaUser, FaClipboardList, FaServicestack,
  FaBuilding, FaUserTie, FaTag,
  FaChevronLeft, FaChevronRight
} from "react-icons/fa";
import { firestore } from "@/lib/firebase.client";
import { doc, getDoc } from "firebase/firestore";
import { FaCrown } from "react-icons/fa";

// الأقسام الأساسية
const MAIN_SECTIONS = [
  { key: "personal", icon: <FaUser size={22} />, ar: "المعلومات الشخصية", en: "Personal Info" },
  { key: "orders",   icon: <FaClipboardList size={22} />, ar: "الطلبات الحالية", en: "Current Orders" },
];

const SERVICE_SECTIONS = {
  resident: [
    { key: "residentServices", icon: <FaServicestack size={22} />, ar: "خدمات المقيم", en: "Resident Services" },
    { key: "otherServices", icon: <FaTag size={22} />, ar: "خدمات أخرى", en: "Other Services" },
  ],
  nonresident: [
    { key: "nonresidentServices", icon: <FaUserTie size={22} />, ar: "خدمات غير المقيم", en: "Non-Resident Services" },
    { key: "otherServices", icon: <FaTag size={22} />, ar: "خدمات أخرى", en: "Other Services" },
  ],
  company: [
    { key: "subscriptions", icon: <FaCrown size={22} />, ar: "اشتراك PRO", en: "PRO Subscription" },
    { key: "companyServices", icon: <FaBuilding size={22} />, ar: "خدمات الشركات", en: "Company Services" },
    { key: "residentServices", icon: <FaServicestack size={22} />, ar: "خدمات المقيم", en: "Resident Services" },
    { key: "otherServices", icon: <FaTag size={22} />, ar: "خدمات أخرى", en: "Other Services" },
  ],
};

export default function Sidebar({
  selected,
  onSelect = () => {},
  lang = "ar",
  clientType = "resident",
  selectedSubcategory = "",
  onSelectSubcategory = () => {},
}) {
  const [opened, setOpened] = useState(true);
  const sidebarRef = useRef();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const headerHeight = 140;
  const [showSubcatsFor, setShowSubcatsFor] = useState(null);
  const serviceSections = SERVICE_SECTIONS[clientType] || [];
  const [isHovered, setIsHovered] = useState(false);

  // السابكاتوجري الديناميكية لكل قسم خدمات
  const [subcategories, setSubcategories] = useState({});
  const [loadingSubcats, setLoadingSubcats] = useState(false);

  // جلب السابكاتوجري الديناميكية من الخدمات تحت القسم
  async function fetchSubcategories(sectionKey) {
    let docKey = "";
    if (sectionKey === "residentServices") docKey = "resident";
    else if (sectionKey === "nonresidentServices") docKey = "nonresident";
    else if (sectionKey === "companyServices") docKey = "company";
    else if (sectionKey === "otherServices") docKey = "other";
    if (!docKey) return;
    setLoadingSubcats(true);
    try {
      const snap = await getDoc(doc(firestore, "servicesByClientType", docKey));
      if (!snap.exists()) return;
      const data = snap.data();
      const servicesArr = Object.entries(data)
        .filter(([key, val]) => key.startsWith("service") && typeof val === "object")
        .map(([key, val]) => val);
      const uniqueSubcats = [...new Set(servicesArr.map((s) => s.subcategory).filter(Boolean))];
      setSubcategories((prev) => ({ ...prev, [sectionKey]: uniqueSubcats }));
    } catch (error) {
      setSubcategories((prev) => ({ ...prev, [sectionKey]: [] }));
    }
    setLoadingSubcats(false);
  }

  useEffect(() => {
    function handleClick(e) {
      if (opened && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setOpened(false);
        setShowSubcatsFor(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [opened]);

  const floatingBtnStyle = {
    position: "absolute",
    top: "26px",
    right: dir === "rtl" ? "-18px" : undefined,
    left: dir === "ltr" ? "-18px" : undefined,
    width: "36px",
    height: "36px",
    background: "#fff",
    color: "#10b981",
    borderRadius: "50%",
    boxShadow: "0 2px 12px 0 rgba(16,185,129,0.18)",
    border: "2px solid #10b981",
    cursor: "pointer",
    zIndex: 99,
    transition: "background 0.25s, color 0.25s, border-color 0.25s, box-shadow 0.25s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    outline: "none",
  };

  const floatingBtnHoverStyle = {
    background: "#10b981",
    color: "#fff",
    borderColor: "#059669",
    boxShadow: "0 4px 24px 0 rgba(16,185,129,0.32)",
  };

  const handleServiceSectionClick = async (sectionKey) => {
    // subscriptions: no subcats
    if (sectionKey === "subscriptions") {
      setShowSubcatsFor(null);
      onSelect("subscriptions");
      onSelectSubcategory("");
      return;
    }

    // toggle subcats
    if (showSubcatsFor === sectionKey) {
      setShowSubcatsFor(null);
      onSelect(sectionKey);
      onSelectSubcategory("");
    } else {
      setShowSubcatsFor(sectionKey);
      onSelect(sectionKey);
      onSelectSubcategory("");
      await fetchSubcategories(sectionKey);
    }
  };

  // عند اختيار سابكاتوجري تظهر خدماته فقط
  const handleSubcategoryClick = (sectionKey, subcat) => {
    onSelect(sectionKey);
    onSelectSubcategory(subcat);
  };

  const isPro = (k) => k === "subscriptions";
  const proActive = selected === "subscriptions";

  return (
    <aside
      ref={sidebarRef}
      className={`fixed left-0 z-40`}
      dir={dir}
      lang={lang}
      style={{
        top: `${headerHeight}px`,
        height: `calc(100vh - ${headerHeight}px)`,
        width: opened ? "260px" : "70px",
        minWidth: opened ? "260px" : "70px",
        background: `linear-gradient(135deg, #16222c 80%, #22304a 100%), url(/wave-bg.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: "40px",
        boxShadow: "0 6px 24px 0 rgba(16,185,129,0.15)",
        border: "none",
        overflow: "hidden",
        transition: "width 0.5s cubic-bezier(.4,0,.2,1), box-shadow 0.3s, background 0.5s, top 0.3s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ✅ Neon keyframes (local to component) */}
      <style jsx>{`
        @keyframes proPulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,211,238,.35), 0 0 18px rgba(168,85,247,.18); }
          50%  { box-shadow: 0 0 0 0 rgba(34,211,238,.10), 0 0 34px rgba(168,85,247,.32); }
          100% { box-shadow: 0 0 0 0 rgba(34,211,238,.35), 0 0 18px rgba(168,85,247,.18); }
        }
        @keyframes proSweep {
          0% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
          25% { opacity: 1; }
          55% { opacity: 1; }
          100% { transform: translateX(120%) skewX(-12deg); opacity: 0; }
        }
      `}</style>

      {/* زر فتح/غلق عائم صغير وديناميكي */}
      <button
        style={isHovered ? { ...floatingBtnStyle, ...floatingBtnHoverStyle } : floatingBtnStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          setOpened((v) => !v);
          if (opened) setShowSubcatsFor(null);
        }}
        title={opened ? (lang === "ar" ? "إغلاق القائمة" : "Close sidebar") : (lang === "ar" ? "فتح القائمة" : "Open sidebar")}
      >
        {opened ? <FaChevronLeft size={20} /> : <FaChevronRight size={20} />}
      </button>

      {/* اللوجو */}
      <div className={`mt-10 mb-8 flex items-center justify-center transition-all duration-300 ${opened ? "opacity-100" : "opacity-0"}`}>
        <div className="w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-emerald-400">
          <img
            src="/logo-transparent-large.png"
            alt="Logo"
            className="w-12 h-12 rounded-full"
            style={{ objectFit: "contain" }}
          />
        </div>
      </div>

      {/* قائمة التنقل الرئيسية */}
      <nav className="flex flex-col gap-2 mt-2">
        {MAIN_SECTIONS.map((section) => (
          <button
            key={section.key}
            className={`flex flex-row items-center gap-3 px-4 py-3 rounded-full transition-all font-bold text-base group
              ${
                selected === section.key
                  ? "bg-emerald-700/20 text-emerald-300 shadow"
                  : "text-gray-100 hover:bg-emerald-400/20 hover:text-emerald-300"
              }`}
            onClick={() => {
              setShowSubcatsFor(null);
              onSelect(section.key);
              onSelectSubcategory("");
            }}
            style={{ justifyContent: "flex-start", cursor: "pointer" }}
            tabIndex={0}
          >
            <span className={`transition-all ${opened ? "" : "mx-auto"}`}>{section.icon}</span>
            {opened && <span className="whitespace-nowrap">{lang === "ar" ? section.ar : section.en}</span>}
          </button>
        ))}

        {/* أقسام الخدمات حسب نوع العميل */}
        {serviceSections.map((section) => {
          const pro = isPro(section.key);
          const active = selected === section.key;
          const neonBase =
            "text-cyan-50 border border-cyan-300/25 bg-gradient-to-r from-cyan-500/15 via-fuchsia-500/10 to-sky-500/15 hover:from-cyan-500/22 hover:via-fuchsia-500/16 hover:to-sky-500/22";
          const neonActive =
            "text-white border border-cyan-300/40 bg-gradient-to-r from-cyan-500/25 via-fuchsia-500/18 to-sky-500/25";

          return (
            <div key={section.key}>
              <button
                className={`relative overflow-hidden flex flex-row items-center gap-3 px-4 py-3 rounded-full transition-all font-bold text-base group
                  ${
                    pro
                      ? active
                        ? neonActive
                        : neonBase
                      : active
                      ? "bg-emerald-700/20 text-emerald-300 shadow"
                      : "text-gray-100 hover:bg-emerald-400/20 hover:text-emerald-300"
                  }
                `}
                onClick={() => handleServiceSectionClick(section.key)}
                style={{
                  justifyContent: "flex-start",
                  cursor: "pointer",
                  // ✅ neon pulse for PRO (always, stronger when active)
                  animation: pro ? "proPulse 1.55s ease-in-out infinite" : undefined,
                }}
                tabIndex={0}
              >
                {/* ✅ shiny sweep layer for PRO */}
                {pro ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                      width: "55%",
                      animation: "proSweep 1.8s ease-in-out infinite",
                      mixBlendMode: "screen",
                    }}
                  />
                ) : null}

                {/* icon bubble */}
                <span
                  className={`transition-all ${opened ? "" : "mx-auto"}`}
                  style={
                    pro
                      ? {
                          filter: "drop-shadow(0 0 10px rgba(34,211,238,.35)) drop-shadow(0 0 18px rgba(168,85,247,.20))",
                        }
                      : undefined
                  }
                >
                  {section.icon}
                </span>

                {opened && (
                  <div className="flex items-center gap-2 min-w-0">
                    {/* title */}
                    <span className="whitespace-nowrap truncate">
                      {lang === "ar" ? section.ar : section.en}
                    </span>

                    {/* ✅ PRO neon badge */}
                    {pro ? (
                      <span
                        className="ml-1 text-[10px] font-extrabold px-2 py-[2px] rounded-full border"
                        style={{
                          background: "rgba(0,0,0,0.35)",
                          borderColor: "rgba(34,211,238,0.35)",
                          color: "#e0f2fe",
                          boxShadow:
                            "0 0 0 1px rgba(34,211,238,0.12), 0 0 18px rgba(34,211,238,0.18), 0 0 26px rgba(168,85,247,0.14)",
                        }}
                      >
                        PRO
                      </span>
                    ) : null}
                  </div>
                )}

                {/* right hint glow dot for PRO */}
                {pro ? (
                  <span
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{
                      right: dir === "rtl" ? undefined : "14px",
                      left: dir === "rtl" ? "14px" : undefined,
                      width: "8px",
                      height: "8px",
                      borderRadius: "999px",
                      background: "rgba(34,211,238,0.9)",
                      boxShadow: "0 0 14px rgba(34,211,238,.55), 0 0 26px rgba(168,85,247,.25)",
                      opacity: proActive ? 1 : 0.75,
                    }}
                  />
                ) : null}
              </button>

              {/* قائمة السابكاتوجري تظهر فقط لو القسم مفتوح ومختار */}
              <div
                style={{
                  maxHeight:
                    showSubcatsFor === section.key &&
                    subcategories[section.key] &&
                    opened &&
                    subcategories[section.key].length
                      ? "500px"
                      : "0px",
                  opacity:
                    showSubcatsFor === section.key &&
                    subcategories[section.key] &&
                    opened &&
                    subcategories[section.key].length
                      ? 1
                      : 0,
                  overflow: "hidden",
                  transition: "max-height 0.5s cubic-bezier(.4,0,.2,1), opacity 0.4s",
                }}
                className="pl-8 pr-2 mt-1 mb-2 flex flex-col gap-1"
              >
                {loadingSubcats ? (
                  <div className="text-xs text-gray-400 py-2">جاري التحميل...</div>
                ) : (
                  <>
                    {subcategories[section.key]?.map((subcat) => (
                      <button
                        key={subcat}
                        onClick={() => handleSubcategoryClick(section.key, subcat)}
                        className={`text-sm rounded-full px-3 py-1 font-bold transition border
                          ${
                            selectedSubcategory === subcat
                              ? "bg-emerald-400 text-white"
                              : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                          }
                        `}
                        style={{ cursor: "pointer" }}
                      >
                        {subcat}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* فراغ لحقوق الملكية بالأسفل */}
      <div className="flex-1" />

      {/* حقوق الملكية */}
      {opened && (
        <div className="text-xs text-gray-400 text-center mb-8 transition-opacity opacity-80 relative z-10">
          © 2025 تأهيل. جميع الحقوق محفوظة
        </div>
      )}
    </aside>
  );
}
