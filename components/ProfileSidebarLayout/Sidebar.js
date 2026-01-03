"use client";

import { useEffect, useRef, useState } from "react";
import {
  FaUser,
  FaClipboardList,
  FaServicestack,
  FaBuilding,
  FaUserTie,
  FaTag,
  FaChevronLeft,
  FaChevronRight,
  FaComments,
  FaEnvelopeOpenText,
} from "react-icons/fa";
import { FaCrown } from "react-icons/fa";
import { firestore } from "@/lib/firebase.client";
import { doc, getDoc } from "firebase/firestore";

// الأقسام الأساسية
const MAIN_SECTIONS = [
  { key: "personal", icon: <FaUser size={22} />, ar: "المعلومات الشخصية", en: "Personal Info" },
  { key: "orders", icon: <FaClipboardList size={22} />, ar: "الطلبات الحالية", en: "Current Orders" },
];

// أقسام الخدمات حسب نوع العميل
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
  const [isHovered, setIsHovered] = useState(false);
  const [showSubcatsFor, setShowSubcatsFor] = useState(null);

  const sidebarRef = useRef(null);

  const dir = lang === "ar" ? "rtl" : "ltr";
  const headerHeight = 140;

  // ✅ Guard: subscriptions تظهر للشركة فقط
  const safeClientType = clientType === "company" ? "company" : clientType;
  const serviceSectionsRaw = SERVICE_SECTIONS[safeClientType] || [];
  const serviceSections =
    safeClientType !== "company"
      ? serviceSectionsRaw.filter((s) => s.key !== "subscriptions")
      : serviceSectionsRaw;

  // السابكاتوجري الديناميكية لكل قسم خدمات
  const [subcategories, setSubcategories] = useState({});
  const [loadingSubcats, setLoadingSubcats] = useState(false);

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
      if (!snap.exists()) {
        setSubcategories((prev) => ({ ...prev, [sectionKey]: [] }));
        return;
      }

      const data = snap.data() || {};
      const servicesArr = Object.entries(data)
        .filter(([key, val]) => key.startsWith("service") && typeof val === "object" && val)
        .map(([, val]) => val);

      const uniqueSubcats = [...new Set(servicesArr.map((s) => s.subcategory).filter(Boolean))];
      setSubcategories((prev) => ({ ...prev, [sectionKey]: uniqueSubcats }));
    } catch {
      setSubcategories((prev) => ({ ...prev, [sectionKey]: [] }));
    } finally {
      setLoadingSubcats(false);
    }
  }

  // close sidebar if click outside
  useEffect(() => {
    function handleClick(e) {
      if (opened && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setOpened(false);
        setShowSubcatsFor(null);
        onSelectSubcategory("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [opened, onSelectSubcategory]);

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
    // ✅ subscriptions: صفحة مباشرة بدون subcats
    if (sectionKey === "subscriptions") {
      setShowSubcatsFor(null);
      onSelect("subscriptions");
      onSelectSubcategory("");
      return;
    }

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

  const handleSubcategoryClick = (sectionKey, subcat) => {
    onSelect(sectionKey);
    onSelectSubcategory(subcat);
  };

  const asidePosStyle =
    dir === "rtl"
      ? { right: 0, left: "auto" }
      : { left: 0, right: "auto" };

  // سهم الزر حسب الاتجاه
  const ToggleIcon = opened
    ? (dir === "rtl" ? FaChevronRight : FaChevronLeft)
    : (dir === "rtl" ? FaChevronLeft : FaChevronRight);

  return (
    <aside
      ref={sidebarRef}
      className="fixed z-40"
      dir={dir}
      lang={lang}
      style={{
        ...asidePosStyle,
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
      {/* زر فتح/غلق */}
      <button
        style={isHovered ? { ...floatingBtnStyle, ...floatingBtnHoverStyle } : floatingBtnStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          setOpened((v) => !v);
          if (opened) {
            setShowSubcatsFor(null);
            onSelectSubcategory("");
          }
        }}
        title={
          opened
            ? lang === "ar"
              ? "إغلاق القائمة"
              : "Close sidebar"
            : lang === "ar"
              ? "فتح القائمة"
              : "Open sidebar"
        }
      >
        <ToggleIcon size={20} />
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

      {/* القائمة */}
      <nav className="flex flex-col gap-2 mt-2">
        {MAIN_SECTIONS.map((section) => (
          <button
            key={section.key}
            className={`flex flex-row items-center gap-3 px-4 py-3 rounded-full transition-all font-bold text-base group
              ${selected === section.key
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

        {serviceSections.map((section) => (
          <div key={section.key}>
            <button
              className={`flex flex-row items-center gap-3 px-4 py-3 rounded-full transition-all font-bold text-base group
                ${selected === section.key
                  ? "bg-emerald-700/20 text-emerald-300 shadow"
                  : "text-gray-100 hover:bg-emerald-400/20 hover:text-emerald-300"
                }`}
              onClick={() => handleServiceSectionClick(section.key)}
              style={{ justifyContent: "flex-start", cursor: "pointer" }}
              tabIndex={0}
            >
              <span className={`transition-all ${opened ? "" : "mx-auto"}`}>{section.icon}</span>
              {opened && <span className="whitespace-nowrap">{lang === "ar" ? section.ar : section.en}</span>}
            </button>

            {/* subcategories */}
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
                <div className="text-xs text-gray-400 py-2">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>
              ) : (
                <>
                  {subcategories[section.key]?.map((subcat) => (
                    <button
                      key={subcat}
                      onClick={() => handleSubcategoryClick(section.key, subcat)}
                      className={`text-sm rounded-full px-3 py-1 font-bold transition border
                        ${selectedSubcategory === subcat
                          ? "bg-emerald-400 text-white"
                          : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                        }`}
                      style={{ cursor: "pointer" }}
                    >
                      {subcat}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      {opened && (
        <div className="text-xs text-gray-400 text-center mb-8 transition-opacity opacity-80 relative z-10">
          © 2025 تأهيل. جميع الحقوق محفوظة
        </div>
      )}
    </aside>
  );
}
