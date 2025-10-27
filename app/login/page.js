"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FaLock,
  FaUser,
  FaEye,
  FaEyeSlash,
  FaWhatsapp,
} from "react-icons/fa";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendEmailVerification,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  limit,
} from "firebase/firestore";
import { auth, firestore } from "@/lib/firebase.client";
import { GlobalLoader } from "@/components/GlobalLoader";

const RECAPTCHA_SITE_KEY =
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

// force dynamic since we're reading search params etc.
export const dynamic = "force-dynamic";

const LANGUAGES = {
  ar: {
    login: "تسجيل الدخول",
    welcome: "مرحباً بك !",
    platform: "منصة",
    clientOrEmail: "رقم العميل/الشركة أو البريد الإلكتروني",
    password: "كلمة المرور",
    remember: "تذكرني",
    forgot: "نسيت كلمة المرور؟",
    submit: "تسجيل الدخول",
    newUser: "مستخدم جديد؟ أنشئ حساب",
    recaptchaCheck: "يرجى التحقق من reCAPTCHA",
    recaptchaFail: "فشل التحقق من reCAPTCHA، حاول مرة أخرى.",
    wrongClient: "المعرف غير صحيح أو لا يوجد حساب بهذا الرقم.",
    emailVerify: "يجب تفعيل بريدك الإلكتروني أولاً.",
    notFound: "لم يتم العثور على بيانات المستخدم!",
    wrongLogin:
      "بيانات الدخول غير صحيحة أو هناك مشكلة في الاتصال!",
    verified: "✔ تم التحقق",
    recaptcha: "Google reCAPTCHA",
    rights: "© 2025 تأهيل. جميع الحقوق محفوظة",
    success: "تم تسجيل الدخول بنجاح!",
    resend: "إعادة إرسال رابط التفعيل",
    sending: "يتم الإرسال...",
    resendSuccess:
      "تم إرسال رابط التفعيل إلى بريدك الإلكتروني!",
    resendError: "حدث خطأ أثناء إرسال رابط التفعيل.",
  },
  en: {
    login: "Login",
    welcome: "Welcome!",
    platform: "TAHEEL Platform",
    clientOrEmail: "Client/Company ID or Email",
    password: "Password",
    remember: "Remember me",
    forgot: "Forgot password?",
    submit: "Login",
    newUser: "New user? Create account",
    recaptchaCheck: "Please verify reCAPTCHA",
    recaptchaFail:
      "reCAPTCHA verification failed, try again.",
    wrongClient:
      "Identifier is incorrect or does not exist.",
    emailVerify:
      "Please verify your email address first.",
    notFound: "User data not found!",
    wrongLogin:
      "Incorrect login credentials or connection problem!",
    verified: "✔ Verified",
    recaptcha: "Google reCAPTCHA",
    rights: "© 2025 Taheel. All rights reserved",
    success: "Login successful!",
    resend: "Resend Activation Link",
    sending: "Sending...",
    resendSuccess:
      "Activation link sent to your email!",
    resendError: "Error sending activation link.",
  },
};

// -------- util: is it an email? ------
function isEmail(val) {
  return typeof val === "string" && val.includes("@");
}

// -------- util: resolve loginId -> { email, docId } --------
// tries: direct doc, then customerId/userId/companyId
async function resolveEmailAndDocId(loginIdRaw) {
  const loginId = String(loginIdRaw || "").trim();
  if (!loginId) return null;

  // 1) direct /users/{loginId}
  try {
    const direct = await getDoc(
      doc(firestore, "users", loginId)
    );
    if (direct.exists()) {
      const d = direct.data();
      const email = (d.email || "")
        .toLowerCase()
        .trim();
      if (email) {
        return { email, docId: direct.id };
      }
    }
  } catch {
    /* ignore */
  }

  // 2) search by common fields
  const usersCol = collection(firestore, "users");
  const tryField = async (field) => {
    const qs = await getDocs(
      query(
        usersCol,
        where(field, "==", loginId),
        limit(1)
      )
    );
    if (!qs.empty) {
      const snap = qs.docs[0];
      const data = snap.data();
      const email = (data.email || "")
        .toLowerCase()
        .trim();
      if (email) {
        return { email, docId: snap.id };
      }
    }
    return null;
  };

  return (
    (await tryField("customerId")) ||
    (await tryField("userId")) ||
    (await tryField("companyId"))
  );
}

// ======================================
// Component
// ======================================
function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // language
  const [lang, setLang] = useState(
    searchParams.get("lang") === "en" ? "en" : "ar"
  );
  const t = LANGUAGES[lang];

  // form state
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // ui / flow state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [recaptchaOk, setRecaptchaOk] = useState(false);

  // email verification flow
  const [unverifiedUser, setUnverifiedUser] = useState(null);
  const [sendingVerify, setSendingVerify] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");

  // redirect param
  const prevParam = searchParams.get("prev");

  // --- Load reCAPTCHA v3 script (only once) ---
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      !window.grecaptcha &&
      RECAPTCHA_SITE_KEY
    ) {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // --- verify token server-side (/api/recaptcha) ---
  const verifyRecaptcha = useCallback(async (token) => {
    try {
      const res = await fetch("/api/recaptcha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      return (
        data.success &&
        (typeof data.score !== "number" ||
          data.score > 0.5)
      );
    } catch {
      return false;
    }
  }, []);

  // --- handle resend activation email ---
  const handleResendActivation = useCallback(async () => {
    if (!unverifiedUser) return;
    setSendingVerify(true);
    setVerifyMsg("");
    try {
      await sendEmailVerification(unverifiedUser);
      setVerifyMsg(t.resendSuccess);
    } catch {
      setVerifyMsg(t.resendError);
    }
    setSendingVerify(false);
  }, [unverifiedUser, t.resendError, t.resendSuccess]);

  // --- main login flow ---
  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      setErrorMsg("");
      setLoading(true);
      setUnverifiedUser(null);
      setVerifyMsg("");

      // 1) reCAPTCHA v3
      let recaptchaToken = "";
      if (
        typeof window !== "undefined" &&
        window.grecaptcha &&
        RECAPTCHA_SITE_KEY
      ) {
        try {
          await new Promise((resolve) =>
            window.grecaptcha.ready(resolve)
          );
          recaptchaToken =
            await window.grecaptcha.execute(
              RECAPTCHA_SITE_KEY,
              { action: "login" }
            );
          if (!recaptchaToken) {
            setLoading(false);
            setRecaptchaOk(false);
            setErrorMsg(t.recaptchaCheck);
            return;
          }
        } catch {
          setLoading(false);
          setRecaptchaOk(false);
          setErrorMsg(t.recaptchaCheck);
          return;
        }
      } else {
        // if recaptcha script not ready / missing key
        setLoading(false);
        setRecaptchaOk(false);
        setErrorMsg(t.recaptchaCheck);
        return;
      }

      const recaptchaValid =
        await verifyRecaptcha(recaptchaToken);
      if (!recaptchaValid) {
        setLoading(false);
        setRecaptchaOk(false);
        setErrorMsg(t.recaptchaFail);
        return;
      }
      setRecaptchaOk(true);

      // 2) session persistence (remember me)
      try {
        await setPersistence(
          auth,
          rememberMe
            ? browserLocalPersistence
            : browserSessionPersistence
        );
      } catch {
        setLoading(false);
        setErrorMsg(
          lang === "ar"
            ? "خطأ في تعيين حالة الجلسة"
            : "Failed to set session persistence"
        );
        return;
      }

      // 3) resolve loginId -> email + docId
      let emailToUse = loginId.trim();
      let resolvedDocId = "";
      if (!isEmail(emailToUse)) {
        const res = await resolveEmailAndDocId(
          emailToUse
        );
        if (!res) {
          setLoading(false);
          setErrorMsg(t.wrongClient);
          return;
        }
        emailToUse = res.email;
        resolvedDocId = res.docId;
      } else {
        emailToUse = emailToUse
          .toLowerCase()
          .trim();
      }

      // 4) Firebase Auth sign-in
      try {
        const userCredential =
          await signInWithEmailAndPassword(
            auth,
            emailToUse,
            password.trim()
          );
        const user = userCredential.user;

        // 4.a: check email verification
        if (!user.emailVerified) {
          setLoading(false);
          setErrorMsg(t.emailVerify);
          setUnverifiedUser(user);
          return;
        }

        // 5) Load Firestore profile for routing
        let data = null;
        let docId = "";

        // a) match by uid
        let qs = await getDocs(
          query(
            collection(firestore, "users"),
            where("uid", "==", user.uid),
            limit(1)
          )
        );
        if (!qs.empty) {
          const d = qs.docs[0];
          data = d.data();
          docId = d.id;
        }

        // b) fallback: resolvedDocId
        if (!data && resolvedDocId) {
          const snap = await getDoc(
            doc(firestore, "users", resolvedDocId)
          );
          if (snap.exists()) {
            data = snap.data();
            docId = snap.id;
          }
        }

        // c) fallback: email
        if (!data) {
          qs = await getDocs(
            query(
              collection(firestore, "users"),
              where("email", "==", user.email),
              limit(1)
            )
          );
          if (!qs.empty) {
            const d = qs.docs[0];
            data = d.data();
            docId = d.id;
          }
        }

        if (!data) {
          setLoading(false);
          setErrorMsg(t.notFound);
          return;
        }

        // 6) Derive role/type to pick dashboard
        const accountType = String(
          data.accountType || data.type || ""
        ).toLowerCase();
        const customerId = String(
          data.customerId || docId || ""
        );

        // optional: save quick info locally
        try {
          if (docId)
            window.localStorage.setItem(
              "userId",
              docId
            );
          window.localStorage.setItem(
            "userName",
            data.name ||
              data.firstName ||
              "مستخدم"
          );
          window.localStorage.setItem(
            "userRole",
            data.role || "client"
          );
          window.localStorage.setItem(
            "accountType",
            accountType
          );
        } catch {
          /* ignore */
        }

        // 7) Build redirect URL
        let targetUrl = `/dashboard/client?userId=${encodeURIComponent(
          docId || customerId
        )}&lang=${lang}`;

        if (data.role === "admin") {
          targetUrl = `/dashboard/admin?userId=${encodeURIComponent(
            user.uid
          )}&lang=${lang}`;
        } else if (data.role === "employee") {
          targetUrl = `/dashboard/employee?userId=${encodeURIComponent(
            user.uid
          )}&lang=${lang}`;
        }

        // respect prev param if valid absolute/relative URL
        if (prevParam) {
          try {
            const url = new URL(
              prevParam,
              window.location.origin
            );
            url.searchParams.set("lang", lang);
            targetUrl =
              url.pathname +
              "?" +
              url.searchParams.toString();
          } catch {
            /* ignore invalid prev */
          }
        }

        // 8) go dashboard
        router.replace(targetUrl);
        setLoading(false);
      } catch {
        setErrorMsg(t.wrongLogin);
        setLoading(false);
      }
    },
    [
      lang,
      loginId,
      password,
      rememberMe,
      prevParam,
      router,
      t.emailVerify,
      t.notFound,
      t.recaptchaCheck,
      t.recaptchaFail,
      t.wrongClient,
      t.wrongLogin,
      verifyRecaptcha,
    ]
  );

  // --- language switcher ---
  const handleLang = useCallback(
    (lng) => {
      setLang(lng);
      const params = new URLSearchParams(
        searchParams.toString()
      );
      params.set("lang", lng);
      router.replace("?" + params.toString());
    },
    [router, searchParams]
  );

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-[#0b131e] via-[#22304a] to-[#1d4d40] font-sans relative overflow-x-hidden"
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
    >
      {/* decorative background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-28 -left-20 w-[350px] h-[350px] bg-emerald-400 opacity-20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-emerald-900 to-emerald-400 opacity-30 rounded-full blur-2xl" />
        <svg
          className="absolute bottom-0 left-0 w-full h-24 md:h-32 opacity-30"
          viewBox="0 0 500 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 80 Q250 0 500 80V100H0V80Z"
            fill="#10b981"
          />
        </svg>
      </div>

      {/* language toggle */}
      <div className="absolute left-4 top-4 z-20 flex gap-2">
        <button
          className={`px-3 py-1 rounded-md text-xs font-bold shadow ${
            lang === "ar"
              ? "bg-emerald-500 text-white"
              : "bg-white text-emerald-700"
          } transition`}
          onClick={() => handleLang("ar")}
          tabIndex={0}
        >
          العربية
        </button>
        <button
          className={`px-3 py-1 rounded-md text-xs font-bold shadow ${
            lang === "en"
              ? "bg-emerald-500 text-white"
              : "bg-white text-emerald-700"
          } transition`}
          onClick={() => handleLang("en")}
          tabIndex={0}
        >
          English
        </button>
      </div>

      {/* header / logo */}
      <header className="flex flex-col items-center justify-center py-10 z-10 relative">
        <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center rounded-full bg-white shadow-lg ring-4 ring-emerald-400 mb-6">
          <Image
            src="/logo-transparent-large.png"
            alt={
              lang === "ar"
                ? "شعار تأهيل"
                : "Taheel Logo"
            }
            width={110}
            height={110}
            className="object-contain"
            priority
          />
        </div>

        <h1 className="heading-global text-3xl sm:text-4xl mb-2 drop-shadow-lg text-center text-white font-bold">
          {lang === "ar" ? (
            <>
              منصة{" "}
              <span className="text-emerald-400">
                تأهيل
              </span>{" "}
              - {t.login}
            </>
          ) : (
            <>
              {t.platform}{" "}
              <span className="text-emerald-400">
                - {t.login}
              </span>
            </>
          )}
        </h1>

        <p className="text-gray-200 text-lg mb-4 font-medium">
          {t.welcome}
        </p>
      </header>

      {/* login form card */}
      <main className="w-full max-w-md mx-auto card-global p-10 space-y-7 mt-2 z-10 relative">
        {errorMsg && (
          <div className="bg-red-900/80 text-red-200 p-3 rounded text-center mb-2 animate-shake">
            {errorMsg}

            {unverifiedUser && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <button
                  type="button"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow disabled:opacity-50"
                  disabled={sendingVerify}
                  onClick={handleResendActivation}
                >
                  {sendingVerify
                    ? t.sending
                    : t.resend}
                </button>
                {verifyMsg && (
                  <span className="text-xs text-emerald-200 mt-2">
                    {verifyMsg}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={handleLogin}
          autoComplete="on"
          className="space-y-5"
        >
          {/* loginId / email */}
          <div className="relative">
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={loginId}
              onChange={(e) =>
                setLoginId(e.target.value)
              }
              placeholder={t.clientOrEmail}
              className="w-full py-3 px-4 pr-12 rounded-xl bg-[#1e2e41] text-emerald-200 placeholder-gray-400 border border-emerald-700 focus:ring-2 focus:ring-emerald-400 outline-none transition font-semibold text-lg shadow"
              dir={lang === "ar" ? "rtl" : "ltr"}
            />
            <FaUser
              className="absolute top-1/2 right-4 -translate-y-1/2 text-emerald-400"
              size={20}
            />
          </div>

          {/* password */}
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder={t.password}
              className="w-full py-3 px-4 pr-12 rounded-xl bg-[#1e2e41] text-emerald-200 placeholder-gray-400 border border-emerald-700 focus:ring-2 focus:ring-emerald-400 outline-none transition font-semibold text-lg shadow"
              dir={lang === "ar" ? "rtl" : "ltr"}
            />
            <FaLock
              className="absolute top-1/2 right-4 -translate-y-1/2 text-emerald-400"
              size={20}
            />
            <button
              type="button"
              className="absolute top-1/2 left-4 -translate-y-1/2 text-emerald-200 hover:text-emerald-400 transition"
              onClick={() =>
                setShowPass((s) => !s)
              }
              tabIndex={-1}
              aria-label={
                showPass
                  ? lang === "ar"
                    ? "إخفاء كلمة المرور"
                    : "Hide password"
                  : lang === "ar"
                  ? "عرض كلمة المرور"
                  : "Show password"
              }
            >
              {showPass ? (
                <FaEyeSlash size={20} />
              ) : (
                <FaEye size={20} />
              )}
            </button>
          </div>

          {/* WhatsApp quick help */}
          <div className="flex justify-end w-full mb-2">
            <a
              href="https://wa.me/971555555555"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg p-3 text-xl transition-all"
              title={
                lang === "ar"
                  ? "تواصل عبر واتساب"
                  : "Contact via WhatsApp"
              }
              style={{ zIndex: 10 }}
            >
              <FaWhatsapp />
            </a>
          </div>

          {/* reCAPTCHA status display */}
          <div className="my-2 flex justify-center">
            <div className="w-full flex justify-center">
              {recaptchaOk ? (
                <span className="text-green-400 text-xs flex items-center gap-1">
                  <span>{t.verified}</span>
                </span>
              ) : (
                <span className="text-gray-400 text-xs flex items-center gap-1">
                  {t.recaptcha} v3
                </span>
              )}
            </div>
          </div>

          {/* remember me / forgot password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-emerald-100 cursor-pointer select-none font-medium">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) =>
                  setRememberMe(e.target.checked)
                }
                className="accent-emerald-500 scale-110"
              />
              {t.remember}
            </label>

            <button
              type="button"
              className="text-emerald-400 hover:underline text-sm"
              onClick={() =>
                router.push(
                  `/forgot-password?lang=${lang}`
                )
              }
            >
              {t.forgot}
            </button>
          </div>

          {/* submit button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-global w-full py-3 rounded-2xl text-xl shadow-xl mt-2 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:opacity-60"
            style={{
              cursor: loading
                ? "wait"
                : "pointer",
            }}
          >
            {loading ? (
              <span className="animate-spin h-6 w-6 border-2 border-emerald-900 border-t-transparent rounded-full inline-block"></span>
            ) : (
              t.submit
            )}
          </button>
        </form>

        {/* new user / register CTA */}
        <div className="flex flex-col items-center mt-3 gap-2">
          <button
            className="w-full py-2 rounded-xl bg-[#253745] hover:bg-[#11212D] text-emerald-200 font-semibold border border-emerald-800 flex items-center justify-center gap-3 shadow transition text-base"
            onClick={() =>
              router.push(
                `/register?lang=${lang}`
              )
            }
          >
            {t.newUser}
          </button>
        </div>
      </main>

      {loading && <GlobalLoader />}

      <div className="h-10 z-0" />

      {/* footer */}
      <footer className="w-full flex flex-col items-center justify-center mt-8 mb-6 z-10 relative">
        <Image
          src="/logo-transparent-large.png"
          alt={
            lang === "ar"
              ? "شعار تأهيل"
              : "Taheel Logo"
          }
          width={50}
          height={50}
          className="rounded-full bg-white ring-2 ring-emerald-400 shadow mb-4"
        />
        <div className="text-sm text-gray-400 text-center font-bold">
          {t.rights}
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
