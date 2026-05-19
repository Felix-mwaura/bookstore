"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Top-level Field — avoids focus loss on re-render ─────
function Field({ label, name, type = "text", placeholder, value, onChange, error }) {
  const [showPass, setShowPass] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-800/70 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword ? (showPass ? "text" : "password") : type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(name, e.target.value)}
          className={`w-full bg-[#1a1208] border rounded-lg px-4 py-3 text-[#e8d5a3] placeholder-[#4a3820] font-serif text-base outline-none transition-all
            ${error
              ? "border-red-800/60 ring-1 ring-red-900/30"
              : "border-[#2a1e0e] focus:border-amber-700/60 focus:ring-1 focus:ring-amber-900/30"
            }
            ${isPassword ? "pr-11" : ""}
          `}
        />
        {isPassword && (
          <button type="button" onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-900/40 hover:text-amber-600/80 transition text-lg">
            {showPass ? "🙈" : "👁"}
          </button>
        )}
      </div>
      {error && <p className="text-red-700/80 text-xs mt-1 font-serif italic">{error}</p>}
    </div>
  );
}

// ── Ambient floating particles ────────────────────────────
function Particles() {
  const containerRef = useRef(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const interval = setInterval(() => {
      const p = document.createElement("div");
      const size = 1 + Math.random() * 2;
      Object.assign(p.style, {
        position: "absolute",
        width: `${size}px`, height: `${size}px`,
        borderRadius: "50%",
        background: "#c9a84c",
        left: `${Math.random() * 100}%`,
        bottom: "0",
        opacity: "0",
        pointerEvents: "none",
        animation: `bh-float ${4 + Math.random() * 4}s linear forwards`,
      });
      container.appendChild(p);
      setTimeout(() => p.remove(), 8000);
    }, 700);
    return () => clearInterval(interval);
  }, []);
  return <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none" />;
}

// ── Celebration particles ─────────────────────────────────
function celebrate(container) {
  const emojis = ["📖", "✨", "🌟", "📚", "⭐", "🕯️"];
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const p = document.createElement("div");
      Object.assign(p.style, {
        position: "absolute",
        fontSize: `${10 + Math.random() * 16}px`,
        left: `${5 + Math.random() * 90}%`,
        bottom: "0",
        pointerEvents: "none",
        animation: `bh-float ${2 + Math.random() * 3}s ease-out forwards`,
      });
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      container.appendChild(p);
      setTimeout(() => p.remove(), 5000);
    }, i * 110);
  }
}

// ── Social Button ─────────────────────────────────────────
function SocialBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center justify-center gap-2 bg-[#1a1208] border border-[#2a1e0e] rounded-lg py-2.5 text-amber-900/60 hover:border-amber-700/50 hover:text-amber-600/80 transition text-sm font-serif">
      <span>{icon}</span> {label}
    </button>
  );
}

// ── Login Form ────────────────────────────────────────────
function LoginForm({ onSuccess }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (name, value) => {
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
  };

  const submit = () => {
    const e = {};
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Please enter a valid email";
    if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setTimeout(() => {
      const name = form.email.split("@")[0];
      localStorage.setItem("bh_user", JSON.stringify({ name, email: form.email }));
      onSuccess(name.charAt(0).toUpperCase() + name.slice(1), false);
    }, 1600);
  };

  return (
    <div className="space-y-4">
      <p className="text-center font-serif italic text-amber-900/50 text-sm mb-5">
        Welcome back, fellow reader
      </p>

      <div className="grid grid-cols-2 gap-3">
        <SocialBtn icon="🇬" label="Google" onClick={() => onSuccess("Reader", false)} />
        <SocialBtn icon="📘" label="Facebook" onClick={() => onSuccess("Reader", false)} />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#2a1e0e]" />
        <span className="font-serif italic text-xs text-amber-900/40">or with email</span>
        <div className="flex-1 h-px bg-[#2a1e0e]" />
      </div>

      <Field label="Email Address" name="email" type="email" placeholder="grace@example.com"
        value={form.email} onChange={handleChange} error={errors.email} />
      <Field label="Password" name="password" type="password" placeholder="Enter your password"
        value={form.password} onChange={handleChange} error={errors.password} />

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="accent-amber-700 w-3.5 h-3.5" />
          <span className="font-serif italic text-xs text-amber-900/50">Remember me</span>
        </label>
        <button className="font-serif italic text-xs text-amber-900/50 hover:text-amber-600/80 transition">
          Forgot password?
        </button>
      </div>

      <button onClick={submit} disabled={loading}
        className="w-full mt-2 py-3.5 rounded-lg font-cinzel text-sm font-semibold tracking-widest text-[#0f0b08] transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, #7a4f1e 0%, #c9a84c 50%, #7a4f1e 100%)", backgroundSize: "200% 100%" }}>
        {loading ? (
          <><span className="inline-block w-4 h-4 border-2 border-[#0f0b08]/30 border-t-[#0f0b08] rounded-full animate-spin" /> Opening…</>
        ) : "Open the Library"}
      </button>
    </div>
  );
}

// ── Register Form ─────────────────────────────────────────
function RegisterForm({ onSuccess }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleChange = (name, value) => {
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
  };

  const submit = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required";
    if (form.phone.replace(/\D/g, "").length < 9) e.phone = "Valid phone required";
    if (form.password.length < 8) e.password = "At least 8 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords don't match";
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem("bh_user", JSON.stringify({ name: form.firstName, email: form.email }));
      onSuccess(form.firstName, true);
    }, 1800);
  };

  return (
    <div className="space-y-3">
      <p className="text-center font-serif italic text-amber-900/50 text-sm mb-4">
        Begin your reading journey
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" name="firstName" placeholder="Grace"
          value={form.firstName} onChange={handleChange} error={errors.firstName} />
        <Field label="Last Name" name="lastName" placeholder="Wambui"
          value={form.lastName} onChange={handleChange} error={errors.lastName} />
      </div>

      <Field label="Email Address" name="email" type="email" placeholder="grace@example.com"
        value={form.email} onChange={handleChange} error={errors.email} />
      <Field label="Phone Number" name="phone" type="tel" placeholder="0712 345 678"
        value={form.phone} onChange={handleChange} error={errors.phone} />
      <Field label="Password" name="password" type="password" placeholder="At least 8 characters"
        value={form.password} onChange={handleChange} error={errors.password} />
      <Field label="Confirm Password" name="confirm" type="password" placeholder="Repeat your password"
        value={form.confirm} onChange={handleChange} error={errors.confirm} />

      <label className="flex items-start gap-2.5 cursor-pointer mt-1">
        <div onClick={() => setAgreed(!agreed)}
          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition ${agreed ? "bg-amber-700 border-amber-600" : "border-[#4a3020] hover:border-amber-800"}`}>
          {agreed && <svg className="w-2.5 h-2.5 text-[#0f0b08]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>}
        </div>
        <span className="font-serif italic text-xs text-amber-900/50 leading-relaxed">
          I agree to the <span className="text-amber-700/70 hover:text-amber-600 cursor-pointer">Terms of Service</span> and <span className="text-amber-700/70 hover:text-amber-600 cursor-pointer">Privacy Policy</span>
        </span>
      </label>

      <button onClick={submit} disabled={loading || !agreed}
        className="w-full py-3.5 rounded-lg text-sm font-semibold tracking-widest text-[#0f0b08] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, #7a4f1e 0%, #c9a84c 50%, #7a4f1e 100%)", backgroundSize: "200% 100%", fontFamily: "'Cinzel', serif" }}>
        {loading ? (
          <><span className="inline-block w-4 h-4 border-2 border-[#0f0b08]/30 border-t-[#0f0b08] rounded-full animate-spin" /> Creating account…</>
        ) : "Join the Library"}
      </button>
    </div>
  );
}

// ── Main Login Page ───────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState("login"); // "login" | "register"
  const [success, setSuccess] = useState(null); // { name, isNew }
  const celebrationRef = useRef(null);

  const handleSuccess = (name, isNew) => {
    setSuccess({ name, isNew });
    if (celebrationRef.current) celebrate(celebrationRef.current);
    setTimeout(() => router.push("/account"), 2800);
  };

  return (
    <>
      {/* Inject keyframes globally */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-fell { font-family: 'IM Fell English', serif; }
        .font-serif { font-family: 'Crimson Text', serif; }
        @keyframes bh-float {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.2; }
          100% { transform: translateY(-120px) rotate(360deg); opacity: 0; }
        }
        @keyframes bh-twinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.4); }
        }
        @keyframes bh-breathe {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-8px) rotate(-1deg); }
        }
        @keyframes bh-pop {
          0% { transform: scale(0) rotate(-10deg); }
          70% { transform: scale(1.1) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>

      <div className="min-h-screen flex items-center justify-center bg-[#050302] p-4">
        {/* Back to store */}
        <Link href="/"
          className="fixed top-6 left-6 z-50 flex items-center gap-2 text-amber-900/50 hover:text-amber-600/80 transition font-serif italic text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Store
        </Link>

        <div className="w-full max-w-4xl flex rounded-2xl overflow-hidden shadow-2xl"
          style={{ boxShadow: "0 0 80px rgba(201,168,76,0.08), 0 25px 60px rgba(0,0,0,0.8)" }}>

          {/* ── LEFT — Atmospheric panel ── */}
          <div className="hidden md:flex md:w-[42%] flex-col items-center justify-center p-10 relative overflow-hidden"
            style={{ background: "linear-gradient(160deg, #1a0f05 0%, #0d0805 50%, #1a1005 100%)", borderRight: "1px solid #2a1a08" }}>

            {/* Stars */}
            {[
              { top: "12%", left: "20%", dur: "2.1s", delay: "0s" },
              { top: "25%", left: "72%", dur: "3.4s", delay: "0.5s" },
              { top: "8%",  left: "55%", dur: "2.7s", delay: "1s"   },
              { top: "38%", left: "14%", dur: "4.1s", delay: "0.3s" },
              { top: "62%", left: "82%", dur: "2.9s", delay: "1.5s" },
              { top: "78%", left: "32%", dur: "3.7s", delay: "0.8s" },
              { top: "88%", left: "68%", dur: "2.3s", delay: "0.2s" },
              { top: "18%", left: "42%", dur: "4.5s", delay: "1.2s" },
              { top: "50%", left: "58%", dur: "3.1s", delay: "0.6s" },
            ].map((s, i) => (
              <div key={i} className="absolute rounded-full bg-[#e8d5a3]"
                style={{ width: i % 2 === 0 ? "2px" : "1px", height: i % 2 === 0 ? "2px" : "1px", top: s.top, left: s.left, animation: `bh-twinkle ${s.dur} ease-in-out ${s.delay} infinite` }} />
            ))}

            {/* Glow */}
            <div className="absolute rounded-full pointer-events-none"
              style={{ width: "200px", height: "200px", background: "#c9a84c", opacity: 0.05, filter: "blur(50px)", top: "30%", left: "50%", transform: "translate(-50%,-50%)" }} />
            <div className="absolute rounded-full pointer-events-none"
              style={{ width: "120px", height: "120px", background: "#8b3a1e", opacity: 0.08, filter: "blur(35px)", bottom: "10%", right: "5%" }} />

            <Particles />
            <div ref={celebrationRef} className="absolute inset-0 pointer-events-none overflow-hidden" />

            {/* Brand */}
            <p className="font-cinzel text-[#e8d5a3] text-2xl font-bold tracking-[0.12em] text-center mb-1 relative z-10">
              Book Haven
            </p>
            <p className="font-cinzel text-[#8a6a3a] text-[9px] tracking-[0.3em] uppercase text-center mb-8 relative z-10">
              Kenya · Est. 2018
            </p>

            {/* Animated Book SVG */}
            <div className="relative z-10" style={{ animation: "bh-breathe 4s ease-in-out infinite" }}>
              <svg width="150" height="170" viewBox="0 0 140 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="70" cy="155" rx="45" ry="5" fill="#c9a84c" opacity="0.07"/>
                <rect x="38" y="18" width="72" height="130" rx="4" fill="#2a1a08" stroke="#4a3018" strokeWidth="0.5"/>
                <rect x="36" y="16" width="68" height="128" rx="3" fill="#e8d5b0" stroke="#c9a870" strokeWidth="0.5"/>
                {[35,42,49,56,63,70,77,84].map((y,i) => (
                  <line key={i} x1="44" y1={y} x2={84 + (i%3)*8} y2={y} stroke="#c9a870" strokeWidth="0.4" opacity="0.35"/>
                ))}
                <rect x="22" y="12" width="72" height="130" rx="4" fill="#5a2e0a" stroke="#c9a84c" strokeWidth="0.8"/>
                <rect x="28" y="18" width="60" height="118" rx="2" fill="none" stroke="#c9a84c" strokeWidth="0.5" opacity="0.45"/>
                <text x="52" y="75" fontSize="22" fill="#c9a84c" opacity="0.8">📚</text>
                <rect x="32" y="90" width="52" height="3" rx="1.5" fill="#c9a84c" opacity="0.5"/>
                <rect x="38" y="97" width="40" height="2" rx="1" fill="#c9a84c" opacity="0.3"/>
                <rect x="42" y="103" width="32" height="2" rx="1" fill="#c9a84c" opacity="0.2"/>
                <rect x="22" y="12" width="8" height="130" rx="4" fill="#3a1e06" stroke="#c9a84c" strokeWidth="0.5"/>
                <path d="M22 12 L30 12 L30 20" stroke="#c9a84c" strokeWidth="1" fill="none" opacity="0.7"/>
                <path d="M94 12 L86 12 L86 20" stroke="#c9a84c" strokeWidth="1" fill="none" opacity="0.7"/>
                <path d="M22 142 L30 142 L30 134" stroke="#c9a84c" strokeWidth="1" fill="none" opacity="0.7"/>
                <path d="M94 142 L86 142 L86 134" stroke="#c9a84c" strokeWidth="1" fill="none" opacity="0.7"/>
              </svg>
            </div>

            <p className="font-fell italic text-amber-700/60 text-[13px] text-center mt-6 leading-relaxed relative z-10">
              "A reader lives a thousand lives<br/>before he dies."<br/>
              <span className="text-[11px] opacity-60">— George R.R. Martin</span>
            </p>
          </div>

          {/* ── RIGHT — Form panel ── */}
          <div className="flex-1 bg-[#0f0b08] flex flex-col justify-center p-8 relative overflow-hidden">

            {/* Ambient glow */}
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-900/5 blur-3xl pointer-events-none" />

            {/* Success state */}
            {success ? (
              <div className="text-center py-8" style={{ animation: "bh-pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards" }}>
                <div className="text-6xl mb-5">✨</div>
                <h2 className="font-cinzel text-[#e8d5a3] text-2xl mb-2">
                  {success.isNew ? `Welcome, ${success.name}!` : `Welcome back, ${success.name}!`}
                </h2>
                <p className="font-fell italic text-amber-900/60 text-base">
                  {success.isNew ? "Your account has been created. The library awaits..." : "The library awaits your return..."}
                </p>
                <p className="font-serif text-amber-900/40 text-sm mt-4">Redirecting to your account...</p>
              </div>
            ) : (
              <>
                {/* Tab switcher */}
                <div className="relative flex bg-[#1a1208] border border-[#2a1e0e] rounded-lg p-0.5 mb-7">
                  <div className="absolute top-0.5 left-0.5 h-[calc(100%-4px)] w-[calc(50%-2px)] rounded-md transition-transform duration-300 ease-in-out"
                    style={{ background: "linear-gradient(135deg, #7a4f1e, #c9a84c)", transform: tab === "register" ? "translateX(100%)" : "translateX(0)" }} />
                  {["login", "register"].map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`flex-1 py-2.5 text-xs tracking-[0.15em] uppercase relative z-10 transition-colors duration-300 rounded-md ${tab === t ? "text-[#0f0b08] font-bold" : "text-amber-900/50 hover:text-amber-800/70"}`}
                      style={{ fontFamily: "'Cinzel', serif" }}>
                      {t === "login" ? "Sign In" : "Create Account"}
                    </button>
                  ))}
                </div>

                {/* Form panels */}
                <div className="relative">
                  <div className={`transition-all duration-300 ${tab === "login" ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 absolute inset-0 pointer-events-none"}`}>
                    <LoginForm onSuccess={handleSuccess} />
                  </div>
                  <div className={`transition-all duration-300 ${tab === "register" ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 absolute inset-0 pointer-events-none"}`}>
                    <RegisterForm onSuccess={handleSuccess} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}