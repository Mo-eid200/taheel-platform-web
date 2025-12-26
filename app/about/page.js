"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * TAHEEL About Page (AR/EN via ?lang=ar|en)
 * Place: app/about/page.js
 *
 * Assets expected:
 * /logo-transparent-large.png
 * /logos/iso-9001.png
 * /logos/iso-27001.png
 * /logos/dmca.png
 * /logos/google-business.png
 * /logos/trustpilot.png
 */

const ABOUT = {
  ar: {
    eyebrow: "من نحن",
    title: "تأهيل — منصة تشغيل رقمية مرخّصة لمتابعة المعاملات الحكومية في الإمارات",
    intro:
      "تأهيل ليست مكتب معاملات تقليدي. نحن منصة تشغيل رقمية مرخّصة داخل دولة الإمارات لإنجاز ومتابعة المعاملات الحكومية للأفراد والشركات بأسلوب حديث يجمع الخبرة العملية والتنظيم الرقمي والتنفيذ عن بُعد، مع تتبع وإشعارات وتوثيق واضح لكل خطوة.",
    trustLine:
      "تأهيل تعمل كجهة تشغيل ومتابعة وخدمة مع العملاء ضمن نطاق الترخيص المعتمد، بينما يبقى القرار النهائي دائمًا للجهة الحكومية المختصة.",
    bullets: [
      "تشغيل ومتابعة المعاملات الحكومية عن بُعد: تقديم، تدقيق، متابعة، وإغلاق الطلب مع سجل إجراءات واضح.",
      "تتبع لحظي وإشعارات دقيقة + رقم تتبع لكل طلب لضمان الشفافية وتقليل الاستفسارات والانتظار.",
      "منهجية تشغيل موحدة تقلّل الأخطاء وتزيد جودة الملفات قبل إرسالها للجهات المختصة.",
      "حماية بيانات متقدمة: تشفير أثناء النقل والتخزين + صلاحيات دقيقة + تسجيل عمليات (Audit Trail).",
      "خدمة ثنائية اللغة (عربي/English) وتجربة عميل احترافية للأفراد والمستثمرين والشركات.",
    ],
    sections: [
      {
        title: "ماذا نفعل؟",
        desc:
          "ندير معاملات الأفراد والشركات داخل دولة الإمارات من البداية للنهاية: استقبال الطلب عبر الموقع/التطبيق، تنظيم المستندات، مراجعة الجودة، المتابعة الإجرائية، والتسليم النهائي — مع توثيق كامل لكل خطوة.",
      },
      {
        title: "لماذا نحن مختلفون؟",
        desc:
          "لأننا منصة تشغيل وليست اجتهادًا فرديًا: توزيع ذكي للطلبات، مراجعة تقنية وبشرية، تواصل واضح عند نقص البيانات، وتحديثات حالة مستمرة حتى الإنهاء. النتيجة: وقت أقل، أخطاء أقل، وتجربة أوضح.",
      },
      {
        title: "الأمان والامتثال والاعتمادات",
        desc:
          "نلتزم بمعايير وتشريعات حماية البيانات داخل دولة الإمارات، ونعتمد ممارسات أمن معلومات وجودة تشغيلية على مستوى عالمي. كما تمت حماية المحتوى والملفات الرقمية وفق DMCA، مع وجود اعتمادات تشغيلية ومعايير جودة وأمن معلومات مثل ISO 9001 و ISO 27001 ضمن نطاق الاستخدام الفني والتشغيلي.",
      },
      {
        title: "التسجيل الدولي والموثوقية",
        desc:
          "تأهيل تمتلك شهادة تسجيل دولية داعمة للموثوقية التجارية والهوية المؤسسية، بما يعكس التزامنا بمعايير تنظيمية واضحة وبيانات قانونية موثقة. كما نعتمد أسلوب عمل احترافي يسهّل على العملاء والشركات التعامل بثقة.",
      },
    ],
    stats: [
      { k: "Remote-First", v: "تنفيذ عن بُعد بالكامل" },
      { k: "Traceability", v: "تتبع + توثيق لكل خطوة" },
      { k: "Compliance", v: "تشغيل وفق ترخيص ومعايير" },
      { k: "Bilingual", v: "Arabic / English" },
    ],
    ctaTitle: "ابدأ الآن بثقة",
    ctaDesc:
      "سجّل الآن وابدأ تجربة حكومية مختلفة — منظمة، موثقة، وواضحة. سنستقبل طلبك ونحوّله لمسار تشغيل كامل من أول خطوة حتى الإغلاق.",
    cta: "سجّل الآن",
    legalNote:
      "ملاحظة: تأهيل ليست جهة حكومية ولا جهة اتخاذ قرار. القبول/الرفض والرسوم الحكومية الرسمية تخضع للجهة المختصة وفق الأنظمة المعمول بها داخل دولة الإمارات.",
  },

  en: {
    eyebrow: "About Us",
    title:
      "TAHEEL — A Licensed Digital Operating Platform for Government Transactions in the UAE",
    intro:
      "TAHEEL is not a traditional typing center. We are a licensed digital operating platform in the UAE that manages and follows up government transactions for individuals and businesses with a modern, remote-first approach — powered by structured operations, real-time tracking, notifications, and full step-by-step documentation.",
    trustLine:
      "TAHEEL operates within its licensed scope for processing and follow-up, while final decisions always remain with the relevant government authority.",
    bullets: [
      "Remote-first government transaction handling: submission, validation, follow-up, and closure with a clear audit trail.",
      "Real-time tracking, notifications, and a unique tracking ID for every request to ensure transparency.",
      "Standardized operations that reduce errors and improve file quality before submission to authorities.",
      "Advanced security: encryption in transit & at rest, fine-grained permissions, and audit logging.",
      "Bilingual service (Arabic/English) with a professional customer experience for individuals & companies.",
    ],
    sections: [
      {
        title: "What we do",
        desc:
          "We manage UAE-related government transactions end-to-end: request intake via web/app, document organization, quality checks, procedural follow-up, and final delivery — with clear documentation at every stage.",
      },
      {
        title: "Why TAHEEL is different",
        desc:
          "Because we are an operating system, not a one-person effort: smart request routing, technical + human review, precise requirement notes when something is missing, and continuous status updates until closure.",
      },
      {
        title: "Security, compliance & standards",
        desc:
          "We follow UAE data protection practices and implement globally recognized security and quality management operations. Digital content and files are protected under DMCA, with operational standards such as ISO 9001 and ISO 27001 applied within their technical and operational scope.",
      },
      {
        title: "International registration & trust",
        desc:
          "TAHEEL holds an international registration certificate supporting corporate identity and commercial trust. This reflects our commitment to structured operations, verified company data, and professional service delivery.",
      },
    ],
    stats: [
      { k: "Remote-First", v: "Fully remote execution" },
      { k: "Traceability", v: "Tracking + full audit trail" },
      { k: "Compliance", v: "Licensed operations" },
      { k: "Bilingual", v: "Arabic / English" },
    ],
    ctaTitle: "Get started with confidence",
    ctaDesc:
      "Register now and experience a more organized, transparent, and professional way to manage government transactions — from intake to closure.",
    cta: "Register Now",
    legalNote:
      "Note: TAHEEL is not a government entity and does not make final decisions. Approvals/denials and official government fees are determined by the relevant authority under UAE regulations.",
  },
};

function AboutContent() {
  const searchParams = useSearchParams();
  const lang = searchParams.get("lang") === "ar" ? "ar" : "en";
  const t = ABOUT[lang];

  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "text-right" : "text-left";
  const flexDir = lang === "ar" ? "md:flex-row-reverse" : "md:flex-row";

  return (
    <section
      dir={dir}
      className="min-h-screen bg-gradient-to-br from-[#060910] via-[#070b14] to-[#05060a] text-white px-3 sm:px-6 py-14"
    >
      <div className="mx-auto max-w-6xl">
        {/* HERO */}
        <div className="rounded-[32px] border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[0_30px_90px_-55px_rgba(0,0,0,0.8)] overflow-hidden">
          <div className="p-7 sm:p-10">
            <div className={`flex flex-col ${flexDir} gap-10 items-start`}>
              <div className="w-full md:w-[58%]">
                <div
                  className={`inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-4 py-2 text-sm text-white/80 ${align}`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-300/90" />
                  {t.eyebrow}
                </div>

                <h1
                  className={`mt-5 text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.08] ${align}`}
                >
                  <span className="text-emerald-300 drop-shadow">
                    {t.title}
                  </span>
                </h1>

                <p
                  className={`mt-5 text-base sm:text-lg text-white/80 leading-8 ${align}`}
                >
                  {t.intro}
                </p>

                <p
                  className={`mt-4 text-sm sm:text-base text-white/70 leading-7 ${align}`}
                >
                  {t.trustLine}
                </p>

                {/* STATS */}
                <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {t.stats.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-2xl bg-black/30 ring-1 ring-white/10 px-4 py-3"
                    >
                      <div className="text-xs text-white/60">{s.k}</div>
                      <div className="mt-1 font-extrabold text-white/90 text-sm">
                        {s.v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LOGO + TRUST STRIP */}
              <div className="w-full md:w-[42%]">
                <div className="rounded-[28px] bg-black/35 ring-1 ring-white/10 p-6 sm:p-7">
                  <div className="flex justify-center">
                    <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10 shadow-lg">
                      <Image
                        src="/logo-transparent-large.png"
                        alt="TAHEEL Logo"
                        width={110}
                        height={110}
                        className="h-[92px] w-[92px] sm:h-[110px] sm:w-[110px] object-contain"
                        priority
                      />
                    </div>
                  </div>

                  <div className={`mt-6 ${align}`}>
                    <div className="text-sm text-white/70">
                      TAHEEL | تأهيل
                    </div>
                    <div className="mt-1 text-2xl font-black">
                      Government Services, Re-Engineered
                    </div>
                    <div className="mt-2 text-white/70 leading-relaxed">
                      {lang === "ar"
                        ? "تشغيل منظم، متابعة دقيقة، وتوثيق واضح."
                        : "Structured operations, precise follow-up, and clear documentation."}
                    </div>
                  </div>

                  {/* BADGES */}
                  <div className="mt-6 grid grid-cols-5 gap-3 items-center">
                    <Image
                      src="/logos/iso-9001.png"
                      alt="ISO 9001"
                      width={64}
                      height={48}
                      className="h-8 w-auto object-contain opacity-80 hover:opacity-100 transition"
                    />
                    <Image
                      src="/logos/iso-27001.png"
                      alt="ISO 27001"
                      width={64}
                      height={48}
                      className="h-8 w-auto object-contain opacity-80 hover:opacity-100 transition"
                    />
                    <Image
                      src="/logos/dmca.png"
                      alt="DMCA"
                      width={64}
                      height={48}
                      className="h-8 w-auto object-contain opacity-80 hover:opacity-100 transition"
                    />
                    <Image
                      src="/logos/google-business.png"
                      alt="Google Business"
                      width={64}
                      height={48}
                      className="h-8 w-auto object-contain opacity-80 hover:opacity-100 transition"
                    />
                    <Image
                      src="/logos/trustpilot.png"
                      alt="Trustpilot"
                      width={64}
                      height={48}
                      className="h-8 w-auto object-contain opacity-80 hover:opacity-100 transition"
                    />
                  </div>

                  <div className="mt-5 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-sm text-white/70 leading-7">
                    {lang === "ar"
                      ? "اعتمادات ومعايير تشغيل مذكورة ضمن نطاقها الفني والتشغيلي."
                      : "Standards and badges are presented within their technical & operational scope."}
                  </div>
                </div>
              </div>
            </div>

            {/* BULLETS */}
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-[28px] bg-black/30 ring-1 ring-white/10 p-6">
                <div className={`font-extrabold text-lg ${align}`}>
                  {lang === "ar" ? "لماذا يثق بنا العملاء؟" : "Why clients trust TAHEEL"}
                </div>
                <ul className={`mt-4 space-y-3 text-white/80 ${align}`}>
                  {t.bullets.map((x, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300/90 shrink-0" />
                      <span className="leading-7">{x}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[28px] bg-black/30 ring-1 ring-white/10 p-6">
                <div className={`font-extrabold text-lg ${align}`}>
                  {lang === "ar" ? "ماذا ستشعر من أول تعامل؟" : "What you’ll feel from day one"}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    lang === "ar" ? "وضوح كامل في المطلوب" : "Clear requirements",
                    lang === "ar" ? "تحديثات حالة مستمرة" : "Continuous status updates",
                    lang === "ar" ? "ملف منظم قبل الإرسال" : "Organized file before submission",
                    lang === "ar" ? "تقليل الأخطاء والتأخير" : "Fewer errors & delays",
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80"
                    >
                      {s}
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-sm text-white/70 leading-7">
                  {t.legalNote}
                </div>
              </div>
            </div>

            {/* SECTIONS */}
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
              {t.sections.map((s, i) => (
                <div
                  key={i}
                  className="rounded-[28px] bg-white/[0.06] ring-1 ring-white/10 p-6"
                >
                  <div className={`font-black text-xl ${align}`}>
                    {s.title}
                  </div>
                  <p className={`mt-3 text-white/80 leading-8 ${align}`}>
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-10 rounded-[28px] bg-gradient-to-br from-emerald-500/15 via-white/5 to-sky-400/10 ring-1 ring-white/12 p-7 sm:p-8">
              <div className={`text-2xl sm:text-3xl font-black ${align}`}>
                {t.ctaTitle}
              </div>
              <p className={`mt-3 text-white/80 leading-8 ${align}`}>
                {t.ctaDesc}
              </p>

              <div className={`mt-6 flex flex-wrap gap-3 ${lang === "ar" ? "justify-start" : "justify-start"}`}>
                <Link href={lang === "ar" ? "/register?lang=ar" : "/register?lang=en"}>
                  <button className="cursor-pointer px-8 py-3 text-black text-lg font-extrabold bg-white rounded-full shadow-lg hover:scale-[1.03] transition-transform duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-400/40">
                    {t.cta}
                  </button>
                </Link>

                <Link href={lang === "ar" ? "/p/u/brochure?lang=ar" : "/p/u/brochure?lang=en"}>
                  <button className="cursor-pointer px-8 py-3 text-white text-lg font-semibold bg-white/10 ring-1 ring-white/18 rounded-full shadow-lg hover:bg-white/14 transition duration-300 focus:outline-none focus:ring-4 focus:ring-white/20">
                    {lang === "ar" ? "اقرأ البورتفوليو" : "View Portfolio"}
                  </button>
                </Link>
              </div>
            </div>

            {/* FOOTER NOTE */}
            <div className={`mt-8 text-xs text-white/50 leading-6 ${align}`}>
              {lang === "ar"
                ? "© " + new Date().getFullYear() + " TAHEEL. All rights reserved."
                : "© " + new Date().getFullYear() + " TAHEEL. All rights reserved."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05060a] text-white grid place-items-center">Loading...</div>}>
      <AboutContent />
    </Suspense>
  );
}
