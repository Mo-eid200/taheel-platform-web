"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Sparkles,
  Gauge,
  Workflow,
  Building2,
  Users,
  Globe,
  BadgeCheck,
  Lock,
  FileText,
  ScrollText,
  Cpu,
  Zap,
  CheckCircle2,
  ArrowDown,
  Smartphone,
  Mail,
  Phone,
  MapPin,
  Layers,
  Star,
  Info,
  ChevronDown,
} from "lucide-react";

/**
 * ✅ TAHEEL | Portfolio Page (AR)
 * Place in: app/portfolio/page.js (Next.js App Router)
 *
 * Requires:
 * - tailwindcss
 * - framer-motion
 * - lucide-react
 *
 * Images (in /public):
 * - /taheel-logo.png
 * - /Taheel-qr.png
 * (optional) /openqcore-logo.png, /qxt-badge.png
 */

const Section = ({ id, title, subtitle, icon: Icon, children }) => (
  <section id={id} className="scroll-mt-28">
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
          {Icon ? <Icon className="h-6 w-6" /> : null}
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-white/70 leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
    {children}
  </section>
);

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-sm text-white/85 ring-1 ring-white/15">
    {children}
  </span>
);

const Card = ({ children, className = "" }) => (
  <div
    className={
      "rounded-3xl bg-white/8 ring-1 ring-white/12 backdrop-blur-xl shadow-[0_25px_70px_-40px_rgba(0,0,0,0.6)] " +
      className
    }
  >
    {children}
  </div>
);

const FancyButton = ({ children, href = "#", variant = "primary" }) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold transition will-change-transform";
  const styles =
    variant === "primary"
      ? "bg-white text-black hover:bg-white/90"
      : variant === "ghost"
        ? "bg-white/10 text-white ring-1 ring-white/18 hover:bg-white/14"
        : "bg-gradient-to-l from-white/20 to-white/5 text-white ring-1 ring-white/15 hover:from-white/25 hover:to-white/10";
  return (
    <a href={href} className={`${base} ${styles}`} style={{ textDecoration: "none" }}>
      {children}
    </a>
  );
};

function AccordionItem({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 overflow-hidden">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 text-right"
      >
        <span className="font-bold text-white/95">{title}</span>
        <ChevronDown className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="px-5"
        style={{ overflow: "hidden" }}
      >
        <div className="pb-5 text-white/75 leading-relaxed">{children}</div>
      </motion.div>
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const LtrText = ({ children, className = "" }) => (
  <span dir="ltr" className={`unicode-bidi-isolate text-left ${className}`}>
    {children}
  </span>
);


export default function TaheelPortfolioPage() {
  const nav = useMemo(
    () => [
      { id: "about", label: "من نحن" },
      { id: "why", label: "لماذا تأهيل" },
      { id: "how", label: "كيف نعمل" },
      { id: "services", label: "خدماتنا" },
      { id: "golden", label: "الإقامة الذهبية" },
      { id: "tech", label: "التكنولوجيا QXT" },
      { id: "trust", label: "الثقة والامتثال" },
      { id: "record", label: "سجل الإنجاز" },
      { id: "plans", label: "باقات PRO" },
      { id: "terms", label: "الشروط والأحكام" },
      { id: "contact", label: "تواصل معنا" },
    ],
    []
  );

  const plans = useMemo(
    () => [
      {
        key: "starter",
        name: "Starter PRO",
        badge: "للشركات الصغيرة | 3–5 موظفين",
        price: "1,499",
        color: "from-emerald-300/30 to-white/5",
        items: [
          "إدارة جميع المعاملات الحكومية للشركة",
          "وزارة الموارد البشرية والتوطين",
          "الإقامات، التأشيرات، العقود",
          "متابعة وصياغة الشكاوى العمالية",
          "إشعارات وتتبع كامل لكل طلب",
          "تنفيذ رقمي 100% بدون تنقّل",
        ],
        options: [
          "شهري: 1,499 درهم",
          "ربع سنوي: 3,999 درهم / 3 أشهر",
          "نصف سنوي: 7,499 درهم / 6 أشهر (يشمل شهر مجاني)",
          "سنوي: 13,999 درهم / 12 شهر (يشمل شهر مجاني)",
        ],
      },
      {
        key: "growth",
        name: "Growth PRO",
        badge: "للشركات المتوسطة | 5–10 موظفين",
        price: "2,499",
        color: "from-sky-300/30 to-white/5",
        items: [
          "كل ما في Starter PRO",
          "مدير حساب مخصص",
          "أولوية في التنفيذ والمتابعة",
          "مراجعة إضافية للملفات الحساسة",
          "تقارير دورية عن الوضع الحكومي للشركة",
          "تنفيذ رقمي 100% بدون تنقّل",
        ],
        options: [
          "شهري: 2,499 درهم",
          "ربع سنوي: 6,499 درهم",
          "نصف سنوي: 11,999 درهم (يشمل شهر مجاني)",
          "سنوي: 21,999 درهم (يشمل شهر مجاني)",
        ],
      },
      {
        key: "scale",
        name: "Scale PRO",
        badge: "للشركات النامية | 10–20 موظف",
        price: "3,999",
        color: "from-fuchsia-300/30 to-white/5",
        items: [
          "إدارة شاملة لشؤون الموظفين الحكومية",
          "معالجة الحالات المعقّدة",
          "دعم قانوني وإجرائي موسّع",
          "تنبيهات استباقية قبل المخالفات أو التأخير",
          "إشراف تشغيلي أعلى",
          "تشغيل حكومي منظم بمستوى أعلى",
        ],
        options: [
          "شهري: 3,999 درهم",
          "ربع سنوي: 10,499 درهم",
          "نصف سنوي: 18,999 درهم (يشمل شهر مجاني)",
          "سنوي: 33,999 درهم (يشمل شهر مجاني)",
        ],
      },
      {
        key: "enterprise",
        name: "Enterprise PRO",
        badge: "للشركات الكبيرة | 20+ موظف (غير محدود)",
        price: "6,999",
        color: "from-rose-300/30 to-white/5",
        items: [
          "إدارة حكومية كاملة بدون سقف",
          "عدد غير محدود من الموظفين",
          "فريق مخصص",
          "أولوية قصوى في التنفيذ",
          "حلول حسب نشاط الشركة + SLA",
          "تشغيل حكومي بمستوى الشركات الكبرى",
        ],
        options: [
          "شهري: 6,999 درهم",
          "ربع سنوي: 17,999 درهم",
          "نصف سنوي: 32,999 درهم (يشمل شهر مجاني)",
          "سنوي: 57,999 درهم (يشمل شهر مجاني)",
        ],
      },
    ],
    []
  );

  const workflow = useMemo(
    () => [
      {
        title: "تقديم الطلب",
        desc: "عبر تطبيق تأهيل (Android & iOS) أو عبر الموقع — اختيار الخدمة ورفع المستندات بسهولة من أي مكان.",
        icon: Smartphone,
      },
      {
        title: "تسجيل الطلب ورقم التتبع",
        desc: "تسجيل تلقائي داخل النظام + رقم تتبع لمتابعة الحالة في أي وقت (موثّق منذ لحظة التقديم).",
        icon: FileText,
      },
      {
        title: "التوزيع الذكي للطلب",
        desc: "توجيه الطلب تلقائيًا إلى الموظف المختص وفق نوع الخدمة والجهة المعنية لضمان سرعة المعالجة ووضوح المسؤولية.",
        icon: Workflow,
      },
      {
        title: "مراجعة ذكية ثم بشرية",
        desc: "فحص إلكتروني باستخدام الذكاء الاصطناعي لتقييم اكتمال وتوافق البيانات + مراجعة بشرية نهائية لضمان جودة الملف.",
        icon: Cpu,
      },
      {
        title: "التواصل عند الحاجة",
        desc: "في حال نقص بيانات/مستندات غير واضحة: إشعار واضح ومباشر يحدد المطلوب بدقة. وإذا مكتمل 100% ينتقل تلقائيًا للخطوة التالية.",
        icon: Info,
      },
      {
        title: "الإرسال للجهات المختصة",
        desc: "بعد اكتمال المراجعة يتم الإرسال للجهة الحكومية صاحبة القرار مع تحديثات حالة مستمرة وإشعارات للعميل.",
        icon: Zap,
      },
      {
        title: "متابعة حتى الإنهاء",
        desc: "متابعة مستمرة حتى القرار النهائي وإغلاق الطلب وتسليم النتيجة — مع توثيق كامل لكل خطوة.",
        icon: CheckCircle2,
      },
    ],
    []
  );

  const services = useMemo(
    () => [
      {
        icon: Globe,
        title: "خدمات غير المقيمين",
        points: [
          "التأشيرات السياحية والمعاملات المرتبطة بغير المقيمين",
          "طلبات رسمية وخدمات مساندة ذات صلة",
          "ترجمات قانونية معتمدة بمراجعة مترجمين متخصصين",
          "تسليم موثق + QR + حفظ داخل النظام للرجوع والتوثيق",
        ],
        note:
          "جميع الخدمات هنا أمثلة توضيحية لا على سبيل الحصر — تختلف الإجراءات حسب حالة العميل ونوع الطلب ومتطلبات الجهة المختصة.",
      },
      {
        icon: Building2,
        title: "خدمات الشركات",
        points: [
          "بديل احترافي لموظف PRO… بتكلفة موظف واحد",
          "تأسيس الشركات وإدارة معاملات التشغيل المستمرة",
          "إدارة شؤون الموظفين أمام الجهات الحكومية",
          "متابعة وزارة الموارد البشرية والتوطين + الهجرة والإقامة",
          "معالجة الإشكالات الإدارية والملفات الحساسة",
        ],
      },
      {
        icon: Users,
        title: "خدمات الأفراد (المقيمين)",
        points: [
          "إنجاز المعاملات الحكومية الشخصية عن بُعد",
          "متابعة حتى الإنهاء مع تتبع واضح وإشعارات",
          "صياغة ومتابعة الشكاوى الرسمية والعمالية",
          "طلبات خاصة تتطلب صياغة دقيقة ومهنية",
        ],
      },
    ],
    []
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#05060a] text-white">
      {/* ✅ Ultra Global Animated Background (NO video, NO canvas) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[#05060a]" />
        <div className="aurora absolute inset-0 opacity-90" />
        <div className="gridMove absolute inset-0 opacity-[0.14]" />
        <div className="particles absolute inset-0 opacity-[0.25]" />
        <div className="noise absolute inset-0 opacity-[0.14]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/75" />
      </div>

      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/35 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
<div className="relative h-14 w-14 md:h-16 md:w-16 overflow-hidden rounded-full bg-white ring-1 ring-white/25 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.9)]">
  <Image
    src="/logo3.png"
    alt="TAHEEL"
    fill
    className="object-contain p-2"
    priority
  />
</div>

            <div className="leading-tight">
              <div className="font-extrabold tracking-tight">TAHEEL | تأهيل</div>
              <div className="text-xs text-white/65">Government Services, Re-Engineered</div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-2">
            {nav.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="rounded-full px-3 py-2 text-sm text-white/75 hover:text-white hover:bg-white/10 transition"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <FancyButton href="#contact" variant="primary">
              <Sparkles className="h-5 w-5" />
              ابدأ بثقة
            </FancyButton>
            <FancyButton href="#plans" variant="ghost">
              <ArrowDown className="h-5 w-5" />
              الباقات
            </FancyButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative">
        <div className="mx-auto max-w-7xl px-5 pt-12 pb-14">
          <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.7 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap gap-2 mb-5">
                <Pill>من حيث يبدأ المستقبل</Pill>
                <Pill>Remote-First</Pill>
                <Pill>منصة تشغيل — ليست مكتب معاملات</Pill>
                <Pill>QXT Powered</Pill>
              </div>

              <h1 className="text-4xl md:text-5xl font-black leading-[1.08] tracking-tight">
                نحو تجربة أكثر تنظيمًا، أسرع تنفيذًا،
                <span className="text-white/70"> وأوضح تواصلًا</span>
              </h1>

              <p className="mt-5 text-white/75 leading-relaxed text-lg">
                تأهيل منصة متخصصة لإدارة الخدمات الحكومية للأفراد والشركات داخل دولة الإمارات — بأسلوب حديث يجمع الخبرة العملية والتنظيم الرقمي وسهولة التنفيذ عن بُعد، مع تتبع وإشعارات وشفافية في كل خطوة.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <FancyButton href="#about" variant="primary">
                  <Star className="h-5 w-5" />
                  اقرأ البورتفوليو
                </FancyButton>
                <FancyButton href="#how" variant="ghost">
                  <Workflow className="h-5 w-5" />
                  كيف نعمل؟
                </FancyButton>
                <FancyButton href="#terms" variant="soft">
                  <ScrollText className="h-5 w-5" />
                  الشروط والأحكام
                </FancyButton>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: Gauge, t: "سرعة + تنظيم", d: "توزيع ذكي للطلبات ومسار واضح." },
                  { icon: ShieldCheck, t: "ثقة وامتثال", d: "توثيق + تتبع + معايير تشغيل." },
                  { icon: Lock, t: "حماية بيانات", d: "تشفير وصلاحيات وتسجيل العمليات." },
                ].map((x, i) => (
                  <Card key={i} className="p-5">
                    <x.icon className="h-6 w-6 text-white/90" />
                    <div className="mt-3 font-extrabold">{x.t}</div>
                    <div className="mt-1 text-sm text-white/70 leading-relaxed">{x.d}</div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <Card className="p-6 h-full">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/60">TAHEEL | تأهيل</div>
                    <div className="text-2xl font-black tracking-tight">Digital Operating Platform</div>
                    <div className="mt-1 text-white/70 text-sm">From the future beginning</div>
                  </div>
                  <div className="flex gap-2">
                    <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 px-3 py-2 text-xs">Pulse G1</div>
                    <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 px-3 py-2 text-xs">Atlas G1</div>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl bg-black/25 ring-1 ring-white/10 p-5">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-6 w-6" />
                    <div>
                      <div className="font-extrabold">QXT — Quantum eXtended Thinking</div>
                      <div className="text-sm text-white/70">محرك تنظيم وتشغيل متقدم ضمن منظومة OpenQCore</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/75">
                    {[
                      "تنظيم الطلبات وتوزيع المهام",
                      "تحليل البيانات وجودة المستندات",
                      "تقليل التدخل اليدوي",
                      "تتبع وتوثيق كامل",
                      "تنبيهات وإشعارات",
                      "معايير تشغيل موحدة",
                    ].map((t, i) => (
                      <div key={i} className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
                        {t}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-5">
                    <div className="font-extrabold">رمز الاستجابة السريع</div>
                    <div className="mt-2 text-sm text-white/70">امسح الكود لتحميل التطبيق أو فتح الرابط.</div>
                    <div className="mt-4 relative w-full aspect-square rounded-3xl bg-white/6 ring-1 ring-white/12 overflow-hidden">
                      <Image src="/Taheel-qr.png" alt="Taheel QR" fill className="object-contain p-6" />
                    </div>
                  </Card>

                  <Card className="p-5">
                    <div className="font-extrabold">تنزيل التطبيق</div>
                    <div className="mt-2 text-sm text-white/70">Android & iOS — تجربة حكومية مختلفة.</div>
                    <div className="mt-4 space-y-3">
                      <FancyButton href="#contact" variant="primary">
                        <Smartphone className="h-5 w-5" />
                        اطلب رابط التحميل
                      </FancyButton>
                      <FancyButton href="#how" variant="ghost">
                        <ArrowDown className="h-5 w-5" />
                        شاهد رحلة العميل
                      </FancyButton>
                    </div>
                    <div className="mt-5 text-xs text-white/55 leading-relaxed">
                      * سيتم ربط أزرار المتاجر الرسمية (App Store / Google Play) بالروابط النهائية عند جاهزيتها.
                    </div>
                  </Card>
                </div>
              </Card>
            </div>
          </motion.div>

          <div className="mt-10 flex flex-wrap gap-2">
            <Pill>✔ واضحة من البداية</Pill>
            <Pill>✔ منظمة أثناء التنفيذ</Pill>
            <Pill>✔ موثقة بعد الانتهاء</Pill>
            <Pill>✔ تنفيذ عن بُعد بالكامل</Pill>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-5 pb-20 space-y-14">
          {/* About */}
          <Section
            id="about"
            title="من نحن"
            subtitle="تأهيل منصة متخصصة لإدارة المعاملات الحكومية للأفراد والشركات داخل دولة الإمارات — تنظيم رقمي، تنفيذ عن بُعد، وتوثيق كامل."
            icon={BadgeCheck}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="p-6 lg:col-span-7">
                <div className="text-white/80 leading-relaxed space-y-4">
                  <p>
                    تأهيل ليست مكتب معاملات تقليدي، ولا تُحمّل العميل عبء التنقل بين الجهات أو زيارة مراكز الخدمة. نحن <b>منصة تشغيل رقمية</b> تستقبل الطلب، تنظمه، تراجعه، تتابعه، وتوثقه ضمن منظومة واضحة.
                  </p>
                  <p>
                    هدفنا تحويل التجربة الحكومية من إجراءات متفرقة إلى عمليات منظمة تُدار رقميًا: <b>تقليل التعقيد</b>، <b>تسريع التنفيذ</b>، و<b>ضمان الشفافية</b> في كل خطوة.
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { icon: Layers, t: "من الرؤية إلى التطبيق", d: "تطبيق عملي لتحويل البيروقراطية إلى عمليات رقمية منظمة." },
                    { icon: Users, t: "حل متكامل للأفراد والشركات", d: "نفس المنهجية — مع تخصيص الخدمة حسب نوع العميل." },
                    { icon: Workflow, t: "وضوح المسؤوليات", d: "توزيع ذكي للطلبات + تتبع يوضح من يفعل ماذا ومتى." },
                    { icon: FileText, t: "توثيق كامل", d: "كل خطوة محفوظة داخل النظام لضمان المصداقية." },
                  ].map((x, i) => (
                    <div key={i} className="rounded-3xl bg-black/20 ring-1 ring-white/10 p-5">
                      <x.icon className="h-6 w-6" />
                      <div className="mt-2 font-extrabold">{x.t}</div>
                      <div className="mt-1 text-sm text-white/70 leading-relaxed">{x.d}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 lg:col-span-5">
                <div className="flex items-center gap-3">
                  <Globe className="h-6 w-6" />
                  <div>
                    <div className="font-extrabold">التزام وطني</div>
                    <div className="text-sm text-white/70">دعم التحول الرقمي ومبادئ “تصفير البيروقراطية”</div>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-white/75 leading-relaxed">
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                    • تبسيط الإجراءات<br />• تقليل الخطوات غير الضرورية<br />• تحسين تجربة المتعامل
                  </div>
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                    بما يتماشى مع توجهات الدولة نحو حكومة أكثر كفاءة ومرونة.
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Pill>Transparency</Pill>
                  <Pill>Traceability</Pill>
                  <Pill>Compliance</Pill>
                  <Pill>Quality</Pill>
                </div>
              </Card>
            </div>
          </Section>

          {/* Why */}
          <Section
            id="why"
            title="لماذا تأهيل؟"
            subtitle="لأن الإدارة الذكية تصنع الفرق — منصة تشغيل بدلاً من مكتب معاملات تقليدي."
            icon={Sparkles}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { icon: Workflow, title: "منصة تشغيل… وليست مكتب معاملات", desc: "إدارة رقمية كاملة عن بُعد — بدون تنقل بين المراكز وبدون اعتماد على مصادر غير موثوقة." },
                { icon: Cpu, title: "إدارة ذكية مدعومة بتقنية QXT", desc: "تنظيم العمليات الحكومية المعقدة وربط الخطوات وتقليل التدخل اليدوي — مع معايير تشغيل موحدة." },
                { icon: Gauge, title: "كل شيء عن بُعد… بدون انتظار", desc: "استقبال الطلب وتنفيذه ومتابعته ضمن منظومة واضحة — سرعة ودقة وشفافية في كل مرحلة." },
              ].map((x, i) => (
                <Card key={i} className="p-6">
                  <x.icon className="h-7 w-7" />
                  <div className="mt-3 text-lg font-extrabold">{x.title}</div>
                  <div className="mt-2 text-white/70 leading-relaxed">{x.desc}</div>
                </Card>
              ))}
            </div>
          </Section>

          {/* How */}
          <Section
            id="how"
            title="كيف نعمل في تأهيل؟"
            subtitle="رحلة العميل رقمية بالكامل — بسيطة في الواجهة، ومحكومة بنظام ذكي في الخلفية."
            icon={Workflow}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="p-6 lg:col-span-5">
                <div className="font-extrabold text-lg">خلاصة التجربة</div>
                <div className="mt-3 space-y-3 text-white/75 leading-relaxed">
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                    • تقديم رقمي عبر التطبيق أو الموقع<br />
                    • توزيع ذكي للطلبات<br />
                    • مراجعة تقنية وبشرية<br />
                    • تواصل واضح عند الحاجة<br />
                    • متابعة لحظية حتى الإنهاء
                  </div>
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                    كل ذلك ضمن منظومة واحدة تجعل الخدمات الحكومية أبسط، أوضح، وأكثر كفاءة.
                  </div>
                </div>
              </Card>

              <Card className="p-6 lg:col-span-7">
                <div className="font-extrabold text-lg mb-4">مسار التنفيذ (Operational Flow)</div>
                <div className="space-y-3">
                  {workflow.map((s, idx) => (
                    <div key={idx} className="rounded-3xl bg-black/18 ring-1 ring-white/10 p-5">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-2xl bg-white/10 ring-1 ring-white/15 p-2">
                          <s.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-extrabold">{idx + 1}. {s.title}</div>
                          <div className="mt-1 text-sm text-white/70 leading-relaxed">{s.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </Section>

          {/* Services */}
          <Section
            id="services"
            title="خدماتنا"
            subtitle="لا نقدّم خدمات منفصلة… بل إدارة شاملة ومتكاملة للملفات الحكومية للأفراد، غير المقيمين، والشركات."
            icon={Building2}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {services.map((s, i) => (
                <Card key={i} className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 p-3">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <div className="font-extrabold text-lg">{s.title}</div>
                  </div>

                  <div className="mt-4 space-y-2 text-white/75">
                    {s.points.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 mt-0.5 text-white/80" />
                        <div className="leading-relaxed">{p}</div>
                      </div>
                    ))}
                  </div>

                  {s.note ? <div className="mt-4 text-xs text-white/55 leading-relaxed">{s.note}</div> : null}
                </Card>
              ))}
            </div>

            <div className="mt-6">
              <Card className="p-6">
                <div className="flex flex-wrap gap-2">
                  <Pill>شركة بدل موظف</Pill>
                  <Pill>نظام بدل اجتهاد فردي</Pill>
                  <Pill>تنظيم بدل عشوائية</Pill>
                  <Pill>متابعة بدل انتظار</Pill>
                </div>
              </Card>
            </div>
          </Section>

          {/* Golden Visa */}
          <Section
            id="golden"
            title="خدمات الإقامة الذهبية"
            subtitle="أحد أكثر الملفات تعقيدًا… وأكثرها تميّزًا في تأهيل — نُدير ملفًا مؤهلًا للقبول، لا مجرد تقديم طلب."
            icon={Star}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="p-6 lg:col-span-7">
                <div className="text-white/80 leading-relaxed space-y-4">
                  <p>
                    الإقامة الذهبية تعتمد على معايير دقيقة وتقييم شامل للملف، وليس فقط استيفاء مستندات شكلية. لذلك نتعامل معها كنظام تقييم متكامل.
                  </p>

                  <div className="rounded-3xl bg-black/20 ring-1 ring-white/10 p-5">
                    <div className="flex items-center gap-3">
                      <Cpu className="h-6 w-6" />
                      <div>
                        <div className="font-extrabold">تقييم ذكي قبل التقديم</div>
                        <div className="text-sm text-white/70">
                          محاكاة منطق التقييم لدى الجهات المختصة لتحديد القوة والثغرات وتحسين عرض الملف.
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/75">
                      {[
                        "تحليل شامل لملف المتقدم",
                        "إبراز نقاط القوة المؤثرة",
                        "تحديد نقاط الضعف المحتملة",
                        "اقتراح تحسينات واقعية",
                        "إعادة تنظيم المستندات",
                        "تحسين طريقة عرض المعلومات",
                      ].map((t, i) => (
                        <div key={i} className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-black/20 ring-1 ring-white/10 p-5">
                    <div className="font-extrabold">إدارة الملف حتى القرار</div>
                    <div className="mt-2 text-white/70 leading-relaxed">
                      إعداد + تدقيق + تقديم + متابعة حتى القرار النهائي، مع إبقاء العميل على اطلاع كامل بكل مرحلة.
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 lg:col-span-5">
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-6 w-6" />
                  <div>
                    <div className="font-extrabold">لماذا هذا الفرق مهم؟</div>
                    <div className="text-sm text-white/70">الفارق بين تقديم طلب… وإدارة ملف مؤهل للقبول.</div>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-white/75">
                  {[
                    "لا تُقاس فقط بالمستندات",
                    "ولا تعتمد على التقديم السريع",
                    "بل على التقييم الصحيح قبل التقديم",
                    "وتنظيم المعلومات بالطريقة الأنسب",
                  ].map((t, i) => (
                    <div key={i} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 mt-0.5" />
                      <div className="leading-relaxed">{t}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 text-xs text-white/55 leading-relaxed">
                  * القرار دائمًا للجهة المختصة — ولا يوجد ضمان لقبول أي طلب.
                </div>
              </Card>
            </div>
          </Section>

          {/* Tech */}
          <Section
            id="tech"
            title="كيف يعمل نظام تأهيل؟"
            subtitle="منصة تشغيل رقمية مبنية على منظومة OpenQCore ومدعومة بمحرك QXT — Pulse G1 & Atlas G1."
            icon={Cpu}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="p-6 lg:col-span-6">
                <div className="font-extrabold text-lg">QXT — عقل النظام</div>
                <div className="mt-3 text-white/75 leading-relaxed">
                  في قلب تأهيل يعمل QXT كمحرك تفكير وتشغيل مسؤول عن تنظيم الطلبات، تحليل البيانات، إدارة تدفق الإجراءات، توزيع المهام، ومراقبة جودة التنفيذ.
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/75">
                  {[
                    "توافق البيانات مع متطلبات الجهة المختصة",
                    "اكتمال المستندات وجودتها",
                    "ترتيب المعلومات للتقديم",
                    "تحديد نقاط القوة والتحسين",
                    "تقليل الأخطاء البشرية",
                    "رفع جودة الملفات وفرص القبول",
                  ].map((t, i) => (
                    <div key={i} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                      {t}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 lg:col-span-6">
                <div className="font-extrabold text-lg">التكامل بين الذكاء الاصطناعي والخبرة البشرية</div>
                <div className="mt-3 text-white/75 leading-relaxed">
                  لا يُستخدم الذكاء الاصطناعي كبديل عن الإنسان، بل كأداة دعم ورفع جودة: تحليل أولي وتنظيم، ثم اعتماد نهائي عبر فريق متخصص.
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    { icon: Cpu, t: "تحليل أولي ذكي", d: "فحص اكتمال/توافق/جودة المستندات." },
                    { icon: Users, t: "مراجعة بشرية متخصصة", d: "تدقيق نهائي وقرارات تشغيلية." },
                    { icon: ShieldCheck, t: "معايير تشغيل موحدة", d: "نفس الجودة لكل عميل وكل معاملة." },
                  ].map((x, i) => (
                    <div key={i} className="rounded-3xl bg-black/20 ring-1 ring-white/10 p-5">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-2xl bg-white/10 ring-1 ring-white/15 p-2">
                          <x.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-extrabold">{x.t}</div>
                          <div className="mt-1 text-sm text-white/70 leading-relaxed">{x.d}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </Section>

          {/* Trust */}
          <Section
            id="trust"
            title="الثقة، الامتثال، والأمان"
            subtitle="تم بناء المنصة على أسس واضحة من الأمان والشفافية والامتثال."
            icon={ShieldCheck}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { icon: Lock, title: "حماية البيانات والخصوصية", desc: "تشفير أثناء النقل والتخزين + صلاحيات دقيقة + تسجيل وتتبع كامل لكل عملية." },
                { icon: ShieldCheck, title: "تشغيل آمن ومراقبة", desc: "حماية ضد الاختراق + مراقبة الاستخدام + تحديثات أمنية دورية + فصل بيئات حساسة." },
                { icon: BadgeCheck, title: "الجودة وتوحيد الخدمة", desc: "إجراءات واضحة + مراجعات متعددة + توثيق كامل + تقليل الأخطاء البشرية." },
              ].map((x, i) => (
                <Card key={i} className="p-6">
                  <x.icon className="h-7 w-7" />
                  <div className="mt-3 text-lg font-extrabold">{x.title}</div>
                  <div className="mt-2 text-white/70 leading-relaxed">{x.desc}</div>
                </Card>
              ))}
            </div>

            <Card className="p-6 mt-6">
              <div className="flex items-center gap-3">
                <ScrollText className="h-6 w-6" />
                <div>
                  <div className="font-extrabold">الشفافية وبناء الثقة</div>
                  <div className="text-sm text-white/70">إشعارات واضحة وتحديثات حالة مستمرة ومسار تتبع لكل طلب.</div>
                </div>
              </div>
            </Card>
          </Section>

          {/* Record */}
          <Section
            id="record"
            title="سجل الإنجاز والالتزام الوطني"
            subtitle="نتائج مبنية على نظام واضح ومنهجية تشغيل ثابتة."
            icon={Users}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="p-6 lg:col-span-7">
                <div className="font-extrabold text-lg">سجل إنجاز يعكس المنهجية</div>
                <div className="mt-3 text-white/75 leading-relaxed">
                  إدارة معاملات متنوعة تشمل تأسيس وتشغيل شركات، شؤون الموظفين، الإقامات، التأشيرات، والخدمات الحكومية المرتبطة بها.
                </div>
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/75">
                  {["تنظيم دقيق للملفات", "فهم عميق للإجراءات", "تقديم مدروس قبل رفع الطلب", "توثيق ومسار واضح لكل طلب"].map((t, i) => (
                    <div key={i} className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">{t}</div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 lg:col-span-5">
                <div className="font-extrabold text-lg">مشاركة في “تصفير البيروقراطية”</div>
                <div className="mt-3 text-white/75 leading-relaxed">
                  تطبيق فعلي لمبادئ التنظيم وتقليل الأخطاء وتقديم مكتمل من أول مرة — مع تجربة رقمية واضحة.
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Pill>تبسيط</Pill><Pill>تقليل التعقيد</Pill><Pill>تسريع الإنجاز</Pill><Pill>تحسين تجربة المتعامل</Pill>
                </div>
              </Card>
            </div>
          </Section>

          {/* Plans */}
          <Section
            id="plans"
            title="باقات تأهيل PRO للشركات"
            subtitle="إدارة حكومية كاملة… بنظام اشتراك ذكي — أقل من تكلفة موظف PRO واحد."
            icon={Building2}
          >
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              {plans.map((p) => (
                <Card key={p.key} className="p-6 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-tr ${p.color} pointer-events-none`} />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black">{p.name}</div>
                        <div className="mt-1 text-xs text-white/70">{p.badge}</div>
                      </div>
                      <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 px-3 py-2 text-sm">
                        AED <b>{p.price}</b>/mo
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-white/80">
                      {p.items.map((t, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 mt-0.5" />
                          <div className="text-sm leading-relaxed">{t}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl bg-black/25 ring-1 ring-white/10 p-4">
                      <div className="text-sm font-extrabold mb-2">خيارات الاشتراك</div>
                      <div className="text-xs text-white/70 leading-relaxed space-y-1">
                        {p.options.map((o, idx) => <div key={idx}>• {o}</div>)}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-6 mt-6">
              <div className="font-extrabold">خيار مرن: الدفع حسب الطلب 🟡</div>
              <div className="mt-2 text-white/70 leading-relaxed">
                Pay Per Request (Limited) — متاح لمن يريد تجربة الخدمة أو معاملات خاصة متعددة الجهات بتسعير حسب الطلب.
              </div>
              <div className="mt-3 text-xs text-white/55 leading-relaxed">
                * خيار محدود وقد يتم إيقافه عند زيادة حجم الاستخدام.
              </div>
            </Card>

            <Card className="p-6 mt-6">
              <div className="font-extrabold">🧾 تنويه</div>
              <div className="mt-2 text-white/70 leading-relaxed text-sm">
                • الأسعار إرشادية وقد تختلف حسب نوع المعاملة والجهة الحكومية أو تحديثات الأنظمة الرسمية.
                <br />• لا تشمل الباقات الرسوم الحكومية الرسمية أو الغرامات، ويتم تحصيلها حسب الجهة المختصة.
                <br />• مدة إنجاز الطلبات تعتمد على الجهة الحكومية المعنية، ولا تتحكم تأهيل في زمن القرار النهائي.
                <br />• تخضع جميع الخدمات للأنظمة والقوانين المعمول بها داخل دولة الإمارات العربية المتحدة.
              </div>
            </Card>
          </Section>

          {/* Terms */}
          <Section
            id="terms"
            title="الشروط والأحكام العامة"
            subtitle="نسخة قانونية تنظيمية — توضح طبيعة الخدمة ونطاق المسؤولية والرسوم والالتزامات وعدم الاسترداد."
            icon={ScrollText}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="p-6 lg:col-span-7">
                <div className="space-y-3">
                  <AccordionItem title="1) طبيعة الخدمة" defaultOpen>
                    تأهيل منصة رقمية متخصصة في إدارة ومتابعة المعاملات الحكومية للأفراد والشركات داخل دولة الإمارات، وتعمل كوسيط تنظيمي وتقني لإعداد الطلبات، مراجعتها، متابعتها، وتقديمها للجهات الحكومية المختصة، ولا تُعد جهة حكومية أو جهة اتخاذ قرار.
                  </AccordionItem>

                  <AccordionItem title="2) نطاق المسؤولية">
                    • تقتصر مسؤولية تأهيل على تنظيم الطلبات، مراجعة المستندات، المتابعة الإجرائية، والتواصل مع الجهات الحكومية المختصة.
                    <br />• لا تتحمل تأهيل مسؤولية عن قرارات القبول أو الرفض الصادرة عن الجهات الحكومية.
                    <br />• لا تضمن تأهيل صدور قرار إيجابي لأي طلب حتى في حال استيفاء المتطلبات.
                  </AccordionItem>

                  <AccordionItem title="3) الأسعار والرسوم">
                    • الأسعار إرشادية وقابلة للتغيير حسب نوع المعاملة والجهة الحكومية وتحديثات الأنظمة.
                    <br />• لا تشمل الاشتراكات رسومًا حكومية رسمية أو غرامات أو رسوم طرف ثالث.
                    <br />• يقر العميل بموافقته على أي رسوم إضافية ناتجة عن تحديثات حكومية مفاجئة.
                  </AccordionItem>

                  <AccordionItem title="4) مدة الإنجاز">
                    تعتمد مدة تنفيذ أي معاملة على الجهة الحكومية المعنية، ولا تتحكم تأهيل في زمن القرار أو سرعة المعالجة داخل الجهات الرسمية. أي تقدير زمني هو تقدير تقريبي غير ملزم.
                  </AccordionItem>

                  <AccordionItem title="5) التزامات العميل">
                    • يلتزم العميل بتقديم بيانات صحيحة ومكتملة وواضحة.
                    <br />• يتحمل العميل المسؤولية القانونية عن صحة المستندات المقدمة.
                    <br />• أي تأخير أو رفض بسبب بيانات غير صحيحة أو مستندات ناقصة لا تتحمل تأهيل مسؤوليته.
                  </AccordionItem>

                  <AccordionItem title="6) الباقات والاشتراكات (للشركات)">
                    • تحديد الباقة بناءً على عدد الموظفين الفعلي المسجلين رسميًا.
                    <br />• عند زيادة عدد الموظفين تتم الترقية التلقائية دون تعطيل أو فقدان بيانات.
                    <br />• تحتفظ تأهيل بحق مراجعة الاستخدام في حال وجود استخدام مفرط أو غير معتاد.
                  </AccordionItem>

                  <AccordionItem title="7) Pay Per Request (Limited)">
                    باقة محدودة ولا تشمل إدارة مستمرة أو مدير حساب، والأسعار تختلف حسب نوع المعاملة وتعقيدها، ولا يترتب عليها أي التزام مستقبلي من تأهيل.
                  </AccordionItem>

                  <AccordionItem title="8) الذكاء الاصطناعي والمراجعة البشرية">
                    تستخدم تأهيل أنظمة ذكاء اصطناعي للمراجعة المبدئية وتحليل التوافق، ولا يُغني ذلك عن المراجعة البشرية، ويتم اعتماد القرار التشغيلي النهائي بواسطة موظفين مختصين.
                  </AccordionItem>

                  <AccordionItem title="9) الإقامات الذهبية والخدمات الخاصة">
                    تقييم ملفات الإقامة الذهبية وفق المعايير المعتمدة من الجهات المختصة. أي نسب نجاح تعتمد على نتائج سابقة ولا تمثل ضمانًا مستقبليًا. وتحتفظ تأهيل بحق رفض تقديم الخدمة لأي ملف غير قابل للتقديم قانونيًا.
                  </AccordionItem>

                  <AccordionItem title="10) السرية وحماية البيانات">
                    تلتزم تأهيل بالحفاظ على سرية بيانات العملاء واستخدامها لغرض تنفيذ الخدمة فقط، ولا تتحمل مسؤولية اختراقات ناتجة عن أطراف خارجية أو ظروف قهرية.
                  </AccordionItem>

                  <AccordionItem title="11) إيقاف أو تعليق الخدمة">
                    تحتفظ تأهيل بحق تعليق/إيقاف الخدمة في حال مخالفة الشروط أو إساءة استخدام المنصة أو تقديم مستندات مزورة، دون التزام بإعادة رسوم الاشتراك عن الفترة المتبقية.
                  </AccordionItem>

                  <AccordionItem title="12) عدم الاسترداد">
                    جميع الاشتراكات غير قابلة للاسترداد بعد بدء تقديم الخدمة، وتعتبر الخدمة قد بدأت بمجرد تسجيل الطلب أو فتح ملف العميل.
                  </AccordionItem>

                  <AccordionItem title="13) القوة القاهرة">
                    لا تتحمل تأهيل مسؤولية عن التأخير أو عدم التنفيذ بسبب ظروف خارجة عن الإرادة مثل تغييرات قانونية مفاجئة أو أنظمة حكومية أو كوارث طبيعية أو قرارات سيادية.
                  </AccordionItem>

                  <AccordionItem title="14) القانون المعمول به">
                    تخضع هذه الشروط والأحكام وتُفسَّر وفقًا لقوانين دولة الإمارات العربية المتحدة، وتختص محاكم الدولة بالفصل في أي نزاع.
                  </AccordionItem>

                  <AccordionItem title="15) القبول">
                    باستخدام خدمات تأهيل أو الاشتراك في أي باقة، يقر العميل بموافقته الكاملة وغير المشروطة على جميع ما ورد أعلاه.
                  </AccordionItem>
                </div>
              </Card>

              <Card className="p-6 lg:col-span-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6" />
                  <div>
                    <div className="font-extrabold">ملحوظة تنظيمية</div>
                    <div className="text-sm text-white/70">تأهيل ليست جهة حكومية ولا جهة قرار — القرار دائمًا للجهة المختصة.</div>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl bg-black/20 ring-1 ring-white/10 p-5 text-white/75 leading-relaxed">
                  تم إعداد وتنظيم هذا النظام باستخدام نماذج ذكاء اصطناعي متقدمة لإدارة العمليات، مع مراجعة بشرية كاملة لضمان الامتثال القانوني والتنفيذي.
                </div>

                <div className="mt-5 rounded-3xl bg-black/20 ring-1 ring-white/10 p-5">
                  <div className="font-extrabold">الإعتمادات والمعايير</div>
                  <div className="mt-2 text-sm text-white/70 leading-relaxed">
                    • DMCA حماية المحتوى والملفات الرقمية
                    <br />• ISO 27001 أمن المعلومات
                    <br />• ISO 9001 إدارة الجودة
                    <br />• Cisco Cybersecurity ممارسات الأمن السيبراني
                    <br />• Google Business Profile
                    <br />• Google Digital Garage
                  </div>
                  <div className="mt-3 text-xs text-white/55">(جميع الاعتمادات تُستخدم وفق نطاقها الفني والتشغيلي)</div>
                </div>
              </Card>
            </div>
          </Section>

          {/* Contact */}
          <Section
            id="contact"
            title="تواصل معنا"
            subtitle="وقتك قيمة… وملفك مسؤولية — دع تأهيل تديرها باحتراف."
            icon={Mail}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="p-6 lg:col-span-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-3xl bg-black/20 ring-1 ring-white/10 p-5">
                    <div className="flex items-center gap-2 font-extrabold">
                      <Phone className="h-5 w-5" />
                      الهاتف
                    </div>
<div className="mt-2 text-white/75 leading-relaxed space-y-1">
  <a
    href="tel:+97155598331"
    className="block hover:text-white transition"
    dir="ltr"
    style={{ unicodeBidi: "isolate" }}
  >
    +971 55 598 331
  </a>

  <a
    href="tel:+971554463108"
    className="block hover:text-white transition"
    dir="ltr"
    style={{ unicodeBidi: "isolate" }}
  >
    +971 55 446 3108
  </a>
</div>

                  </div>

                  <div className="rounded-3xl bg-black/20 ring-1 ring-white/10 p-5">
                    <div className="flex items-center gap-2 font-extrabold">
                      <Mail className="h-5 w-5" />
                      البريد الإلكتروني
                    </div>
                    <div className="mt-2 text-white/75 leading-relaxed">
  <a
    href="mailto:info@taheel.ae"
    className="hover:text-white transition"
    dir="ltr"
    style={{ unicodeBidi: "isolate" }}
  >
    info@taheel.ae
  </a>
</div>

                  </div>

                  <div className="rounded-3xl bg-black/20 ring-1 ring-white/10 p-5 md:col-span-2">
                    <div className="flex items-center gap-2 font-extrabold">
                      <MapPin className="h-5 w-5" />
                      العنوان
                    </div>
<div className="mt-2 text-white/75 leading-relaxed">
  <a
    href="https://maps.app.goo.gl/UfGskQBB4MT9di9F7"
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-start gap-2 hover:text-white transition"
  >
    <MapPin className="h-5 w-5 mt-0.5 text-white/80" />
    <span>
      شارع 57 - القرهود - دبي، مبنى ريد أفينيو، مكتب رقم 60
      <span className="block text-xs text-white/55 mt-1">
        اضغط لفتح الموقع على خرائط Google
      </span>
    </span>
  </a>
</div>
<a
  href="https://maps.app.goo.gl/UfGskQBB4MT9di9F7"
  target="_blank"
  rel="noreferrer"
  className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm ring-1 ring-white/15 hover:bg-white/14 transition"
>
  <MapPin className="h-4 w-4" />
  فتح على خرائط Google
</a>

                  </div>

                  <div className="rounded-3xl bg-black/20 ring-1 ring-white/10 p-5 md:col-span-2">
                    <div className="flex items-center gap-2 font-extrabold">
                      <Globe className="h-5 w-5" />
                      الموقع الإلكتروني
                    </div>
                    <div className="mt-2 text-white/75 leading-relaxed">
  <a
    href="https://www.taheel.ae"
    target="_blank"
    rel="noreferrer"
    className="hover:text-white transition"
    dir="ltr"
    style={{ unicodeBidi: "isolate" }}
  >
    www.taheel.ae
  </a>
</div>

                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <FancyButton href="#plans" variant="primary">
                    <Building2 className="h-5 w-5" />
                    اختر الباقة المناسبة
                  </FancyButton>
                  <FancyButton href="#terms" variant="ghost">
                    <ScrollText className="h-5 w-5" />
                    اقرأ الشروط والأحكام
                  </FancyButton>
                </div>
              </Card>

              <Card className="p-6 lg:col-span-5">
                <div className="font-extrabold text-lg">ابدأ الآن</div>
                <div className="mt-2 text-white/70 leading-relaxed">
                  سجّل الآن وابدأ تجربة حكومية مختلفة — منظمة، موثقة، وواضحة.
                </div>

                <div className="mt-5 rounded-3xl bg-black/25 ring-1 ring-white/10 p-5">
                  <div className="font-extrabold">QR Code</div>
                  <div className="mt-2 text-sm text-white/70">امسح الكود لفتح التحميل/الملف التعريفي.</div>
                  <div className="mt-4 relative w-full aspect-square rounded-3xl bg-white/6 ring-1 ring-white/12 overflow-hidden">
                    <Image src="/Taheel-qr.png" alt="Taheel QR" fill className="object-contain p-6" />
                  </div>
                </div>
              </Card>
            </div>
          </Section>

          {/* Footer */}
          <footer className="pb-16">
            <div className="mx-auto max-w-7xl px-5">
              <Card className="p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="text-white/75">
                    <div className="font-extrabold text-white">TAHEEL | تأهيل</div>
                    <div className="text-sm">منصة تشغيل رقمية — من حيث يبدأ المستقبل</div>
                  </div>
                  <div className="text-xs text-white/55 leading-relaxed">
                    © {new Date().getFullYear()} TAHEEL. All rights reserved.
                    <br />
                    AI-assisted structuring (QXT) under human review.
                  </div>
                </div>
              </Card>
            </div>
          </footer>
        </div>
      </main>

      {/* ✅ Global Animated Background CSS (Pure CSS) */}
      <style jsx global>{`
        .aurora {
          background:
            radial-gradient(1200px 700px at 80% 10%, rgba(16,185,129,0.22), transparent 60%),
            radial-gradient(900px 600px at 20% 25%, rgba(56,189,248,0.18), transparent 60%),
            radial-gradient(900px 600px at 75% 55%, rgba(217,70,239,0.14), transparent 60%),
            radial-gradient(1000px 700px at 40% 90%, rgba(244,63,94,0.12), transparent 60%);
          filter: blur(34px);
          transform: translate3d(0,0,0);
          animation: auroraFloat 16s ease-in-out infinite alternate;
        }
        .unicode-bidi-isolate { unicode-bidi: isolate; }

        @keyframes auroraFloat {
          0%   { transform: translate3d(-2%, -1%, 0) scale(1); }
          50%  { transform: translate3d( 2%,  1%, 0) scale(1.04); }
          100% { transform: translate3d(-1%,  2%, 0) scale(1.02); }
        }

        .gridMove {
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(circle at 50% 35%, black 0%, transparent 70%);
          -webkit-mask-image: radial-gradient(circle at 50% 35%, black 0%, transparent 70%);
          transform: translate3d(0,0,0);
          animation: gridPan 18s linear infinite;
        }

        @keyframes gridPan {
          0%   { background-position: 0px 0px; }
          100% { background-position: 220px 220px; }
        }

        .particles {
          background-image:
            radial-gradient(circle, rgba(255,255,255,0.55) 1px, transparent 1px),
            radial-gradient(circle, rgba(255,255,255,0.25) 1px, transparent 1px);
          background-size: 42px 42px, 86px 86px;
          background-position: 0 0, 18px 12px;
          filter: blur(0.2px);
          mask-image: radial-gradient(circle at 50% 30%, black 0%, transparent 72%);
          -webkit-mask-image: radial-gradient(circle at 50% 30%, black 0%, transparent 72%);
          transform: translate3d(0,0,0);
          animation: particlesDrift 22s linear infinite;
        }

        @keyframes particlesDrift {
          0%   { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-140px, 60px, 0); }
        }

        .noise {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E");
          background-size: 220px 220px;
          mix-blend-mode: overlay;
          transform: translate3d(0,0,0);
          animation: noiseMove 9s steps(8) infinite;
        }

        @keyframes noiseMove {
          0%   { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-120px, 80px, 0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .aurora, .gridMove, .particles, .noise { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
