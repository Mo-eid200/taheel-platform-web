"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Mona Basal • CEO – VIP page (single-file component)
 * - Animated neon background (Taheel deep blue + deep green)
 * - Particles + flowing gradient ribbons (GPU-friendly, respects reduced motion)
 * - Arabic/English copy via ?lang=ar|en (default: en)
 * - Logo glow, CEO header, actions (email, LinkedIn, phone, vCard, website)
 * - No external deps; Tailwind styles
 */

/** @typedef {"ar" | "en"} Lang */

export default function MonaBasal() {
  const params = useSearchParams();
  const initialParam = (params?.get("lang") || "en").toLowerCase();

  /** @type {[Lang, Function]} */
  const [lang, setLang] = useState(sanitizeLang(initialParam));
  const [motionOK, setMotionOK] = useState(true);

  // ----- Respect reduced motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionOK(!mq.matches);
    const onChange = (e) => setMotionOK(!e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // ----- Animated background canvas
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!motionOK) return; // static fallback handled by CSS below

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0,
      h = 0; // logical CSS pixels

    const C1 = "#0a1a2b"; // deep navy
    const C2 = "#0b1220"; // deep blue
    const NEON_G = "rgba(35,218,198,0.9)"; // neon green-ish
    const NEON_B = "rgba(83,166,247,0.9)"; // neon blue

    /** @type {{x:number,y:number,r:number,vx:number,vy:number}[]} */
    let P = [];
    let t = 0;

    const resize = () => {
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Particles scale to area
      const COUNT = Math.min(80, Math.floor((w * h) / 35000));
      P = new Array(COUNT).fill(0).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
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
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(cx1, cy1, r1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    };

    const drawParticles = () => {
      ctx.shadowBlur = 12;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;
        const mix = (Math.sin(t * 0.002 + i) + 1) / 2;
        ctx.fillStyle = mix > 0.5 ? NEON_G : NEON_B;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
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

    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resize();
      rafRef.current = requestAnimationFrame(tick);
    };

    resize();
    rafRef.current = requestAnimationFrame(tick);
    window.addEventListener("resize", onResize);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [motionOK]);

  // ----- Copy (AR/EN)
  const t = useMemo(() => COPY[lang], [lang]);

  // ----- vCard generator (download on click)
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
    a.href = url;
    a.download = "mona-basal.vcf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main
      className={`relative min-h-screen text-white selection:bg-emerald-500/30 selection:text-white ${
        lang === "ar" ? "rtl" : "ltr"
      }`}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* Animated background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10"
        style={{ filter: "saturate(1.1) brightness(1.05)" }}
      />

      {/* Static fallback when motion disabled */}
      {!motionOK && (
        <div
          aria-hidden
          className="fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(40% 30% at 70% 20%, rgba(35,218,198,.10), transparent 60%), linear-gradient(#0b1220, #0a1a2b)",
          }}
        />
      )}

      {/* Subtle grid overlay for depth */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <section className="relative max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-14">
        {/* Header */}
        <div className="flex items-center justify-between gap-6">
          <img
            src="/logo-transparent-large.png"
            alt="TAHEEL"
            className="h-12 md:h-14 drop-shadow-[0_0_18px_rgba(35,218,198,.55)]"
          />
          <div className="flex items-center gap-3">
            <LangToggle lang={lang} onToggle={() => setLang(lang === "ar" ? "en" : "ar")} />
            <span className="rounded-full border border-white/20 bg-black/20 px-4 py-1.5 text-sm font-semibold tracking-wide">
              VIP • {t.verified}
            </span>
          </div>
        </div>

        {/* Hero Card */}
        <div className="mt-10 md:mt-14 relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-white/5 backdrop-blur-md">
          {/* glow edges */}
          <div
            className="pointer-events-none absolute -inset-px rounded-3xl"
            style={{
              boxShadow:
                "0 0 0 1px rgba(35,218,198,0.25), 0 20px 60px rgba(35,218,198,0.08), 0 30px 80px rgba(83,166,247,0.10)",
            }}
          />
          <div className="p-6 md:p-10">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              <div className="relative">
                {/* Avatar (image fallback to initials) */}
                <div className="h-28 w-28 md:h-32 md:w-32 rounded-2xl bg-gradient-to-br from-emerald-400/30 to-sky-400/30 border border-white/20 backdrop-blur-sm grid place-items-center overflow-hidden">
                  <img
                    src="/mona.jpg"
                    alt="Mona Basal"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const img = e?.currentTarget;
                      if (img) {
                        img.style.display = "none";
                        const fallback = img.nextSibling;
                        if (fallback && fallback.style) fallback.style.display = "grid";
                      }
                    }}
                  />
                  <span className="hidden place-items-center text-3xl md:text-4xl font-black">MB</span>
                </div>
                <span className="absolute -bottom-2 -right-2 rounded-full bg-emerald-400/90 text-black text-xs font-extrabold px-2 py-0.5 shadow">
                  CEO
                </span>
              </div>

              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-black leading-tight drop-shadow-[0_0_16px_rgba(83,166,247,.35)]">
                  Mona Basal
                </h1>
                <p className="mt-2 text-emerald-200/90 font-semibold">{t.title}</p>
              </div>

              <div className="flex-1" />

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
                <a
                  href={`mailto:${LINKS.emailOfficial}`}
                  className="group inline-flex items-center gap-2 rounded-xl border-2 border-emerald-400/60 bg-black/20 px-4 py-2 font-bold hover:bg-emerald-400/10 transition"
                >
                  <Dot className="text-emerald-300 group-hover:scale-125" />
                  {t.ctaEmail}
                </a>
                <a
                  href={LINKS.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-2 rounded-xl border-2 border-sky-400/60 bg-black/20 px-4 py-2 font-bold hover:bg-sky-400/10 transition"
                >
                  <Dot className="text-sky-300 group-hover:scale-125" />
                  LinkedIn
                </a>
                <button
                  onClick={downloadVCF}
                  className="group inline-flex items-center gap-2 rounded-xl border-2 border-white/25 bg-white/10 px-4 py-2 font-bold hover:bg-white/20 transition"
                >
                  <Dot className="text-white/80 group-hover:scale-125" />
                  {t.ctaVCF}
                </button>
                <a
                  href={LINKS.site}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-2 rounded-xl border-2 border-emerald-300/40 bg-black/20 px-4 py-2 font-bold hover:bg-emerald-300/10 transition"
                >
                  <Dot className="text-emerald-200 group-hover:scale-125" />
                  {t.ctaSite}
                </a>
              </div>
            </div>

            {/* Highlights */}
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <BadgeCard title={t.hl1Title}>{t.hl1Body}</BadgeCard>
              <BadgeCard title={t.hl2Title}>{t.hl2Body}</BadgeCard>
              <BadgeCard title={t.hl3Title}>{t.hl3Body}</BadgeCard>
            </div>
          </div>
        </div>

        {/* Bio / Links */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-2xl border border-white/15 bg-white/[.06] p-6 backdrop-blur">
            <h2 className="text-xl font-extrabold text-emerald-300 mb-3">{t.aboutTitle}</h2>
            <p className="leading-8 text-emerald-50/90">{t.aboutBody}</p>
          </div>

          <div className="rounded-2xl border border-emerald-400/30 bg-white/[.06] p-6 backdrop-blur">
            <h2 className="text-xl font-extrabold text-emerald-300 mb-3">{t.mediaTitle}</h2>
            <div className="space-y-3">
              <a
                className="block rounded-lg border border-emerald-400/40 px-4 py-3 font-bold hover:bg-emerald-400/10 transition"
                href={LINKS.instagram}
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
              <a
                className="block rounded-lg border border-sky-400/40 px-4 py-3 font-bold hover:bg-sky-400/10 transition"
                href={LINKS.threads}
                target="_blank"
                rel="noreferrer"
              >
                Threads
              </a>
              <a
                className="block rounded-lg border border-white/30 px-4 py-3 font-bold hover:bg-white/10 transition"
                href={`tel:${LINKS.phone.replace(/\s+/g, "")}`}
              >
                {t.callCTA}
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 py-6 text-center text-sm text-emerald-200/70">
          {t.powered} <span className="font-extrabold text-emerald-300">TAHEEL • GISAI</span>
        </div>
      </section>

      {/* extra glow behind content */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: "radial-gradient(40% 30% at 70% 20%, rgba(35,218,198,.08), transparent 60%)",
          mixBlendMode: "screen",
        }}
      />
    </main>
  );
}

/* ---------- helpers ---------- */
/** @param {string} v */ function sanitizeLang(v) {
  return v === "ar" || v === "en" ? v : "en";
}

/* ---------- Localized copy ---------- */
/** @type {{[k in Lang]: any}} */
const COPY = {
  en: {
    verified: "Verified",
    title: "Chief Executive Officer • TAHEEL",
    ctaEmail: "Email (Official)",
    ctaVCF: "Save Contact",
    ctaSite: "Visit Website",
    hl1Title: "Vision",
    hl1Body: "Executive leader building a trusted, AI-first e-government platform.",
    hl2Title: "Focus",
    hl2Body: "Scale, reliability, and a world-class client experience.",
    hl3Title: "Regions",
    hl3Body: "UAE • GCC • Global partners",
    aboutTitle: "About",
    aboutBody:
      "Mona Basal leads TAHEEL with a mission to build a smart, secure bridge between residents, businesses, and government services. She blends design, compliance, and intelligent automation to deliver measurable outcomes at enterprise scale.",
    mediaTitle: "Media & Links",
    callCTA: "Call Mona",
    powered: "Powered by",
  },
  ar: {
    verified: "موثَّق",
    title: "الرئيس التنفيذي • تأهيل",
    ctaEmail: "البريد الرسمي",
    ctaVCF: "حفظ جهة الاتصال",
    ctaSite: "الموقع الرسمي",
    hl1Title: "الرؤية",
    hl1Body: "قائدة تنفيذية تبني منصة حكومية ذكية وموثوقة بمدخلية ذكاء اصطناعي.",
    hl2Title: "التركيز",
    hl2Body: "التوسّع القابل للقياس، الاعتمادية، وتجربة عميل عالمية.",
    hl3Title: "النطاق",
    hl3Body: "الإمارات • الخليج • شركاء عالميون",
    aboutTitle: "نبذة",
    aboutBody:
      "تقود مُنى بصل منصة تأهيل لبناء جسر ذكي وآمن بين الأفراد والشركات والجهات الحكومية. تمزج بين التصميم الدقيق والامتثال والأتمتة الذكية لتحقيق نتائج قابلة للقياس على مستوى المؤسسات.",
    mediaTitle: "وسائط وروابط",
    callCTA: "اتصال بمُنى",
    powered: "بإشراف",
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

/* ---------- Reusable tiny bits ---------- */
function Dot({ className = "" }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full bg-current transition-transform ${className}`}
      aria-hidden
    />
  );
}

function BadgeCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-black/20 p-5 backdrop-blur-sm">
      <div className="mb-2 text-[13px] font-black tracking-wider text-emerald-300/90">{title}</div>
      <div className="text-emerald-50/85 leading-7">{children}</div>
    </div>
  );
}

function LangToggle({ lang, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20 transition"
      aria-label="Toggle language"
    >
      {lang === "ar" ? "AR" : "EN"}
    </button>
  );
}
