"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* ── Floating Embers / Magic Dust ── */
function EmberCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const embers = Array.from({ length: 80 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: -Math.random() * 0.7 - 0.2,
      alpha: Math.random() * 0.7 + 0.3,
      color: ["#fbbf24", "#f59e0b", "#d97706", "#92400e", "#fef3c7"][Math.floor(Math.random() * 5)],
      pulse: Math.random() * 0.015 + 0.005,
      offset: Math.random() * Math.PI * 2,
    }));

    let animId;
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      const now = Date.now();
      embers.forEach((p) => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        const flicker = 0.5 + 0.5 * Math.sin(now * p.pulse + p.offset);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * flicker;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(loop);
    };
    loop();
    const onResize = () => { w = window.innerWidth; h = window.innerHeight; canvas.width = w; canvas.height = h; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-10" />;
}

/* ── Flickering Candle Flame ── */
function CandleFlame() {
  return (
    <div className="relative w-3 h-8">
      <div className="absolute inset-0 bg-amber-400 rounded-full blur-sm animate-pulse" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-6 bg-gradient-to-t from-amber-600 via-amber-400 to-yellow-200 rounded-full animate-[flicker_2s_ease-in-out_infinite]" />
      <div className="absolute -inset-2 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
    </div>
  );
}

/* ── Ornate Input ── */
function ArcaneInput({ label, type = "text", value, onChange, error, icon, showToggle, onToggle, showPassword }) {
  const [focus, setFocus] = useState(false);
  const hasVal = value.length > 0;

  return (
    <div className="relative group">
      <div className={`absolute -inset-0.5 bg-gradient-to-r from-amber-700/30 via-amber-500/50 to-amber-700/30 rounded-xl opacity-0 group-hover:opacity-100 transition duration-500 ${focus ? "opacity-100" : ""}`} />
      <div className="relative bg-[#0a0e1a]/90 border border-amber-900/40 rounded-xl overflow-hidden">
        <div className="flex items-center px-4 py-3.5">
          <span className="text-amber-600/70 text-lg mr-3 select-none">{icon}</span>
          <div className="flex-1 relative">
            <label className={`absolute left-0 transition-all duration-300 pointer-events-none ${focus || hasVal ? "top-0 text-[10px] text-amber-500/80 uppercase tracking-wider font-bold" : "top-1.5 text-sm text-amber-200/40"}`}>
              {label}
            </label>
            <input
              type={showToggle ? (showPassword ? "text" : "password") : type}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              className="w-full bg-transparent text-amber-100 text-sm outline-none pt-3 pb-0 placeholder:text-transparent"
            />
          </div>
          {showToggle && (
            <button type="button" onClick={onToggle} className="text-amber-700/50 hover:text-amber-500/70 transition ml-2">
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-red-400/80 text-xs mt-1.5 ml-1">{error}</p>}
    </div>
  );
}

/* ── Social Login Orb ── */
function SocialOrb({ icon, label }) {
  return (
    <button className="w-12 h-12 rounded-full border border-amber-800/40 bg-[#0a0e1a]/60 hover:bg-amber-900/20 hover:border-amber-600/50 transition-all duration-300 flex items-center justify-center text-amber-200/70 hover:text-amber-100 group relative">
      <span className="text-lg">{icon}</span>
      <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

/* ── Login Face ── */
function LoginFace({ form, errors, update, loading, submit, onFlip, showPassword, setShowPassword }) {
  return (
    <div className="relative bg-[#0d1220]/90 backdrop-blur-sm rounded-2xl p-8 md:p-10 border border-amber-900/20 animate-glow overflow-hidden h-full">
      {/* Inner ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />

      {/* Crest */}
      <div className="relative flex justify-center mb-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-700/20 to-amber-900/40 border-2 border-amber-600/40 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.15)]">
          <span className="text-amber-300 font-serif font-black text-2xl">H</span>
        </div>
        <div className="absolute -bottom-1 w-20 h-4 bg-amber-500/10 blur-xl rounded-full" />
      </div>

      {/* Title */}
      <div className="text-center mb-7">
        <h1 className="text-3xl md:text-4xl font-black text-amber-100 font-serif tracking-wide">WELCOME</h1>
        <p className="text-amber-400/60 text-sm mt-1 font-medium tracking-wider">to The Midnight Library</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-700/50" />
          <span className="text-[10px] text-amber-500/60 uppercase tracking-[0.2em]">✦ Sign in to continue ✦</span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-700/50" />
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4 relative z-10">
        <ArcaneInput label="Email or Username" type="email" icon="✉" value={form.email} onChange={v => update("email", v)} error={errors.email} />
        <ArcaneInput label="Password" type="password" icon="⚷" value={form.password} onChange={v => update("password", v)} error={errors.password} showToggle onToggle={() => setShowPassword(p => !p)} showPassword={showPassword} />

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <div onClick={() => update("remember", !form.remember)} className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-300 ${form.remember ? "bg-amber-700 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" : "border-amber-800/40 group-hover:border-amber-700/60"}`}>
              {form.remember && <svg className="w-3 h-3 text-amber-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="text-xs text-amber-200/50 group-hover:text-amber-200/70 transition">Remember me</span>
          </label>
          <button type="button" className="text-xs text-amber-500/70 hover:text-amber-400 transition">Forgot Password?</button>
        </div>

        <button type="button" onClick={(e) => submit(e)} disabled={loading} className="relative w-full mt-2 group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-700 via-amber-500 to-amber-700 rounded-xl opacity-60 group-hover:opacity-100 transition duration-500 blur-sm" />
          <div className="relative bg-gradient-to-b from-[#1a1508] to-[#0d0a04] border border-amber-600/40 hover:border-amber-500/60 text-amber-100 py-3.5 rounded-xl font-bold text-sm tracking-[0.15em] uppercase transition-all duration-300 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(180,83,9,0.2)]">
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span className="font-serif italic normal-case tracking-normal">Casting spell...</span></>
            ) : (
              <><span className="text-amber-400/60">✦</span>Sign In<span className="text-amber-400/60">✦</span></>
            )}
          </div>
        </button>
      </div>

      <div className="flex items-center gap-4 my-5">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-800/40 to-transparent" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-amber-600/50 font-bold">or continue with</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-800/40 to-transparent" />
      </div>

      <div className="flex justify-center gap-4">
        <SocialOrb label="Google" icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>} />
        <SocialOrb label="Apple" icon="" />
        <SocialOrb label="Facebook" icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>} />
      </div>

      <div className="mt-5 text-center">
        <p className="text-sm text-amber-200/40">
          New to our library?{" "}
          <button onClick={onFlip} className="text-amber-400 hover:text-amber-300 font-semibold transition underline decoration-amber-800/50 underline-offset-4 hover:decoration-amber-500/70">
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}

/* ── Register Face ── */
function RegisterFace({ form, errors, update, loading, submit, onFlip, showPassword, setShowPassword }) {
  return (
    <div className="relative bg-[#0d1220]/90 backdrop-blur-sm rounded-2xl p-8 md:p-10 border border-amber-900/20 animate-glow overflow-hidden h-full">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />

      {/* Crest */}
      <div className="relative flex justify-center mb-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-700/20 to-amber-900/40 border-2 border-amber-600/40 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.15)]">
          <span className="text-amber-300 font-serif font-black text-2xl">H</span>
        </div>
        <div className="absolute -bottom-1 w-20 h-4 bg-amber-500/10 blur-xl rounded-full" />
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-black text-amber-100 font-serif tracking-wide">JOIN US</h1>
        <p className="text-amber-400/60 text-sm mt-1 font-medium tracking-wider">to The Midnight Library</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-700/50" />
          <span className="text-[10px] text-amber-500/60 uppercase tracking-[0.2em]">✦ Begin your magical journey ✦</span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-700/50" />
        </div>
      </div>

      {/* Form */}
      <div className="space-y-3.5 relative z-10">
        <ArcaneInput label="Full Name" icon="✦" value={form.name} onChange={v => update("name", v)} error={errors.name} />
        <ArcaneInput label="Email Address" type="email" icon="✉" value={form.email} onChange={v => update("email", v)} error={errors.email} />
        <ArcaneInput label="Password" type="password" icon="⚷" value={form.password} onChange={v => update("password", v)} error={errors.password} showToggle onToggle={() => setShowPassword(p => !p)} showPassword={showPassword} />
        <ArcaneInput label="Confirm Password" type="password" icon="⚷" value={form.confirm} onChange={v => update("confirm", v)} error={errors.confirm} />

        <button type="button" onClick={(e) => submit(e)} disabled={loading} className="relative w-full mt-2 group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-700 via-amber-500 to-amber-700 rounded-xl opacity-60 group-hover:opacity-100 transition duration-500 blur-sm" />
          <div className="relative bg-gradient-to-b from-[#1a1508] to-[#0d0a04] border border-amber-600/40 hover:border-amber-500/60 text-amber-100 py-3.5 rounded-xl font-bold text-sm tracking-[0.15em] uppercase transition-all duration-300 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(180,83,9,0.2)]">
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span className="font-serif italic normal-case tracking-normal">Enchanting...</span></>
            ) : (
              <><span className="text-amber-400/60">✦</span>Create Account<span className="text-amber-400/60">✦</span></>
            )}
          </div>
        </button>
      </div>

      <div className="mt-5 text-center">
        <p className="text-sm text-amber-200/40">
          Already have an account?{" "}
          <button onClick={onFlip} className="text-amber-400 hover:text-amber-300 font-semibold transition underline decoration-amber-800/50 underline-offset-4 hover:decoration-amber-500/70">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

/* ── Main Auth Page ── */
export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [flipping, setFlipping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", remember: false });
  const [errors, setErrors] = useState({});

  const update = useCallback((key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: "" }));
  }, []);

  const validate = useCallback(() => {
    const e = {};
    if (mode === "register" && !form.name.trim()) e.name = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (form.password.length < 6) e.password = "Min 6 characters";
    if (mode === "register" && form.password !== form.confirm) e.confirm = "Does not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [mode, form]);

  const submit = useCallback((ev) => {
    ev.preventDefault?.();
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); router.push("/"); }, 2000);
  }, [validate, router]);

  const handleFlip = () => {
    if (flipping) return;
    setFlipping(true);
    // Halfway through flip, switch mode
    setTimeout(() => {
      setMode(m => m === "login" ? "register" : "login");
      setForm({ name: "", email: "", password: "", confirm: "", remember: false });
      setErrors({});
      setShowPassword(false);
    }, 350);
    setTimeout(() => setFlipping(false), 700);
  };

  return (
    <main className="min-h-screen relative overflow-hidden bg-[#020408] text-amber-50 selection:bg-amber-900/50 selection:text-amber-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');

        * { font-family: 'Crimson Text', serif; }
        .font-display { font-family: 'Cinzel', serif; }

        @keyframes flicker {
          0%, 100% { opacity: 1; transform: scaleY(1); }
          33% { opacity: 0.8; transform: scaleY(0.95); }
          66% { opacity: 0.9; transform: scaleY(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(251,191,36,0.08), inset 0 0 20px rgba(251,191,36,0.03); }
          50% { box-shadow: 0 0 50px rgba(251,191,36,0.18), inset 0 0 35px rgba(251,191,36,0.08); }
        }
        @keyframes borderGlow {
          0%, 100% { border-color: rgba(180,83,9,0.3); box-shadow: 0 0 15px rgba(180,83,9,0.1); }
          50% { border-color: rgba(251,191,36,0.5); box-shadow: 0 0 30px rgba(251,191,36,0.2); }
        }
        @keyframes cinematic-reveal {
          from { opacity: 0; transform: scale(1.08); filter: brightness(0) blur(8px); }
          to { opacity: 1; transform: scale(1); filter: brightness(0.38) saturate(0.7); }
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(32px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes vignette-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 0.85; }
        }

        /* FLIP */
        .flip-container { perspective: 1200px; }
        .flip-card {
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.7s cubic-bezier(0.77, 0, 0.18, 1);
        }
        .flip-card.flipped { transform: rotateY(180deg); }
        .flip-card-front,
        .flip-card-back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .flip-card-back {
          position: absolute;
          inset: 0;
          transform: rotateY(180deg);
        }

        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-glow { animation: glow 4s ease-in-out infinite; }
        .animate-border-glow { animation: borderGlow 3s ease-in-out infinite; }
        .bg-cinematic { animation: cinematic-reveal 2.5s ease-out forwards; }
        .card-entrance { animation: card-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.4s both; }
      `}</style>

      {/* ── Cinematic Background ── */}
      <div className="fixed inset-0 z-0">
        {/* Main castle / dark library image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-cinematic"
          style={{
            backgroundImage: `url("https://www.pinterest.com/pin/361836151328597127/")`,
            filter: "brightness(0.38) saturate(0.7) contrast(1.1)",
          }}
        />
        {/* Warm candlelight overlay on right side */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_80%_60%,rgba(120,50,5,0.35),transparent)]" />
        {/* Deep dark vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,transparent_30%,rgba(2,4,8,0.75)_100%)]" style={{ animation: "vignette-pulse 8s ease-in-out infinite" }} />
        {/* Top + bottom dark gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020408] via-transparent to-[#020408]/70" />
        {/* Center glow — where the card sits */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_50%_at_50%_50%,rgba(251,191,36,0.06),transparent_70%)]" />
      </div>

      {/* Moon atmospheric glow */}
      <div className="fixed top-8 left-16 w-48 h-48 bg-blue-100/6 rounded-full blur-[80px] z-0" />
      <div className="fixed top-6 left-14 w-28 h-28 bg-white/5 rounded-full blur-3xl z-0" />

      {/* Ember particles */}
      <EmberCanvas />

      {/* Back link */}
      <Link href="/" className="fixed top-6 left-6 z-50 flex items-center gap-2 text-amber-200/40 hover:text-amber-300 transition group text-sm font-medium">
        <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
        Back to Book Haven
      </Link>

      {/* Floating candles left */}
      <div className="fixed left-8 top-1/4 z-20 hidden lg:flex flex-col items-center gap-10 animate-float">
        <div className="relative">
          <div className="w-1 h-24 bg-gradient-to-b from-amber-900/60 to-transparent" />
          <div className="absolute -top-2 left-1/2 -translate-x-1/2"><CandleFlame /></div>
        </div>
        <div className="relative" style={{ animationDelay: "1.2s" }}>
          <div className="w-1 h-16 bg-gradient-to-b from-amber-900/60 to-transparent" />
          <div className="absolute -top-2 left-1/2 -translate-x-1/2"><CandleFlame /></div>
        </div>
      </div>

      {/* Floating candles right */}
      <div className="fixed right-10 top-1/3 z-20 hidden lg:flex flex-col items-center gap-12 animate-float" style={{ animationDelay: "0.8s" }}>
        <div className="relative">
          <div className="w-1 h-20 bg-gradient-to-b from-amber-900/60 to-transparent" />
          <div className="absolute -top-2 left-1/2 -translate-x-1/2"><CandleFlame /></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-30 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="card-entrance w-full max-w-[440px]">

          {/* Outer decorative glow border */}
          <div className="absolute -inset-4 bg-gradient-to-b from-amber-800/15 via-amber-900/8 to-amber-800/15 rounded-3xl animate-border-glow blur-sm" />

          {/* Corner ornaments */}
          <div className="absolute -top-2 -left-2 w-7 h-7 border-t-2 border-l-2 border-amber-600/60 rounded-tl-xl z-10" />
          <div className="absolute -top-2 -right-2 w-7 h-7 border-t-2 border-r-2 border-amber-600/60 rounded-tr-xl z-10" />
          <div className="absolute -bottom-2 -left-2 w-7 h-7 border-b-2 border-l-2 border-amber-600/60 rounded-bl-xl z-10" />
          <div className="absolute -bottom-2 -right-2 w-7 h-7 border-b-2 border-r-2 border-amber-600/60 rounded-br-xl z-10" />

          {/* ── FLIP CARD ── */}
          <div className="flip-container relative">
            <div className={`flip-card w-full ${mode === "register" ? "flipped" : ""}`} style={{ minHeight: "580px" }}>

              {/* FRONT — Login */}
              <div className="flip-card-front w-full">
                <LoginFace
                  form={form}
                  errors={errors}
                  update={update}
                  loading={loading}
                  submit={submit}
                  onFlip={handleFlip}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                />
              </div>

              {/* BACK — Register */}
              <div className="flip-card-back w-full">
                <RegisterFace
                  form={form}
                  errors={errors}
                  update={update}
                  loading={loading}
                  submit={submit}
                  onFlip={handleFlip}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                />
              </div>
            </div>
          </div>

          {/* Bottom dots */}
          <div className="flex justify-center mt-4 gap-1.5">
            <div className="w-1 h-1 rounded-full bg-amber-700/40" />
            <div className={`h-1.5 rounded-full bg-amber-600/60 transition-all duration-500 ${mode === "login" ? "w-4" : "w-1.5"}`} />
            <div className={`h-1.5 rounded-full bg-amber-600/60 transition-all duration-500 ${mode === "register" ? "w-4" : "w-1.5"}`} />
            <div className="w-1 h-1 rounded-full bg-amber-700/40" />
          </div>
        </div>
      </div>

      {/* Owl companion */}
      <div className="fixed bottom-8 right-8 z-20 hidden xl:block animate-float" style={{ animationDelay: "2s" }}>
        <div className="relative">
          <div className="w-20 h-24 bg-gradient-to-b from-stone-300 to-stone-500 rounded-t-full rounded-b-3xl shadow-2xl relative">
            <div className="absolute top-4 left-2 w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center border-2 border-stone-600">
              <div className="w-3 h-3 bg-amber-800 rounded-full" />
            </div>
            <div className="absolute top-4 right-2 w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center border-2 border-stone-600">
              <div className="w-3 h-3 bg-amber-800 rounded-full" />
            </div>
            <div className="absolute top-9 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-amber-700" />
            <div className="absolute top-10 -left-3 w-6 h-10 bg-stone-400 rounded-full rotate-12" />
            <div className="absolute top-10 -right-3 w-6 h-10 bg-stone-400 rounded-full -rotate-12" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-16 h-3 bg-[#3d2817] rounded-sm border border-amber-900/30" />
            <div className="w-14 h-3 bg-[#2d1f14] rounded-sm border border-amber-900/30 -mt-0.5" />
          </div>
        </div>
      </div>

      {/* Feather quill */}
      <div className="fixed bottom-12 left-12 z-20 hidden xl:block rotate-45 opacity-30">
        <div className="w-1 h-24 bg-gradient-to-t from-amber-800 to-amber-500 rounded-full" />
        <div className="w-4 h-6 bg-amber-600 rounded-full -mt-1 -ml-1.5" />
      </div>

      {/* Trust seal */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 text-[10px] text-amber-700/40 uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600/60 animate-pulse" />
        Secured by ancient encryption
      </div>
    </main>
  );
}