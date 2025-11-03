"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mona Basal • CEO – VIP page
 * - Animated neon background (Taheel deep blue + deep green)
 * - Subtle particles + flowing gradient ribbons
 * - Logo glow, CEO header, and action buttons
 * - Respects prefers-reduced-motion
 */
export default function MonaBasal() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [motionOK, setMotionOK] = useState(true);

  useEffect(() => {
    // Respect reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionOK(!mq.matches);
    const off = () => mq.removeEventListener?.("change", onChange);
    function onChange(e) {
      setMotionOK(!e.matches);
    }
    mq.addEventListener?.("change", onChange);
    return off;
  }, []);

  useEffect(() => {
    if (!motionOK) return; // static fallback if user prefers reduced motion

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    // Colors (Taheel palette)
    const C1 = "#0a1a2b"; // deep navy
    const C2 = "#0b1220"; // deep blue
    const NEON_G = "rgba(35,218,198,0.9)"; // neon green-ish
    const NEON_B = "rgba(83,166,247,0.9)"; // neon blue

    // Particles
    const COUNT = Math.min(80, Math.floor((w * h) / 35000)); // scale by screen
    const P = new Array(COUNT).fill(0).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
    }));

    // Ribbon gradient phase
    let t = 0;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);

    function drawBackground() {
      // Soft vertical gradient base
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, C2);
      g.addColorStop(1, C1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    function drawRibbons() {
      // Two flowing radial ribbons that orbit slowly across the canvas
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
    }

    function drawParticles() {
      ctx.shadowBlur = 12;
      for (let i = 0; i < COUNT; i++) {
        const p = P[i];
        p.x += p.vx;
        p.y += p.vy;

        // gentle wrap
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;

        // alternate glow
        const mix = (Math.sin((t * 0.002) + i) + 1) / 2;
        ctx.fillStyle = mix > 0.5 ? NEON_G : NEON_B;
        ctx.shadowColor = ctx.fillStyle;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    function tick(now) {
      t = now || t + 16;
      drawBackground();
      drawRibbons();
      drawParticles();
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [motionOK]);

  return (
    <main className="relative min-h-screen text-white selection:bg-emerald-500/30 selection:text-white">
      {/* Animated background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10"
        style={{ filter: "saturate(1.1) brightness(1.05)" }}
      />

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
          <span className="rounded-full border border-white/20 bg-black/20 px-4 py-1.5 text-sm font-semibold tracking-wide">
            VIP • Verified
          </span>
        </div>

        {/* Hero Card */}
        <div className="mt-10 md:mt-14 relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-white/5 backdrop-blur-md">
          {/* glow edges */}
          <div className="pointer-events-none absolute -inset-px rounded-3xl"
               style={{
                 boxShadow:
                   "0 0 0 1px rgba(35,218,198,0.25), 0 20px 60px rgba(35,218,198,0.08), 0 30px 80px rgba(83,166,247,0.10)",
               }}
          />
          <div className="p-6 md:p-10">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              <div className="relative">
                <div className="h-28 w-28 md:h-32 md:w-32 rounded-2xl bg-gradient-to-br from-emerald-400/30 to-sky-400/30 border border-white/20 backdrop-blur-sm grid place-items-center">
                  <span className="text-3xl md:text-4xl font-black">MB</span>
                </div>
                <span className="absolute -bottom-2 -right-2 rounded-full bg-emerald-400/90 text-black text-xs font-extrabold px-2 py-0.5 shadow">
                  CEO
                </span>
              </div>

              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-black leading-tight drop-shadow-[0_0_16px_rgba(83,166,247,.35)]">
                  Mona Basal
                </h1>
                <p className="mt-2 text-emerald-200/90 font-semibold">
                  Chief Executive Officer • TAHEEL
                </p>
              </div>

              <div className="flex-1" />

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
                <a
                  href="mailto:ceo@taheel.ae"
                  className="group inline-flex items-center gap-2 rounded-xl border-2 border-emerald-400/60 bg-black/20 px-4 py-2 font-bold hover:bg-emerald-400/10 transition"
                >
                  <Dot className="text-emerald-300 group-hover:scale-125" />
                  Email
                </a>
                <a
                  href="https://www.linkedin.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-2 rounded-xl border-2 border-sky-400/60 bg-black/20 px-4 py-2 font-bold hover:bg-sky-400/10 transition"
                >
                  <Dot className="text-sky-300 group-hover:scale-125" />
                  LinkedIn
                </a>
                <a
                  href="/files/mona-basal.vcf"
                  className="group inline-flex items-center gap-2 rounded-xl border-2 border-white/25 bg-white/10 px-4 py-2 font-bold hover:bg-white/20 transition"
                >
                  <Dot className="text-white/80 group-hover:scale-125" />
                  Save Contact
                </a>
              </div>
            </div>

            {/* Highlights */}
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <BadgeCard title="Vision">
                Driving seamless, secure e-gov services with AI-first execution.
              </BadgeCard>
              <BadgeCard title="Focus">
                Scale, reliability, and world-class client experience.
              </BadgeCard>
              <BadgeCard title="Regions">
                UAE • GCC • Global partners
              </BadgeCard>
            </div>
          </div>
        </div>

        {/* Bio / Links */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-2xl border border-white/15 bg-white/[.06] p-6 backdrop-blur">
            <h2 className="text-xl font-extrabold text-emerald-300 mb-3">
              About
            </h2>
            <p className="leading-8 text-emerald-50/90">
              Mona Basal leads TAHEEL with a mission to build a trusted,
              automated bridge between residents, businesses, and government
              services. Under her leadership, the platform blends design,
              compliance, and intelligent automation to deliver results at
              enterprise scale.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-400/30 bg-white/[.06] p-6 backdrop-blur">
            <h2 className="text-xl font-extrabold text-emerald-300 mb-3">
              Media
            </h2>
            <div className="space-y-3">
              <a
                className="block rounded-lg border border-emerald-400/40 px-4 py-3 font-bold hover:bg-emerald-400/10 transition"
                href="https://youtu.be/..."
                target="_blank"
                rel="noreferrer"
              >
                Interview – Strategy & AI
              </a>
              <a
                className="block rounded-lg border border-sky-400/40 px-4 py-3 font-bold hover:bg-sky-400/10 transition"
                href="https://open.spotify.com/..."
                target="_blank"
                rel="noreferrer"
              >
                Podcast – Growth & Ops
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 py-6 text-center text-sm text-emerald-200/70">
          Powered by <span className="font-extrabold text-emerald-300">TAHEEL • GISAI</span>
        </div>
      </section>

      {/* extra glow behind content */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(40% 30% at 70% 20%, rgba(35,218,198,.08), transparent 60%)",
          mixBlendMode: "screen",
        }}
      />
    </main>
  );
}

/* ---------- Tiny helper components ---------- */
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
      <div className="mb-2 text-[13px] font-black tracking-wider text-emerald-300/90">
        {title}
      </div>
      <div className="text-emerald-50/85 leading-7">{children}</div>
    </div>
  );
}
