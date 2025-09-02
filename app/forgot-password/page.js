"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FaEnvelope, FaArrowRight, FaArrowLeft, FaKey } from "react-icons/fa";

const LANGUAGES = {
  ar: {
    title: "نسيت كلمة المرور؟",
    desc: "أدخل بريدك الإلكتروني لإرسال رمز التحقق.",
    email: "البريد الإلكتروني",
    sendOtp: "إرسال الرمز",
    otpLabel: "أدخل الرمز السري المرسل إلى بريدك",
    verifyOtp: "تحقق من الرمز",
    newPass: "كلمة المرور الجديدة",
    confirmPass: "تأكيد كلمة المرور الجديدة",
    resetPass: "تغيير كلمة المرور",
    back: "رجوع لتسجيل الدخول",
    success: "تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.",
    otpSent: "تم إرسال الرمز إلى بريدك الإلكتروني!",
    otpError: "رمز خاطئ أو انتهت صلاحيته.",
    passError: "كلمة المرور غير متطابقة أو ضعيفة.",
    rights: "© 2025 تأهيل. جميع الحقوق محفوظة",
    langAr: "العربية",
    langEn: "English",
    resendOtp: "إعادة إرسال الرمز",
  },
  en: {
    title: "Forgot Password?",
    desc: "Enter your email to receive a verification code.",
    email: "Email",
    sendOtp: "Send Code",
    otpLabel: "Enter the secret code sent to your email",
    verifyOtp: "Verify Code",
    newPass: "New Password",
    confirmPass: "Confirm New Password",
    resetPass: "Change Password",
    back: "Back to Login",
    success: "Password changed successfully! You can now login.",
    otpSent: "Code sent to your email!",
    otpError: "Wrong code or expired.",
    passError: "Passwords do not match or weak.",
    rights: "© 2025 Taheel. All rights reserved",
    langAr: "العربية",
    langEn: "English",
    resendOtp: "Resend Code",
  },
};

function ForgotPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang] = useState(searchParams.get("lang") === "en" ? "en" : "ar");
  const t = LANGUAGES[lang];

  // مراحل الخطوات
  const [step, setStep] = useState(1);

  // المرحلة 1: إرسال الرمز
  const [email, setEmail] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpMsg, setOtpMsg] = useState("");
  const [otpError, setOtpError] = useState("");

  // المرحلة 2: تحقق الرمز
  const [otp, setOtp] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // المرحلة 3: تغيير كلمة المرور
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [resetting, setResetting] = useState(false);
  const [passError, setPassError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // حفظ البريد لعملية التحقق وتغيير كلمة المرور
  const [emailForReset, setEmailForReset] = useState("");

  // مرحلة إعادة إرسال الرمز
  const [resendingOtp, setResendingOtp] = useState(false);

  // تبديل اللغة
  const handleLang = (lng) => {
    setLang(lng);
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", lng);
    router.replace(`?${params.toString()}`);
  };

  // إرسال الرمز إلى البريد
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setSendingOtp(true);
    setOtpMsg("");
    setOtpError("");
    try {
      // استدعاء API وهمي
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailForReset(email.trim().toLowerCase());
        setStep(2);
        setOtpMsg(t.otpSent);
      } else {
        setOtpError(data.error || t.otpError);
      }
    } catch {
      setOtpError(t.otpError);
    }
    setSendingOtp(false);
  };

  // إعادة إرسال الرمز
  const handleResendOtp = async () => {
    setResendingOtp(true);
    setOtpMsg("");
    setOtpError("");
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailForReset }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpMsg(t.otpSent);
      } else {
        setOtpError(data.error || t.otpError);
      }
    } catch {
      setOtpError(t.otpError);
    }
    setResendingOtp(false);
  };

  // تحقق الرمز
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setVerifyingOtp(true);
    setOtpError("");
    setOtpMsg("");
    try {
      // تحقق الرمز عبر API
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailForReset, otp }),
      });
      const data = await res.json();
      if (data.success) {
        setStep(3);
      } else {
        setOtpError(data.error || t.otpError);
      }
    } catch {
      setOtpError(t.otpError);
    }
    setVerifyingOtp(false);
  };

  // تغيير كلمة المرور
  const handleResetPass = async (e) => {
    e.preventDefault();
    setPassError("");
    setSuccessMsg("");
    setResetting(true);

    // تحقق من تطابق كلمة المرور
    if (newPass.length < 6 || newPass !== confirmPass) {
      setPassError(t.passError);
      setResetting(false);
      return;
    }

    try {
      // استدعاء API تغيير كلمة المرور
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailForReset, otp, password: newPass }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(t.success);
        setStep(4);
      } else {
        setPassError(data.error || t.passError);
      }
    } catch {
      setPassError(t.passError);
    }
    setResetting(false);
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

        {/* المرحلة 1: إدخال البريد الإلكتروني */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} autoComplete="on" className="space-y-5">
            {otpError && <div className="bg-red-900/80 text-red-200 p-3 rounded text-center mb-2">{otpError}</div>}
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
              disabled={sendingOtp}
              className="btn-global w-full py-3 rounded-2xl text-xl shadow-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
              style={{ cursor: sendingOtp ? "wait" : "pointer" }}
            >
              {sendingOtp ? (
                <span className="animate-spin h-6 w-6 border-2 border-emerald-900 border-t-transparent rounded-full inline-block"></span>
              ) : lang === "ar" ? (
                <>
                  {t.sendOtp} <FaArrowLeft />
                </>
              ) : (
                <>
                  <FaArrowRight /> {t.sendOtp}
                </>
              )}
            </button>
          </form>
        )}

        {/* المرحلة 2: إدخال الرمز السري */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} autoComplete="off" className="space-y-5">
            {otpError && <div className="bg-red-900/80 text-red-200 p-3 rounded text-center mb-2">{otpError}</div>}
            {otpMsg && <div className="bg-green-900/80 text-green-200 p-3 rounded text-center mb-2">{otpMsg}</div>}
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder={t.otpLabel}
                className="w-full py-3 px-4 pr-12 rounded-xl bg-[#1e2e41] text-emerald-200 placeholder-gray-400 border border-emerald-700 focus:ring-2 focus:ring-emerald-400 outline-none transition font-semibold text-lg shadow tracking-widest text-center"
                dir="ltr"
                inputMode="numeric"
                pattern="\d*"
              />
              <FaKey className="absolute top-1/2 right-4 -translate-y-1/2 text-emerald-400" size={20} />
            </div>
            <button
              type="submit"
              disabled={verifyingOtp}
              className="btn-global w-full py-3 rounded-2xl text-xl shadow-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
              style={{ cursor: verifyingOtp ? "wait" : "pointer" }}
            >
              {verifyingOtp ? (
                <span className="animate-spin h-6 w-6 border-2 border-emerald-900 border-t-transparent rounded-full inline-block"></span>
              ) : lang === "ar" ? (
                <>
                  {t.verifyOtp} <FaArrowLeft />
                </>
              ) : (
                <>
                  <FaArrowRight /> {t.verifyOtp}
                </>
              )}
            </button>
            <div className="flex justify-center mt-2">
              <button
                type="button"
                className="text-emerald-400 hover:underline text-sm"
                onClick={handleResendOtp}
                disabled={resendingOtp}
              >
                {resendingOtp ? t.sendingOtp : t.resendOtp}
              </button>
            </div>
          </form>
        )}

        {/* المرحلة 3: تغيير كلمة المرور */}
        {step === 3 && (
          <form onSubmit={handleResetPass} autoComplete="off" className="space-y-5">
            {passError && <div className="bg-red-900/80 text-red-200 p-3 rounded text-center mb-2">{passError}</div>}
            <div className="relative">
              <input
                type="password"
                required
                autoFocus
                minLength={6}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder={t.newPass}
                className="w-full py-3 px-4 pr-12 rounded-xl bg-[#1e2e41] text-emerald-200 placeholder-gray-400 border border-emerald-700 focus:ring-2 focus:ring-emerald-400 outline-none transition font-semibold text-lg shadow"
                dir={lang === "ar" ? "rtl" : "ltr"}
              />
            </div>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder={t.confirmPass}
                className="w-full py-3 px-4 pr-12 rounded-xl bg-[#1e2e41] text-emerald-200 placeholder-gray-400 border border-emerald-700 focus:ring-2 focus:ring-emerald-400 outline-none transition font-semibold text-lg shadow"
                dir={lang === "ar" ? "rtl" : "ltr"}
              />
            </div>
            <button
              type="submit"
              disabled={resetting}
              className="btn-global w-full py-3 rounded-2xl text-xl shadow-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
              style={{ cursor: resetting ? "wait" : "pointer" }}
            >
              {resetting ? (
                <span className="animate-spin h-6 w-6 border-2 border-emerald-900 border-t-transparent rounded-full inline-block"></span>
              ) : lang === "ar" ? (
                <>
                  {t.resetPass} <FaArrowLeft />
                </>
              ) : (
                <>
                  <FaArrowRight /> {t.resetPass}
                </>
              )}
            </button>
          </form>
        )}

        {/* المرحلة 4: نجاح العملية */}
        {step === 4 && (
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="bg-green-900/80 text-green-200 p-4 rounded text-center text-lg font-bold mb-2">
              {successMsg || t.success}
            </div>
            <button
              className="w-full py-2 rounded-xl bg-[#253745] hover:bg-[#11212D] text-emerald-200 font-semibold border border-emerald-800 flex items-center justify-center gap-3 shadow transition text-base"
              onClick={() => router.push(`/login?lang=${lang}`)}
            >
              {lang === "ar" ? <FaArrowRight /> : <FaArrowLeft />}
              {t.back}
            </button>
          </div>
        )}
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