"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/*
  Mohamed Kasteero • VIP Artist Profile (single-file, JS only)
  - Animated neon background (music / club vibe + golden notes)
  - Sections: Artist Snapshot, Story, Style, Live & Tours, Discography, Collabs, Press, Highlights, Testimonials
  - AR/EN via ?lang=ar|en (default: en)
  - Tailwind only
*/

export default function MohamedKasteero() {
  const params = useSearchParams();
  const initialParam = (params?.get("lang") || "ar").toLowerCase();

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

  // animated bg (music neon + golden notes)
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
    const C1 = "#050716";
    const C2 = "#050311";
    const NEON_PINK = "rgba(255, 71, 204, 0.9)";
    const NEON_CYAN = "rgba(0, 255, 214, 0.9)";
    const GOLD = "rgba(255, 215, 0, 0.9)";

    let P = []; // particles
    let NOTES = []; // musical notes
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

      const NOTE_COUNT = Math.floor(COUNT / 3);
      NOTES = Array.from({ length: NOTE_COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vy: 0.35 + Math.random() * 0.45,
        size: 0.8 + Math.random() * 1.4,
        wobble: Math.random() * Math.PI * 2,
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
      ctx.shadowBlur = 10;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;
        const beat = (Math.sin(t * 0.004 + i * 0.8) + 1) / 2;
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

    const drawNotes = () => {
      ctx.shadowBlur = 14;
      ctx.fillStyle = GOLD;
      ctx.shadowColor = GOLD;

      for (let i = 0; i < NOTES.length; i++) {
        const n = NOTES[i];
        n.y += n.vy;
        n.wobble += 0.01;
        n.x += Math.sin(n.wobble) * 0.15;

        if (n.y > h + 20) {
          n.y = -20;
          n.x = Math.random() * w;
        }

        const s = n.size;
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.scale(s, s);

        // simple music note: circle + stem + small head
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(4, -0.5);
        ctx.lineTo(4, -18);
        ctx.lineTo(7, -16);
        ctx.lineTo(7, -14);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      ctx.shadowBlur = 0;
    };

    const tick = (now) => {
      t = now || t + 16;
      drawBackground();
      drawRibbons();
      drawNotes();
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
      "N:Abdelghafar;Mohamed;;;\n" +
      "FN:Mohamed Kasteero\n" +
      "TITLE:Egyptian Singer • Shaabi & Tarab Artist\n" +
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
          <div
            className="relative flex h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,.12),0_10px_30px_rgba(0,0,0,.35)] animate-pulse"
            aria-hidden={false}
          >
            <img
              src="/logo-transparent-large.png"
              alt="TAHEEL Logo"
              className="h-7 sm:h-9 md:h-10 w-auto drop-shadow-[0_0_14px_rgba(0,255,214,.55)]"
            />
          </div>

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
                <div className="h-[120px] w-[120px] sm:h-32 sm:w-32 md:h-36 md:w-36 lg:h-40 lg:w-40 rounded-2xl bg-gradient-to-br from-fuchsia-500/40 via-purple-500/40 to-cyan-400/40 border border-white/25 backdrop-blur-sm grid place-items-center overflow-hidden">
                  <img
                    src="/kasteero.jpg"
                    alt={
                      lang === "ar"
                        ? "محمد كستيرو — صورة الفنان"
                        : "Mohamed Kasteero — Artist Portrait"
                    }
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
                <div
                  className="mt-3 flex justify-center md:justify-start gap-1.5"
                  aria-hidden
                >
                  {[12, 22, 16, 26, 18].map((h, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-gradient-to-b from-fuchsia-400 to-cyan-300 animate-pulse"
                      style={{
                        height: `${h}px`,
                        animationDelay: `${i * 0.12}s`,
                      }}
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

        {/* KPI Bar */}
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
  return v === "ar" || v === "en" ? v : "ar";
}

/* ---------- Localized copy ---------- */
const COPY = {
  en: {
    verified: "Verified Artist",
    title: "Egyptian singer • Shaabi & tarab vocalist • Music producer & arranger",
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
      "Classic Arabic tarab and popular Egyptian sound with modern arrangements built for both festivals and digital platforms.",
    hl2Title: "Stage",
    hl2Body:
      "A live-first artist: strong presence, audience interaction, and moments that translate into TV and social media.",
    hl3Title: "Roots & Reach",
    hl3Body:
      "From Cairo’s stages to regional festivals — with a growing audience across Egypt, the Gulf, and Arab communities abroad.",

    kpis: [
      { value: "15+ years", label: "Experience in Arabic singing & music" },
      { value: "50+ shows", label: "Concerts, festivals & official events" },
      { value: "10+ cities", label: "Performances across Egypt & the region" },
      { value: "Golden Residency", label: "Prepared file • UAE candidate 2025" },
    ],

    aboutTitle: "Artist Story",
    aboutBody:
      "Mohamed Abdelghafar (stage name: Mohamed Kasteero) is an Egyptian singer, producer, and music arranger who has spent more than fifteen years in the world of Arabic tarab and popular music. Starting from Cairo in the mid-2000s, he built a career through concerts, major festivals, and televised appearances, becoming part of the contemporary Egyptian music scene while staying loyal to authentic melodies and live performance. TAHEEL manages his artistic brand and has prepared his profile as a Golden Residency candidate for the UAE Ministry of Culture (2025).",

    style: {
      title: "Musical Identity",
      items: [
        "Egyptian tarab and shaabi with strong melodic lines and emotional delivery.",
        "Arrangements that blend authentic orchestration with modern sounds and rhythms.",
        "Lyrics and performances that speak to social, human, and patriotic themes.",
        "Comfortable in full-orchestra stages, club settings, and intimate cultural nights.",
      ],
    },

    live: {
      title: "Live Shows & National Events",
      items: [
        {
          title: "National & Patriotic Events",
          metric: "Major stages",
          body: "Participated in large national celebrations, charitable events, and cultural evenings, including Ramadan nights, Eid concerts, and performances honoring the Egyptian army and police.",
        },
        {
          title: "Opera & Festivals",
          metric: "Cairo & beyond",
          body: "Appeared in concerts at the Egyptian Opera House and multiple festivals in Egypt and abroad, including evenings dedicated to the legacy of Umm Kulthum and other icons.",
        },
      ],
    },

    disco: {
      title: "Selected Works",
      items: [
        "“Lams Ketafak” — an influential song about willpower and overcoming hardship, honored by the producing entity for its message and impact.",
        "“Ala Baladi Albi” — a patriotic work recorded specially for Egypt and upcoming national occasions.",
        "Duets and collaborations, including “Laali El Saqat” with the artist Nannar El-Behairy and performances in Lebanon celebrating the heritage of Umm Kulthum.",
      ],
    },

    collabs: {
      title: "Collaborations",
      items: [
        "Worked with a range of Egyptian and Arab writers, composers, and arrangers.",
        "Open to new musical collaborations with producers, rappers, and DJs in Egypt, the Gulf, and internationally.",
      ],
    },

    press: {
      title: "Media Presence",
      items: [
        "Extensive coverage in major Egyptian newspapers and digital platforms, with interviews highlighting his artistic journey and social contributions.",
        "TV appearances on leading satellite channels such as MBC Masr, Egyptian TV, and other regional broadcasters.",
        "Features within reports and special episodes focusing on independent art, patriotic music, and community initiatives.",
      ],
    },

    highlights: {
      title: "Professional & Cultural Highlights",
      items: [
        "Legal name: Mohamed Abdelghafar Abd Mostafa El-Shafey Ibrahim.",
        "Official member of the Egyptian Musicians Syndicate (registration no. 1855), classified as a popular-song artist.",
        "Bachelor’s degree in Civil & Construction Engineering from the Arab Academy for Science, Technology & Maritime Transport; member of the Egyptian Engineers Syndicate.",
        "Active member of Rotary International (membership no. 12238885) and the “Mostaqbal Watan” party, participating in development and charity initiatives.",
        "Owns a private property in the United Arab Emirates and seeks to continue his artistic and community work from within the UAE.",
      ],
    },

    testimonials: {
      title: "What People Say",
      items: [
        {
          quote:
            "A charismatic Egyptian voice that carries both the nostalgia of classic tarab and the energy of today’s stages.",
          name: "Festival Director",
          title: "National Event",
        },
        {
          quote:
            "His songs deliver clear human and patriotic messages that connect with wide audiences.",
          name: "TV Producer",
          title: "Cultural Program",
        },
        {
          quote:
            "On stage, Kasteero turns each concert into a shared story between him and the crowd.",
          name: "Music Critic",
          title: "Arts Columnist",
        },
      ],
    },
  },

  ar: {
    verified: "فنان موثَّق",
    title:
      "مطرب مصري معاصر • مطرب شعبي وطربي • منتج وموزع موسيقي",
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
      "لون غنائي مصري يجمع بين الطرب الأصيل والغناء الشعبي، بتوزيعات حديثة جاهزة للمهرجانات والمنصات الرقمية.",
    hl2Title: "الاستعراض",
    hl2Body:
      "حضور لايف قوي وتفاعل مباشر مع الجمهور، ولحظات تصنع مادة غنية للتلفزيون والسوشيال ميديا.",
    hl3Title: "الجذور والانتشار",
    hl3Body:
      "من مسارح القاهرة إلى المهرجانات والفعاليات في مصر وخارجها، مع جمهور متزايد في الخليج والجاليات العربية.",

    kpis: [
      { value: "15+ سنة", label: "خبرة في الغناء العربي والموسيقى" },
      { value: "50+ حفل", label: "حفلات ومهرجانات وفعاليات رسمية" },
      { value: "10+ مدن", label: "مشاركات في مصر والمنطقة" },
      { value: "إقامة ذهبية", label: "حاصل على الإقامة الذهبية بدولة الإمارات العربية المتحدة | 2025" },
    ],

    aboutTitle: "النبذة الفنية",
    aboutBody:
      "الاسم القانوني الكامل للفنان هو «محمد عبد الغفار مصطفي إبراهيم»، والاسم الفني: «محمد كستيرو». يعد نموذجًا لفنان عربي ملتزم يمتلك خبرة تتجاوز خمسة عشر عامًا في الغناء العربي الأصيل والشعبي والتوزيع الموسيقي. انطلقت رحلته من القاهرة منذ منتصف الثمانينيات/التسعينيات عبر الحفلات والمهرجانات حتى أصبح حضورًا ثابتًا في المشهد الموسيقي المصري. تم إعداد هذا الملف خصيصًا لوزارة الثقافة في دولة الإمارات ضمن مرشحي الإقامة الذهبية لعام 2025، وتقوم شركة تأهيل بإدارة علامته التجارية الفنية وتمثيله في المنطقة.",

    style: {
      title: "ملامح الهوية الموسيقية",
      items: [
        "غناء طربي وشعبي مصري يعتمد على اللحن الواضح والأداء الإحساسي المباشر.",
        "توزيعات تجمع بين الآلات الشرقية الكلاسيكية والصوت العصري في الإيقاع والخلفية الموسيقية.",
        "أغانٍ تعبر عن قضايا اجتماعية وإنسانية ووطنية، مع قدرة على تحريك وجدان الجمهور.",
        "مرونة في فورمات اللايف: أوركسترا كاملة، فرق صغيرة، أو فورمات مناسب للمسرح والنوادي.",
      ],
    },

    live: {
      title: "الحفلات والفعاليات",
      items: [
        {
          title: "الفعاليات الوطنية والرسميّة",
          metric: "منصات كبرى",
          body: "مشاركات في حفلات وفعاليات وطنية وخيرية عديدة داخل مصر، بما في ذلك أمسيات رمضانية وحفلات العيد وأنشطة داعمة للجيش والشرطة والأسر.",
        },
        {
          title: "الأوبرا والمهرجانات",
          metric: "القاهرة وخارجها",
          body: "مشاركات في حفلات بدار الأوبرا المصرية وعدد من المهرجانات في مصر وخارجها، إلى جانب أمسيات غنائية لإحياء تراث كوكب الشرق وغيرها من الرموز.",
        },
      ],
    },

    disco: {
      title: "أعمال بارزة",
      items: [
        "أغنية «لمس كتافك» — عمل مؤثر عن الإرادة والتحدي، حاز على تكريم خاص من الجهة المنتجة تقديرًا لرسالته وتأثيره.",
        "أغنية وطنية «قلبي على بلدي» تم تسجيلها خصيصًا للتعبير عن الانتماء لمصر والاستعداد لعرضها في مناسبات وطنية.",
        "تعاونات غنائية أبرزها المشاركة مع الفنانة راندا البحيري في عمل مصوّر لاقى صدى واسعًا ومشاهدات مرتفعة.",
      ],
    },

    collabs: {
      title: "التعاونات",
      items: [
        "تعاون مع عدد من الشعراء والملحنين والموزعين في الساحة المصرية والعربية.",
        "منفتح على التعاون مع منتجين ورابرز ودي جي في مصر والخليج لتقديم ألوان معاصرة مع الحفاظ على الهوية المصرية.",
      ],
    },

    press: {
      title: "الظهور الإعلامي",
      items: [
        "تغطيات في صحف ومواقع كبرى مثل الأهرام ومصر اليوم ومجلات فنية متخصصة، ركّزت على مسيرته ورسائله الإنسانية.",
        "ظهور تلفزيوني على قنوات رائدة من بينها MBC مصر وقنوات مصرية وعربية أخرى في برامج فنية وحوارية.",
        "استضافات في مهرجانات وفعاليات فنية داخل مصر وخارجها، مع تكريمات لجهوده في دعم الفن المستقل والرسالة الوطنية.",
      ],
    },

    highlights: {
      title: "المعلومات الرسمية والمهنيّة",
      items: [
        "الاسم القانوني الكامل: محمد عبد الغفار مصطفى إبراهيم.",
        "الاسم الفني والشهرة: محمد كستيرو / عبدالغفار.",
        "عضو عامل في نقابة المهن الموسيقية المصرية (رقم القيد 1855) بتصنيف «فنان – غناء شعبي».",
        "حاصل على بكالوريوس هندسة تشييد وبناء – الأكاديمية العربية للعلوم والتكنولوجيا والنقل البحري، وعضو في نقابة المهندسين المصرية.",
        "عضو فعّال في نادي روتاري الدولي (رقم العضوية 12238885) وعضو في حزب مستقبل وطن، مع مساهمات مستمرة في مبادرات تنموية وخيرية.",
        "يمتلك مسكنًا خاصًا في دولة الإمارات العربية المتحدة، ويعمل على ربط خبرته الفنية والمجتمعية بالمشهد الثقافي الإماراتي.",
      ],
    },

    testimonials: {
      title: "قالوا عنه",
      items: [
        {
          quote:
            "صوت مصري يجمع بين أصالة الطرب وروح الجيل الجديد، ويعرف كيف يحوّل الليلة إلى حالة جماعية.",
          name: "منظّم مهرجان",
          title: "فعالية وطنية",
        },
        {
          quote:
            "أغانيه تحمل رسائل إنسانية ووطنية واضحة وتصل بسهولة إلى الجمهور.",
          name: "مُعدّ برامج",
          title: "برنامج ثقافي",
        },
        {
          quote:
            "حضوره على المسرح يشبه حوارًا مفتوحًا مع الجمهور أكثر منه حفلًا عاديًا.",
          name: "ناقد فني",
          title: "كاتب عن الفن المصري",
        },
      ],
    },
  },
};

const LINKS = {
  site: "https://www.taheel.ae",
  emailOfficial: "booking@taheel.ae", // عدّلها لو عندكم إيميل إدارة مختلف
  phone: "+971 55 000 0000", // رقم الإدارة / الحجوزات
  instagram: "https://www.instagram.com/", // حدّث لينكات السوشيال
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
        style={{
          lineHeight: "1.85",
          fontSize: "clamp(0.92rem, 1.05vw, 1.05rem)",
        }}
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
