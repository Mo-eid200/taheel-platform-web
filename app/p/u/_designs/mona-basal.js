"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Mona Basal • Executive VIP Profile (single-file, JS only)
 * - Animated neon background (GPU-friendly, respects reduced motion)
 * - Rich sections: KPIs, Qualifications, Case Studies, Timeline, Boards, Media, Education, Certifications, Testimonials
 * - AR/EN via ?lang=ar|en (default: en)
 * - Tailwind only (no styled-jsx / no @apply)
 */

/** @typedef {"ar" | "en"} Lang */

export default function MonaBasal() {
  const params = useSearchParams();
  const initialParam = (params?.get("lang") || "en").toLowerCase();

  /** @type {[Lang, Function]} */
  const [lang, setLang] = useState(sanitizeLang(initialParam));
  const [motionOK, setMotionOK] = useState(true);

  // respect reduced motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionOK(!mq.matches);
    const onChange = (e) => setMotionOK(!e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // animated bg
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!motionOK) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0, h = 0;
    const C1 = "#0a1a2b", C2 = "#0b1220";
    const NEON_G = "rgba(35,218,198,0.9)";
    const NEON_B = "rgba(83,166,247,0.9)";

    /** @type {{x:number,y:number,r:number,vx:number,vy:number}[]} */
    let P = [];
    let t = 0;

    const baseCount = () => {
      const area = w * h;
      let count = Math.floor(area / 38000);
      if (w < 480) count = Math.floor(count * 0.6);
      return Math.max(24, Math.min(80, count));
    };

    const resize = () => {
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const COUNT = baseCount();
      P = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
      }));
    };

    const drawBackground = () => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, C2);
      g.addColorStop(1, C1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const drawRibbons = () => {
      const cx1 = w * 0.5 + Math.cos(t * 0.0008) * (w * 0.25);
      const cy1 = h * 0.4 + Math.sin(t * 0.0012) * (h * 0.2);
      const cx2 = w * 0.5 + Math.cos(-t * 0.001) * (w * 0.3);
      const cy2 = h * 0.65 + Math.sin(-t * 0.0007) * (h * 0.25);
      const r1 = Math.max(w, h) * 0.65;
      const r2 = Math.max(w, h) * 0.55;

      const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
      g1.addColorStop(0, "rgba(35,218,198,0.16)");
      g1.addColorStop(0.6, "rgba(35,218,198,0.06)");
      g1.addColorStop(1, "transparent");

      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      g2.addColorStop(0, "rgba(83,166,247,0.15)");
      g2.addColorStop(0.6, "rgba(83,166,247,0.05)");
      g2.addColorStop(1, "transparent");

      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(cx1, cy1, r1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    };

    const drawParticles = () => {
      ctx.shadowBlur = 12;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;
        const mix = (Math.sin(t * 0.002 + i) + 1) / 2;
        ctx.fillStyle = mix > 0.5 ? NEON_G : NEON_B;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const tick = (now) => {
      t = now || t + 16;
      drawBackground();
      drawRibbons();
      drawParticles();
      rafRef.current = requestAnimationFrame(tick);
    };

    let resizeTimer = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        resize();
        rafRef.current = requestAnimationFrame(tick);
      }, 120);
    };

    resize();
    rafRef.current = requestAnimationFrame(tick);
    window.addEventListener("resize", onResize);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [motionOK]);

  const t = useMemo(() => COPY[lang], [lang]);

  // ----- UI utility class constants (بديل .btn-chip و.link-block إلخ)
  const CHIP = "group inline-flex items-center gap-2 rounded-xl border-2 bg-black/20 px-3.5 sm:px-4 py-2 text-[13px] sm:text-sm font-bold hover:bg-white/10 transition";
  const LINK_BLOCK = "block w-full rounded-lg px-4 py-2.5 sm:py-3 text-[13px] sm:text-sm font-bold hover:bg-white/10 transition border";
  const LIST_CHECK = "pl-5 grid gap-2 list-disc marker:text-emerald-400 text-emerald-50/90";
  const LIST_DASH  = "pl-5 grid gap-1.5 list-disc marker:text-white/60 text-emerald-50/90 text-sm";
  const LEAD_STYLE = { lineHeight: "1.9", fontSize: "clamp(0.95rem, 1.15vw, 1.1rem)", color: "rgba(236,253,245,.9)" };

  const downloadVCF = () => {
    const vcf =
      "BEGIN:VCARD\n" +
      "VERSION:3.0\n" +
      "N:Basal;Mona;;;\n" +
      "FN:Mona Basal\n" +
      "TITLE:Chief Executive Officer — TAHEEL • GISAI\n" +
      "ORG:TAHEEL\n" +
      `EMAIL;TYPE=INTERNET;TYPE=WORK:${LINKS.emailOfficial}\n` +
      `EMAIL;TYPE=INTERNET;TYPE=HOME:${LINKS.emailPersonal}\n` +
      `TEL;TYPE=CELL:${LINKS.phone}\n` +
      `URL:${LINKS.site}\n` +
      `item1.URL:${LINKS.linkedin}\n` +
      "item1.X-ABLabel:LinkedIn\n" +
      "END:VCARD";
    const blob = new Blob([vcf], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mona-basal.vcf";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main
      className={`relative min-h-screen text-white selection:bg-emerald-500/30 selection:text-white ${lang === "ar" ? "rtl" : "ltr"}`}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* bg */}
      <canvas ref={canvasRef} className="fixed inset-0 -z-10" style={{ filter: "saturate(1.06) brightness(1.04)" }} aria-hidden />
      {!motionOK && (
        <div aria-hidden className="fixed inset-0 -z-10" style={{ background:
          "radial-gradient(40% 30% at 70% 20%, rgba(35,218,198,.10), transparent 60%), linear-gradient(#0b1220, #0a1a2b)" }} />
      )}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-[0.08]"
           style={{ backgroundImage:
             "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
             backgroundSize: "36px 36px" }}/>

      <section className="relative mx-auto max-w-[min(94rem,94vw)] px-4 sm:px-6 md:px-8 lg:px-10 py-8 sm:py-10 md:py-14">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 sm:gap-6">
          <img src="/logo-transparent-large.png" alt="TAHEEL Logo"
               className="h-10 sm:h-12 md:h-14 drop-shadow-[0_0_18px_rgba(35,218,198,.55)]" />
          <div className="flex items-center gap-2 sm:gap-3">
            <LangToggle lang={lang} onToggle={() => setLang(lang === "ar" ? "en" : "ar")} />
            <span className="rounded-full border border-white/20 bg-black/20 px-3 sm:px-4 py-1.5 text-[11px] sm:text-sm font-semibold tracking-wide">
              VIP • {t.verified}
            </span>
          </div>
        </div>

        {/* Hero */}
        <div className="mt-8 sm:mt-10 md:mt-14 relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-white/5 backdrop-blur-md">
          <div className="pointer-events-none absolute -inset-px rounded-3xl"
               style={{ boxShadow:"0 0 0 1px rgba(35,218,198,0.25), 0 16px 50px rgba(35,218,198,0.08), 0 26px 70px rgba(83,166,247,0.10)" }} />
          <div className="p-5 sm:p-6 md:p-8 lg:p-10">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-5 sm:gap-6">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="h-[88px] w-[88px] sm:h-28 sm:w-28 md:h-32 md:w-32 lg:h-36 lg:w-36 rounded-2xl bg-gradient-to-br from-emerald-400/30 to-sky-400/30 border border-white/20 backdrop-blur-sm grid place-items-center overflow-hidden">
                  <img src="/mona.jpg" alt="Mona Basal" className="h-full w-full object-cover"
                       onError={(e) => { const img = e?.currentTarget; if (img) { img.style.display="none";
                         const fallback = img.nextSibling; if (fallback && fallback.style) fallback.style.display="grid"; }}} />
                  <span className="hidden place-items-center text-2xl sm:text-3xl md:text-4xl font-black">MB</span>
                </div>
                <span className="absolute -bottom-2 -right-2 rounded-full bg-emerald-400/90 text-black text-[10px] sm:text-xs font-extrabold px-1.5 sm:px-2 py-0.5 shadow">
                  CEO
                </span>
              </div>

              {/* Name + Title */}
              <div className="text-center md:text-left">
                <h1 className="font-black leading-tight drop-shadow-[0_0_16px_rgba(83,166,247,.35)]"
                    style={{ fontSize: "clamp(1.75rem, 3.8vw, 3.5rem)" }}>Mona Basal</h1>
                <p className="mt-2 text-emerald-200/90 font-semibold"
                   style={{ fontSize: "clamp(0.95rem, 1.3vw, 1.125rem)" }}>{t.title}</p>
              </div>

              <div className="flex-1" />

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 sm:gap-3">
                <a href={`mailto:${LINKS.emailOfficial}`} className={`${CHIP} border-emerald-400/60`}>
                  <Dot className="text-emerald-300 group-hover:scale-125" />{t.ctaEmail}
                </a>
                <a href={LINKS.linkedin} target="_blank" rel="noreferrer" className={`${CHIP} border-sky-400/60`}>
                  <Dot className="text-sky-300 group-hover:scale-125" />LinkedIn
                </a>
                <button onClick={downloadVCF} className={`${CHIP} border-white/25`}>
                  <Dot className="text-white/80 group-hover:scale-125" />{t.ctaVCF}
                </button>
                <a href={LINKS.site} target="_blank" rel="noreferrer" className={`${CHIP} border-emerald-300/40`}>
                  <Dot className="text-emerald-200 group-hover:scale-125" />{t.ctaSite}
                </a>
              </div>
            </div>

            {/* Executive Snapshot */}
            <div className="mt-6 sm:mt-8 grid gap-4 sm:gap-5 md:grid-cols-3">
              <BadgeCard title={t.hl1Title}>{t.hl1Body}</BadgeCard>
              <BadgeCard title={t.hl2Title}>{t.hl2Body}</BadgeCard>
              <BadgeCard title={t.hl3Title}>{t.hl3Body}</BadgeCard>
            </div>
          </div>
        </div>

        {/* KPI Bar */}
        <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-4">
          {t.kpis.map((k, i) => (
            <Stat key={i} value={k.value} label={k.label} />
          ))}
        </div>

        {/* Rich Bio + Sidebar */}
        <div className="mt-8 sm:mt-10 grid gap-5 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-white/15 bg-white/[.06] p-5 sm:p-6 md:p-7 backdrop-blur">
            <SectionTitle>{t.aboutTitle}</SectionTitle>
            <p className="text-emerald-50/90" style={LEAD_STYLE}>{t.aboutBody}</p>

            {/* Qualifications */}
            <div className="mt-6">
              <SubTitle>{t.qual.title}</SubTitle>
              <ul className={LIST_CHECK}>
                {t.qual.items.map((it, idx) => <li key={idx}>{it}</li>)}
              </ul>
            </div>

            {/* Case Studies */}
            <div className="mt-6">
              <SubTitle>{t.cases.title}</SubTitle>
              <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
                {t.cases.items.map((c, idx) => (
                  <CaseCard key={idx} title={c.title} metric={c.metric} body={c.body} />
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="mt-6">
              <SubTitle>{t.timeline.title}</SubTitle>
              <div className="space-y-4">
                {t.timeline.items.map((item, idx) => (
                  <TimelineItem key={idx} role={item.role} org={item.org} where={item.where} when={item.when} bullets={item.points} />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="rounded-2xl border border-emerald-400/30 bg-white/[.06] p-5 sm:p-6 md:p-7 backdrop-blur">
            <SectionTitle>{t.mediaTitle}</SectionTitle>
            <div className="space-y-2.5 sm:space-y-3">
              <a className={`${LINK_BLOCK} border-emerald-400/40`} href={LINKS.instagram} target="_blank" rel="noreferrer">Instagram</a>
              <a className={`${LINK_BLOCK} border-sky-400/40`} href={LINKS.threads} target="_blank" rel="noreferrer">Threads</a>
              <a className={`${LINK_BLOCK} border-white/30`} href={`tel:${LINKS.phone.replace(/\s+/g, "")}`}>{t.callCTA}</a>
              <a className={`${LINK_BLOCK} border-white/30`} href={LINKS.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
              <a className={`${LINK_BLOCK} border-white/30`} href={LINKS.site} target="_blank" rel="noreferrer">{t.ctaSite}</a>
              <button className={`${LINK_BLOCK} border-white/30`} onClick={downloadVCF}>{t.ctaVCF}</button>
            </div>

            {/* Boards & Memberships */}
            <div className="mt-6">
              <SubTitle>{t.boards.title}</SubTitle>
              <ul className={LIST_DASH}>
                {t.boards.items.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>

            {/* Education & Certs */}
            <div className="mt-6">
              <SubTitle>{t.edu.title}</SubTitle>
              <ul className={LIST_DASH}>
                {t.edu.items.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>

            <div className="mt-6">
              <SubTitle>{t.certs.title}</SubTitle>
              <ul className={LIST_DASH}>
                {t.certs.items.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          </aside>
        </div>

        {/* Testimonials */}
        <div className="mt-8">
          <SectionTitle>{t.testimonials.title}</SectionTitle>
          <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
            {t.testimonials.items.map((q, i) => (
              <QuoteCard key={i} quote={q.quote} name={q.name} title={q.title} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 sm:mt-12 py-5 sm:py-6 text-center text-emerald-200/70" style={{ fontSize: "clamp(12px, 1vw, 14px)" }}>
          {t.powered} <span className="font-extrabold text-emerald-300">TAHEEL • GISAI</span>
        </div>
      </section>

      {/* extra glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10"
           style={{ background:"radial-gradient(40% 30% at 70% 20%, rgba(35,218,198,.08), transparent 60%)", mixBlendMode:"screen" }} />
    </main>
  );
}

/* ---------- helpers ---------- */
/** @param {string} v */ function sanitizeLang(v) { return v === "ar" || v === "en" ? v : "en"; }

/* ---------- Localized copy ---------- */
/** @type {{[k in Lang]: any}} */
const COPY = {
  en: {
    verified: "Verified",
    title: "Chief Executive Officer • TAHEEL",
    ctaEmail: "Email (Official)",
    ctaVCF: "Save Contact",
    ctaSite: "Visit Website",
    mediaTitle: "Media & Links",
    callCTA: "Call Mona",
    powered: "Powered by",

    // top badges
    hl1Title: "Vision",
    hl1Body: "Executive leader building a trusted, AI-first e-government platform.",
    hl2Title: "Focus",
    hl2Body: "Scale, reliability, and a world-class client experience.",
    hl3Title: "Regions",
    hl3Body: "UAE • GCC • Global partners",

    // KPI bar
    kpis: [
      { value: "10+ yrs", label: "Leadership & Ops" },
      { value: "95–100%", label: "Gov. approvals (MOHRE, licensing)" },
      { value: "15–25%", label: "Productivity & cost impact" },
      { value: "Zero", label: "Compliance violations" },
    ],

    aboutTitle: "Executive Profile",
    aboutBody:
      "Mona Basal is a government relations and operations executive driving compliant, scalable service delivery across the UAE and Georgia. She blends policy fluency with operational discipline to deliver on-time approvals, streamlined licensing, and resilient internal processes. Her leadership style is people-centric and metrics-driven, with a consistent record of raising team performance and customer satisfaction while maintaining regulatory excellence.",

    qual: {
      title: "Core Qualifications",
      items: [
        "Government relations & regulatory compliance (MOHRE, permits, licensing).",
        "Operations leadership: cost control, workflow design, KPI governance.",
        "Policy development & internal controls; crisis readiness & risk mitigation.",
        "Stakeholder management: agencies, vendors, enterprise clients.",
        "International exposure: UAE (Ajman), Georgia (Tbilisi) — bilingual Arabic/English.",
      ],
    },

    cases: {
      title: "Selected Impact",
      items: [
        { title: "MOHRE & Licensing Program", metric: "100% approval, 0 disruptions",
          body: "Centralized dossiers, deadline SLAs, and pre-clearance checklists reduced rework and eliminated late submissions." },
        { title: "Ops Efficiency @ Swift byt L.L.C", metric: "15% cost ↓ • 20% revenue ↑",
          body: "Lean workflows, vendor renegotiations, and performance dashboards improved profitability and service speed." },
        { title: "Construction Ops @ Royal Towers", metric: "95% on-time delivery",
          body: "Integrated schedules and risk registers kept multi-million projects on budget with zero safety incidents." },
        { title: "Client Retention @ Easy GO", metric: "90%+ retention • 25% revenue ↑",
          body: "Account plans and feedback loops matured service quality and expansion into new partner channels." },
      ],
    },

    timeline: {
      title: "Career Timeline",
      items: [
        { role: "Government Relations Manager (Self-Employed)", org: "Ajman, UAE", where: "UAE", when: "2024 – Present",
          points: [
            "Regulatory strategy, MOHRE interfaces, permits & renewals.",
            "Zero compliance violations with transparent reporting.",
            "Trained teams on policy awareness (+30% compliance literacy).",
          ]},
        { role: "Assistant Manager", org: "Swift byt L.L.C", where: "Ajman, UAE", when: "May 2023 – Present",
          points: [
            "Operational oversight; 15% cost reduction; +20% revenue.",
            "Expanded client base +30%; 95% CSAT; risk management.",
            "Reporting cadence to stakeholders with actionable KPIs.",
          ]},
        { role: "Assistant Operations Manager", org: "Royal Towers L.T.D", where: "Tbilisi, Georgia", when: "May 2021 – Sep 2023",
          points: [
            "Managed residential projects ($5–10M); 95% on-time delivery.",
            "Zero-incident safety record; 10% budget savings.",
            "Optimized timelines (-15%) via process standardization.",
          ]},
        { role: "Relations Manager", org: "Easy GO L.T.D", where: "Tbilisi, Georgia", when: "Jun 2018 – Sep 2021",
          points: [
            "Handled 50+ accounts; 90% retention; 25% revenue growth.",
            "Upgraded service SLAs and response playbooks.",
          ]},
        { role: "Operations Manager", org: "Babel’s School", where: "Tbilisi, Georgia", when: "Jul 2017 – Sep 2018",
          points: [
            "Facilities & staffing for 500 students; turnover −15%.",
            "Compliance, scheduling, vendor management, crisis protocols.",
          ]},
      ],
    },

    boards: {
      title: "Boards & Affiliations",
      items: [
        "Member, Executive Operations Network (UAE).",
        "Advisor, Private sector compliance working group (informal).",
      ],
    },

    edu: {
      title: "Education",
      items: [
        "MBA (in progress), University of the People, CA, USA (2023 – Present).",
        "M.Ed., University of the People, CA, USA (2021 – 2024).",
        "B.A. Philosophy, Tanta University, Egypt (2012).",
      ],
    },

    certs: {
      title: "Professional Certifications",
      items: [
        "Special Education: Autism (intro, assessment & intervention).",
        "Classroom management & inclusive education practices.",
        "Google Scholarship – Marketing & Management.",
      ],
    },

    testimonials: {
      title: "What Leaders Say",
      items: [
        { quote: "Policy-smart and operations-exact—Mona closes approvals without drama and scales the process after.", name: "Regional GM", title: "GCC Services Group" },
        { quote: "Her KPI routines are practical and humane. Teams get faster without burning out.", name: "Head of HR", title: "Private Sector" },
        { quote: "Licensing, MOHRE, and risk are always in control. Zero surprises.", name: "Operations Director", title: "Construction Sector" },
      ],
    },
  },

  ar: {
    verified: "موثَّق",
    title: "الرئيس التنفيذي • تأهيل",
    ctaEmail: "البريد الرسمي",
    ctaVCF: "حفظ جهة الاتصال",
    ctaSite: "الموقع الرسمي",
    mediaTitle: "وسائط وروابط",
    callCTA: "اتصال بمُنى",
    powered: "بإشراف",

    hl1Title: "الرؤية",
    hl1Body: "قيادة تنفيذية تبني منصة حكومية موثوقة بمدخلية ذكاء اصطناعي.",
    hl2Title: "التركيز",
    hl2Body: "قابلية التوسّع، الاعتمادية، وتجربة عميل عالمية.",
    hl3Title: "النطاق",
    hl3Body: "الإمارات • الخليج • شركاء عالميون",

    kpis: [
      { value: "10+ سنوات", label: "قيادة وعمليات" },
      { value: "95–100%", label: "معدلات الموافقات الحكومية" },
      { value: "15–25%", label: "تحسّن الإنتاجية والتكلفة" },
      { value: "صفر", label: "مخالفات امتثال" },
    ],

    aboutTitle: "النبذة التنفيذية",
    aboutBody:
      "مُنى بصل قيادية في العلاقات الحكومية والعمليات، تقود تقديم خدمات متوافقة وقابلة للتوسع عبر الإمارات وجورجيا. تمزج بين فهم السياسات والانضباط التشغيلي لتحقيق الموافقات في وقتها، وتبسيط إجراءات الترخيص، وبناء إجراءات داخلية مرنة. أسلوبها قيادي إنساني قائم على الأرقام، مع سجل ثابت في رفع أداء الفرق ورضا العملاء مع الحفاظ على تميّز الامتثال.",

    qual: {
      title: "المؤهلات الأساسية",
      items: [
        "علاقات حكومية وامتثال (MOHRE، التراخيص، التصاريح).",
        "قيادة العمليات: ضبط التكاليف، تصميم التدفقات، مؤشرات الأداء.",
        "تطوير السياسات والرقابة الداخلية؛ جاهزية الأزمات وتقليل المخاطر.",
        "إدارة الأطراف المعنية: جهات حكومية، موردون، عملاء مؤسسيون.",
        "خبرة دولية: الإمارات (عجمان) وجورجيا (تبليسي) — عربي/إنجليزي.",
      ],
    },

    cases: {
      title: "أبرز التأثيرات",
      items: [
        { title: "برنامج الموافقات (MOHRE والتراخيص)", metric: "100% موافقات • 0 تعطّل",
          body: "ملفات مركزية، اتفاقيات مستوى خدمة للمواعيد، وقوائم تدقيق قبل الإرسال خفّضت الإرجاع وألغت التأخير." },
        { title: "رفع الكفاءة في Swift byt L.L.C", metric: "15% خفض تكلفة • 20% نمو إيراد",
          body: "تحسين التدفقات، إعادة التفاوض مع الموردين، ولوحات تحكّم رفعت الربحية والسرعة." },
        { title: "عمليات البناء في Royal Towers", metric: "95% تسليم في الموعد",
          body: "جداول متكاملة وسجلات مخاطر حافظت على الميزانيات دون حوادث." },
        { title: "الاحتفاظ بالعملاء في Easy GO", metric: "90%+ احتفاظ • 25% نمو",
          body: "خطط حسابات ودورات تغذية راجعة حسّنت الجودة ووسّعت الشراكات." },
      ],
    },

    timeline: {
      title: "المسار المهني",
      items: [
        { role: "مدير علاقات حكومية (عمل حر)", org: "عجمان، الإمارات", where: "الإمارات", when: "2024 – الآن",
          points: ["استراتيجية الامتثال والتواصل مع MOHRE والتراخيص والتجديد.", "صفر مخالفات امتثال وتقارير شفافة.", "تدريب الفرق على الوعي بالسياسات (+30%)."] },
        { role: "مساعد مدير", org: "Swift byt L.L.C", where: "عجمان، الإمارات", when: "مايو 2023 – الآن",
          points: ["إشراف تشغيلي؛ −15% تكلفة؛ +20% إيراد.", "توسيع قاعدة العملاء +30%؛ 95% رضا.", "تقارير مؤشرات أداء تنفيذية دورية."] },
        { role: "مساعد مدير عمليات", org: "Royal Towers L.T.D", where: "تبليسي، جورجيا", when: "مايو 2021 – سبتمبر 2023",
          points: ["إدارة مشاريع سكنية (5–10 مليون$)؛ 95% تسليم في الموعد.", "سجل صفر حوادث؛ 10% توفير بالميزانية.", "تقليص الجداول −15% عبر توحيد الإجراءات."] },
        { role: "مدير علاقات", org: "Easy GO L.T.D", where: "تبليسي، جورجيا", when: "يونيو 2018 – سبتمبر 2021",
          points: ["إدارة 50+ حسابًا؛ 90% احتفاظ؛ 25% نمو.", "رفع SLAs وأدلة الاستجابة."] },
        { role: "مدير عمليات", org: "Babel’s School", where: "تبليسي، جورجيا", when: "يوليو 2017 – سبتمبر 2018",
          points: ["منشآت وموارد لـ 500 طالب؛ −15% دوران موظفين.", "امتثال وجدولة ومورّدون وخطط أزمات."] },
      ],
    },

    boards: {
      title: "عضويات ومشاركات",
      items: [
        "عضو، شبكة المدراء التنفيذيين للعمليات (الإمارات).",
        "مساهمة استشارية غير رسمية بمجموعة امتثال للقطاع الخاص.",
      ],
    },

    edu: {
      title: "التعليم",
      items: [
        "ماجستير إدارة أعمال (جارٍ)، University of the People، كاليفورنيا (2023 – الآن).",
        "ماجستير تربية، University of the People، كاليفورنيا (2021 – 2024).",
        "ليسانس فلسفة، جامعة طنطا، مصر (2012).",
      ],
    },

    certs: {
      title: "الشهادات المهنية",
      items: [
        "تخصصات التربية الخاصة: التوحّد (مقدمة، تقييم وتدخّل).",
        "إدارة الفصول والممارسات الشاملة.",
        "منحة Google — التسويق والإدارة.",
      ],
    },

    testimonials: {
      title: "قالوا عنها",
      items: [
        { quote: "ذكية سياسياً ودقيقة عملياتياً—تحصل على الموافقات وتؤسّس نظاماً يتوسّع بعدها.", name: "مدير إقليمي", title: "مجموعة خدمات خليجية" },
        { quote: "روتين مؤشرات الأداء عملي وإنساني. الفريق يصبح أسرع دون إنهاك.", name: "رئيس موارد بشرية", title: "قطاع خاص" },
        { quote: "التراخيص وMOHRE والمخاطر تحت السيطرة دائماً. لا مفاجآت.", name: "مدير عمليات", title: "قطاع الإنشاءات" },
      ],
    },
  },
};

const LINKS = {
  site: "https://www.taheel.ae",
  emailOfficial: "Mona_basal@taheel.ae",
  emailPersonal: "mona_basal@outlook.com",
  phone: "+971 56 785 8017",
  linkedin: "https://www.linkedin.com/in/mona-basal-853a9320b",
  instagram: "https://www.instagram.com/manmontymohammed",
  threads: "https://www.threads.com/@manmontymohammed",
};

/* ---------- UI Bits ---------- */
function Dot({ className = "" }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full bg-current transition-transform ${className}`} aria-hidden />;
}
function BadgeCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-black/20 p-4 sm:p-5 backdrop-blur-sm">
      <div className="mb-1.5 sm:mb-2 text-emerald-300/90 font-black tracking-wider" style={{ fontSize: "clamp(12px, 1.1vw, 13px)" }}>{title}</div>
      <div className="text-emerald-50/85" style={{ lineHeight: "1.85", fontSize: "clamp(0.92rem, 1.05vw, 1.05rem)" }}>{children}</div>
    </div>
  );
}
function LangToggle({ lang, onToggle }) {
  return (
    <button onClick={onToggle} className="rounded-full border border-white/25 bg-white/10 px-3 sm:px-3.5 py-1 text-[11px] sm:text-xs font-bold hover:bg-white/20 transition"
      aria-label={lang === "ar" ? "تبديل اللغة" : "Toggle language"} title={lang === "ar" ? "تبديل اللغة" : "Toggle language"}>
      {lang === "ar" ? "AR" : "EN"}
    </button>
  );
}
function Stat({ value, label }) {
  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-white/[.05] p-4 sm:p-5">
      <div className="text-emerald-300 font-extrabold" style={{ fontSize: "clamp(1.1rem, 2.2vw, 1.6rem)" }}>{value}</div>
      <div className="text-emerald-50/80 mt-1" style={{ fontSize: "clamp(0.8rem, 1vw, .95rem)" }}>{label}</div>
    </div>
  );
}
function SectionTitle({ children }) {
  return (
    <h2 className="text-emerald-300 mb-2.5 sm:mb-3 font-extrabold" style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.25rem)" }}>
      {children}
    </h2>
  );
}
function SubTitle({ children }) {
  return (
    <h3 className="text-emerald-200/90 mb-2 font-bold" style={{ fontSize: "clamp(.95rem, 1.2vw, 1.1rem)" }}>
      {children}
    </h3>
  );
}
function CaseCard({ title, metric, body }) {
  return (
    <div className="rounded-xl border border-white/12 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-extrabold text-emerald-200" style={{ fontSize: "clamp(.95rem, 1.2vw, 1.1rem)" }}>{title}</div>
        <span className="text-[12px] sm:text-xs rounded-full border border-emerald-300/40 px-2 py-0.5 text-emerald-100/90">{metric}</span>
      </div>
      <p className="mt-2 text-emerald-50/85" style={{ lineHeight: "1.8", fontSize: "clamp(.9rem, 1vw, 1rem)" }}>{body}</p>
    </div>
  );
}
function TimelineItem({ role, org, where, when, bullets }) {
  return (
    <div className="rounded-xl border border-white/12 bg-black/20 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="font-extrabold text-emerald-200" style={{ fontSize: "clamp(.95rem, 1.2vw, 1.1rem)" }}>{role}</div>
        <div className="text-emerald-100/80">• {org}</div>
        <div className="text-emerald-100/60">• {where}</div>
        <div className="ml-auto text-emerald-200/80 text-xs sm:text-[13px]">{when}</div>
      </div>
      <ul className="mt-2 grid gap-1.5 text-emerald-50/85" style={{ fontSize: "clamp(.9rem, 1vw, 1rem)" }}>
        {bullets.map((b, i) => <li key={i}>— {b}</li>)}
      </ul>
    </div>
  );
}
function QuoteCard({ quote, name, title }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-black/20 p-4 sm:p-5">
      <p className="italic text-emerald-50/90" style={{ lineHeight: "1.9", fontSize: "clamp(.9rem, 1vw, 1rem)" }}>"{quote}"</p>
      <div className="mt-3 text-emerald-200 font-bold">{name}</div>
      <div className="text-emerald-100/70 text-sm">{title}</div>
    </div>
  );
}
