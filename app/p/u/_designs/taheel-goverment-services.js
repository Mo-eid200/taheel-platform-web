"use client";

import { useEffect, useState } from "react";

const ANDROID_URL =
  "https://play.google.com/store/apps/details?id=ae.taheel.app";
const IOS_URL =
  "https://apps.apple.com/ae/app/taheel-government-services/id6755335579";
const WEB_URL = "https://www.taheel.ae";

export default function TaheelSmartLink() {
  const [platform, setPlatform] = useState("other"); // android | ios | other
  const [lang, setLang] = useState("en"); // ar | en
  const [motionOK, setMotionOK] = useState(true);
  const [angle, setAngle] = useState(140); // لخلفية متحركة
  const [mounted, setMounted] = useState(false); // للتحكم في ظهور العناصر بالتدريج

  // كشف نوع الجهاز + لغة الجهاز + تفضيل الحركة
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect platform
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(ua)) {
      setPlatform("android");
    } else if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
      setPlatform("ios");
    } else {
      setPlatform("other");
    }

    // Detect language
    const navLang =
      navigator.language ||
      (navigator.languages && navigator.languages[0]) ||
      "en";
    setLang(navLang.toLowerCase().startsWith("ar") ? "ar" : "en");

    // Motion preference
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionOK(!mq.matches);
    const onChange = (e) => setMotionOK(!e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // تحريك خفيف لخلفية الكونِك-جراديانت
  useEffect(() => {
    if (!motionOK) return;
    let frame;
    const animate = () => {
      setAngle((prev) => (prev + 0.05) % 360);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [motionOK]);

  // تشغيل الأنيميشن التدريجي بعد الماونت
  useEffect(() => {
    setMounted(true);
  }, []);

  const t = TEXT[lang] || TEXT.en;

  const mainLabel =
    platform === "android"
      ? t.mainAndroid
      : platform === "ios"
      ? t.mainIOS
      : t.mainOther;

  const mainHref =
    platform === "android"
      ? ANDROID_URL
      : platform === "ios"
      ? IOS_URL
      : WEB_URL;

  const platformText =
    platform === "android"
      ? t.detectAndroid
      : platform === "ios"
      ? t.detectIOS
      : t.detectOther;

  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "text-right" : "text-left";

  return (
    <main
      className="relative min-h-screen bg-[#020617] text-white overflow-hidden"
      dir={dir}
    >
      {/* خلفيات نيون ثابتة */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 10% 0%, rgba(16,185,129,0.2) 0, transparent 50%), radial-gradient(circle at 90% 100%, rgba(56,189,248,0.22) 0, transparent 55%), radial-gradient(circle at 50% 40%, rgba(45,212,191,0.12) 0, transparent 55%)",
          filter: "saturate(1.1)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.35) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* خلفية متحركة ناعمة */}
      {motionOK && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-[40%] opacity-70 mix-blend-screen"
          style={{
            background: `conic-gradient(from ${angle}deg, rgba(45,212,191,0.08), rgba(56,189,248,0.22), rgba(16,185,129,0.18), transparent 65%)`,
            filter: "blur(42px)",
          }}
        />
      )}

      {/* المحتوى */}
      <section className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-[2rem] border border-emerald-400/35 bg-slate-900/80 backdrop-blur-2xl px-6 py-7 sm:px-8 sm:py-9 shadow-[0_24px_80px_rgba(15,23,42,0.95)]">
          {/* لوجو + عنوان + زر اللغة */}
          <div
            className={`flex items-center justify-between gap-3 mb-6 ${
              lang === "ar" ? "flex-row-reverse" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-2xl blur-xl opacity-70"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(16,185,129,0.7), rgba(56,189,248,0.4), transparent 70%)",
                  }}
                />
                <img
                  src="/logo-transparent-large.png"
                  alt="TAHEEL"
                  className="relative h-10 sm:h-12 drop-shadow-[0_0_20px_rgba(16,185,129,0.85)] rounded-xl"
                />
              </div>
              <div className={align}>
                <div className="text-[11px] sm:text-xs uppercase tracking-[0.25em] text-emerald-300/80">
                  TAHEEL • GOVERNMENT SERVICES
                </div>
                <h1 className="text-lg sm:text-xl font-extrabold text-white drop-shadow-[0_0_18px_rgba(56,189,248,0.75)]">
                  {t.heading}
                </h1>
              </div>
            </div>

            {/* زر تبديل اللغة */}
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] sm:text-xs font-bold hover:bg-white/20 transition active:scale-95"
            >
              {lang === "ar" ? "EN" : "AR"}
            </button>
          </div>

          {/* وصف */}
          <p
            className={`text-sm sm:text-[15px] text-emerald-50/85 leading-relaxed mb-5 ${align}`}
          >
            {t.description}
          </p>

          {/* منصة مكتشفة */}
          <div
            className={`mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] sm:text-xs text-emerald-100/80 ${
              lang === "ar" ? "flex-row-reverse" : ""
            }`}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
            {platformText}
          </div>

          {/* الزرار الرئيسي الديناميكي + أنيميشن دخول */}
          <a
            href={mainHref}
            className={`mt-2 block w-full rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm sm:text-base py-3.5 text-center shadow-[0_18px_55px_rgba(16,185,129,0.6)] transition-all duration-700 active:scale-95 ${
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            {mainLabel}
          </a>

          {/* خط فاصل */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
            <span className="text-[11px] sm:text-xs text-emerald-100/70 uppercase tracking-[0.22em]">
              {t.orChoose}
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" />
          </div>

          {/* لوجوهات المتاجر + الويب مع ظهور تدريجي وحركة ديناميكية عند الضغط */}
          <div className="mt-2 flex flex-col gap-4">
            <div
              className={`text-[11px] sm:text-xs text-emerald-100/75 ${align}`}
            >
              {t.chooseStore}
            </div>

            <div className="flex items-center justify-center gap-4 sm:gap-6">
{/* Google Play */}
<a
  href={ANDROID_URL}
  className={`group inline-flex flex-col items-center gap-1 transition-all duration-700 ${
    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
  }`}
  style={{ transitionDelay: "120ms" }}
  aria-label="Google Play"
>
  <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white/5 border border-white/20 shadow-[0_10px_30px_rgba(15,23,42,0.8)] group-hover:bg-white/10 group-hover:border-emerald-300/70 group-active:scale-95 group-active:shadow-[0_4px_16px_rgba(16,185,129,0.7)] transition-all overflow-hidden">
    <img
      src="/icon-google-play.png"
      alt="Google Play"
      className="h-full w-full object-contain drop-shadow-[0_0_16px_rgba(56,189,248,0.8)]"
    />
  </div>
  <span className="text-[11px] sm:text-xs text-emerald-100/80">Google Play</span>
</a>

{/* App Store */}
<a
  href={IOS_URL}
  className={`group inline-flex flex-col items-center gap-1 transition-all duration-700 ${
    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
  }`}
  style={{ transitionDelay: "220ms" }}
  aria-label="App Store"
>
  <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white/5 border border-white/20 shadow-[0_10px_30px_rgba(15,23,42,0.8)] group-hover:bg-white/10 group-hover:border-sky-300/70 group-active:scale-95 group-active:shadow-[0_4px_16px_rgba(59,130,246,0.7)] transition-all overflow-hidden">
    <img
      src="/icon-app-store.png"
      alt="App Store"
      className="h-full w-full object-contain drop-shadow-[0_0_16px_rgba(96,165,250,0.9)]"
    />
  </div>
  <span className="text-[11px] sm:text-xs text-emerald-100/80">App Store</span>
</a>

{/* TAHEEL Web */}
<a
  href={WEB_URL}
  className={`group inline-flex flex-col items-center gap-1 transition-all duration-700 ${
    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
  }`}
  style={{ transitionDelay: "320ms" }}
  aria-label={t.openWeb}
>
  <div className="relative h-16 w-full max-w-[190px] sm:h-20 sm:max-w-[220px] rounded-2xl bg-emerald-500/10 border border-emerald-300/70 
                  flex items-center justify-center shadow-[0_10px_30px_rgba(16,185,129,0.8)] 
                  group-hover:bg-emerald-500/20 group-active:scale-95 
                  group-active:shadow-[0_4px_16px_rgba(16,185,129,0.9)] 
                  transition-all overflow-hidden">
    <img
      src="/icon-taheel-web.png"
      alt="TAHEEL Web"
      className="h-12 sm:h-14 object-contain drop-shadow-[0_0_16px_rgba(16,185,129,0.9)]"
    />
  </div>
  <span className="text-[11px] sm:text-xs text-emerald-100/80">
    {t.webLabel}
  </span>
</a>


            </div>
          </div>

          {/* سطر سفلي */}
          <p className="mt-5 text-[11px] sm:text-xs text-emerald-100/60 text-center leading-relaxed">
            {t.footer}
          </p>
        </div>
      </section>
    </main>
  );
}

/* ======================= نصوص AR/EN ======================= */

const TEXT = {
  en: {
    heading: "Smart Download Link",
    description:
      "Scan once, open everywhere. This smart link detects your device language and platform, then routes you to the best TAHEEL experience — Android, iOS, or Web.",
    mainAndroid: "Get it on Google Play",
    mainIOS: "Download on the App Store",
    mainOther: "Open TAHEEL Platform",
    detectAndroid: "Detected: Android device",
    detectIOS: "Detected: iOS device",
    detectOther: "Detected: Other device",
    orChoose: "OR CHOOSE",
    chooseStore: "Choose where you’d like to open TAHEEL:",
    openWeb: "Open TAHEEL Web Platform",
    webLabel: "TAHEEL Web",
    footer:
      "Safe to use on QR codes, emails, business cards, and billboards. One URL • All platforms • TAHEEL Government Services.",
  },
  ar: {
    heading: "رابط تنزيل ذكي",
    description:
      "امسح مرة واحدة وافتح من أي مكان. هذا الرابط الذكي يتعرّف على لغة جهازك ونظامه، ثم يوجّهك لأفضل تجربة لمنصة تأهيل — أندرويد، آيفون أو الويب.",
    mainAndroid: "تنزيل من متجر Google Play",
    mainIOS: "تنزيل من App Store",
    mainOther: "فتح منصة تأهيل",
    detectAndroid: "تم التعرف: جهاز أندرويد",
    detectIOS: "تم التعرف: جهاز iOS",
    detectOther: "تم التعرف: جهاز آخر",
    orChoose: "أو اختر يدويًا",
    chooseStore: "اختر المكان الذي تريد فتح تأهيل فيه:",
    openWeb: "فتح منصة تأهيل على الويب",
    webLabel: "موقع تأهيل",
    footer:
      "مناسب للاستخدام على QR، الإيميل، الكروت، ولوحات الإعلانات. رابط واحد • كل المنصات • خدمات تأهيل الحكومية.",
  },
};
