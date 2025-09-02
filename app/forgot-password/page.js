"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FaEnvelope, FaArrowRight, FaArrowLeft } from "react-icons/fa";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase.client";

const LANGUAGES = {
  ar: {
    title: "نسيت كلمة المرور؟",
    desc: "أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور.",
    email: "البريد الإلكتروني",
    submit: "إرسال الرابط",
    back: "رجوع لتسجيل الدخول",
    success: "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني!",
    error: "حدث خطأ أثناء الإرسال أو البريد غير صحيح.",
    rights: "© 2025 تأهيل. جميع الحقوق محفوظة",
    langAr: "العربية",
    langEn: "English",
  },
  en: {
    title: "Forgot Password?",
    desc: "Enter your email to send a password reset link.",
    email: "Email",
    submit: "Send Link",
    back: "Back to Login",
    success: "Password reset link has been sent to your email!",
    error: "Error sending request or email is incorrect.",
    rights: "© 2025 Taheel. All rights reserved",
    langAr: "العربية",
    langEn: "English",
  },
};

function ForgotPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang] = useState(searchParams.get("lang") === "en" ? "en" : "ar");
  const t = LANGUAGES[lang];

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const handleLang = (lng) => {
    setLang(lng);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", lng);
    router.replace(`?${params.toString()}`);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setMsg(t.success);
    } catch {
      setError(t.error);
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-[#0b131e] via-[#22304a] to-[#1d4d40] font-sans relative overflow-x-hidden"
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
    >
      {/* خلفية زخرفية */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-28 -left-20 w-[350px] h-[350px] bg-emerald-400 opacity-20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-emerald-900 to-emerald-400 opacity-30 rounded-full blur-2xl" />
        <svg className="absolute bottom-0 left-0 w-full h-24 md:h-32 opacity-30" viewBox="0 0 500 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 80 Q250 0 500 80V100H0V80Z" fill="#10b981" />
        </svg>
      </div>

      {/* زر تبديل اللغة */}
      <div className="absolute left-4 top-4 z-20 flex gap-2">
        <button
          className={`px-3 py-1 rounded-md text-xs font-bold shadow ${lang === "ar" ? "bg-emerald-500 text-white" : "bg-white text-emerald-700"} transition`}
          onClick={() => handleLang("ar")}
          tabIndex={0}
        >
          {t.langAr}
        </button>
        <button
          className={`px-3 py-1 rounded-md text-xs font-bold shadow ${lang === "en" ? "bg-emerald-500 text-white" : "bg-white text-emerald-700"} transition`}
          onClick={() => handleLang("en")}
          tabIndex={0}
        >
          {t.langEn}
        </button>
      </div>

      {/* الهيدر والشعار */}
      <header className="flex flex-col items-center justify-center py-10 z-10 relative">
        <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center rounded-full bg-white shadow-lg ring-4 ring-emerald-400 mb-6">
          <Image
            src="/logo-transparent-large.png"
            alt={lang === "ar" ? "شعار تأهيل" : "Taheel Logo"}
            width={110}
            height={110}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="heading-global text-3xl sm:text-4xl mb-2 drop-shadow-lg text-center text-emerald-200">
          {t.title}
        </h1>
        <p className="text-gray-200 text-lg mb-4 font-medium">{t.desc}</p>
      </header>

      {/* نموذج نسيت كلمة المرور */}
      <main className="w-full max-w-md mx-auto card-global p-10 space-y-7 mt-2 z-10 relative">
        {msg && <div className="bg-green-900/80 text-green-200 p-3 rounded text-center mb-2">{msg}</div>}
        {error && <div className="bg-red-900/80 text-red-200 p-3 rounded text-center mb-2">{error}</div>}

        <form onSubmit={handleSend} autoComplete="on" className="space-y-5">
          <div className="relative">
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.email}
              className="w-full py-3 px-4 pr-12 rounded-xl bg-[#1e2e41] text-emerald-200 placeholder-gray-400 border border-emerald-700 focus:ring-2 focus:ring-emerald-400 outline-none transition font-semibold text-lg shadow"
              dir={lang === "ar" ? "rtl" : "ltr"}
            />
            <FaEnvelope className="absolute top-1/2 right-4 -translate-y-1/2 text-emerald-400" size={20} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-global w-full py-3 rounded-2xl text-xl shadow-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
            style={{ cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? (
              <span className="animate-spin h-6 w-6 border-2 border-emerald-900 border-t-transparent rounded-full inline-block"></span>
            ) : lang === "ar" ? (
              <>
                {t.submit} <FaArrowLeft />
              </>
            ) : (
              <>
                <FaArrowRight /> {t.submit}
              </>
            )}
          </button>
        </form>

        <div className="flex flex-col items-center mt-3 gap-2">
          <button
            className="w-full py-2 rounded-xl bg-[#253745] hover:bg-[#11212D] text-emerald-200 font-semibold border border-emerald-800 flex items-center justify-center gap-3 shadow transition text-base"
            onClick={() => router.push(`/login?lang=${lang}`)}
          >
            {lang === "ar" ? <FaArrowRight /> : <FaArrowLeft />}
            {t.back}
          </button>
        </div>
      </main>

      <div className="h-10 z-0" />

      {/* الفوتر */}
      <footer className="w-full flex flex-col items-center justify-center mt-8 mb-6 z-10 relative">
        <Image
          src="/logo-transparent-large.png"
          alt={lang === "ar" ? "شعار تأهيل" : "Taheel Logo"}
          width={50}
          height={50}
          className="rounded-full bg-white ring-2 ring-emerald-400 shadow mb-4"
        />
        <div className="text-sm text-gray-400 text-center font-bold">{t.rights}</div>
      </footer>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordInner />
    </Suspense>
  );
}