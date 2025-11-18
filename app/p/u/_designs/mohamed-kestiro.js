"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/*
  Mohamed Kasteero • VIP Artist Profile (single-file, JS only)
  - Animated neon background (music / club vibe)
  - Sections: Artist Snapshot, Story, Style, Live & Tours, Discography, Collabs, Press, Testimonials
  - AR/EN via ?lang=ar|en (default: en)
  - Tailwind only
*/

export default function MohamedKasteero() {
  const params = useSearchParams();
  const initialParam = (params?.get("lang") || "en").toLowerCase();

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

  // animated bg (music neon)
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!motionOK) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0,
      h = 0;
    const C1 = "#050716"; // dark purple/blue
    const C2 = "#050311";
    const NEON_PINK = "rgba(255, 71, 204, 0.9)";
    const NEON_CYAN = "rgba(0, 255, 214, 0.9)";

    let P = [];
    let t = 0;

    const baseCount = () => {
      const area = w * h;
      let count = Math.floor(area / 38000);
      if (w < 480) count = Math.floor(count * 0.6);
      return Math.max(24, Math.min(90, count));
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
        r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      }));
    };

    const drawBackground = () => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, C2);
      g.addColorStop(1, C1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const drawRibbons = () => {
      // مثل إضاءة ليزر في حفلة
      const cx1 = w * 0.3 + Math.cos(t * 0.001) * (w * 0.25);
      const cy1 = h * 0.3 + Math.sin(t * 0.0014) * (h * 0.25);
      const cx2 = w * 0.7 + Math.cos(-t * 0.0011) * (w * 0.28);
      const cy2 = h * 0.65 + Math.sin(-t * 0.0008) * (h * 0.25);
      const r1 = Math.max(w, h) * 0.6;
      const r2 = Math.max(w, h) * 0.6;

      const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
      g1.addColorStop(0, "rgba(255,71,204,0.16)");
      g1.addColorStop(0.6, "rgba(255,71,204,0.06)");
      g1.addColorStop(1, "transparent");

      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      g2.addColorStop(0, "rgba(0,255,214,0.16)");
      g2.addColorStop(0.6, "rgba(0,255,214,0.05)");
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
      // كأنها نقاط إضاءة في السقف + مؤشرات صوت
      ctx.shadowBlur = 12;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;
        const beat = (Math.sin(t * 0.004 + i * 0.8) + 1) / 2; // شبه نبض موسيقي
        const r = p.r * (0.8 + beat * 0.8);
        const usePink = beat > 0.5;
        ctx.fillStyle = usePink ? NEON_PINK : NEON_CYAN;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
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

  // Contact helpers
  const PHONE_TEL = useMemo(
    () => LINKS.phone.replace(/\s+/g, "").replace(/^00/, "+"),
    []
  );
  const WA_NUMBER = useMemo(
    () => LINKS.phone.replace(/[^\d]/g, "").replace(/^00/, ""),
    []
  );
  const WA_TEXT = encodeURIComponent(t.whatsappText);
  const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${WA_TEXT}`;

  const CHIP =
    "group inline-flex items-center gap-2 rounded-xl border-2 bg-black/30 px-3.5 sm:px-4 py-2 text-[13px] sm:text-sm font-bold hover:bg-white/10 transition";
  const LINK_BLOCK =
    "block w-full rounded-lg px-4 py-2.5 sm:py-3 text-[13px] sm:text-sm font-bold hover:bg-white/10 transition border";
  const LIST_CHECK =
    "pl-5 grid gap-2 list-disc marker:text-fuchsia-400 text-fuchsia-50/90";
  const LIST_DASH =
    "pl-5 grid gap-1.5 list-disc marker:text-white/60 text-fuchsia-50/90 text-sm";
  const LEAD_STYLE = {
    lineHeight: "1.9",
    fontSize: "clamp(0.95rem, 1.15vw, 1.1rem)",
    color: "rgba(250,240,255,.9)",
  };

  const downloadVCF = () => {
    const vcf =
      "BEGIN:VCARD\n" +
      "VERSION:3.0\n" +
      "N:Kasteero;Mohamed;;;\n" +
      "FN:Mohamed Kasteero\n" +
      "TITLE:Singer • Performer\n" +
      "ORG:TAHEEL Artist Circle\n" +
      `EMAIL;TYPE=INTERNET;TYPE=WORK:${LINKS.emailOfficial}\n` +
      `TEL;TYPE=CELL:${LINKS.phone}\n` +
      `URL:${LINKS.site}\n` +
      `item1.URL:${LINKS.instagram}\n` +
      "item1.X-ABLabel:Instagram\n" +
      "END:VCARD";
    const blob = new Blob([vcf], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mohamed-kasteero.vcf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main
      className={`relative min-h-screen text-white selection:bg-fuchsia-500/40 selection:text-white ${
        lang === "ar" ? "rtl" : "ltr"
      }`}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* bg */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10"
        style={{ filter: "saturate(1.2) brightness(1.05)" }}
        aria-hidden
      />
      {!motionOK && (
        <div
          aria-hidden
          className="fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(40% 30% at 70% 20%, rgba(255,71,204,.16), transparent 60%), linear-gradient(#050311, #050716)",
          }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.09]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <section className="relative mx-auto max-w-[min(94rem,94vw)] px-4 sm:px-6 md:px-8 lg:px-10 py-8 sm:py-10 md:py-14">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 sm:gap-6">
          <img
            src="/logo-transparent-large.png"
            alt="TAHEEL Logo"
            className="h-10 sm:h-12 md:h-14 drop-shadow-[0_0_20px_rgba(0,255,214,.65)]"
          />
          <div className="flex items-center gap-2 sm:gap-3">
            <LangToggle
              lang={lang}
              onToggle={() => setLang(lang === "ar" ? "en" : "ar")}
            />
            <span className="rounded-full border border-white/20 bg-black/30 px-3 sm:px-4 py-1.5 text-[11px] sm:text-sm font-semibold tracking-wide">
              LIVE • {t.verified}
            </span>
          </div>
        </div>

        {/* Hero */}
        <div className="mt-8 sm:mt-10 md:mt-14 relative overflow-hidden rounded-3xl border border-fuchsia-400/40 bg-white/5 backdrop-blur-md">
          <div
            className="pointer-events-none absolute -inset-px rounded-3xl"
            style={{
              boxShadow:
                "0 0 0 1px rgba(255,71,204,0.25), 0 18px 55px rgba(255,71,204,0.18), 0 28px 80px rgba(0,255,214,0.16)",
            }}
          />
          <div className="p-5 sm:p-6 md:p-8 lg:p-10">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-5 sm:gap-6">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="h-[90px] w-[90px] sm:h-28 sm:w-28 md:h-32 md:w-32 lg:h-36 lg:w-36 rounded-2xl bg-gradient-to-br from-fuchsia-500/40 via-purple-500/40 to-cyan-400/40 border border-white/25 backdrop-blur-sm grid place-items-center overflow-hidden">
                  <img
                    src="/kasteero.jpg"
                    alt="Mohamed Kasteero — Artist Portrait"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const img = e?.currentTarget;
                      if (img) {
                        img.style.display = "none";
                        const fallback = img.nextSibling;
                        if (fallback && fallback.style)
                          fallback.style.display = "grid";
                      }
                    }}
                  />
                  <span className="hidden place-items-center text-2xl sm:text-3xl md:text-4xl font-black">
                    MK
                  </span>
                </div>
                <span className="absolute -bottom-2 -right-2 rounded-full bg-fuchsia-400/95 text-black text-[10px] sm:text-xs font-extrabold px-1.5 sm:px-2 py-0.5 shadow">
                  ARTIST
                </span>
              </div>

              {/* Name + Title */}
              <div className="text-center md:text-left">
                <h1
                  className="font-black leading-tight drop-shadow-[0_0_18px_rgba(255,71,204,.55)]"
                  style={{
                    fontSize: "clamp(1.9rem, 4vw, 3.6rem)",
                    letterSpacing: lang === "ar" ? "0" : "0.03em",
                  }}
                >
                  {lang === "ar" ? "محمد كستيرو" : "Mohamed Kasteero"}
                </h1>
                <p
                  className="mt-2 text-fuchsia-100/90 font-semibold"
                  style={{
                    fontSize: "clamp(0.95rem, 1.3vw, 1.15rem)",
                  }}
                >
                  {t.title}
                </p>

                {/* Small equalizer style bar */}
                <div className="mt-3 flex justify-center md:justify-start gap-1.5" aria-hidden>
                  {[10, 18, 14, 22, 16].map((h, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-gradient-to-b from-fuchsia-400 to-cyan-300 animate-pulse"
                      style={{ height: `${h}px`, animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1" />

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 sm:gap-3">
                <a
                  href={`mailto:${LINKS.emailOfficial}`}
                  className={`${CHIP} border-fuchsia-400/70`}
                  aria-label={t.ctaEmail}
                >
                  <Dot className="text-fuchsia-300 group-hover:scale-125" />
                  {t.ctaEmail}
                </a>

                <a
                  href={LINKS.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className={`${CHIP} border-fuchsia-300/70`}
                  aria-label="Instagram"
                >
                  <Dot className="text-fuchsia-200 group-hover:scale-125" />
                  Instagram
                </a>

                <a
                  href={LINKS.youtube}
                  target="_blank"
                  rel="noreferrer"
                  className={`${CHIP} border-red-400/70`}
                  aria-label="YouTube"
                >
                  <Dot className="text-red-300 group-hover:scale-125" />
                  YouTube
                </a>

                <a
                  href={LINKS.spotify}
                  target="_blank"
                  rel="noreferrer"
                  className={`${CHIP} border-emerald-400/70`}
                  aria-label="Spotify"
                >
                  <Dot className="text-emerald-300 group-hover:scale-125" />
                  Spotify
                </a>

                <a
                  href={WA_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className={`${CHIP} border-emerald-300/70`}
                  aria-label="WhatsApp"
                >
                  <Dot className="text-emerald-200 group-hover:scale-125" />
                  {t.ctaWhatsApp}
                </a>

                <button
                  onClick={downloadVCF}
                  className={`${CHIP} border-white/35`}
                  aria-label={t.ctaVCF}
                >
                  <Dot className="text-white/80 group-hover:scale-125" />
                  {t.ctaVCF}
                </button>
              </div>
            </div>

            {/* Snapshot */}
            <div className="mt-6 sm:mt-8 grid gap-4 sm:gap-5 md:grid-cols-3">
              <BadgeCard title={t.hl1Title}>{t.hl1Body}</BadgeCard>
              <BadgeCard title={t.hl2Title}>{t.hl2Body}</BadgeCard>
              <BadgeCard title={t.hl3Title}>{t.hl3Body}</BadgeCard>
            </div>
          </div>
        </div>

        {/* KPI Bar (streams / shows / countries / years) */}
        <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-4">
          {t.kpis.map((k, i) => (
            <Stat key={i} value={k.value} label={k.label} />
          ))}
        </div>

        {/* Bio + Sidebar */}
        <div className="mt-8 sm:mt-10 grid gap-5 sm:gap-6 lg:grid-cols-3">
          {/* Left: story */}
          <div className="lg:col-span-2 rounded-2xl border border-white/18 bg-white/[.07] p-5 sm:p-6 md:p-7 backdrop-blur">
            <SectionTitle>{t.aboutTitle}</SectionTitle>
            <p className="text-fuchsia-50/90" style={LEAD_STYLE}>
              {t.aboutBody}
            </p>

            {/* Style */}
            <div className="mt-6">
              <SubTitle>{t.style.title}</SubTitle>
              <ul className={LIST_CHECK}>
                {t.style.items.map((it, idx) => (
                  <li key={idx}>{it}</li>
                ))}
              </ul>
            </div>

            {/* Live & Tours */}
            <div className="mt-6">
              <SubTitle>{t.live.title}</SubTitle>
              <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
                {t.live.items.map((c, idx) => (
                  <CaseCard
                    key={idx}
                    title={c.title}
                    metric={c.metric}
                    body={c.body}
                  />
                ))}
              </div>
            </div>

            {/* Discography */}
            <div className="mt-6">
              <SubTitle>{t.disco.title}</SubTitle>
              <ul className={LIST_DASH}>
                {t.disco.items.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            {/* Collabs */}
            <div className="mt-6">
              <SubTitle>{t.collabs.title}</SubTitle>
              <ul className={LIST_DASH}>
                {t.collabs.items.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: links + press */}
          <aside className="rounded-2xl border border-fuchsia-400/40 bg-white/[.07] p-5 sm:p-6 md:p-7 backdrop-blur">
            <SectionTitle>{t.mediaTitle}</SectionTitle>
            <div className="space-y-2.5 sm:space-y-3">
              <a
                className={`${LINK_BLOCK} border-fuchsia-400/50`}
                href={LINKS.instagram}
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
              <a
                className={`${LINK_BLOCK} border-red-400/50`}
                href={LINKS.youtube}
                target="_blank"
                rel="noreferrer"
              >
                YouTube
              </a>
              <a
                className={`${LINK_BLOCK} border-emerald-400/50`}
                href={LINKS.spotify}
                target="_blank"
                rel="noreferrer"
              >
                Spotify
              </a>
              <a
                className={`${LINK_BLOCK} border-white/35`}
                href={`tel:${PHONE_TEL}`}
              >
                {t.callCTA}
              </a>
              <a
                className={`${LINK_BLOCK} border-emerald-300/40`}
                href={WA_LINK}
                target="_blank"
                rel="noreferrer"
              >
                {t.ctaWhatsApp}
              </a>
              <button
                className={`${LINK_BLOCK} border-white/35`}
                onClick={downloadVCF}
              >
                {t.ctaVCF}
              </button>
            </div>

            {/* Press / Media Quotes */}
            <div className="mt-6">
              <SubTitle>{t.press.title}</SubTitle>
              <ul className={LIST_DASH}>
                {t.press.items.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>

            {/* Highlights */}
            <div className="mt-6">
              <SubTitle>{t.highlights.title}</SubTitle>
              <ul className={LIST_DASH}>
                {t.highlights.items.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        {/* Testimonials */}
        <div className="mt-8">
          <SectionTitle>{t.testimonials.title}</SectionTitle>
          <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
            {t.testimonials.items.map((q, i) => (
              <QuoteCard
                key={i}
                quote={q.quote}
                name={q.name}
                title={q.title}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="mt-10 sm:mt-12 py-5 sm:py-6 text-center text-fuchsia-100/75"
          style={{ fontSize: "clamp(12px, 1vw, 14px)" }}
        >
          {t.powered}{" "}
          <span className="font-extrabold text-fuchsia-300">
            TAHEEL • Artist Circle
          </span>
        </div>
      </section>

      {/* Floating quick actions (mobile only) */}
      <div className="md:hidden fixed bottom-4 right-4 z-50 flex flex-col gap-3">
        <a
          href={WA_LINK}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border-2 border-fuchsia-400/80 bg-fuchsia-500/95 backdrop-blur px-4 py-3 text-sm font-extrabold text-black shadow-[0_10px_30px_rgba(255,71,204,.45)] active:scale-95 transition"
          aria-label={t.ctaWhatsApp}
          title={t.ctaWhatsApp}
        >
          {t.ctaWhatsApp}
        </a>
        <a
          href={`tel:${PHONE_TEL}`}
          className="rounded-full border-2 border-emerald-400/60 bg-white/10 backdrop-blur px-4 py-3 text-sm font-extrabold text-fuchsia-50 shadow-[0_8px_24px_rgba(0,255,214,.35)] active:scale-95 transition"
          aria-label={t.callCTA}
          title={t.callCTA}
        >
          {t.callCTA}
        </a>
      </div>

      {/* extra glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(40% 30% at 15% 20%, rgba(255,71,204,.16), transparent 60%), radial-gradient(35% 30% at 85% 80%, rgba(0,255,214,.16), transparent 60%)",
          mixBlendMode: "screen",
        }}
      />
    </main>
  );
}

/* ---------- helpers ---------- */
function sanitizeLang(v) {
  return v === "ar" || v === "en" ? v : "en";
}

/* ---------- Localized copy ---------- */
const COPY = {
  en: {
    verified: "Verified Artist",
    title: "Singer • Performer • Live Act",
    ctaEmail: "Booking & Management",
    ctaVCF: "Save Contact",
    mediaTitle: "Music & Social",
    callCTA: "Call Management",
    ctaWhatsApp: "WhatsApp (Bookings)",
    whatsappText:
      "Hello, I’d like to get in touch regarding bookings for Mohamed Kasteero.",
    powered: "Powered by",

    hl1Title: "Sound",
    hl1Body:
      "A modern Arabic pop sound with global production and hooks built for live shows and streaming.",
    hl2Title: "Stage",
    hl2Body:
      "High-energy performance, live crowd interaction, and visual moments tailored for social clips.",
    hl3Title: "Audience",
    hl3Body: "Young, digital-first listeners across the GCC, North Africa, and beyond.",

    kpis: [
      { value: "Millions+", label: "Total streams & views (cumulative)" },
      { value: "50+ shows", label: "Live performances regionally" },
      { value: "10+ cities", label: "Regional reach (GCC & MENA)" },
      { value: "🎛 Live-ready", label: "Band / playback / hybrid formats" },
    ],

    aboutTitle: "Artist Story",
    aboutBody:
      "Mohamed Kasteero is a contemporary Arabic singer who blends melodic hooks with modern production, balancing emotional lyrics with a sound that works equally well on stage and on streaming platforms. His performances are built around energy, audience connection, and unforgettable choruses that stay with the crowd long after the show ends.",

    style: {
      title: "Musical DNA",
      items: [
        "Arabic pop sound with influences from global R&B and dance.",
        "Topline-focused writing with memorable hooks and strong choruses.",
        "Stage presence built around crowd participation and sing-along moments.",
        "Flexible live setup: full band, semi-playback, or club-ready performance.",
      ],
    },

    live: {
      title: "Live Shows & Events",
      items: [
        {
          title: "Concerts & Festivals",
          metric: "Full live set",
          body: "Curated setlists for festivals, city events, and brand stages — from opening acts to headliner-style shows.",
        },
        {
          title: "Private & Corporate",
          metric: "Custom formats",
          body: "Tailored performances for private events, launches, and corporate galas with curated tracklists and timings.",
        },
      ],
    },

    disco: {
      title: "Selected Tracks / Releases",
      items: [
        "Lead singles and collaborations available across major platforms (Spotify, Anghami, Apple Music, YouTube).",
        "Mix of emotional ballads and high-energy tracks suitable for live performances and club play.",
        "Ongoing pipeline of new material aligned with a modern, visual-first release strategy.",
      ],
    },

    collabs: {
      title: "Collaborations",
      items: [
        "Open to featuring with producers, rappers, and DJs across the region.",
        "Flexible on original tracks, acoustic sessions, and remix-ready vocals.",
      ],
    },

    press: {
      title: "Press & Positioning",
      items: [
        "Positioned as a new-wave Arabic voice with a live-first mentality.",
        "Strong visual identity suitable for campaigns, brand work, and digital storytelling.",
      ],
    },

    highlights: {
      title: "Booking Highlights",
      items: [
        "Available for festivals, city events, club nights, and private occasions.",
        "Professional communication, clear technical rider, and punctual show delivery.",
      ],
    },

    testimonials: {
      title: "What People Say",
      items: [
        {
          quote:
            "A fresh voice with the kind of choruses that audiences remember.",
          name: "Event Organizer",
          title: "Regional Festival",
        },
        {
          quote:
            "Delivers the energy brands need on stage and on social media.",
          name: "Brand Manager",
          title: "Lifestyle Partner",
        },
        {
          quote:
            "His live presence turns a normal night into a highlight moment.",
          name: "Club Promoter",
          title: "GCC Venue",
        },
      ],
    },
  },

  ar: {
    verified: "فنان موثَّق",
    title: "مطرب • مؤدّي لايف • صوت عربي معاصر",
    ctaEmail: "للحجوزات والإدارة",
    ctaVCF: "حفظ جهة الاتصال",
    mediaTitle: "الموسيقى والسوشيال",
    callCTA: "اتصال بالإدارة",
    ctaWhatsApp: "واتساب للحجوزات",
    whatsappText:
      "مرحبًا، أرغب بالتواصل بخصوص حجوزات الفنان محمد كستيرو.",
    powered: "بإشراف",

    hl1Title: "الصوت",
    hl1Body:
      "لون غنائي عربي حديث بإنتاج عالمي وكلمات تعلق في الأذن ومناسبة للمنصات والحفلات.",
    hl2Title: "الاستعراض",
    hl2Body:
      "حضور لايف قوي، تفاعل مباشر مع الجمهور، ولحظات بصرية جاهزة للريلز والتيك توك.",
    hl3Title: "الجمهور",
    hl3Body:
      "قاعدة جماهيرية شابة ورقمية في الخليج وشمال أفريقيا وجاليات عربية حول العالم.",

    kpis: [
      { value: "ملايين+", label: "إجمالي الاستماعات والمشاهدات (تراكمي)" },
      { value: "50+ حفل", label: "حفلات وعروض في المنطقة" },
      { value: "10+ مدن", label: "انتشار في الخليج والمنطقة" },
      { value: "🎛 جاهز لايف", label: "فرقة / بلاي باك / فورمات مختلطة" },
    ],

    aboutTitle: "قصة الفنان",
    aboutBody:
      "محمد كستيرو صوت عربي معاصر يمزج بين اللحن القريب من القلب والإنتاج الحديث، فيوازن بين الإحساس وبين السهولة في الحفظ والغناء مع الجمهور. حفلاته مبنية على طاقة عالية وتفاعل مباشر، وكلمات تظل في ذهن الناس بعد انتهاء الليلة.",

    style: {
      title: "ملامح الهوية الموسيقية",
      items: [
        "بوب عربي بلمسات عالمية من الـ R&B والهاوس.",
        "تركيز على اللوازم (الهُوك) والكوبليه الذي يحفظه الجمهور بسرعة.",
        "حضور مسرحي يعتمد على التفاعل والهتاف والـ sing along.",
        "مرونة في فورمات اللايف: فرقة كاملة، بلاي باك، أو فورمات مناسب للنوادي.",
      ],
    },

    live: {
      title: "الحفلات والعروض",
      items: [
        {
          title: "مهرجانات وحفلات عامة",
          metric: "ست لايف كامل",
          body: "قوائم أغاني مصممة للمهرجانات والفعاليات الرسمية وحفلات المدن — من افتتاحيات إلى فقرات رئيسية.",
        },
        {
          title: "مناسبات خاصة وشركات",
          metric: "فورمات حسب الطلب",
          body: "عروض للمناسبات الخاصة، إطلاق العلامات التجارية، والفعاليات المؤسسية بقوائم وأزمنة مخصصة.",
        },
      ],
    },

    disco: {
      title: "أعمال مختارة",
      items: [
        "أغانٍ منفردة وتعاونات متاحة على المنصات الكبرى (Spotify، Anghami، Apple Music، YouTube).",
        "مزيج بين أغاني إحساس وتراكات حماسية مناسبة للنادي والحفلات.",
        "خطة مستمرة لإصدار أعمال جديدة بأسلوب بصري يناسب المنصات الرقمية.",
      ],
    },

    collabs: {
      title: "التعاونات",
      items: [
        "منفتح على التعاون مع منتجين، رابرز، و DJs من المنطقة.",
        "مرن في تقديم أصوات أصلية، جلسات أكوستيك، وتراكات جاهزة للريمكس.",
      ],
    },

    press: {
      title: "المشهد والصورة الإعلامية",
      items: [
        "مطرب عربي بموجة جديدة وصوت يناسب الجيل الرقمي.",
        "هوية بصرية قوية وقابلة للتوظيف في الحملات والـ storytelling الرقمي.",
      ],
    },

    highlights: {
      title: "نِقَاط مهمّة للحجوزات",
      items: [
        "متاح للمهرجانات، حفلات المدن، النوادي، والمناسبات الخاصة.",
        "التزام مهني، رايدر فني واضح، وتنفيذ ملتزم بالوقت.",
      ],
    },

    testimonials: {
      title: "قالوا عنه",
      items: [
        {
          quote: "صوت جديد، وكوبليهات تفضل على لسان الجمهور بعد الحفلة.",
          name: "منظّم حفلات",
          title: "مهرجان إقليمي",
        },
        {
          quote: "يعطي الطاقة التي تحتاجها العلامة على المسرح وعلى السوشيال.",
          name: "مدير علامة تجارية",
          title: "شريك لايفستайл",
        },
        {
          quote: "وجوده على المسرح يحوّل الليلة من عادية لـ highlight في الموسم.",
          name: "منسّق حفلات",
          title: "نادي في الخليج",
        },
      ],
    },
  },
};

const LINKS = {
  site: "https://www.taheel.ae",
  emailOfficial: "booking@taheel.ae", // عدّلها لو عندكم إيميل خاص
  phone: "+971 55 000 0000", // رقم الإدارة / الحجوزات
  instagram: "https://www.instagram.com/", // عدّل لينكات السوشيال لما تبقى جاهزة
  youtube: "https://www.youtube.com/",
  spotify: "https://open.spotify.com/",
};

/* ---------- UI Bits ---------- */
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
    <div className="rounded-2xl border border-white/14 bg-black/30 p-4 sm:p-5 backdrop-blur-sm">
      <div
        className="mb-1.5 sm:mb-2 text-fuchsia-300/95 font-black tracking-wider"
        style={{ fontSize: "clamp(12px, 1.1vw, 13px)" }}
      >
        {title}
      </div>
      <div
        className="text-fuchsia-50/85"
        style={{ lineHeight: "1.85", fontSize: "clamp(0.92rem, 1.05vw, 1.05rem)" }}
      >
        {children}
      </div>
    </div>
  );
}

function LangToggle({ lang, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="rounded-full border border-white/25 bg-white/10 px-3 sm:px-3.5 py-1 text-[11px] sm:text-xs font-bold hover:bg-white/20 transition"
      aria-label={lang === "ar" ? "تبديل اللغة" : "Toggle language"}
      title={lang === "ar" ? "تبديل اللغة" : "Toggle language"}
    >
      {lang === "ar" ? "AR" : "EN"}
    </button>
  );
}

function Stat({ value, label }) {
  return (
    <div className="rounded-2xl border border-fuchsia-400/30 bg-white/[.06] p-4 sm:p-5">
      <div
        className="text-fuchsia-300 font-extrabold"
        style={{ fontSize: "clamp(1.1rem, 2.2vw, 1.6rem)" }}
      >
        {value}
      </div>
      <div
        className="text-fuchsia-50/85 mt-1"
        style={{ fontSize: "clamp(0.8rem, 1vw, .95rem)" }}
      >
        {label}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2
      className="text-fuchsia-300 mb-2.5 sm:mb-3 font-extrabold"
      style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.25rem)" }}
    >
      {children}
    </h2>
  );
}

function SubTitle({ children }) {
  return (
    <h3
      className="text-fuchsia-100/95 mb-2 font-bold"
      style={{ fontSize: "clamp(.95rem, 1.2vw, 1.1rem)" }}
    >
      {children}
    </h3>
  );
}

function CaseCard({ title, metric, body }) {
  return (
    <div className="rounded-xl border border-white/14 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div
          className="font-extrabold text-fuchsia-100"
          style={{ fontSize: "clamp(.95rem, 1.2vw, 1.1rem)" }}
        >
          {title}
        </div>
        <span className="text-[12px] sm:text-xs rounded-full border border-fuchsia-300/50 px-2 py-0.5 text-fuchsia-50/90">
          {metric}
        </span>
      </div>
      <p
        className="mt-2 text-fuchsia-50/85"
        style={{ lineHeight: "1.8", fontSize: "clamp(.9rem, 1vw, 1rem)" }}
      >
        {body}
      </p>
    </div>
  );
}

function QuoteCard({ quote, name, title }) {
  return (
    <div className="rounded-2xl border border-white/14 bg-black/30 p-4 sm:p-5">
      <p
        className="italic text-fuchsia-50/90"
        style={{ lineHeight: "1.9", fontSize: "clamp(.9rem, 1vw, 1rem)" }}
      >
        "{quote}"
      </p>
      <div className="mt-3 text-fuchsia-200 font-bold">{name}</div>
      <div className="text-fuchsia-100/70 text-sm">{title}</div>
    </div>
  );
}
