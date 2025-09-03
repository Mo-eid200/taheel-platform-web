'use client';

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FaFacebookMessenger, FaInstagram, FaWhatsapp, FaMapMarkerAlt } from "react-icons/fa";
import CountUp from "react-countup";
import { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import WeatherTimeWidget from "@/components/WeatherTimeWidget";
import TrackingForm from "@/components/TrackingForm";
import { GlobalLoader } from "@/components/GlobalLoader";

// Force dynamic rendering to prevent static export issues
export const dynamic = 'force-dynamic';

// ترجمة النصوص
const LANG = {
  en: {
    taheel: "TAHEEL",
    slogan: "Information Tracking Service",
    desc: "Certified Government Information & Clearance Platform",
    hero1: "TAHEEL — Smart Platform for Global Government Transactions",
    hero2: "Taheel is a smart and trusted solution for handling government services remotely.",
    hero3: "We serve individuals, visitors, and investors worldwide.",
    hero4: "Security, speed, and transparency... all services at your fingertips.",
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
    trackDesc: "Enter your request or transaction number to check its status.",
    trackNow: "Track Now",
    about: "About Taheel",
    aboutDesc1: "Taheel is the first certified smart digital platform for managing government transactions and information services worldwide.",
    aboutDesc2: "From residence visas and business formation to instant translation and electronic documentation — Taheel delivers a complete, secure, and encrypted online experience.",
    aboutDesc3: "The platform uses advanced technologies for document archiving, real-time request tracking, and live customer support.",
    quickLinks: "Quick Links",
    contact: "Contact Us",
    getInTouch: "Get in Touch",
    allRights: "All rights reserved",
    registerNow: "Register & Start Now",
    home: "Home",
    dubai: "Dubai",
    placeholder: "Request or Tracking Number",
    enterTrackNum: "Please enter the tracking number first.",
    whatsappTitle: "Chat with us on WhatsApp"
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
    aboutDesc1: "تأهيل هي أول منصة رقمية ذكية معتمدة لمتابعة المعلومات والمعاملات الحكومية حول العالم.",
    aboutDesc2: "من تأشيرات الإقامة إلى تأسيس الشركات وخدمات الترجمة والتوثيق الإلكتروني — تأهيل توفر تجربة إلكترونية متكاملة وآمنة.",
    aboutDesc3: "تعتمد المنصة على أحدث التقنيات في أرشفة المستندات، تتبع الطلبات، وتقديم الدعم المباشر.",
    quickLinks: "روابط سريعة",
    contact: "تواصل معنا",
    getInTouch: "تواصل معنا",
    allRights: "جميع الحقوق محفوظة",
    registerNow: "سجل وابدأ الآن",
    home: "الرئيسية",
    dubai: "دبي",
    placeholder: "رقم الطلب أو التتبع",
    enterTrackNum: "من فضلك أدخل رقم الطلب أولاً",
    whatsappTitle: "تحدث معنا على واتساب"
  }
};

function ServiceCard({ title, link, icon, desc, counter, counterLabel, tagColor, lang }) {
  const langParam = lang === 'ar' ? 'ar' : 'en';
  const finalLink = link.includes('?') ? `${link}&lang=${langParam}` : `${link}?lang=${langParam}`;
  return (
    <Link href={finalLink}>
      <div className="group relative p-6 bg-gradient-to-br from-[#22304a] to-[#0b131e] rounded-3xl shadow-md hover:shadow-2xl transition duration-300 transform hover:-translate-y-1 hover:scale-[1.02] border border-gray-800 hover:border-emerald-500 cursor-pointer min-h-[420px] flex flex-col justify-between">
        <span className={`absolute top-3 left-3 ${tagColor} text-xs font-semibold px-3 py-1 rounded-full`}>
          {LANG[lang].new}
        </span>
        <div className="flex flex-col items-center gap-3 mt-8">
          <div className="w-20 h-20 flex items-center justify-center mb-2 mx-auto">
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-emerald-300 via-white to-cyan-300 shadow-lg">
              <Image src={icon} alt={title} width={64} height={64} className="w-14 h-14 object-contain" style={{ background: 'transparent' }} />
            </div>
          </div>
          <h3 className="text-lg font-bold text-white mb-1 text-center">{title}</h3>
          <p className="text-gray-200 text-sm mb-2 text-center">{desc}</p>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-extrabold text-emerald-400">
              <CountUp end={counter} duration={2} separator="," />
            </span>
            <span className="text-xs text-gray-400">{counterLabel}</span>
          </div>
        </div>
        <div className="flex justify-center mt-5">
          <button className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-800 text-white text-sm font-semibold rounded-full hover:from-emerald-700 hover:to-green-700 transition">{LANG[lang].requestService}</button>
        </div>
      </div>
    </Link>
  );
}

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = searchParams.get("lang") === "ar" ? "ar" : "en";
  const [individuals, setIndividuals] = useState(8000);
  const [transactions, setTransactions] = useState(12500);
  const [companies, setCompanies] = useState(1200);
  const [dynamicIdx, setDynamicIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    const intervalIndividuals = setInterval(() => setIndividuals((prev) => prev + 3), 5 * 60 * 1000);
    const intervalTransactions = setInterval(() => setTransactions((prev) => prev + 4), 60 * 60 * 1000);
    const intervalCompanies = setInterval(() => setCompanies((prev) => prev + 2), 24 * 60 * 60 * 1000);
    return () => {
      clearInterval(intervalIndividuals);
      clearInterval(intervalTransactions);
      clearInterval(intervalCompanies);
    };
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      setDynamicIdx((i) => (lang === "ar" ? (i + 1) % dynamicTextsAr.length : (i + 1) % dynamicTextsEn.length));
    }, 2750);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [lang]);

  const toggleLanguage = () => {
    const nextLang = lang === "ar" ? "en" : "ar";
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", nextLang);
    router.replace(`?${params.toString()}`);
  };

  if (loading) {
    return <GlobalLoader />;
  }

  // شهادات واعتمادات
  const certifications = [
    {
      src: "/logos/google-digital-garage.png",
      alt: { ar: "Google Digital Garage Certified", en: "Google Digital Garage Certified" },
      label: { ar: "Google Digital Garage", en: "Google Digital Garage" }
    },
    {
      src: "/logos/iso-9001.png",
      alt: { ar: "ISO 9001 Certified", en: "ISO 9001 Certified" },
      label: { ar: "ISO 9001", en: "ISO 9001" }
    },
    {
      src: "/logos/iso-27001.png",
      alt: { ar: "ISO 27001 Certified", en: "ISO 27001 Certified" },
      label: { ar: "ISO 27001", en: "ISO 27001" }
    },
    {
      src: "/logos/google-business.png",
      alt: { ar: "Google Business Profile Verified", en: "Google Business Profile Verified" },
      label: { ar: "Google Business Profile", en: "Google Business Profile" }
    },
    {
      src: "/logos/cisco-cybersecurity.png",
      alt: { ar: "Cisco Cybersecurity Certified", en: "Cisco Cybersecurity Certified" },
      label: { ar: "Cisco Cybersecurity", en: "Cisco Cybersecurity" }
    },
    {
      src: "/logos/trustpilot.png",
      alt: { ar: "مراجعات Trustpilot", en: "Trustpilot Reviews" },
      label: { ar: "Trustpilot", en: "Trustpilot" }
    },
    {
      src: "/logos/dmca.png",
      alt: { ar: "محمية بحقوق النشر DMCA", en: "DMCA Protected" },
      label: { ar: "DMCA", en: "DMCA" }
    }
  ];

  const loginLink = `/login?lang=${lang}`;
  const registerLink = `/register?lang=${lang}`;

  const isArabic = lang === "ar";
  const dir = isArabic ? "rtl" : "ltr";

  const gradientBackground =
    "linear-gradient(180deg, #0b131e 0%, #22304a 30%, #122024 60%, #1d4d40 100%)";

  return (
    <div
      dir={dir}
      lang={lang}
      className="min-h-screen flex flex-col font-sans"
      style={{ background: gradientBackground }}
    >
      {/* HEADER */}
<header className="sticky top-0 z-30 bg-gradient-to-b from-[#06141B]/90 to-[#253745]/80 backdrop-blur border-b border-gray-800 shadow px-2 sm:px-4 py-4 md:py-8 rounded-b-xl w-full">
  <div className="flex flex-col md:flex-row justify-between items-center w-full gap-4">
    {/* Logo & Titles */}
    <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto">
      {/* Logo */}
      <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-28 md:h-28 flex items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-emerald-500">
        <Image
          src="/logo-transparent-large.png"
          alt="شعار تأهيل"
          width={80}
          height={80}
          className="object-contain"
        />
      </div>
      <div className="text-center space-y-1 sm:space-y-2 max-w-xs sm:max-w-md mx-auto">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-tight">
          TAHEEL - تأهيل
        </h1>
        <p className="text-xs sm:text-sm text-gray-200 font-small">
          {isArabic ? LANG.ar.slogan : LANG.en.slogan}
        </p>
        <p className="text-xs sm:text-base text-gray-300">
          {isArabic ? LANG.ar.desc : LANG.en.desc}
        </p>
        <p className="text-xs sm:text-base text-gray-400 medium">
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
      <div className="flex gap-1 sm:gap-2">
        <Link href={loginLink}>
          <button className="text-xs sm:text-sm px-3 sm:px-4 py-1 font-semibold rounded-full bg-blue-700 text-white hover:scale-105 transition duration-200 cursor-pointer">
            {isArabic ? LANG.ar.login : LANG.en.login}
          </button>
        </Link>
        <Link href={registerLink}>
          <button className="text-xs sm:text-sm px-3 sm:px-4 py-1 font-semibold rounded-full bg-green-600 text-white hover:scale-105 transition duration-200 cursor-pointer">
            {isArabic ? LANG.ar.register : LANG.en.register}
          </button>
        </Link>
      </div>
      <button
        onClick={toggleLanguage}
        className="text-xs sm:text-sm px-3 sm:px-4 py-2 font-semibold bg-[#253745] text-gray-100 border border-gray-700 rounded-full shadow hover:bg-[#11212D] transition transform hover:scale-105 flex items-center gap-2 cursor-pointer"
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
      <WeatherTimeWidget isArabic={isArabic} />
    </div>
  </div>
</header>

      {/* HERO VIDEO + نصوص */}
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
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="w-full h-full bg-gradient-to-b from-black/80 via-black/30 to-transparent" />
          </div>
          <button
            onClick={() => setIsMuted(!isMuted)}
            aria-label={isMuted ? (isArabic ? "تشغيل الصوت" : "Unmute") : (isArabic ? "كتم الصوت" : "Mute")}
            className={`absolute bottom-4 sm:bottom-6 ${isArabic ? "right-3 sm:right-5" : "left-3 sm:left-5"} z-50 bg-black/70 hover:bg-black/90 text-white px-3 sm:px-4 py-2 rounded-full text-xs sm:text-base shadow-lg flex items-center gap-2 transition`}
          >
            {isMuted
              ? (isArabic ? "🔇 تشغيل الصوت" : "🔇 Unmute")
              : (isArabic ? "🔊 كتم الصوت" : "🔊 Mute")}
          </button>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.37, delayChildren: 0.35 }
              }
            }}
            className={`absolute inset-0 flex flex-col justify-center z-20 px-3 sm:px-6 ${isArabic ? "items-start text-left" : "items-end text-right"}`}
          >
            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 42 },
                visible: { opacity: 1, y: 0 }
              }}
              transition={{ duration: 1.1 }}
              className="text-white text-xl sm:text-3xl md:text-5xl font-extrabold drop-shadow-xl mb-2"
            >
              {LANG[lang].hero1}
            </motion.h1>
            <motion.h2
              variants={{
                hidden: { opacity: 0, y: 42 },
                visible: { opacity: 1, y: 0 }
              }}
              transition={{ duration: 1.1, delay: 0.2 }}
              className="text-white text-base sm:text-xl md:text-2xl font-bold drop-shadow mb-2"
            >
              {LANG[lang].hero2}
            </motion.h2>
            <motion.h3
              variants={{
                hidden: { opacity: 0, y: 42 },
                visible: { opacity: 1, y: 0 }
              }}
              transition={{ duration: 1.1, delay: 0.4 }}
              className="text-white text-sm sm:text-lg md:text-xl drop-shadow mb-2"
            >
              {LANG[lang].hero3}
            </motion.h3>
            <motion.p
              variants={{
                hidden: { opacity: 0, y: 42 },
                visible: { opacity: 1, y: 0 }
              }}
              transition={{ duration: 1.1, delay: 0.6 }}
              className="text-white text-xs sm:text-base md:text-lg drop-shadow mb-4 max-w-2xl"
            >
              {LANG[lang].hero4}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* TRACKING FORM */}
<section className="w-full py-10 flex justify-center bg-gradient-to-br from-emerald-950/60 via-[#122024]/90 to-emerald-900/40">
  <div className="max-w-xl w-full rounded-3xl shadow-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 sm:p-10 relative overflow-hidden">
    {/* تأثير ضوئي زجاجي ديناميكي */}
    <span
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        background:
          "linear-gradient(120deg,rgba(16,185,129,0.10) 0%,rgba(59,130,246,0.08) 45%,rgba(245,158,11,0.11) 100%)",
        animation: "move-light 3.5s linear infinite",
        opacity: 0.85,
      }}
    />
    {/* العنوان/الوصف (اختياري) */}
    <h2 className="relative z-10 text-emerald-200 text-xl font-extrabold mb-7 text-center tracking-wide drop-shadow">
      {isArabic ? "تتبع حالة طلبك" : "Track Your Order Status"}
    </h2>
    <div className="relative z-10">
      <TrackingForm LANG={LANG} lang={lang} isArabic={isArabic} router={router} />
    </div>
    {/* كود أنيميشن ديناميكي */}
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

      {/* ABOUT SECTION */}
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
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-emerald-300 drop-shadow animate-slide-in-down" tabIndex={0}>
            {LANG?.[lang]?.taheel || "تأهيل - TAHEEL"}
          </h1>
          {/* نص متغير ديناميكي (Fade) */}
          <div className="h-7 sm:h-8 flex justify-center items-center relative overflow-hidden">
            <span
              key={dynamicIdx}
              className="absolute left-0 right-0 text-sm sm:text-lg md:text-xl font-semibold text-emerald-200 mb-1 animate-fade-in-up transition-all duration-700"
            >
              {isArabic ? dynamicTextsAr[dynamicIdx] : dynamicTextsEn[dynamicIdx]}
            </span>
          </div>
          <p className="text-gray-200 text-xs sm:text-base md:text-lg leading-relaxed font-medium animate-fade-in delay-150">
            {LANG?.[lang]?.aboutDesc1}
          </p>
          <p className="text-gray-200 text-xs sm:text-base md:text-lg leading-relaxed font-medium animate-fade-in delay-300">
            {LANG?.[lang]?.aboutDesc2}
          </p>
          <p className="text-gray-200 text-xs sm:text-base md:text-lg leading-relaxed font-medium animate-fade-in delay-500">
            {LANG?.[lang]?.aboutDesc3}
          </p>
          {/* سكشن الشهادات والاعتمادات */}
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
                <span className="text-xs mt-2 text-gray-400">{cert.label[lang]}</span>
              </span>
            ))}
          </div>
          <div className="mt-4 sm:mt-6">
            <Link href={registerLink} aria-label="سجّل الآن في منصة تأهيل">
              <button className="cursor-pointer px-6 sm:px-8 py-2 sm:py-3 text-white text-xs sm:text-base md:text-lg font-semibold bg-gradient-to-r from-emerald-700 via-emerald-500 to-green-700 rounded-full shadow-lg hover:scale-110 transition-transform duration-300 hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-emerald-400 animate-bounce">
                {LANG?.[lang]?.registerNow || "سجّل الآن"}
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

      {/* SERVICES */}
      
<section className="bg-gradient-to-b from-[#22304a]/90 to-[#122024]/90 py-10 sm:py-14 rounded-b-xl">
  <div className="max-w-6xl mx-auto px-2 sm:px-4">
    <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10 sm:mb-12 text-white tracking-tight drop-shadow">
      {LANG[lang].services}
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
          counterLabel: LANG[lang].residentClient
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
          counterLabel: LANG[lang].visitorClient
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
          counterLabel: LANG[lang].registeredCompany
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
          counterLabel: LANG[lang].completedTransactions
        }
      ].map((service, idx) => (
        <motion.div
          key={service.key}
          className="flex"
          initial={{ rotateY: 70, scale: 0.75, opacity: 0 }}
          whileInView={{ rotateY: 0, scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.75,
            delay: idx * 0.18,
            type: "spring",
            bounce: 0.34,
          }}
        >
          <Link href={`/services?section=${service.param}&lang=${lang}`} className="flex w-full">
            <div className="group relative flex flex-col p-4 sm:p-6 bg-gradient-to-br from-[#24354a] to-[#121c24] rounded-3xl shadow-xl hover:shadow-2xl transition duration-300 transform hover:-translate-y-2 hover:scale-[1.025] border border-gray-800 hover:border-emerald-500 min-h-[340px] sm:min-h-[420px] h-full cursor-pointer">
              <span className={`absolute top-3 left-3 ${service.tagColor} text-xs font-bold px-3 py-1 rounded-full shadow-sm`}>
                {LANG[lang].new}
              </span>
              {/* دائرة Gradient */}
              <div className="w-16 sm:w-20 h-16 sm:h-20 flex items-center justify-center mb-4 sm:mb-5 mt-2 sm:mt-3 mx-auto">
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-emerald-300 via-white to-cyan-300 shadow-lg">
                  <Image
                    src={service.icon}
                    alt={
                      LANG[lang][service.key] 
                        ? LANG[lang][service.key] 
                        : (lang === "ar" ? "أيقونة الخدمة" : "Service icon")
                    }
                    width={56}
                    height={56}
                    className="w-10 sm:w-14 h-10 sm:h-14 object-contain"
                    style={{ background: 'transparent' }}
                  />
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-emerald-300 mb-1 sm:mb-2 text-center tracking-tight drop-shadow">
                {LANG[lang][service.key]}
              </h3>
              <p className="text-gray-200 text-xs sm:text-sm mb-4 sm:mb-6 text-center leading-relaxed min-h-[36px] sm:min-h-[44px]">
                {service.desc[lang]}
              </p>
              <div className="flex flex-col items-center mb-4 sm:mb-6 mt-auto">
                <span className="text-xl sm:text-3xl font-extrabold text-emerald-400 drop-shadow-sm">
                  <CountUp end={service.counter} duration={2} separator="," />
                </span>
                <span className="text-xs text-gray-400 mt-1">{service.counterLabel}</span>
              </div>
              <div className="flex justify-center mt-2">
                <button className="px-4 sm:px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-700 text-white text-xs sm:text-sm font-bold rounded-full shadow-md hover:from-emerald-700 hover:to-green-800 transition duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                  {LANG[lang].requestService}
                </button>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  </div>
</section>

      {/* FOOTER */}
      <footer className="bg-[#192233] text-gray-200 pt-10 sm:pt-14 pb-4 sm:pb-6 px-2 sm:px-4 mt-10 sm:mt-20 rounded-t-3xl shadow-lg border-t border-[#22304a]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 gap-y-12 sm:gap-y-10">
          {/* تعريف احترافي */}
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
                <h3 className="text-lg sm:text-xl font-extrabold text-emerald-400 mb-1">TAHEEL - تأهيل</h3>
                <span className="text-xs font-bold text-emerald-300">
                  {isArabic
                    ? "منصة معتمدة لمتابعة المعلومات والمعاملات الحكومية"
                    : "Certified Platform for Government Information & Transactions"
                  }
                </span>
              </div>
            </div>
            <div className="text-gray-400 text-xs sm:text-sm leading-relaxed max-w-xs text-justify">
              {isArabic ? (
                <>
                  <b>تأهيل</b> منصة معتمده (من حكومة دبي) ذكية تعتمد على الذكاء الاصطناعي والتقنيات الحديثة في متابعة وإنجاز المعاملات والمعلومات الحكومية.<br />
                  جميع بياناتك محمية بأعلى معايير التشفير، وتتم المعالجة والمعاينة إلكترونيًا بسرعة وشفافية.<br />
                  تعتمد المنصة على إدارة رقمية متطورة وأرشفة مؤمنة، مع دعم مباشر وواجهة سهلة لكل المستخدمين حول العالم.
                </>
              ) : (
                <>
                  <b>TAHEEL</b> is an AI-powered smart government platform for secure information and transaction management.<br />
                  Your data is protected with industry-leading encryption, and all processes are handled digitally with speed and full transparency.<br />
                  The platform leverages advanced automation, secure archiving, and instant support for users worldwide.
                </>
              )}
            </div>
          </div>

          {/* روابط سريعة في المنتصف */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 order-3 md:order-2">
  <h4 className="text-base sm:text-lg font-bold text-white mb-1 sm:mb-2">{LANG[lang].quickLinks}</h4>
  <ul className="flex flex-col gap-1 sm:gap-2 text-sm sm:text-base text-center">
  <li>
    <Link href={`/?lang=${lang}`}>{LANG[lang].home}</Link>
  </li>
  <li>
    <Link href={`/services?section=resident&lang=${lang}`}>
      {LANG[lang].resident}
    </Link>
  </li>
  <li>
    <Link href={`/services?section=nonresident&lang=${lang}`}>
      {LANG[lang].nonResident}
    </Link>
  </li>
  <li>
    <Link href={`/services?section=company&lang=${lang}`}>
      {LANG[lang].company}
    </Link>
  </li>
  <li>
    <Link href={`/services?section=other&lang=${lang}`}>
      {LANG[lang].other}
    </Link>
  </li>
  <li>
    <Link href={`/about?lang=${lang}`}>{isArabic ? "من نحن" : "About Us"}</Link>
  </li>
  <li>
    <Link href={`/privacy?lang=${lang}`}>{isArabic ? "سياسة الخصوصية" : "Privacy Policy"}</Link>
  </li>
  <li>
    <Link href={`/terms?lang=${lang}`}>{isArabic ? "الشروط والأحكام" : "Terms & Conditions"}</Link>
  </li>
  <li>
    <Link href={`/careers?lang=${lang}`}>{isArabic ? "انضم إلينا" : "Careers"}</Link>
  </li>
</ul>
</div>

          {/* تواصل معنا */}
          <div className="flex flex-col items-center md:items-end gap-3 sm:gap-4 order-2 md:order-3">
            <h4 className="text-base sm:text-lg font-bold text-white mb-1">{LANG[lang].getInTouch}</h4>
            <iframe
              src="https://maps.google.com/maps?q=Red%20Avenue%20Building%2C%20Dubai&t=&z=15&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="120"
              className="rounded-xl border border-gray-700 w-full mb-2 hidden sm:block"
              loading="lazy"
              allowFullScreen
              title="TAHEEL Office Map"
              style={{ minWidth: "180px", maxWidth: "320px" }}
            />
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <FaMapMarkerAlt className="text-emerald-400" />
              <span>57th St - Al Garhoud - Dubai, Red Avenue Building, Office No. 60</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span>📞</span>
              <a href="tel:+971554463108" className="underline hover:text-emerald-400">+971 55 446 3108</a>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span>✉️</span>
              <a href="mailto:info@TAHEEL.ae" className="underline hover:text-emerald-400">info@TAHEEL.ae</a>
            </div>
            {/* أيقونات السوشيال تحت بيانات التواصل */}
            <div className="flex gap-2 sm:gap-3 mt-2">
              <a href="https://wa.me/971554463108" target="_blank" rel="noopener noreferrer" className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full p-2 sm:p-3 shadow transition focus:outline-none">
                <FaWhatsapp size={18} className="sm:text-[22px]" />
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 sm:p-3 shadow transition focus:outline-none">
                <FaFacebookMessenger size={18} className="sm:text-[22px]" />
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" className="bg-pink-500 hover:bg-pink-600 text-white rounded-full p-2 sm:p-3 shadow transition focus:outline-none">
                <FaInstagram size={18} className="sm:text-[22px]" />
              </a>
            </div>
          </div>
        </div>


        {/* خط فاصل وحقوق النشر */}
        <div className="max-w-7xl mx-auto mt-8 sm:mt-10 border-t border-[#22304a] pt-3 sm:pt-4 text-center text-xs text-gray-400 flex flex-col md:flex-row justify-between items-center gap-2">
          <span>
            © {new Date().getFullYear()} {LANG[lang].taheel}. {LANG[lang].allRights}
          </span>
          <span>
            {LANG[lang].dubai} - Powered by TAHEEL Team
          </span>
        </div>
        {/* زر واتساب عائم - ثابت */}
        <a
          href="https://wa.me/971554463108"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 z-50 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg p-4 text-xl transition"
          title={LANG[lang].whatsappTitle}
        >
          <FaWhatsapp />
        </a>
      </footer>
    </div>
  );
}
export default function HomePage() {
  return (
    <Suspense fallback={<GlobalLoader />}>
      <HomePageInner />
    </Suspense>
  );
}
