"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

import {
  setDoc,
  doc as firestoreDoc,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";

import { firestore as db, auth } from "@/lib/firebase.client";

import ClientTypeStep from "@/components/register/ClientTypeStep";
import PersonalInfoStep from "@/components/register/PersonalInfoStep";
import AddressStep from "@/components/register/AddressStep";
import DocumentsStep from "@/components/register/DocumentsStep";
import ContactStep from "@/components/register/ContactStep";

// الترجمات
const LANGUAGES = {
  ar: {
    accountType: "نوع الحساب",
    resident: "مقيم",
    nonresident: "غير مقيم",
    company: "شركة",
    choose: "-- اختر --",
    createAccount: "إنشاء حساب",
    logoAlt: "شعار تأهيل",
    platform: "تأهيل",
    platformDesc: "منصة معتمدة لمتابعة المعلومات والمعاملات الحكومية",
    platformMore:
      "منصة ذكية تعتمد على الذكاء الاصطناعي والتقنيات الحديثة في متابعة وإنجاز المعاملات الحكومية.",
    rights: `© ${new Date().getFullYear()} تأهيل. جميع الحقوق محفوظة - دبي`,
    back: "الرجوع للموقع",
    loadingRegister: "جاري التسجيل...",
    registered: "تم التسجيل بنجاح!",
    selectTypeError: "يرجى اختيار نوع الحساب.",
    genericError:
      "حدث خطأ أثناء تسجيل الحساب، حاول مرة أخرى.",
    emailUsed: "هذا البريد مستخدم بالفعل.",
    weakPass: "كلمة المرور ضعيفة.",
    badEmail: "بريد غير صالح.",
    recaptchaFail: "فشل التحقق من reCAPTCHA.",
    customerIdFail:
      "خطأ في حجز رقم العميل، حاول مرة أخرى.",
  },
  en: {
    accountType: "Account Type",
    resident: "Resident",
    nonresident: "Non Resident",
    company: "Company",
    choose: "-- Choose --",
    createAccount: "Create Account",
    logoAlt: "TAHEEL LOGO",
    platform: "TAHEEL",
    platformDesc:
      "Certified platform for government information & transactions",
    platformMore:
      "A smart platform powered by AI and modern technologies to follow up and complete government transactions.",
    rights: `© ${new Date().getFullYear()} TAHEEL. All rights reserved - Dubai`,
    back: "Back to site",
    loadingRegister: "Registering...",
    registered: "Registration successful!",
    selectTypeError: "Please select account type.",
    genericError:
      "An error occurred during registration. Please try again.",
    emailUsed: "Email already in use.",
    weakPass: "Weak password.",
    badEmail: "Invalid email.",
    recaptchaFail: "reCAPTCHA failed.",
    customerIdFail:
      "Customer ID reservation failed. Please try again.",
  },
};

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const initialLang = searchParams.get("lang") === "en" ? "en" : "ar";

  const [lang, setLang] = useState(initialLang);
  const t = LANGUAGES[lang];

  const router = useRouter();
  const { executeRecaptcha } = useGoogleReCaptcha();

  // أنواع الحسابات
  const ACCOUNT_TYPES = [
    { value: "resident", label: t.resident },
    { value: "nonresident", label: t.nonresident },
    { value: "company", label: t.company },
  ];

  // الـ state المركزي لكل الخطوات
  const [form, setForm] = useState({
    accountType: "",

    // بيانات الشخص / الشركة
    firstName: "",
    middleName: "",
    lastName: "",
    nameEn: "",
    birthDate: "",
    gender: "",
    nationality: "",

    eidNumber: "",

    companyNameAr: "",
    companyNameEn: "",
    companyLicenseNumber: "",
    companyRegistrationDate: "",

    ownerFirstName: "",
    ownerMiddleName: "",
    ownerLastName: "",
    ownerBirthDate: "",
    ownerGender: "",
    ownerNationality: "",

    // عنوان
    emirate: "",
    district: "",
    street: "",
    building: "",
    floor: "",
    apartment: "",
    country: "",
    city: "",
    state: "",

    // مستندات
    documents: {},

    // تواصل
    email: "",
    emailConfirm: "",
    password: "",
    passwordConfirm: "",
    phone: "",
    phoneCode: "+971",

    // موافقات
    agreeTerms: false,
    agreePrivacy: false,
    agreeEAuth: false,

    createdAt: "",
  });

  const [step, setStep] = useState(0);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // update أي جزء من الـ form من الخطوات
  const handleChange = useCallback((data) => {
    setForm((prev) => ({ ...prev, ...data }));
  }, []);

  // تغيير اللغة (ويبقى reflected في URL)
  function handleLang(lng) {
    setLang(lng);
    const params = new URLSearchParams();
    params.set("lang", lng);
    router.replace(`?${params.toString()}`);
  }

  // التسجيل
  const handleRegister = async () => {
    setRegError("");
    setRegLoading(true);

    try {
      // لازم يختار نوع الحساب
      if (!form.accountType) {
        setRegLoading(false);
        setRegError(
          lang === "ar" ? t.selectTypeError : t.selectTypeError
        );
        return;
      }

      const email = form.email.trim().toLowerCase();

      // 1. reCAPTCHA (نحطها قبل أي استهلاك موارد سيرفر تانية)
      const recaptchaToken = await executeRecaptcha?.("register");
      if (!recaptchaToken) {
        throw new Error("recaptcha_failed");
      }
      const recaptchaRes = await fetch("/api/recaptcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: recaptchaToken }),
      });
      if (!recaptchaRes.ok) {
        throw new Error("recaptcha_failed");
      }

      // 2. احجز customerId من السيرفر
      // السيرفر لازم يرجعلك ID زي "RES-2025-000123" أو "COM-2025-000044"
      const reserveRes = await fetch("/api/reserve-customer-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: form.accountType, // resident / nonresident / company
        }),
      });
      const reserveJson = await reserveRes.json();
      if (!reserveRes.ok || !reserveJson.customerId) {
        throw new Error("customerId_failed");
      }
      const customerId = reserveJson.customerId;

      // 3. أنشئ يوزر في Firebase Auth
      const cred = await createUserWithEmailAndPassword(
        auth,
        email,
        form.password
      );
      const user = cred.user;

      // 4. ابعت ايميل التفعيل
      await sendEmailVerification(user);

      // 5. حضّر الداتا اللي هتدخل Firestore
      // شيل بيانات مش عايزها تتخزن زي الباسورد والتأكيدات
      const {
        password,
        passwordConfirm,
        emailConfirm,
        createdAt, // هنعمل createdAt جديد
        ...safeForm
      } = form;

      const nowIso = new Date().toISOString();

      // دي الداتا اللي هتبقى الحقيقة الوحيدة للعميل في النظام كله:
      const userPayload = {
        ...safeForm,

        // ثوابت/نظام
        email, // lowercase
        customerId, // VERY IMPORTANT نفس ID الدوكيومنت
        uid: user.uid, // UID بتاع Firebase Auth
        userId: user.uid, // لو فيه كود قديم بيستخدم userId
        role: "client",
        status: "active",

        accountType: form.accountType?.toLowerCase(),
        type: form.accountType?.toLowerCase(),

        emailVerified: !!user.emailVerified,
        phoneVerified: false,

        walletBalance: 0,
        coins: 0,

        // documents جاي من DocumentsStep (صور هوية / باسبور / رخصة تجارية الخ)
        // إحنا متفقين إننا نخزنه object جوه نفس user doc
        documents: safeForm.documents || {},

        // بيانات الوقت
        createdAt: nowIso,
        lastLoginAt: nowIso,
      };

      // 6. سجّل المستخدم في Firestore في users/{customerId}
      // هنا المفتاح الكبير اللي بقينا كلنا معتمدين عليه في كل النظام
await setDoc(
  firestoreDoc(db, "users", customerId),
  userPayload,
  { merge: true }
);

// اختياري: إنشاء خريطة للوصول عبر uid
await setDoc(
  firestoreDoc(db, "usersByUid", user.uid),
  { customerId, uid: user.uid, email },
  { merge: true }
);

      // 7. UI state
      setRegSuccess(true);

      // 8. روح على الداشبورد بنفس الـ customerId
      router.replace(
        `/dashboard/client?userId=${customerId}&lang=${lang}`
      );
    } catch (err) {
      const code = err?.code || err?.message;

      function mapErr(c) {
        switch (c) {
          case "auth/email-already-in-use":
            return lang === "ar" ? t.emailUsed : t.emailUsed;
          case "auth/weak-password":
            return lang === "ar" ? t.weakPass : t.weakPass;
          case "auth/invalid-email":
            return lang === "ar" ? t.badEmail : t.badEmail;
          case "recaptcha_failed":
            return lang === "ar" ? t.recaptchaFail : t.recaptchaFail;
          case "customerId_failed":
            return lang === "ar"
              ? t.customerIdFail
              : t.customerIdFail;
          default:
            return lang === "ar"
              ? t.genericError
              : t.genericError;
        }
      }

      setRegError(mapErr(code));
    }

    setRegLoading(false);
  };

  // تعريف الخطوات
  const steps = [
    <ClientTypeStep
      key="step-0"
      value={form.accountType}
      onChange={(type) => handleChange({ accountType: type })}
      options={ACCOUNT_TYPES}
      lang={lang}
      t={t}
      onNext={() => setStep(1)}
    />,
    <PersonalInfoStep
      key="step-1"
      form={form}
      onChange={handleChange}
      lang={lang}
      t={t}
      onNext={() => setStep(2)}
      onBack={() => {
        setForm((prev) => ({ ...prev, accountType: "" }));
        setStep(0);
      }}
    />,
    <AddressStep
      key="step-2"
      form={form}
      onChange={handleChange}
      lang={lang}
      t={t}
      onNext={() => setStep(3)}
      onBack={() => setStep(1)}
    />,
    <DocumentsStep
      key="step-3"
      form={form}
      onChange={handleChange}
      lang={lang}
      t={t}
      onNext={() => setStep(4)}
      onBack={() => setStep(2)}
    />,
    <ContactStep
      key="step-4"
      form={form}
      onChange={handleChange}
      lang={lang}
      t={t}
      onRegister={handleRegister}
      onBack={() => setStep(3)}
    />,
  ];

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-[#0b131e] via-[#22304a] to-[#1d4d40] font-sans relative overflow-x-hidden"
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
    >
      {/* زر تغيير اللغة */}
      <div className="absolute left-4 top-4 z-20 flex gap-2">
        <button
          className={`px-3 py-1 rounded-md text-xs font-bold shadow ${
            lang === "ar"
              ? "bg-emerald-500 text-white"
              : "bg-white text-emerald-700"
          } transition`}
          onClick={() => handleLang("ar")}
          tabIndex={0}
          style={{ cursor: "pointer" }}
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
          style={{ cursor: "pointer" }}
        >
          English
        </button>
      </div>

      <main className="flex flex-col items-center justify-center flex-1 py-10 px-2">
        <div
          className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl px-4 sm:px-10 py-8 flex flex-col gap-10 border border-emerald-200 animate-fade-in"
          style={{ minWidth: 320 }}
        >
          <div className="flex flex-col items-center gap-1 mb-2">
            <Image
              src="/logo-transparent-large.png"
              width={60}
              height={60}
              alt={t.logoAlt}
              className="rounded-full shadow ring-2 ring-emerald-400 bg-white"
            />
            <h2 className="font-extrabold text-2xl sm:text-3xl text-emerald-800 mt-2 text-center tracking-tight drop-shadow">
              {t.createAccount}
            </h2>
          </div>

          {steps[step]}

          {regError && (
            <div className="text-red-600 font-bold text-center mt-2">
              {regError}
            </div>
          )}

          {regLoading && (
            <div className="text-emerald-600 font-bold text-center mt-2">
              {t.loadingRegister}
            </div>
          )}

          {regSuccess && (
            <div className="text-green-600 font-bold text-center mt-2">
              {t.registered}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-[#192233] text-gray-200 pt-8 pb-4 px-2 mt-10 rounded-t-3xl shadow-lg border-t border-[#22304a]">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-3">
          <Image
            src="/logo-transparent-large.png"
            alt={t.logoAlt}
            width={42}
            height={42}
            className="rounded-full bg-white p-1 ring-2 ring-emerald-400 shadow w-10 h-10"
          />
          <h3 className="text-lg font-extrabold text-emerald-400 mb-1">
            {t.platform}
          </h3>
          <span className="text-xs font-bold text-emerald-300 mb-2">
            {t.platformDesc}
          </span>
          <div className="text-gray-400 text-xs leading-relaxed text-center max-w-sm">
            {t.platformMore}
          </div>
          <div className="mt-3 text-xs text-gray-400">{t.rights}</div>
        </div>
      </footer>
    </div>
  );
}