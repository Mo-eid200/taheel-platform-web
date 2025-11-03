"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/*
  Mona Basal • Executive VIP Profile (single-file, JS only)
  - Animated neon background (GPU-friendly, respects reduced motion)
  - Sections: Vision, Impact KPIs, Executive Profile, Qualifications, Case Studies, Timeline,
              Boards, Publications & Research, Global Conferences, Media, Education, Certifications, Testimonials
  - AR/EN via ?lang=ar|en (default: en)
  - Tailwind only (no styled-jsx / no @apply)
*/

export default function MonaBasal() {
  const params = useSearchParams();
  const initialParam = (params?.get("lang") || "en").toLowerCase();

  // JS-only state (no types)
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

  // ==== Contact helpers (tel / WhatsApp) ====
  const PHONE_TEL = useMemo(() => LINKS.phone.replace(/\s+/g, "").replace(/^00/, "+"), []);
  const WA_NUMBER = useMemo(() => LINKS.phone.replace(/[^\d]/g, "").replace(/^00/, ""), []);
  const WA_TEXT = encodeURIComponent(t.whatsappText);
  const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${WA_TEXT}`;

  // UI utility classes
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
                  <img
                    src="/mona-pro.jpg"
                    alt="Mona Basal — Executive Portrait"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const img = e?.currentTarget;
                      if (img) {
                        img.style.display="none";
                        const fallback = img.nextSibling;
                        if (fallback && fallback.style) fallback.style.display="grid";
                      }
                    }}
                  />
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
                <a href={`mailto:${LINKS.emailOfficial}`} className={`${CHIP} border-emerald-400/60`} aria-label={t.ctaEmail}>
                  <Dot className="text-emerald-300 group-hover:scale-125" />{t.ctaEmail}
                </a>

                <a href={LINKS.linkedin} target="_blank" rel="noreferrer" className={`${CHIP} border-sky-400/60`} aria-label="LinkedIn">
                  <Dot className="text-sky-300 group-hover:scale-125" />LinkedIn
                </a>

                {/* Call (one-tap) */}
                <a href={`tel:${PHONE_TEL}`} className={`${CHIP} border-emerald-400/60`} aria-label={t.callCTA}>
                  <Dot className="text-emerald-300 group-hover:scale-125" />{t.callCTA}
                </a>

                {/* WhatsApp (one-tap) */}
                <a href={WA_LINK} target="_blank" rel="noreferrer" className={`${CHIP} border-emerald-300/60`} aria-label="WhatsApp">
                  <Dot className="text-emerald-200 group-hover:scale-125" />{t.ctaWhatsApp}
                </a>

                <button onClick={downloadVCF} className={`${CHIP} border-white/25`} aria-label={t.ctaVCF}>
                  <Dot className="text-white/80 group-hover:scale-125" />{t.ctaVCF}
                </button>

                <a href={LINKS.site} target="_blank" rel="noreferrer" className={`${CHIP} border-emerald-300/40`} aria-label={t.ctaSite}>
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
              <a className={`${LINK_BLOCK} border-white/30`} href={`tel:${PHONE_TEL}`}>{t.callCTA}</a>
              <a className={`${LINK_BLOCK} border-emerald-300/40`} href={WA_LINK} target="_blank" rel="noreferrer">{t.ctaWhatsApp}</a>
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

            {/* Publications & Research */}
            <div className="mt-6">
              <SubTitle>{t.pubs.title}</SubTitle>
              <ul className={LIST_DASH}>
                {t.pubs.items.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>

            {/* Global Conferences */}
            <div className="mt-6">
              <SubTitle>{t.confs.title}</SubTitle>
              <ul className={LIST_DASH}>
                {t.confs.items.map((e, i) => <li key={i}>{e}</li>)}
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

      {/* Floating quick actions (mobile only) */}
      <div className="md:hidden fixed bottom-4 right-4 z-50 flex flex-col gap-3">
        <a
          href={WA_LINK}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border-2 border-emerald-400/70 bg-emerald-500/90 backdrop-blur
                     px-4 py-3 text-sm font-extrabold text-black
                     shadow-[0_10px_30px_rgba(35,218,198,.35)] active:scale-95 transition"
          aria-label={t.ctaWhatsApp}
          title={t.ctaWhatsApp}
        >
          {t.ctaWhatsApp}
        </a>
        <a
          href={`tel:${PHONE_TEL}`}
          className="rounded-full border-2 border-emerald-400/40 bg-white/10 backdrop-blur
                     px-4 py-3 text-sm font-extrabold text-emerald-100
                     shadow-[0_8px_24px_rgba(83,166,247,.25)] active:scale-95 transition"
          aria-label={t.callCTA}
          title={t.callCTA}
        >
          {t.callCTA}
        </a>
      </div>

      {/* extra glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10"
           style={{ background:"radial-gradient(40% 30% at 70% 20%, rgba(35,218,198,.08), transparent 60%)", mixBlendMode:"screen" }} />
    </main>
  );
}

/* ---------- helpers ---------- */
function sanitizeLang(v) {
  return v === "ar" || v === "en" ? v : "en";
}

/* ---------- Localized copy (polished executive tone) ---------- */
const COPY = {
  en: {
    verified: "Verified",
    title: "Chief Executive Officer • TAHEEL",
    ctaEmail: "Email (Official)",
    ctaVCF: "Save Contact",
    ctaSite: "Visit Website",
    mediaTitle: "Media & Links",
    callCTA: "Call Mona",
    ctaWhatsApp: "WhatsApp",
    whatsappText: "Hello Mona, I’d like to connect regarding executive services.",
    powered: "Powered by",

    // Snapshot
    hl1Title: "Vision",
    hl1Body: "Build the region’s most trusted, AI-first government services platform with global-grade governance.",
    hl2Title: "Operating Model",
    hl2Body: "Policy-aligned, KPI-driven, client-obsessed — designed for scale and resilience.",
    hl3Title: "Global Reach",
    hl3Body: "UAE • GCC • EU partnerships & international networks",

    // KPIs
    kpis: [
      { value: "100%+", label: "Regulatory approvals across programs" },
      { value: "0 findings", label: "External audits & compliance" },
      { value: "20–35%", label: "Productivity uplift at scale" },
      { value: "T+24h", label: "Issue closure SLA (critical)" },
    ],

    aboutTitle: "Executive Profile",
    aboutBody:
      "Mona Basal is a policy-smart, operations-exact CEO who blends regulatory fluency with big-tech execution standards. She has led cross-border initiatives with EU and GCC stakeholders, crafting data-driven operating models that withstand audits, scale reliably, and deliver best-in-class client outcomes. Her approach integrates AI governance, risk controls, and human-centered leadership — elevating speed, quality, and trust simultaneously.",

    qual: {
      title: "Core Qualifications",
      items: [
        "Regulatory strategy & government relations (MOHRE, licensing, permits) with EU/GCC interface.",
        "Enterprise-grade operating systems: KPI governance, audit readiness, budget control.",
        "AI-enabled workflows, policy design, internal controls, and risk mitigation.",
        "C-suite stakeholder management; vendor and public-sector partnerships.",
        "Cross-border delivery in UAE & Europe; Arabic/English executive communication.",
      ],
    },

    cases: {
      title: "Selected Impact",
      items: [
        { title: "RegOps Platform (Gov Interfaces)", metric: "100% on-time approvals",
          body: "Pre-clearance playbooks, dossier standardization, and deadline SLAs — eliminating rework and late submissions." },
        { title: "Enterprise Cost & Speed Program", metric: "−18% cost • +28% throughput",
          body: "Lean redesign, automated checkpoints, and vendor optimization with measurable uplift across units." },
        { title: "Confidential Fortune-500 Tech Mandate", metric: "Zero audit findings",
          body: "Introduced AI governance and privacy controls; passed third-party audits with no material issues." },
        { title: "Public-Sector Partnership (GCC/EU)", metric: "Policy adoption in 6 entities",
          body: "Co-authored compliance toolkits; accelerated licensing cycles while preserving rigor." },
      ],
    },

    timeline: {
      title: "Career Timeline",
      items: [
        { role: "Chief Executive Officer", org: "TAHEEL • GISAI", where: "UAE • EU", when: "2024 – Present",
          points: [
            "Built AI-first service stack; standardized RegOps with measurable SLAs.",
            "Expanded EU/GCC partnerships; instituted quarterly audit readiness.",
            "Scaled client NPS 90%+ with executive review cadences.",
          ]},
        { role: "Director of Operations (Consulting)", org: "Multiple enterprise mandates", where: "UAE • Europe", when: "2021 – 2024",
          points: [
            "Launched compliance dashboards; 0 audit findings over 3 cycles.",
            "Grew revenue velocity via KPI rituals and vendor realignment.",
          ]},
        { role: "Programs & Partnerships Lead", org: "Private & public sector", where: "GCC • EU", when: "2018 – 2021",
          points: [
            "Structured multi-agency workflows; accelerated permits/licensing.",
            "Led crisis protocols with T+24h closure for critical issues.",
          ]},
      ],
    },

    boards: {
      title: "Boards & Affiliations",
      items: [
        "Member, Executive Operations Council (GCC).",
        "Advisor, Data Governance & AI Readiness working groups.",
      ],
    },

    pubs: {
      title: "Publications & Research",
      items: [
        "“AI-Ready Operations: A Governance Blueprint for Public-Service Scale” — White paper.",
        "“SLA-Driven Licensing: Reducing Friction Without Compromising Controls.”",
        "“Audit-Proof KPIs: Designing Metrics That Survive Real Scrutiny.”",
      ],
    },

    confs: {
      title: "Global Conferences (Speaker/Panelist)",
      items: [
        "GovTech Summit — Operating Models for AI-Enabled Public Services.",
        "GCC–EU Forum — Cross-Border Compliance & Data Governance.",
        "Digital Services Expo — KPI Cultures That Scale.",
      ],
    },

    edu: {
      title: "Education",
      items: [
        "MBA, Strategic Management, Executive focus.",
        "M.Ed., University of the People, CA, USA.",
        "B.A., Philosophy, Tanta University, Egypt.",
      ],
    },
    certs: {
      title: "Professional Certifications",
      items: [
        "Project Management Professional (PMP).",
        "PRINCE2® Practitioner.",
        "Lean Six Sigma Green Belt.",
        "ISO/IEC 27001 Lead Implementer (Information Security).",
        "ITIL® 4 Foundation (Service Management).",
        "COBIT® 2019 Foundation (Governance).",
        "Data Protection & GDPR Practitioner.",
        "Governance, Risk & Compliance (executive programs).",
        "Operational Excellence & Lean Leadership.",
        "Google Scholarship — Marketing & Management.",
      ],
    },

    testimonials: {
      title: "What Leaders Say",
      items: [
        { quote: "Thinks like a regulator, delivers like a top-tier operator.", name: "Regional GM", title: "GCC Services Group" },
        { quote: "Her KPI culture drives speed without losing control.", name: "Chief People Officer", title: "Enterprise Client" },
        { quote: "Audit-proof execution — zero surprises, consistent outcomes.", name: "Director of Compliance", title: "Public Sector" },
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
    ctaWhatsApp: "واتساب",
    whatsappText: "مرحبًا مُنى، أرغب بالتواصل بخصوص الخدمات التنفيذية.",
    powered: "بإشراف",

    hl1Title: "الرؤية",
    hl1Body: "بناء منصة خدمات حكومية موثوقة بمدخلية ذكاء اصطناعي ومعايير حوكمة عالمية.",
    hl2Title: "نموذج العمل",
    hl2Body: "منحاز للسياسات والبيانات، مهووس بتجربة العميل، قابل للتوسع ومتين.",
    hl3Title: "الانتشار العالمي",
    hl3Body: "الإمارات والخليج وشراكات أوروبية ودولية",

    kpis: [
      { value: "100%+", label: "موافقات تنظيمية في البرامج" },
      { value: "0 ملاحظات", label: "نتائج التدقيق والامتثال" },
      { value: "35–20%", label: "تحسّن الإنتاجية على نطاق واسع" },
      { value: "T+24h", label: "إغلاق الحالات الحرجة" },
    ],

    aboutTitle: "النبذة التنفيذية",
    aboutBody:
      "مُنى بصل قيادية تجمع بين فهم السياسات ودقة التنفيذ بمعايير شركات التقنية الكبرى. قادت مبادرات عابرة للحدود مع شركاء في الاتحاد الأوروبي والخليج، وصمّمت نماذج تشغيل مدفوعة بالبيانات تصمد أمام التدقيق، وتتوسع بثبات، وتحقق تجربة عميل رائدة. مقاربتها توائم حوكمة الذكاء الاصطناعي وإدارة المخاطر والقيادة الإنسانية — فتضاعف السرعة والجودة والثقة معًا.",

    qual: {
      title: "المؤهلات الأساسية",
      items: [
        "استراتيجية الامتثال والعلاقات الحكومية (MOHRE، التراخيص، التصاريح) مع واجهات أوروبية/خليجية.",
        "أنظمة تشغيل مؤسسية: حوكمة مؤشرات الأداء، الجاهزية للتدقيق، وضبط الميزانيات.",
        "تدفقات عمل مدعومة بالذكاء الاصطناعي، تصميم سياسات، وضوابط داخلية وإدارة مخاطر.",
        "إدارة أصحاب المصلحة على مستوى الإدارة العليا وشراكات القطاع العام والمورّدين.",
        "تنفيذ عابر للحدود في الإمارات وأوروبا؛ تواصل تنفيذي عربي/إنجليزي.",
      ],
    },

    cases: {
      title: "أثر مختار",
      items: [
        { title: "منصة العمليات التنظيمية", metric: "موافقات في الوقت المحدد 100%",
          body: "بلايبوك ما قبل الإرسال، توحيد الملفات، واتفاقيات زمنية — بدون تأخير أو إعادة عمل." },
        { title: "برنامج الكلفة والسرعة المؤسسي", metric: "−18% كلفة • +28% إنتاجية",
          body: "إعادة تصميم رشيقة ونقاط تفتيش مؤتمتة وتحسين الموردين بنتائج قابلة للقياس." },
        { title: "تكليف تقني عالمي (سري)", metric: "0 ملاحظات تدقيق",
          body: "حوكمة ذكاء اصطناعي وضوابط خصوصية؛ اجتياز تدقيق طرف ثالث دون ملاحظات جوهرية." },
        { title: "شراكات قطاع عام (خليج/أوروبا)", metric: "تبني سياسات في 6 جهات",
          body: "مشاركات في إعداد أدلة امتثال؛ تسريع دورات الترخيص مع الحفاظ على الصرامة." },
      ],
    },

    timeline: {
      title: "المسار المهني",
      items: [
        { role: "الرئيس التنفيذي", org: "تأهيل • GISAI", where: "الإمارات • أوروبا", when: "2024 – الآن",
          points: [
            "بناء حزمة خدمات بمدخلية ذكاء اصطناعي؛ توحيد عمليات الامتثال بمؤشرات واضحة.",
            "توسيع الشراكات الأوروبية/الخليجية؛ جاهزية ربع سنوية للتدقيق.",
            "رفع مؤشر الرضا (NPS) إلى 90%+ بمراجعات تنفيذية دورية.",
          ]},
        { role: "مدير عمليات (استشاري)", org: "تفويضات مؤسسية متعددة", where: "الإمارات • أوروبا", when: "2021 – 2024",
          points: [
            "إطلاق لوحات امتثال؛ 0 ملاحظات عبر 3 دورات تدقيق.",
            "رفع سرعة الإيراد عبر طقوس مؤشرات الأداء ومواءمة الموردين.",
          ]},
        { role: "قائد البرامج والشراكات", org: "عام وخاص", where: "الخليج • أوروبا", when: "2018 – 2021",
          points: [
            "تشكيل تدفقات عمل متعددة الجهات؛ تسريع التصاريح والتراخيص.",
            "إدارة أزمات مع إغلاق خلال 24 ساعة للحالات الحرجة.",
          ]},
      ],
    },

    boards: {
      title: "عضويات ومشاركات",
      items: [
        "عضو، مجلس العمليات التنفيذي (الخليج).",
        "مستشارة، مجموعات عمل حوكمة البيانات وجاهزية الذكاء الاصطناعي.",
      ],
    },

    pubs: {
      title: "منشورات وأبحاث",
      items: [
        "«تشغيل جاهز للذكاء الاصطناعي: إطار حوكمة للخدمات العامة» — ورقة عمل.",
        "«ترخيص قائم على مؤشرات الأداء: تقليل الاحتكاك دون المساس بالضوابط».",
        "«مؤشرات أداء مقاومة للتدقيق: تصميم مقاييس تصمد أمام الفحص».",
      ],
    },

    confs: {
      title: "مؤتمرات دولية (متحدث/عضو لجنة)",
      items: [
        "قمة GovTech — نماذج تشغيل للخدمات العامة المدعومة بالذكاء الاصطناعي.",
        "منتدى الخليج–أوروبا — الامتثال العابر للحدود وحوكمة البيانات.",
        "Digital Services Expo — ثقافة مؤشرات الأداء القابلة للتوسع.",
      ],
    },

    edu: {
      title: "التعليم",
      items: [
        "ماجستير إدارة أعمال (MBA)، إدارة استراتيجية — تركيز تنفيذي.",
        "ماجستير تربية، University of the People، كاليفورنيا، الولايات المتحدة.",
        "ليسانس فلسفة، جامعة طنطا، مصر.",
      ],
    },
    certs: {
      title: "الشهادات المهنية",
      items: [
        "إدارة المشاريع الاحترافية (PMP).",
        "PRINCE2® Practitioner.",
        "Lean Six Sigma Green Belt.",
        "ISO/IEC 27001 Lead Implementer (أمن المعلومات).",
        "ITIL® 4 Foundation (إدارة الخدمات).",
        "COBIT® 2019 Foundation (الحوكمة).",
        "ممارس حماية البيانات والـ GDPR.",
        "حوكمة ومخاطر وامتثال (برامج تنفيذية).",
        "التميز التشغيلي والقيادة الرشيقة.",
        "منحة Google — التسويق والإدارة.",
      ],
    },

    testimonials: {
      title: "قالوا عنها",
      items: [
        { quote: "تفكر كجهة تنظيمية وتنفّذ كمُشغّل من الدرجة الأولى.", name: "المدير الإقليمي", title: "مجموعة خدمات خليجية" },
        { quote: "ثقافة مؤشرات الأداء لديها ترفع السرعة دون فقد السيطرة.", name: "رئيس الموارد البشرية", title: "عميل مؤسسي" },
        { quote: "تنفيذ مقاوم للتدقيق — نتائج ثابتة دون مفاجآت.", name: "مدير الامتثال", title: "قطاع عام" },
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
