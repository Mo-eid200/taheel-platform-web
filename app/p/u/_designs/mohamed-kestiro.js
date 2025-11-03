"use client";
import { useEffect, useRef, useState } from "react";

export default function MohamedKestiro() {
  const audioRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = 0.4; el.loop = true; el.muted = true;
    const tryPlay = async () => { try { await el.play(); setPlaying(true); } catch {} };
    tryPlay();
    const unlock = () => { if (!audioRef.current) return; audioRef.current.muted = false; setMuted(false); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <main className="min-h-screen text-white"
      style={{ background: "radial-gradient(60% 60% at 50% 10%, rgba(0,255,209,0.12), transparent 60%), #0b1220" }}>
      <section className="max-w-5xl mx-auto px-4 py-10">
        <div className="relative rounded-2xl overflow-hidden border border-emerald-600/40">
          <img src="/images/kestiro-hero.jpg" alt="" className="w-full h-[320px] md:h-[440px] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-transparent to-transparent" />
          <div className="absolute bottom-5 left-0 right-0 text-center">
            <h1 className="text-3xl md:text-5xl font-extrabold drop-shadow">Mohamed Kestiro</h1>
            <p className="text-emerald-200/85 mt-1">Official VIP Page</p>
          </div>
        </div>

        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl backdrop-blur bg-black/30 border border-white/10 px-3 py-2">
          <audio ref={audioRef} src="/audio/kestiro.mp3" preload="auto" playsInline />
          <button onClick={() => { const el = audioRef.current; if (!el) return; if (playing){ el.pause(); setPlaying(false);} else { el.play(); setPlaying(true);} }}
            className="text-white/90 text-sm font-bold px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10">
            {playing ? "Pause" : "Play"}
          </button>
          <button onClick={() => { const el = audioRef.current; if (!el) return; el.muted = !el.muted; setMuted(el.muted); }}
            className="text-white/90 text-sm font-bold px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10">
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl p-6 border border-emerald-600/30 bg-white/5 backdrop-blur">
            <h2 className="text-xl font-extrabold mb-2 text-emerald-300">About</h2>
            <p className="text-emerald-100/85 leading-8">Singer • Performer • Events. For bookings & collaborations:</p>
            <div className="mt-4 space-y-2">
              <a href="mailto:booking@kestiro.com" className="text-emerald-400 underline font-bold">booking@kestiro.com</a><br />
              <a href="https://instagram.com/..." target="_blank" className="text-emerald-400 underline font-bold">Instagram</a>
            </div>
          </div>
          <div className="rounded-2xl p-6 border border-emerald-600/30 bg-white/5 backdrop-blur">
            <h2 className="text-xl font-extrabold mb-2 text-emerald-300">Featured</h2>
            <div className="grid gap-3">
              <a className="rounded-xl px-5 py-4 font-bold border border-emerald-600/40 hover:bg-emerald-600/10 transition" target="_blank" href="https://youtu.be/...">Music Video</a>
              <a className="rounded-xl px-5 py-4 font-bold border border-emerald-600/40 hover:bg-emerald-600/10 transition" target="_blank" href="https://open.spotify.com/...">Spotify</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
