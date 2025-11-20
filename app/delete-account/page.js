"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

// نخلي الصفحة دايناميك زى الـ Privacy
export const dynamic = "force-dynamic";

const DELETE_INFO = {
  ar: {
    title: "طلب حذف حسابك وبياناتك – منصة تأهيل",
    intro:
      'نأسف لرغبتك في مغادرة منصة "تأهيل". من هذه الصفحة يمكنك معرفة طريقة طلب حذف حسابك والبيانات المرتبطة به، والأسباب الشائعة لحذف الحساب، وما هي البيانات التي قد نحتفظ بها لأسباب قانونية أو تنظيمية.',
    sections: [
      {
        heading: "1. كيف تطلب حذف الحساب؟",
        content: [
          "يمكنك إرسال طلب حذف الحساب من خلال البريد الإلكتروني الرسمي: info@taheel.ae باستخدام نفس البريد المسجَّل في حسابك على المنصة.",
          "اكتب في عنوان الرسالة: \"طلب حذف حساب – TAHEEL\"، واذكر في نص الرسالة: اسمك الكامل، رقم الهاتف المسجَّل، ونوع الحساب (مقيم، غير مقيم، شركة).",
          "بعد استلام الطلب، يقوم فريق الدعم بمراجعة البيانات والتحقق من الهوية، ثم تأكيد تنفيذ الحذف عبر رسالة بريد إلكتروني."
        ]
      },
      {
        heading: "2. الأسباب الشائعة لحذف الحساب",
        content: [
          "عدم الرغبة في الاستمرار في استخدام خدمات المنصة.",
          "إنهاء العلاقة التعاقدية للشركة أو انتهاء الحاجة إلى الخدمات الحكومية.",
          "الرغبة في استخدام حساب جديد ببيانات مختلفة.",
          "أسباب خصوصية شخصية أو طلب صريح من صاحب الحساب."
        ]
      },
      {
        heading: "3. ما الذي يحدث بعد حذف الحساب؟",
        content: [
          "يتم إيقاف إمكانية تسجيل الدخول إلى حسابك وإلغاء صلاحيات الوصول إلى لوحة التحكم والخدمات.",
          "يتم حذف أو إخفاء معظم البيانات الشخصية من أنظمة التشغيل الأمامية (الواجهة)، بما في ذلك معلومات الملف الشخصي والوثائق المرفوعة والخدمات النشِطة.",
          "قد نحتفظ ببعض البيانات الأساسية والمالية وسجلات العمليات لفترة زمنية محددة إذا كان ذلك مطلوبًا بموجب القوانين السارية في دولة الإمارات العربية المتحدة أو لأغراض الامتثال الضريبي والمالي."
        ]
      },
      {
        heading: "4. البيانات التي قد نحتفظ بها مؤقتًا",
        content: [
          "سجلات المعاملات المالية والمدفوعات المتعلقة بالخدمات التي تم تنفيذها من خلال المنصة.",
          "نسخ احتياطية للبيانات ضمن أنظمة النسخ الاحتياطي الآمنة، ويتم حذفها دوريًا وفق سياسة الاحتفاظ بالبيانات.",
          "أي بيانات مطلوبة قانونيًا لحل النزاعات أو الاستجابة للجهات الحكومية أو القضائية."
        ]
      },
      {
        heading: "5. إلغاء الطلب أو إعادة تفعيل الحساب",
        content: [
          "إذا تم تنفيذ الحذف بشكل نهائي، قد لا يكون من الممكن استعادة الحساب أو البيانات المحذوفة.",
          "في حال رغبتك في التراجع عن طلب الحذف قبل تنفيذه، يُرجى التواصل سريعًا مع فريق الدعم عبر info@taheel.ae وذكر أنك تريد إلغاء طلب الحذف."
        ]
      },
      {
        heading: "6. تواصل معنا",
        content: [
          "لأي استفسارات إضافية حول حذف الحساب أو إدارة بياناتك، يمكنك التواصل معنا عبر البريد الإلكتروني: info@taheel.ae",
          "كما يمكنك مراجعة: سياسة الخصوصية، والشروط والأحكام من خلال الروابط المتاحة في أسفل موقعنا الرسمي."
        ]
      }
    ]
  },
  en: {
    title: "Request Account Deletion – TAHEEL Platform",
    intro:
      "We are sorry to see you leave TAHEEL. On this page, you can learn how to request deletion of your account and associated data, the most common reasons for deletion, and which data may be retained for legal or regulatory purposes.",
    sections: [
      {
        heading: "1. How to request account deletion",
        content: [
          "Send an email to: info@taheel.ae using the same email address registered with your TAHEEL account.",
          'Use the subject line: "Account Deletion Request – TAHEEL" and include your full name, registered phone number, and account type (Resident, Non-Resident, Company).',
          "After receiving your request, our support team will verify your identity and confirm completion of the deletion by email."
        ]
      },
      {
        heading: "2. Common reasons for deleting an account",
        content: [
          "You no longer wish to use the platform or its services.",
          "Your company relationship or service needs have ended.",
          "You prefer to create a new account with different information.",
          "Personal privacy reasons or an explicit request from the account owner."
        ]
      },
      {
        heading: "3. What happens after deletion?",
        content: [
          "Your login access to the app and dashboard will be disabled.",
          "Most personal data in the operational systems (front-end) will be deleted or anonymised, including profile details, uploaded documents, and active services.",
          "Some basic and financial records may be retained for a limited period if required by applicable UAE laws, tax or accounting regulations."
        ]
      },
      {
        heading: "4. Data that may be temporarily retained",
        content: [
          "Transaction records and payment history for services processed through TAHEEL.",
          "Backup copies stored in secure backup systems, which are automatically purged according to our data retention schedule.",
          "Any information required to resolve disputes or respond to government or judicial authorities."
        ]
      },
      {
        heading: "5. Cancelling a deletion request",
        content: [
          "If deletion has already been completed, it may not be possible to restore your account or deleted data.",
          "If you wish to cancel your deletion request before it is processed, please contact our support team as soon as possible at info@taheel.ae and clearly state that you want to cancel the deletion request."
        ]
      },
      {
        heading: "6. Contact",
        content: [
          "For any additional questions about account deletion or data management, please contact us at: info@taheel.ae",
          "You can also review our Privacy Policy and Terms & Conditions from the links provided in the footer of our official website."
        ]
      }
    ]
  }
};

function DeleteAccountInner() {
  const searchParams = useSearchParams();
  const lang = searchParams.get("lang") === "ar" ? "ar" : "en";
  const t = DELETE_INFO[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "text-right" : "text-left";

  return (
    <section
      dir={dir}
      className="py-14 px-2 sm:px-4 bg-gradient-to-br from-[#17313b]/90 via-[#13242a]/95 to-[#17313b]/80 text-white min-h-screen backdrop-blur-xl"
    >
      <div className="max-w-3xl mx-auto bg-[#0b131e]/85 rounded-3xl p-6 sm:p-10 shadow-2xl border border-[#22304a]/60 space-y-8 transition-all duration-700 hover:shadow-2xl hover:scale-[1.01]">
        <div className="flex justify-center mb-2">
          <Image
            src="/logo-transparent-large.png"
            alt="TAHEEL Logo"
            width={88}
            height={88}
            className="mx-auto rounded-xl shadow-lg border-2 border-emerald-400 bg-white"
            title="TAHEEL Platform"
            priority
          />
        </div>

        <h1
          className={`text-2xl md:text-3xl font-extrabold text-emerald-300 drop-shadow mb-3 ${align}`}
        >
          {t.title}
        </h1>

        <p
          className={`text-base md:text-lg font-medium text-gray-100/90 leading-8 mb-4 ${align}`}
        >
          {t.intro}
        </p>

        <div className="space-y-7">
          {t.sections.map((sec, i) => (
            <div key={i}>
              <h2
                className={`text-emerald-200 text-lg font-bold mb-2 ${align}`}
              >
                {sec.heading}
              </h2>
              <ul
                className={`list-disc list-inside space-y-1 text-emerald-100/90 ${align}`}
              >
                {sec.content.map((line, idx) => (
                  <li key={idx} className="text-gray-200 text-base">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={`text-xs text-gray-400 pt-6 font-medium ${align}`}>
          © {new Date().getFullYear()} TAHEEL. All rights reserved.
        </div>
      </div>
    </section>
  );
}

export default function DeleteAccountPage() {
  return (
    <Suspense fallback={null}>
      <DeleteAccountInner />
    </Suspense>
  );
}
