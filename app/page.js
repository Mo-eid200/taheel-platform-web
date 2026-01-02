"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  FaFacebookMessenger,
  FaInstagram,
  FaWhatsapp,
  FaMapMarkerAlt,
} from "react-icons/fa";
import CountUp from "react-countup";
import { motion } from "framer-motion";
import WeatherTimeWidget from "@/components/WeatherTimeWidget";
import TrackingForm from "@/components/TrackingForm";
import { GlobalLoader } from "@/components/GlobalLoader";
import AnnouncementBar from "@/components/AnnouncementBar";


// Force dynamic rendering (you already want that)
export const dynamic = "force-dynamic";

// =====================
// Translations
// =====================
const LANG = {
  en: {
    taheel: "TAHEEL",
    slogan: "Information Tracking Service",
    desc: "Certified Government Information & Clearance Platform",
    hero1: "TAHEEL — Smart Platform for Global Government Transactions",
    hero2:
      "Taheel is a smart and trusted solution for handling government services remotely.",
    hero3: "We serve individuals, visitors, and investors worldwide.",
    hero4:
      "Security, speed, and transparency... all services at your fingertips.",
    login: "Login",
    register: "Register",
    requestService: "Request Service",
    new: "NEW",
    services: "Our Services",
    resident: "Resident Services",
    nonresident: "Non-resident Services",
    company: "Company Services",
    other: "Other Services",
    residentClient: "Resident Client",
    visitorClient: "Visitor Client",
    registeredCompany: "Registered Company",
    completedTransactions: "Completed Transactions",
    trackTitle: "Track Your Request",
    trackDesc:
      "Enter your request or transaction number to check its status.",
    trackNow: "Track Now",
    about: "About Taheel",
    aboutDesc1:
      "Taheel is the first certified smart digital platform for managing government transactions and information services worldwide.",
    aboutDesc2:
      "From residence visas and business formation to instant translation and electronic documentation — Taheel delivers a complete, secure, and encrypted online experience.",
    aboutDesc3:
      "The platform uses advanced technologies for document archiving, real-time request tracking, and live customer support.",
    quickLinks: "Quick Links",
    contact: "Contact Us",
    getInTouch: "Get in Touch",
    allRights: "All rights reserved",
    registerNow: "Register & Start Now",
    home: "Home",
    dubai: "Dubai",
    placeholder: "Request or Tracking Number",
    enterTrackNum: "Please enter the tracking number first.",
    whatsappTitle: "Chat with us on WhatsApp",
    // footer links labels (for consistency)
    aboutUs: "About Us",
    privacy: "Privacy Policy",
    terms: "Terms & Conditions",
    careers: "Careers",
    companyPlansTitle: "Company Plans (PRO)",
companyPlansSub: "Save time & remove printing fees across your company transactions.",
mostPopular: "Most Popular",
subscribeNow: "View Plans",
plansNote: "Printing fees are waived after successful subscription payment.",
monthly: "Monthly",
quarterly: "3 Months",
semiannual: "6 Months",
yearly: "Yearly",
  },
  ar: {
    taheel: "تأهيل",
    slogan: "لخدمة متابعة المعلومات",
    desc: "منصة معتمدة لمتابعة المعلومات والمعاملات الحكومية",
    hero1: "تأهيل — منصة ذكية عالمية للمعاملات الحكومية",
    hero2: "منصة تأهيل الذكية — حل موثوق لتخليص المعاملات الحكومية عن بُعد.",
    hero3: "نخدم الأفراد، الزوار، والمستثمرين حول العالم.",
    hero4: "أمان، سرعة، وشفافية... كل الخدمات بين يديك.",
    login: "تسجيل الدخول",
    register: "تسجيل جديد",
    requestService: "اطلب الخدمة",
    new: "جديد",
    services: "خدماتنا",
    resident: "خدمات المقيمين",
    nonresident: "خدمات غير المقيمين",
    company: "خدمات الشركات",
    other: "خدمات أخرى",
    residentClient: "عميل مقيم",
    visitorClient: "عميل زائر",
    registeredCompany: "شركة مسجلة",
    completedTransactions: "معاملة منجزة",
    trackTitle: "تتبع حالة الطلب",
    trackDesc: "أدخل رقم المعاملة للتحقق من حالته بشكل مباشر.",
    trackNow: "تتبع الآن",
    about: "حول تأهيل",
    aboutDesc1:
      "تأهيل هي أول منصة رقمية ذكية معتمدة لمتابعة المعلومات والمعاملات الحكومية حول العالم.",
    aboutDesc2:
      "من تأشيرات الإقامة إلى تأسيس الشركات وخدمات الترجمة والتوثيق الإلكتروني — تأهيل توفر تجربة إلكترونية متكاملة وآمنة.",
    aboutDesc3:
      "تعتمد المنصة على أحدث التقنيات في أرشفة المستندات، تتبع الطلبات، وتقديم الدعم المباشر.",
    quickLinks: "روابط سريعة",
    contact: "تواصل معنا",
    getInTouch: "تواصل معنا",
    allRights: "جميع الحقوق محفوظة",
    registerNow: "سجل وابدأ الآن",
    home: "الرئيسية",
    dubai: "دبي",
    placeholder: "رقم الطلب أو التتبع",
    enterTrackNum: "من فضلك أدخل رقم الطلب أولاً",
    whatsappTitle: "تحدث معنا على واتساب",
    aboutUs: "من نحن",
    privacy: "سياسة الخصوصية",
    terms: "الشروط والأحكام",
    careers: "انضم إلينا",
    companyPlansTitle: "باقات الشركات (PRO)",
companyPlansSub: "وفر وقتك وألغِ رسوم الطباعة على معاملات شركتك بعد الاشتراك.",
mostPopular: "الأكثر اختيارًا",
subscribeNow: "عرض الباقات",
plansNote: "يتم إلغاء رسوم الطباعة بعد نجاح دفع الاشتراك فقط.",
monthly: "شهري",
quarterly: "3 شهور",
semiannual: "6 شهور",
yearly: "سنوي",
  },
};

// =====================
// Main Component
// =====================
function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const lang = searchParams.get("lang") === "ar" ? "ar" : "en";
  const t = LANG[lang];
  const isArabic = lang === "ar";
  const dir = isArabic ? "rtl" : "ltr";

  // state
  const [individuals, setIndividuals] = useState(8000);
  const [transactions, setTransactions] = useState(12500);
  const [companies, setCompanies] = useState(1200);

  const [dynamicIdx, setDynamicIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  const [loading, setLoading] = useState(false);

  const qrTitle = isArabic ? "QR Code" : "QR Code";
  const qrDesc = isArabic
    ? "امسح الكود لفتح التحميل/الملف التعريفي."
    : "Scan to open download / profile.";

  const qrLink =
    lang === "ar"
      ? "https://taheel.ae/p/u/brochure?lang=ar"
      : "https://taheel.ae/p/u/brochure?lang=en";

  // Dynamic value lines under "TAHEEL"
  const dynamicTextsAr = [
    "منصة معتمدة لمتابعة المعلومات والخدمات الحكومية",
    "سهولة وسرعة في تتبع معاملاتك الحكومية",
    "دقة وموثوقية مدعومة بأحدث التقنيات",
  ];

  const dynamicTextsEn = [
    "A certified platform for tracking government services",
    "Easy and fast tracking for your government transactions",
    "Accurate and reliable with the latest technologies",
  ];

  // Animated counters auto-increment over time
  useEffect(() => {
    const intervalIndividuals = setInterval(
      () => setIndividuals((prev) => prev + 3),
      5 * 60 * 1000 // كل 5 دقائق
    );
    const intervalTransactions = setInterval(
      () => setTransactions((prev) => prev + 4),
      60 * 60 * 1000 // كل ساعة
    );
    const intervalCompanies = setInterval(
      () => setCompanies((prev) => prev + 2),
      24 * 60 * 60 * 1000 // كل 24 ساعة
    );
    return () => {
      clearInterval(intervalIndividuals);
      clearInterval(intervalTransactions);
      clearInterval(intervalCompanies);
    };
  }, []);

  // Rotate marketing line every ~2.75s
  useEffect(() => {
    const list = isArabic ? dynamicTextsAr : dynamicTextsEn;
    const interval = setInterval(() => {
      setDynamicIdx((i) => (i + 1) % list.length);
    }, 2750);
    return () => clearInterval(interval);
  }, [isArabic]); // we intentionally re-run if language flips

  // switch language (keep other params)
  const toggleLanguage = useCallback(() => {
    const nextLang = lang === "ar" ? "en" : "ar";
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", nextLang);
    router.replace(`?${params.toString()}`);
  }, [lang, router, searchParams]);

  if (loading) {
    return <GlobalLoader />;
  }

  // certifications block
  const certifications = [
    {
      src: "/logos/google-digital-garage.png",
      alt: {
        ar: "Google Digital Garage Certified",
        en: "Google Digital Garage Certified",
      },
      label: {
        ar: "Google Digital Garage",
        en: "Google Digital Garage",
      },
    },
    {
      src: "/logos/iso-9001.png",
      alt: { ar: "ISO 9001 Certified", en: "ISO 9001 Certified" },
      label: { ar: "ISO 9001", en: "ISO 9001" },
    },
    {
      src: "/logos/iso-27001.png",
      alt: { ar: "ISO 27001 Certified", en: "ISO 27001 Certified" },
      label: { ar: "ISO 27001", en: "ISO 27001" },
    },
    {
      src: "/logos/google-business.png",
      alt: {
        ar: "Google Business Profile Verified",
        en: "Google Business Profile Verified",
      },
      label: {
        ar: "Google Business Profile",
        en: "Google Business Profile",
      },
    },
    {
      src: "/logos/cisco-cybersecurity.png",
      alt: {
        ar: "Cisco Cybersecurity Certified",
        en: "Cisco Cybersecurity Certified",
      },
      label: {
        ar: "Cisco Cybersecurity",
        en: "Cisco Cybersecurity",
      },
    },
    {
      src: "/logos/trustpilot.png",
      alt: { ar: "مراجعات Trustpilot", en: "Trustpilot Reviews" },
      label: { ar: "Trustpilot", en: "Trustpilot" },
    },
    {
      src: "/logos/dmca.png",
      alt: { ar: "محمية بحقوق النشر DMCA", en: "DMCA Protected" },
      label: { ar: "DMCA", en: "DMCA" },
    },
  ];

  const loginLink = `/login?lang=${lang}`;
  const registerLink = `/register?lang=${lang}`;

  const gradientBackground =
    "linear-gradient(180deg, #0b131e 0%, #22304a 30%, #122024 60%, #1d4d40 100%)";

  return (
    <div
      dir={dir}
      lang={lang}
      className="min-h-screen flex flex-col font-sans"
      style={{ background: gradientBackground }}
    >
      {/* ✅ Global Announcement */}
    <AnnouncementBar lang={lang} />

      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-[#06141B]/90 to-[#253745]/80 backdrop-blur border-b border-gray-800 shadow px-2 sm:px-4 py-4 md:py-8 rounded-b-xl w-full">
        <div className="flex flex-col md:flex-row justify-between items-center w-full gap-4">
          {/* Logo & Titles */}
          <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto">
            {/* Logo */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-28 md:h-28 flex items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-emerald-500">
              <Image
                src="/logo-transparent-large.png"
                alt="شعار تأهيل / Taheel Logo"
                width={80}
                height={80}
                className="object-contain"
                priority
              />
            </div>

            <div className="text-center space-y-1 sm:space-y-2 max-w-xs sm:max-w-md mx-auto">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-tight">
                TAHEEL - تأهيل
              </h1>
              <p className="text-xs sm:text-sm text-gray-200 font-medium">
                {t.slogan}
              </p>
              <p className="text-xs sm:text-base text-gray-300">{t.desc}</p>
              <p className="text-[10px] sm:text-xs md:text-sm text-gray-400 font-medium">
                DOCUMENTS CLEARING AND INFORMATIONS GOVERNMENT SERVICES PLATFORM
              </p>
            </div>
          </div>

          {/* Right Side Controls */}
          <div
            className={`flex flex-row items-center gap-2 sm:gap-4 w-full md:w-auto justify-end md:static ${
              isArabic ? "md:left-4 right-auto" : "md:right-4 left-auto"
            }`}
          >
            {/* Login / Register */}
            <div className="flex gap-1 sm:gap-2">
              <Link href={loginLink}>
                <button className="text-xs sm:text-sm px-3 sm:px-4 py-1 font-semibold rounded-full bg-blue-700 text-white hover:scale-105 transition duration-200 cursor-pointer">
                  {t.login}
                </button>
              </Link>
              <Link href={registerLink}>
                <button className="text-xs sm:text-sm px-3 sm:px-4 py-1 font-semibold rounded-full bg-green-600 text-white hover:scale-105 transition duration-200 cursor-pointer">
                  {t.register}
                </button>
              </Link>
            </div>

            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className="text-xs sm:text-sm px-3 sm:px-4 py-2 font-semibold bg-[#253745] text-gray-100 border border-gray-700 rounded-full shadow hover:bg-[#11212D] transition transform hover:scale-105 flex items-center gap-2 cursor-pointer"
              aria-label={isArabic ? "English" : "العربية"}
            >
              {isArabic ? (
                <>
                  🇺🇸 <span>English</span>
                </>
              ) : (
                <>
                  🇦🇪 <span>عربي</span>
                </>
              )}
            </button>

            {/* Weather/time widget */}
            <WeatherTimeWidget isArabic={isArabic} />
          </div>
        </div>
      </header>

      {/* ================= HERO VIDEO ================= */}
      <section className="relative w-full bg-[#22304a] overflow-hidden shadow-lg min-h-[220px] sm:min-h-[400px] md:min-h-[600px]">
        <div className="w-full max-w-[1280px] mx-auto relative min-h-[220px] sm:min-h-[400px] md:min-h-[600px]">
          <video
            autoPlay
            loop
            playsInline
            muted={isMuted}
            preload="auto"
            className="w-full h-[220px] sm:h-[400px] md:h-[600px] object-cover mx-auto rounded-b-3xl"
            poster="/video-poster.jpg"
          >
            <source src="/home-banner.mp4" type="video/mp4" />
          </video>

          {/* dark gradient on top of video */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="w-full h-full bg-gradient-to-b from-black/80 via-black/30 to-transparent" />
          </div>

          {/* mute/unmute button */}
          <button
            onClick={() => setIsMuted((m) => !m)}
            aria-label={
              isMuted
                ? isArabic
                  ? "تشغيل الصوت"
                  : "Unmute"
                : isArabic
                ? "كتم الصوت"
                : "Mute"
            }
            className={`absolute bottom-4 sm:bottom-6 ${
              isArabic ? "right-3 sm:right-5" : "left-3 sm:left-5"
            } z-50 bg-black/70 hover:bg-black/90 text-white px-3 sm:px-4 py-2 rounded-full text-xs sm:text-base shadow-lg flex items-center gap-2 transition`}
          >
            {isMuted
              ? isArabic
                ? "🔇 تشغيل الصوت"
                : "🔇 Unmute"
              : isArabic
              ? "🔊 كتم الصوت"
              : "🔊 Mute"}
          </button>

          {/* hero text overlay */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.37,
                  delayChildren: 0.35,
                },
              },
            }}
            className={`absolute inset-0 flex flex-col justify-center z-20 px-3 sm:px-6 ${
              isArabic ? "items-start text-left" : "items-end text-right"
            }`}
          >
            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 42 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 1.1 }}
              className="text-white text-xl sm:text-3xl md:text-5xl font-extrabold drop-shadow-xl mb-2"
            >
              {t.hero1}
            </motion.h1>

            <motion.h2
              variants={{
                hidden: { opacity: 0, y: 42 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 1.1, delay: 0.2 }}
              className="text-white text-base sm:text-xl md:text-2xl font-bold drop-shadow mb-2"
            >
              {t.hero2}
            </motion.h2>

            <motion.h3
              variants={{
                hidden: { opacity: 0, y: 42 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 1.1, delay: 0.4 }}
              className="text-white text-sm sm:text-lg md:text-xl drop-shadow mb-2"
            >
              {t.hero3}
            </motion.h3>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 42 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 1.1, delay: 0.6 }}
              className="text-white text-xs sm:text-base md:text-lg drop-shadow mb-4 max-w-2xl"
            >
              {t.hero4}
            </motion.p>

            {/* ✅ App Store / Google Play badges (image buttons) */}
{/* ✅ Store badges + QR frame */}
<motion.div
  variants={{
    hidden: { opacity: 0, y: 22 },
    visible: { opacity: 1, y: 0 },
  }}
  transition={{ duration: 0.9, delay: 0.8 }}
  className={`mt-2 flex flex-col sm:flex-row items-center gap-4 sm:gap-5 ${
    isArabic ? "justify-start" : "justify-end"
  }`}
>
  {/* Store Badges */}
  <div className={`flex flex-wrap items-center gap-3 sm:gap-4 ${
    isArabic ? "justify-start" : "justify-end"
  }`}>
    <a
      href="https://play.google.com/store/apps/details?id=ae.taheel.app"
      target="_blank"
      rel="noreferrer"
      className="cursor-pointer hover:scale-[1.03] active:scale-[0.99] transition-transform"
      aria-label="Google Play"
    >
      <Image
        src="/google-play.png"
        alt="Get it on Google Play"
        width={170}
        height={52}
        className="h-[44px] sm:h-[52px] w-auto drop-shadow-lg"
        priority={false}
      />
    </a>

    <a
      href="https://apps.apple.com/ae/app/taheel-government-services/id6755335579"
      target="_blank"
      rel="noreferrer"
      className="cursor-pointer hover:scale-[1.03] active:scale-[0.99] transition-transform"
      aria-label="App Store"
    >
      <Image
        src="/Download_on_the_App_Store.png"
        alt="Download on the App Store"
        width={170}
        height={52}
        className="h-[44px] sm:h-[52px] w-auto drop-shadow-lg"
        priority={false}
      />
    </a>
  </div>
  </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ================= TRACKING FORM ================= */}
      <section className="w-full py-10 flex justify-center bg-gradient-to-br from-emerald-950/60 via-[#122024]/90 to-emerald-900/40">
        <div className="max-w-xl w-full rounded-3xl shadow-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 sm:p-10 relative overflow-hidden">
          {/* glass light sweep */}
          <span
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background:
                "linear-gradient(120deg,rgba(16,185,129,0.10) 0%,rgba(59,130,246,0.08) 45%,rgba(245,158,11,0.11) 100%)",
              animation: "move-light 3.5s linear infinite",
              opacity: 0.85,
            }}
          />
          <h2 className="relative z-10 text-emerald-200 text-xl font-extrabold mb-7 text-center tracking-wide drop-shadow">
            {isArabic ? "تتبع حالة طلبك" : "Track Your Order Status"}
          </h2>

          <div className="relative z-10">
            <TrackingForm LANG={LANG} lang={lang} isArabic={isArabic} router={router} />
          </div>

          <style jsx>{`
            @keyframes move-light {
              0% {
                background-position: 0% 50%;
              }
              100% {
                background-position: 100% 50%;
              }
            }
          `}</style>
        </div>
      </section>

      {/* ================= ABOUT ================= */}
      <section className="py-10 sm:py-16 px-2 sm:px-4 bg-gradient-to-b from-[#22304a]/30 to-[#22304a]/5 text-white text-center backdrop-blur-md animate-fade-in">
        <div className="max-w-4xl mx-auto bg-[#0b131e]/80 rounded-2xl p-4 sm:p-8 md:p-12 shadow-xl border border-[#22304a] space-y-7 transition-all duration-700 hover:shadow-2xl hover:scale-[1.01]">
          <div className="flex justify-center">
            <Image
              src="/section-title.png"
              alt="شعار منصة تأهيل لمتابعة الخدمات والمعاملات الحكومية في الإمارات"
              width={90}
              height={90}
              className="mx-auto rounded-xl shadow-lg border-2 border-emerald-400 bg-white animate-logo-pop"
              title="منصة تأهيل"
              priority
            />
          </div>

          <h1
            className="text-xl sm:text-2xl md:text-3xl font-extrabold text-emerald-300 drop-shadow animate-slide-in-down"
            tabIndex={0}
          >
            {t.taheel || "تأهيل - TAHEEL"}
          </h1>

          {/* Dynamic line */}
          <div className="h-7 sm:h-8 flex justify-center items-center relative overflow-hidden">
            <span
              key={dynamicIdx}
              className="absolute left-0 right-0 text-sm sm:text-lg md:text-xl font-semibold text-emerald-200 mb-1 animate-fade-in-up transition-all duration-700"
            >
              {isArabic ? dynamicTextsAr[dynamicIdx] : dynamicTextsEn[dynamicIdx]}
            </span>
          </div>

          <p className="text-gray-200 text-xs sm:text-base md:text-lg leading-relaxed font-medium animate-fade-in delay-150">
            {t.aboutDesc1}
          </p>
          <p className="text-gray-200 text-xs sm:text-base md:text-lg leading-relaxed font-medium animate-fade-in delay-300">
            {t.aboutDesc2}
          </p>
          <p className="text-gray-200 text-xs sm:text-base md:text-lg leading-relaxed font-medium animate-fade-in delay-500">
            {t.aboutDesc3}
          </p>

          {/* Certifications */}
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-5 my-4 sm:my-6">
            {certifications.map((cert, i) => (
              <span key={i} className="group flex flex-col items-center">
                <img
                  src={cert.src}
                  alt={cert.alt[lang]}
                  title={cert.alt[lang]}
                  className="h-8 sm:h-10 w-auto object-contain grayscale group-hover:grayscale-0 transition duration-200 hover:scale-110"
                  loading="lazy"
                />
                <span className="text-xs mt-2 text-gray-400">
                  {cert.label[lang]}
                </span>
              </span>
            ))}
          </div>

          <div className="mt-4 sm:mt-6">
            <Link
              href={registerLink}
              aria-label={isArabic ? "سجّل الآن في منصة تأهيل" : "Register now on Taheel"}
            >
              <button className="cursor-pointer px-6 sm:px-8 py-2 sm:py-3 text-white text-xs sm:text-base md:text-lg font-semibold bg-gradient-to-r from-emerald-700 via-emerald-500 to-green-700 rounded-full shadow-lg hover:scale-110 transition-transform duration-300 hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-emerald-400 animate-bounce">
                {t.registerNow || "سجّل الآن"}
              </button>
            </Link>
          </div>

          <div className="text-xs text-gray-400 pt-2 font-medium animate-fade-in delay-700">
            {isArabic
              ? "منصة معتمدة من حكومة الإمارات | المقر الرئيسي: دبي"
              : "Certified by the UAE Government | Headquarters: Dubai"}
          </div>
        </div>
      </section>

      {/* ================= SERVICES ================= */}
      <section className="bg-gradient-to-b from-[#22304a]/90 to-[#122024]/90 py-10 sm:py-14 rounded-b-xl">
        <div className="max-w-6xl mx-auto px-2 sm:px-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10 sm:mb-12 text-white tracking-tight drop-shadow">
            {t.services}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 items-stretch">
            {[
              {
                key: "resident",
                icon: "/icons/resident.png",
                param: "resident",
                desc: {
                  ar: "خدمات الإقامة والتأشيرات والمعاملات الشخصية بمهنية وسرعة.",
                  en: "Residency, visa, and personal services with professionalism and speed.",
                },
                tagColor: "bg-emerald-100 text-emerald-700",
                counter: individuals,
                counterLabel: t.residentClient,
              },
              {
                key: "nonresident",
                icon: "/icons/non-resident.png",
                param: "nonresident",
                desc: {
                  ar: "خدمات للزوار والمستثمرين من خارج الدولة بموثوقية عالية.",
                  en: "Services for visitors and investors from abroad with high reliability.",
                },
                tagColor: "bg-rose-100 text-rose-700",
                counter: transactions,
                counterLabel: t.visitorClient,
              },
              {
                key: "company",
                icon: "/icons/company.png",
                param: "company",
                desc: {
                  ar: "تأسيس الشركات، التراخيص، وحلول الأعمال المتكاملة.",
                  en: "Company formation, licensing, and integrated business solutions.",
                },
                tagColor: "bg-sky-100 text-sky-700",
                counter: companies,
                counterLabel: t.registeredCompany,
              },
              {
                key: "other",
                icon: "/icons/other.png",
                param: "other",
                desc: {
                  ar: "خدمات سياحية، دعم المستثمرين، واستشارات متنوعة.",
                  en: "Tourism, investor support, and diverse consulting services.",
                },
                tagColor: "bg-yellow-100 text-yellow-700",
                counter: transactions,
                counterLabel: t.completedTransactions,
              },
            ].map((service, idx) => (
              <motion.div
                key={service.key}
                className="flex"
                initial={{ rotateY: 70, scale: 0.75, opacity: 0 }}
                whileInView={{
                  rotateY: 0,
                  scale: 1,
                  opacity: 1,
                }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.75,
                  delay: idx * 0.18,
                  type: "spring",
                  bounce: 0.34,
                }}
              >
                <Link
                  href={`/services?section=${service.param}&lang=${lang}`}
                  className="flex w-full"
                >
                  <div className="group relative flex flex-col p-4 sm:p-6 bg-gradient-to-br from-[#24354a] to-[#121c24] rounded-3xl shadow-xl hover:shadow-2xl transition duration-300 transform hover:-translate-y-2 hover:scale-[1.025] border border-gray-800 hover:border-emerald-500 min-h-[340px] sm:min-h-[420px] h-full cursor-pointer">
                    {/* NEW pill */}
                    <span
                      className={`absolute top-3 left-3 ${service.tagColor} text-xs font-bold px-3 py-1 rounded-full shadow-sm`}
                    >
                      {t.new}
                    </span>

                    {/* icon bubble */}
                    <div className="w-16 sm:w-20 h-16 sm:h-20 flex items-center justify-center mb-4 sm:mb-5 mt-2 sm:mt-3 mx-auto">
                      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-emerald-300 via-white to-cyan-300 shadow-lg">
                        <Image
                          src={service.icon}
                          alt={t[service.key] || (isArabic ? "أيقونة الخدمة" : "Service icon")}
                          width={56}
                          height={56}
                          className="w-10 sm:w-14 h-10 sm:h-14 object-contain"
                          style={{ background: "transparent" }}
                        />
                      </div>
                    </div>

                    {/* title */}
                    <h3 className="text-base sm:text-lg font-extrabold text-emerald-300 mb-1 sm:mb-2 text-center tracking-tight drop-shadow">
                      {t[service.key]}
                    </h3>

                    {/* description */}
                    <p className="text-gray-200 text-xs sm:text-sm mb-4 sm:mb-6 text-center leading-relaxed min-h-[36px] sm:min-h-[44px]">
                      {service.desc[lang]}
                    </p>

                    {/* counter */}
                    <div className="flex flex-col items-center mb-4 sm:mb-6 mt-auto">
                      <span className="text-xl sm:text-3xl font-extrabold text-emerald-400 drop-shadow-sm">
                        <CountUp end={service.counter} duration={2} separator="," />
                      </span>
                      <span className="text-xs text-gray-400 mt-1">
                        {service.counterLabel}
                      </span>
                    </div>

                    {/* CTA */}
                    <div className="flex justify-center mt-2">
                      <button className="px-4 sm:px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-700 text-white text-xs sm:text-sm font-bold rounded-full shadow-md hover:from-emerald-700 hover:to-green-800 transition duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                        {t.requestService}
                      </button>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= COMPANY PLANS ================= */}
{/* ================= COMPANY PLANS (UPGRADED) ================= */}
<section className="py-14 sm:py-20 px-2 sm:px-4 bg-gradient-to-b from-[#071018]/90 via-[#0c1c22]/80 to-[#192233]/95">
  <div className="max-w-6xl mx-auto">
    {/* Header */}
    <div className={`mb-12 ${isArabic ? "text-right" : "text-left"}`}>
      <div className={`flex flex-wrap items-center gap-2 ${isArabic ? "justify-end" : "justify-start"}`}>
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 border border-white/10 text-emerald-200 text-xs font-extrabold shadow">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {t.companyPlansTitle}
        </span>

        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-100 text-xs font-bold">
          {isArabic ? "عروض وميزات للشركات" : "Exclusive offers for companies"}
        </span>
      </div>

      <h2 className="mt-5 text-2xl sm:text-4xl md:text-5xl font-extrabold text-white drop-shadow">
        {isArabic ? "اشتراك واحد = طباعة بدون رسوم" : "One Subscription = Printing Fees Waived"}
      </h2>

      <p className="mt-3 text-sm sm:text-base text-white/70 max-w-3xl leading-relaxed">
        {t.companyPlansSub}
      </p>

      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
        <p className="text-[12px] text-white/55">
          {t.plansNote}
        </p>

        {/* mini highlight */}
        <div className="inline-flex items-center gap-2 text-[12px] font-bold px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80">
          <span className="text-emerald-300">★</span>
          {isArabic ? "الأكثر طلبًا: السنوي" : "Most requested: Yearly"}
        </div>
      </div>
    </div>

    {/* Cards */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 sm:gap-6 items-stretch">
      {[
        {
          key: "monthly",
          title: t.monthly,
          price: "—",
          tag: "",
          hint: isArabic ? "تجربة سريعة للشركات" : "Quick start for teams",
          glow: "hover:border-emerald-400/50",
          accent: "from-white/8 to-white/0",
          perks: isArabic
            ? ["إلغاء رسوم الطباعة", "تفعيل فوري بعد الدفع", "دعم مباشر"]
            : ["Printing fees waived", "Instant activation after payment", "Priority support"],
          cta: isArabic ? "ابدأ الآن" : "Start Now",
        },

        // ✅ YEARLY FEATURED (Most requested)
        {
          key: "yearly",
          title: t.yearly,
          price: "—",
          tag: isArabic ? "الأكثر طلبًا" : "Most Requested",
          hint: isArabic ? "أفضل توفير + ثبات في التكاليف" : "Best savings + stable budgeting",
          glow:
            "border-emerald-400/70 hover:border-emerald-400/90 shadow-[0_40px_120px_-80px_rgba(16,185,129,0.85)]",
          accent: "from-emerald-500/20 via-white/10 to-emerald-900/5",
          perks: isArabic
            ? ["إلغاء رسوم الطباعة", "أولوية تنفيذ أعلى", "تجديد أسهل للشركة"]
            : ["Printing fees waived", "Higher processing priority", "Easier renewals"],
          cta: isArabic ? "اشترك سنويًا" : "Subscribe Yearly",
          featured: true,
          saveLine: isArabic ? "وفّر حتى 20% مقارنة بالشهري" : "Save up to 20% vs monthly",
        },

        {
          key: "quarterly",
          title: t.quarterly,
          price: "—",
          tag: isArabic ? "قيمة ممتازة" : "Great Value",
          hint: isArabic ? "مناسب للشركات المتنامية" : "Perfect for growing teams",
          glow: "hover:border-emerald-400/50",
          accent: "from-white/8 to-white/0",
          perks: isArabic
            ? ["أفضل قيمة للشركات", "إلغاء رسوم الطباعة", "تتبع أسرع للطلبات"]
            : ["Great value for teams", "Printing fees waived", "Faster tracking"],
          cta: isArabic ? "اشترك الآن" : "Subscribe",
        },

        {
          key: "semiannual",
          title: t.semiannual,
          price: "—",
          tag: "",
          hint: isArabic ? "ثبات في التكاليف 6 شهور" : "Stable for 6 months",
          glow: "hover:border-emerald-400/50",
          accent: "from-white/8 to-white/0",
          perks: isArabic
            ? ["ثبات في التكاليف", "إلغاء رسوم الطباعة", "تقارير أسهل للمحاسبة"]
            : ["Stable budgeting", "Printing fees waived", "Cleaner accounting"],
          cta: isArabic ? "اشترك" : "Subscribe",
        },
      ].map((p, idx) => (
        <motion.div
          key={p.key}
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.22 }}
          transition={{ duration: 0.65, delay: idx * 0.08 }}
          className={`relative ${p.featured ? "md:-mt-3" : ""}`}
        >
          {/* Badge */}
          {p.tag ? (
            <div className={`absolute -top-3 ${isArabic ? "right-4" : "left-4"} z-20`}>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold shadow ${
                  p.featured
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-white border border-white/10"
                }`}
              >
                {p.tag}
              </span>
            </div>
          ) : null}

          {/* Featured glow ring */}
          {p.featured ? (
            <span
              className="pointer-events-none absolute -inset-1 rounded-[28px] opacity-80"
              style={{
                background:
                  "linear-gradient(120deg, rgba(16,185,129,0.35), rgba(255,255,255,0.10), rgba(16,185,129,0.22))",
                filter: "blur(10px)",
              }}
            />
          ) : null}

          <div
            className={`relative h-full rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 ${p.glow} p-5 sm:p-6 flex flex-col overflow-hidden`}
          >
            {/* Accent background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${p.accent} opacity-90`} />

            {/* top */}
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <div className="text-white font-extrabold text-lg">{p.title}</div>
                <div className="mt-1 text-[12px] text-white/60 font-semibold">{p.hint}</div>
              </div>

              <div
                className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${
                  p.featured
                    ? "text-emerald-200 bg-emerald-500/10 border-emerald-400/25"
                    : "text-emerald-300 bg-emerald-500/10 border-emerald-400/20"
                }`}
              >
                PRO
              </div>
            </div>

            {/* price */}
            <div className="relative z-10 mt-5">
              <div className="text-white/70 text-xs">{isArabic ? "السعر" : "Price"}</div>
              <div className="text-3xl font-extrabold text-white mt-1 leading-none">
                {p.price}
                <span className="text-xs text-white/55 font-semibold">{isArabic ? " AED" : " AED"}</span>
              </div>

              <div className="text-[11px] text-white/55 mt-2">
                {isArabic ? "يظهر السعر بعد ربط لوحة التحكم" : "Price loads from admin plan settings"}
              </div>

              {/* Save line for yearly */}
              {p.saveLine ? (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-100 text-[11px] font-extrabold">
                  <span className="text-emerald-300">⚡</span>
                  {p.saveLine}
                </div>
              ) : null}
            </div>

            {/* perks */}
            <ul className="relative z-10 mt-6 space-y-2 text-sm text-white/78">
              {p.perks.map((x, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-[2px] text-emerald-300">✓</span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="relative z-10 mt-auto pt-7">
              <Link href={`/company-subscriptions?lang=${lang}`}>
                <button
                  className={`w-full cursor-pointer px-5 py-3 rounded-full font-extrabold shadow-lg transition ${
                    p.featured
                      ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-600 text-[#071018] hover:scale-[1.03]"
                      : "bg-gradient-to-r from-emerald-700 via-emerald-500 to-green-700 text-white hover:scale-[1.02]"
                  } active:scale-[0.99]`}
                >
                  {p.cta || t.subscribeNow}
                </button>
              </Link>

              <div className="mt-3 text-[11px] text-white/45 text-center">
                {isArabic
                  ? "التفعيل يتم تلقائيًا بعد نجاح الدفع فقط"
                  : "Activation happens automatically only after successful payment"}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>

    {/* Bottom CTA strip */}
    <div className="mt-12 rounded-3xl bg-gradient-to-r from-emerald-900/35 via-black/25 to-emerald-900/35 border border-white/10 p-6 sm:p-7 flex flex-col md:flex-row items-center justify-between gap-4 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none opacity-60"
        style={{ background: "radial-gradient(circle at 20% 10%, rgba(16,185,129,0.18), transparent 55%)" }}
      />
      <div className={`relative z-10 ${isArabic ? "text-right" : "text-left"}`}>
        <div className="text-white font-extrabold text-lg">
          {isArabic ? "جاهز تخلي شركتك PRO؟" : "Ready to make your company PRO?"}
        </div>
        <div className="text-white/70 text-sm mt-1">
          {isArabic ? "باقات مصممة للشركات… وميزة واضحة: الطباعة بدون رسوم." : "Plans built for companies… with clear value: printing fees waived."}
        </div>
      </div>

      <div className="relative z-10 flex gap-2">
        <Link href={`/company-subscriptions?lang=${lang}`}>
          <button className="cursor-pointer px-6 py-3 rounded-full bg-white text-[#0b131e] font-extrabold shadow hover:scale-105 transition">
            {isArabic ? "اذهب للباقات" : "Go to Plans"}
          </button>
        </Link>

        <a
          href="https://wa.me/971554463108"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer px-6 py-3 rounded-full bg-emerald-600 text-white font-extrabold shadow hover:bg-emerald-700 hover:scale-105 transition"
        >
          {isArabic ? "استفسار سريع" : "Quick Ask"}
        </a>
      </div>
    </div>
  </div>
</section>



      {/* ================= FOOTER ================= */}
      <footer className="bg-[#192233] text-gray-200 pt-10 sm:pt-14 pb-4 sm:pb-6 px-2 sm:px-4 mt-10 sm:mt-20 rounded-t-3xl shadow-lg border-t border-[#22304a]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 gap-y-12 sm:gap-y-10">
          {/* about / intro */}
          <div className="flex flex-col items-center md:items-start gap-3 sm:gap-4 order-1 md:order-1">
            <div className="flex items-center gap-3 sm:gap-4 mb-1">
              <Image
                src="/logo-transparent-large.png"
                alt="TAHEEL LOGO"
                width={44}
                height={44}
                className="rounded-full bg-white p-1 ring-2 ring-emerald-400 shadow w-10 h-10 sm:w-[60px] sm:h-[60px]"
              />
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-emerald-400 mb-1">
                  TAHEEL - تأهيل
                </h3>
                <span className="text-xs font-bold text-emerald-300">
                  {isArabic
                    ? "منصة معتمدة لمتابعة المعلومات والمعاملات الحكومية"
                    : "Certified Platform for Government Information & Transactions"}
                </span>
              </div>
            </div>

            <div className="text-gray-400 text-xs sm:text-sm leading-relaxed max-w-xs text-justify">
              {isArabic ? (
                <>
                  <b>تأهيل</b> منصة معتمده (من حكومة دبي) ذكية تعتمد على الذكاء
                  الاصطناعي والتقنيات الحديثة في متابعة وإنجاز المعاملات والمعلومات
                  الحكومية.
                  <br />
                  جميع بياناتك محمية بأعلى معايير التشفير، وتتم المعالجة والمعاينة
                  إلكترونيًا بسرعة وشفافية.
                  <br />
                  تعتمد المنصة على إدارة رقمية متطورة وأرشفة مؤمنة، مع دعم مباشر
                  وواجهة سهلة لكل المستخدمين حول العالم.
                </>
              ) : (
                <>
                  <b>TAHEEL</b> is an AI-powered smart government platform for
                  secure information and transaction management.
                  <br />
                  Your data is protected with industry-leading encryption, and all
                  processes are handled digitally with speed and full transparency.
                  <br />
                  The platform leverages advanced automation, secure archiving, and
                  instant support for users worldwide.
                </>
              )}
            </div>

{/* ✅ Download Panel: QR + Store Buttons (Aligned) */}
<div id="download" className="w-full max-w-[520px] mt-3">
  <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_20px_80px_-60px_rgba(0,0,0,0.9)] p-4 sm:p-5">
    {/* Title */}
    <div className={`${isArabic ? "text-right" : "text-left"} mb-3`}>
      <div className="text-sm font-extrabold text-white/90">
        {isArabic ? "تحميل تطبيق تأهيل" : "Download TAHEEL App"}
      </div>
      <div className="text-xs text-white/60">
        {isArabic ? "امسح الـ QR أو اختر المتجر المناسب" : "Scan the QR or choose your store"}
      </div>
    </div>

    {/* Body */}
    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-4 items-center">
      {/* ✅ QR (IMAGE ONLY) */}
      <div
        className="group select-none justify-self-center sm:justify-self-start"
        aria-label="Smart QR"
        title={isArabic ? "امسح لتحميل التطبيق" : "Scan to download the app"}
      >
        <div className="relative rounded-2xl bg-black/35 border border-white/10 p-3 w-[150px]">
          <div className="text-[11px] font-bold text-white/80 text-center">
            Smart QR
          </div>

          <div className="mt-2 flex justify-center">
            <div className="relative w-[112px] h-[112px] rounded-xl overflow-hidden bg-white ring-1 ring-white/20">
              <Image
                src="/Taheel-qr.png"
                alt="TAHEEL Smart QR"
                fill
                className="object-contain p-2"
                sizes="112px"
                draggable={false}
              />
            </div>
          </div>

          <div className="mt-2 text-[10px] text-white/55 text-center leading-4">
            {isArabic ? "iOS / Android تلقائيًا" : "Auto iOS / Android"}
          </div>

          {/* subtle glow */}
          <span
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300"
            style={{
              boxShadow: "0 0 0 1px rgba(52,211,153,0.20), 0 0 26px rgba(52,211,153,0.14)",
            }}
          />
        </div>
      </div>

      {/* ✅ Stores */}
      <div className={`flex flex-col gap-3 items-center ${isArabic ? "sm:items-start" : "sm:items-start"}`}>
        <a
          href="https://play.google.com/store/apps/details?id=ae.taheel.app"
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer hover:scale-[1.03] active:scale-[0.99] transition-transform"
          aria-label="Google Play"
        >
          <Image
            src="/google-play.png"
            alt="Get it on Google Play"
            width={180}
            height={56}
            className="h-[46px] w-auto drop-shadow-lg"
          />
        </a>

        <a
          href="https://apps.apple.com/ae/app/taheel-government-services/id6755335579"
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer hover:scale-[1.03] active:scale-[0.99] transition-transform"
          aria-label="App Store"
        >
          <Image
            src="/Download_on_the_App_Store.png"
            alt="Download on the App Store"
            width={180}
            height={56}
            className="h-[46px] w-auto drop-shadow-lg"
          />
        </a>

        <div className={`text-[11px] text-white/55 w-full ${isArabic ? "text-right" : "text-left"}`}>
          {isArabic ? "اختر المتجر المناسب أو امسح الكود للتحميل" : "Choose your store or scan the QR"}
        </div>
      </div>
    </div>
  </div>
</div>
          </div>
          {/* quick links */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 order-3 md:order-2">
            <h4 className="text-base sm:text-lg font-bold text-white mb-1 sm:mb-2">
              {t.quickLinks}
            </h4>
            <ul className="flex flex-col gap-1 sm:gap-2 text-sm sm:text-base text-center">
              <li>
                <Link href={`/?lang=${lang}`}>{t.home}</Link>
              </li>
              <li>
                <Link href={`/services?section=resident&lang=${lang}`}>
                  {t.resident}
                </Link>
              </li>
              <li>
                <Link href={`/services?section=nonresident&lang=${lang}`}>
                  {t.nonresident}
                </Link>
              </li>
              <li>
                <Link href={`/services?section=company&lang=${lang}`}>
                  {t.company}
                </Link>
              </li>
              <li>
                <Link href={`/services?section=other&lang=${lang}`}>
                  {t.other}
                </Link>
              </li>
              <li>
                <Link href={`/about?lang=${lang}`}>{t.aboutUs}</Link>
              </li>
              <li>
                <Link href={`/privacy?lang=${lang}`}>{t.privacy}</Link>
              </li>
              <li>
                <Link href={`/terms?lang=${lang}`}>{t.terms}</Link>
              </li>
              <li>
                <Link href={`/careers?lang=${lang}`}>{t.careers}</Link>
              </li>
            </ul>
          </div>

          {/* contact */}
          <div className="flex flex-col items-center md:items-end gap-3 sm:gap-4 order-2 md:order-3">
            <h4 className="text-base sm:text-lg font-bold text-white mb-1">
              {t.getInTouch}
            </h4>

            <iframe
              src="https://maps.google.com/maps?q=Red%20Avenue%20Building%2C%20Dubai&t=&z=15&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="120"
              className="rounded-xl border border-gray-700 w-full mb-2 hidden sm:block"
              loading="lazy"
              allowFullScreen
              title="TAHEEL Office Map"
              style={{
                minWidth: "180px",
                maxWidth: "320px",
              }}
            />

            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-300">
              <FaMapMarkerAlt className="text-emerald-400" />
              <span>
                57th St - Al Garhoud - Dubai, Red Avenue Building, Office No. 60
              </span>
            </div>

            {/* ✅ phone (force LTR to prevent reversing in RTL) */}
<div className="flex flex-col gap-2 text-xs sm:text-sm text-gray-300">
  {/* 📞 Phone */}
  <div className="flex items-center gap-2">
    <span>📞</span>
    <a
      href="tel:+971554463108"
      className="underline hover:text-emerald-400"
      dir="ltr"
      style={{ unicodeBidi: "isolate" }}
    >
      +971 55 446 3108
    </a>
  </div>

  {/* 🟢 WhatsApp */}
  <div className="flex items-center gap-2">
    <FaWhatsapp className="text-green-500 text-base sm:text-lg" />
    <a
      href="https://wa.me/971565698331"
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:text-green-400 font-medium"
      dir="ltr"
      style={{ unicodeBidi: "isolate" }}
    >
      +971 56 569 8331
    </a>
  </div>
</div>




            {/* ✅ email (force LTR) */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-300">
              <span>✉️</span>
              <a
                href="mailto:info@TAHEEL.ae"
                className="underline hover:text-emerald-400"
                dir="ltr"
                style={{ unicodeBidi: "isolate" }}
              >
                info@TAHEEL.ae
              </a>
            </div>

            {/* socials */}
            <div className="flex gap-2 sm:gap-3 mt-2">
              <a
                href="https://wa.me/971554463108"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full p-2 sm:p-3 shadow transition focus:outline-none"
                aria-label="WhatsApp"
              >
                <FaWhatsapp size={18} className="sm:text-[22px]" />
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 sm:p-3 shadow transition focus:outline-none"
                aria-label="Messenger"
              >
                <FaFacebookMessenger size={18} className="sm:text-[22px]" />
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-pink-500 hover:bg-pink-600 text-white rounded-full p-2 sm:p-3 shadow transition focus:outline-none"
                aria-label="Instagram"
              >
                <FaInstagram size={18} className="sm:text-[22px]" />
              </a>
            </div>
          </div>
        </div>

        {/* bottom bar */}
        <div className="max-w-7xl mx-auto mt-8 sm:mt-10 border-t border-[#22304a] pt-3 sm:pt-4 text-center text-xs text-gray-400 flex flex-col md:flex-row justify-between items-center gap-2">
          <span>
            © {new Date().getFullYear()} {t.taheel}. {t.allRights}
          </span>
          <span>{t.dubai} - Powered by TAHEEL Team</span>
        </div>

        {/* floating WhatsApp button */}
        <a
          href="https://wa.me/+971554463108"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 z-50 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg p-4 text-xl transition"
          title={t.whatsappTitle}
          aria-label={t.whatsappTitle}
          dir="ltr"
          style={{ unicodeBidi: "isolate" }}
        >
          <FaWhatsapp />
        </a>
      </footer>
    </div>
  );
}

// Wrapper with Suspense for searchParams/router in Next app dir
export default function HomePage() {
  return (
    <Suspense fallback={<GlobalLoader />}>
      <HomePageInner />
    </Suspense>
  );
}