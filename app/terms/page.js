"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

// Force dynamic rendering to prevent static export issues
export const dynamic = "force-dynamic";

const TERMS = {
  ar: {
    title: "الشروط والأحكام لمنصة تأهيل",
    intro:
      'باستخدامك منصة "تأهيل" (موقع الويب، وتطبيق الجوال، وأي خدمات رقمية مرتبطة)، فإنك تقرّ بأنك قرأت هذه الشروط والأحكام وفهمتها وتوافق على الالتزام بها، إضافة إلى سياسة الخصوصية وأي سياسات أو إرشادات أخرى يتم نشرها عبر المنصة أو موقعنا الرسمي.',
    sections: [
      {
        heading: "1. التعريف بمنصة تأهيل وطبيعة الخدمات",
        content: [
          "تأهيل هي منصة خاصة لتقديم خدمات التسهيل الحكومية والخدمات المساندة (مثل تعبئة الطلبات، تجهيز المستندات، المتابعة، وخدمات الدعم الذكي باستخدام الذكاء الاصطناعي).",
          "لا تُعد تأهيل جهة حكومية ولا تمثّل أي جهة حكومية رسمية، بل تعمل وسيطًا خدميًا لمساعدتك في إنجاز معاملتك وفق الأنظمة المعمول بها.",
          "الموافقة على هذه الشروط لا تعني بأي حال منحك أي تأشيرة أو موافقة حكومية أو نتيجة محددة، حيث تخضع الموافقات النهائية للجهات الحكومية المختصة."
        ]
      },
      {
        heading: "2. القبول واستخدام المنصة",
        content: [
          "باستخدامك المنصة أو إنشاء حساب، فإنك تقرّ بأهليتك القانونية (18 سنة أو أكثر) وبأنك مخوّل لاستخدام الخدمات باسمك أو باسم الجهة التي تمثلها.",
          "يُعد استمرارك في استخدام المنصة بعد أي تحديث للشروط موافقة ضمنية على الشروط المعدّلة.",
          "في حال عدم موافقتك على أي بند من هذه الشروط، يجب عليك التوقف فورًا عن استخدام المنصة وخدماتها."
        ]
      },
      {
        heading: "3. إنشاء الحساب وأمن البيانات",
        content: [
          "تتحمل وحدك مسؤولية صحة وكمال البيانات التي تقدمها عند التسجيل، ويحق لتأهيل طلب مستندات أو معلومات إضافية للتحقق.",
          "أنت مسؤول عن الحفاظ على سرية بيانات الدخول (اسم المستخدم، البريد الإلكتروني، كلمة المرور، رمز الـ OTP) وعدم مشاركتها مع أي طرف آخر.",
          "يجب إبلاغنا فورًا عبر قنوات الدعم الرسمية في حال الاشتباه بأي دخول أو استخدام غير مصرح به لحسابك.",
          "يحق لتأهيل تعليق أو إلغاء أي حساب في حال الاشتباه في إساءة الاستخدام، أو التلاعب، أو تقديم بيانات مضلّلة أو مخالفة للقانون."
        ]
      },
      {
        heading: "4. التزامات المستخدم والاستخدام المسموح",
        content: [
          "تتعهد باستخدام المنصة والخدمات لأغراض قانونية ومشروعة فقط، وعدم استغلالها في أي نشاط مخالف للقانون أو للأنظمة المعمول بها في دولة الإمارات العربية المتحدة أو أي دولة أخرى ذات صلة.",
          "تمتنع عن رفع أو إرسال أي محتوى غير قانوني أو مزيف أو مسيء أو ينتهك حقوق الغير (مثل حقوق الملكية الفكرية أو الخصوصية).",
          "تقرّ بأن أي مستندات أو بيانات تقدمها (مثل الهوية، الجواز، الرخصة، العقود) سليمة، صحيحة، وغير مزوّرة، وأنك مخوّل قانونًا لاستخدامها.",
          "تتحمل المسؤولية الكاملة عن أي أضرار أو مطالبات تنشأ نتيجة تقديم بيانات غير صحيحة أو استخدام غير نظامي للخدمات."
        ]
      },
      {
        heading: "5. الرسوم والمدفوعات وسياسة الاسترجاع",
        content: [
          "تُعرض رسوم الخدمات (بما في ذلك رسوم الخدمة ورسوم الجهات الحكومية والضرائب المطبقة مثل ضريبة القيمة المضافة 5%) بشكل واضح قبل إتمام الطلب.",
          "تتم معالجة المدفوعات إلكترونيًا عبر بوابة دفع معتمدة مثل Stripe، ولا تقوم تأهيل بتخزين بيانات البطاقة الائتمانية على خوادمها.",
          "بمجرد إرسال الطلب وبدء معالجته من قبل فريق تأهيل أو الجهات الحكومية، تُعتبر الخدمة منفَّذة كليًا أو جزئيًا، ولا يمكن استرجاع الرسوم المدفوعة إلا في حالات استثنائية وحسب تقدير إدارة تأهيل.",
          "لا تتحمل تأهيل مسؤولية أي مبالغ إضافية أو فروق ناتجة عن رسوم أو سياسات للجهات الحكومية أو البنوك أو بوابات الدفع.",
          "في حال حدوث خطأ تقني أو خصم غير مبرر، سيتم مراجعة الحالة، وإن ثبت الخطأ من طرفنا يتم تصحيحه أو إعادة المبلغ في حدود ما يقرره النظام المالي والقانوني."
        ]
      },
      {
        heading: "6. المستندات والمعاملات الحكومية",
        content: [
          "تقرّ بأن دور تأهيل يقتصر على تجهيز وتقديم الطلبات ومتابعتها حسب البيانات والمستندات التي تقدمها أنت.",
          "الموافقة أو الرفض أو التأخير في الطلبات الحكومية يخضع بالكامل لتقدير الجهات الحكومية المختصة، ولا تتحمل تأهيل مسؤولية قرارات تلك الجهات.",
          "في حال رفض الطلب أو تأخّر إنجازه لأسباب متعلقة بالجهة الحكومية أو المستندات المقدَّمة من العميل، لا يترتب على تأهيل التزام بإعادة الرسوم ما لم تقرر الإدارة خلاف ذلك.",
          "أنت مسؤول عن متابعة حالة طلبك عبر المنصة، وتحديث أي مستندات منتهية الصلاحية أو ناقصة عند طلبها."
        ]
      },
      {
        heading: "7. المحتوى وحقوق الملكية الفكرية",
        content: [
          "جميع الشعارات، والأسماء التجارية، والتصاميم، والواجهات، والأيقونات، والنصوص، والبرمجيات المستخدمة في المنصة مملوكة لتأهيل أو مرخّصة لها، ومحميّة بموجب قوانين حقوق الملكية الفكرية.",
          "يُحظر نسخ أو إعادة نشر أو تعديل أو ترجمة أو توزيع أي جزء من محتوى المنصة لأي غرض تجاري دون موافقة كتابية مسبقة من تأهيل.",
          "يمنحك استخدام المنصة ترخيصًا شخصيًا محدودًا غير حصري وغير قابل للتحويل لاستخدام الخدمات وفقًا لهذه الشروط فقط."
        ]
      },
      {
        heading: "8. مزودو الخدمات الخارجيون (Stripe، Firebase، OpenAI وغيرها)",
        content: [
          "تعتمد المنصة على خدمات وتقنيات مقدمة من أطراف خارجية مثل: Google Firebase / Google Cloud (للتخزين، قواعد البيانات، التحليلات، الإشعارات)، وStripe (لمعالجة المدفوعات)، و OpenAI (لدعم حلول الذكاء الاصطناعي والدردشة وتحليل المستندات).",
          "باستخدامك المنصة، فإنك تقرّ وتوافق على خضوع بياناتك للمعالجة وفقًا لسياسات الخصوصية وشروط الاستخدام لدى هذه الأطراف، بالإضافة إلى سياسة الخصوصية الخاصة بتأهيل.",
          "لا تتحمل تأهيل مسؤولية أي أعطال أو توقف أو تغييرات في سياسات تلك الخدمات الخارجية، لكنها تبذل جهدًا معقولًا للحفاظ على استمرارية الخدمة."
        ]
      },
      {
        heading: "9. حدود المسؤولية وإخلاء المسؤولية",
        content: [
          "تُقدَّم خدمات المنصة \"كما هي\" و\"حسب التوفر\" دون أي ضمانات صريحة أو ضمنية تتعلق بالدقة أو الملاءمة لغرض معين أو استمرارية الخدمة.",
          "لا تتحمل تأهيل مسؤولية أي خسائر مباشرة أو غير مباشرة أو عرضية أو تبعية ناشئة عن استخدامك للمنصة أو عدم قدرتك على استخدامها، بما في ذلك – على سبيل المثال لا الحصر – تأخر المعاملات أو رفض الطلبات أو أي أخطاء في البيانات المقدمة من طرفك.",
          "في جميع الأحوال، إذا تقررت مسؤولية تأهيل قانونيًا، فيُحدّد الحد الأقصى لهذه المسؤولية في مجموع الرسوم التي دفعتها عن الخدمة محل النزاع."
        ]
      },
      {
        heading: "10. الصيانة والتحديثات والتعديلات على الخدمات",
        content: [
          "يحق لتأهيل إجراء أعمال صيانة أو تحديث أو تطوير للمنصة في أي وقت، وقد يترتب على ذلك توقف مؤقت للخدمة.",
          "يمكن إضافة أو تعديل أو إيقاف أي جزء من الخدمات أو الخصائص أو الباقات دون إشعار مسبق، مع الحرص على عدم الإضرار بحقوق المستخدمين قدر الإمكان.",
          "يُنصح المستخدم بمراجعة الشروط والأحكام وسياسة الخصوصية بشكل دوري عبر موقعنا الرسمي."
        ]
      },
      {
        heading: "11. إنهاء أو تعليق الاستخدام",
        content: [
          "يحق لتأهيل، دون إشعار مسبق، تعليق أو إلغاء حسابك أو تقييد وصولك في أي وقت إذا رأت أنك خالفت هذه الشروط أو أسأت استخدام الخدمات أو عرضت المنصة أو المستخدمين الآخرين لمخاطر قانونية أو أمنية.",
          "يمكنك طلب إغلاق حسابك في أي وقت، مع ملاحظة أن بعض البيانات قد تُحتفَظ بها للمدة اللازمة للامتثال للمتطلبات القانونية والتنظيمية.",
          "لا يؤثر إنهاء الحساب أو تعليق الخدمة على أي التزامات مالية مستحقة قبلك لصالح تأهيل."
        ]
      },
      {
        heading: "12. القانون المعمول به والاختصاص القضائي",
        content: [
          "تخضع هذه الشروط والأحكام وتُفسَّر وفقًا لقوانين دولة الإمارات العربية المتحدة.",
          "في حال نشوء أي نزاع أو مطالبة تتعلق باستخدام المنصة أو الخدمات، يكون الاختصاص الحصري للمحاكم المختصة داخل دولة الإمارات العربية المتحدة، مع إمكانية اللجوء لجهات التحكيم إن تم الاتفاق على ذلك لاحقًا."
        ]
      },
      {
        heading: "13. التعديلات على الشروط والأحكام",
        content: [
          "تحتفظ تأهيل بالحق في تعديل هذه الشروط والأحكام في أي وقت، بما في ذلك إضافة بنود جديدة أو حذف أو تحديث بنود قائمة.",
          "يتم نشر النسخة الأحدث من الشروط على موقعنا الرسمي عبر الرابط: https://www.taheel.ae/terms?lang=ar",
          "يُعد استمرارك في استخدام المنصة بعد تاريخ نفاذ أي تعديل موافقة ضمنية منك على الشروط المعدّلة.",
          "تاريخ آخر تحديث لهذه الشروط: 20 نوفمبر 2025."
        ]
      },
      {
        heading: "14. اللغة والتعارض بين النسخ",
        content: [
          "قد تتوفر هذه الشروط والأحكام بلغات متعددة. في حال وجود أي تعارض بين النص العربي والنص الإنجليزي، يتم الاعتماد على النص العربي في نطاق القوانين المعمول بها في دولة الإمارات العربية المتحدة.",
          "تهدف النسخة الإنجليزية إلى التيسير والفهم للمستخدمين غير الناطقين بالعربية."
        ]
      },
      {
        heading: "15. التواصل معنا",
        content: [
          "للاستفسارات المتعلقة بالشروط والأحكام أو الخدمات، يمكنك التواصل معنا عبر البريد الإلكتروني: info@taheel.ae",
          "كما يمكنك دائمًا الاطلاع على أحدث نسخة من الشروط والأحكام من خلال موقعنا الرسمي: https://www.taheel.ae/terms?lang=ar"
        ]
      }
    ]
  },

  en: {
    title: "TAHEEL Terms & Conditions",
    intro:
      "By accessing or using the TAHEEL platform (website, mobile application, and any related digital services), you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions, together with our Privacy Policy and any additional policies or guidelines we publish.",
    sections: [
      {
        heading: "1. About TAHEEL and Nature of Services",
        content: [
          "TAHEEL is a private platform that provides government facilitation services and related support (such as form filling, document preparation, follow-up, and smart assistance powered by AI).",
          "TAHEEL is not a government entity and does not represent any governmental authority. Our role is to assist you in preparing and submitting your requests in line with applicable regulations.",
          "Accepting these Terms does not guarantee visa issuance, approvals, or any specific outcome, as final decisions rest solely with the relevant government authorities."
        ]
      },
      {
        heading: "2. Acceptance and Use of the Platform",
        content: [
          "By creating an account or using the services, you represent that you are at least 18 years old and legally authorized to use the platform on your own behalf or on behalf of the entity you represent.",
          "Your continued use of the platform after any update to these Terms constitutes your acceptance of the revised Terms.",
          "If you do not agree to any part of these Terms, you must stop using the platform and its services immediately."
        ]
      },
      {
        heading: "3. Account Creation and Security",
        content: [
          "You are solely responsible for providing accurate and complete information during registration, and TAHEEL may request additional documents or information for verification.",
          "You are responsible for keeping your login credentials (username, email, password, OTP) confidential and not sharing them with any third party.",
          "You must notify us promptly through our official support channels if you suspect any unauthorized access to or use of your account.",
          "TAHEEL reserves the right to suspend or terminate any account if misuse, fraud, misleading information, or violation of these Terms is suspected."
        ]
      },
      {
        heading: "4. User Obligations and Permitted Use",
        content: [
          "You agree to use the platform and services only for lawful and legitimate purposes and in accordance with applicable laws in the United Arab Emirates and any other relevant jurisdiction.",
          "You must not upload or submit any illegal, false, offensive, or infringing content, including content that violates intellectual property or privacy rights of others.",
          "You confirm that any documents or data you provide (such as IDs, passports, licenses, contracts) are valid, accurate, and not forged, and that you are legally authorized to use them.",
          "You bear full responsibility for any damages, claims, or consequences arising from providing incorrect data or using the services in an unlawful way."
        ]
      },
      {
        heading: "5. Fees, Payments, and Refund Policy",
        content: [
          "Service fees (including our service fees, government fees, and applicable taxes such as 5% VAT) will be displayed clearly before you confirm your order.",
          "Payments are processed electronically through a secure payment gateway such as Stripe. TAHEEL does not store full credit card details on its own servers.",
          "Once a request is submitted and processing has started by TAHEEL or the relevant authority, the service is considered fully or partially delivered. Fees are generally non-refundable, except in exceptional cases and at the sole discretion of TAHEEL management.",
          "TAHEEL is not responsible for any additional amounts, surcharges, or differences applied by government entities, banks, or payment gateways.",
          "If a technical error or unjustified charge is identified and verified as caused by us, we will correct it or issue a refund in accordance with our internal financial and legal procedures."
        ]
      },
      {
        heading: "6. Documents and Government Transactions",
        content: [
          "You acknowledge that TAHEEL’s role is limited to preparing, submitting, and following up on your requests based on the information and documents you provide.",
          "Approval, rejection, or delay of any government request is solely determined by the relevant government authority, and TAHEEL cannot be held liable for such decisions.",
          "If a request is rejected or delayed due to reasons related to the government authority or the documents provided by you, TAHEEL is under no obligation to refund any fees unless otherwise decided by management.",
          "You are responsible for checking your request status via the platform and for updating any expired or missing documents when requested."
        ]
      },
      {
        heading: "7. Content and Intellectual Property",
        content: [
          "All logos, trademarks, brand names, designs, interfaces, icons, texts, and software used on the platform are owned by TAHEEL or licensed to TAHEEL and are protected by intellectual property laws.",
          "You may not copy, republish, modify, translate, or distribute any part of the platform content for commercial purposes without prior written consent from TAHEEL.",
          "Your use of the platform grants you a limited, personal, non-exclusive, non-transferable license to use the services strictly in accordance with these Terms."
        ]
      },
      {
        heading: "8. Third-Party Service Providers (Stripe, Firebase, OpenAI, etc.)",
        content: [
          "The platform relies on third-party services and technologies, including but not limited to: Google Firebase / Google Cloud (for storage, databases, analytics, notifications), Stripe (for payment processing), and OpenAI (for AI-powered support and document analysis).",
          "By using the platform, you acknowledge and agree that your data may be processed in accordance with the privacy policies and terms of these third parties, in addition to TAHEEL’s own Privacy Policy.",
          "TAHEEL is not responsible for outages, changes in policies, or technical issues attributable to these third-party services, although we will use reasonable efforts to maintain service continuity."
        ]
      },
      {
        heading: "9. Limitation of Liability and Disclaimer",
        content: [
          'The platform and services are provided on an "as is" and "as available" basis, without any warranties of any kind, whether express or implied, including but not limited to fitness for a particular purpose or non-infringement.',
          "TAHEEL shall not be liable for any direct, indirect, incidental, consequential, or special damages arising out of or in connection with your use of, or inability to use, the platform or services, including delays, rejections, or errors in requests resulting from your data or third-party systems.",
          "In all cases where TAHEEL is found legally liable, the maximum aggregate liability shall be limited to the total fees you paid for the specific service giving rise to the claim."
        ]
      },
      {
        heading: "10. Maintenance, Updates, and Service Changes",
        content: [
          "TAHEEL may perform maintenance, upgrades, or updates to the platform at any time, which may result in temporary service interruptions.",
          "We may add, modify, or discontinue parts of the services, features, or packages without prior notice, while making reasonable efforts not to adversely affect users’ acquired rights.",
          "You are encouraged to review these Terms & Conditions and our Privacy Policy regularly on our official website."
        ]
      },
      {
        heading: "11. Termination or Suspension of Use",
        content: [
          "TAHEEL may, without prior notice, suspend or terminate your account or restrict your access at any time if we believe you have violated these Terms, misused the services, or exposed the platform or other users to legal or security risks.",
          "You may request closure of your account at any time, noting that certain data may be retained for as long as necessary to comply with legal or regulatory requirements.",
          "Termination or suspension of your account does not relieve you of any outstanding financial obligations owed to TAHEEL."
        ]
      },
      {
        heading: "12. Governing Law and Jurisdiction",
        content: [
          "These Terms & Conditions are governed by and construed in accordance with the laws of the United Arab Emirates.",
          "Any disputes or claims arising out of or relating to your use of the platform or services shall be subject to the exclusive jurisdiction of the competent courts in the United Arab Emirates, without prejudice to any agreed arbitration mechanisms that may be adopted."
        ]
      },
      {
        heading: "13. Changes to the Terms & Conditions",
        content: [
          "TAHEEL reserves the right to modify these Terms & Conditions at any time, including adding new provisions or updating existing ones.",
          "The latest version of the Terms will always be published on our official website at: https://www.taheel.ae/terms?lang=ar",
          "Your continued use of the platform after the effective date of any changes constitutes your acceptance of the revised Terms.",
          "Last updated: 20 November 2025."
        ]
      },
      {
        heading: "14. Language and Conflicts Between Versions",
        content: [
          "These Terms & Conditions may be made available in multiple languages. In case of any inconsistency between the Arabic and English versions, the Arabic version shall prevail to the extent permitted by applicable UAE laws.",
          "The English version is provided for convenience and to support non-Arabic-speaking users."
        ]
      },
      {
        heading: "15. Contact Us",
        content: [
          "For any questions regarding these Terms & Conditions or our services, please contact us at: info@taheel.ae",
          "You can always review the latest version of these Terms on our official website: https://www.taheel.ae/terms?lang=ar"
        ]
      }
    ]
  }
};

function TermsPageInner() {
  const searchParams = useSearchParams();
  const lang = searchParams.get("lang") === "ar" ? "ar" : "en";
  const t = TERMS[lang];
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
          tabIndex={0}
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

        <div
          className={`text-xs text-gray-400 pt-6 font-medium ${align}`}
        >
          © {new Date().getFullYear()} TAHEEL. All rights reserved.
        </div>
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <Suspense fallback={null}>
      <TermsPageInner />
    </Suspense>
  );
}
