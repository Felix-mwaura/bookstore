"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp, useAuth, getUserName } from "../lib/auth";

function Field({ label, name, type = "text", placeholder, value, onChange, error }) {
  const [showPass, setShowPass] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37]/70 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={isPassword ? (showPass ? "text" : "password") : type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(name, e.target.value)}
          className={`w-full bg-[#0b1120] border rounded-lg px-4 py-3 text-[#f4e8c1] placeholder-[#475569] text-base outline-none transition-all
            ${error ? "border-red-900/60 ring-1 ring-red-900/40" : "border-[#1e293b] focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/30"}
            ${isPassword ? "pr-11" : ""}`}
        />
        {isPassword && (
          <button type="button" onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#d4af37]/40 hover:text-[#d4af37]/80 transition text-lg">
            {showPass ? "🙈" : "👁"}
          </button>
        )}
      </div>
      {error && <p className="text-red-500/80 text-xs mt-1 italic">{error}</p>}
    </div>
  );
}

function GreatHallParticles() {
  const ref = useRef(null);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const interval = setInterval(() => {
      const p = document.createElement("div");
      const isCandle = Math.random() > 0.6;
      
      Object.assign(p.style, {
        position: "absolute", 
        left: `${Math.random() * 100}%`, 
        bottom: "-20px", 
        opacity: "0",
        pointerEvents: "none", 
        fontSize: isCandle ? `${12 + Math.random() * 10}px` : `${4 + Math.random() * 8}px`,
        animation: `bh-float ${6 + Math.random() * 6}s ease-in forwards`,
        filter: "drop-shadow(0 0 8px rgba(212, 175, 55, 0.8))"
      });
      
      p.textContent = isCandle ? "🕯️" : "✨";
      container.appendChild(p);
      setTimeout(() => p.remove(), 12000);
    }, 600);
    return () => clearInterval(interval);
  }, []);
  return <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none z-0" />;
}

function celebrate(container) {
  const emojis = ["⚡", "✨", "🦉", "📜", "🔮", "🧹"];
  for (let i = 0; i < 25; i++) {
    setTimeout(() => {
      const p = document.createElement("div");
      Object.assign(p.style, {
        position: "absolute", fontSize: `${14 + Math.random() * 20}px`,
        left: `${5 + Math.random() * 90}%`, bottom: "0",
        pointerEvents: "none", animation: `bh-float ${2 + Math.random() * 3}s ease-out forwards`,
      });
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      container.appendChild(p);
      setTimeout(() => p.remove(), 5000);
    }, i * 90);
  }
}

function LoginForm({ onSuccess, onError }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (name, value) => { setForm((p) => ({ ...p, [name]: value })); setErrors((p) => ({ ...p, [name]: "" })); };

  const submit = async () => {
    const e = {};
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid owl address required";
    if (form.password.length < 6) e.password = "At least 6 characters";
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    const { data, error } = await signIn({ email: form.email, password: form.password });
    setLoading(false);
    if (error) { onError(error.message); return; }
    onSuccess(getUserName(data.user), false);
  };

  return (
    <div className="space-y-4">
      <p className="text-center italic text-[#d4af37]/50 text-sm mb-5">Welcome back, witch or wizard.</p>
      <Field label="Owl Address (Email)" name="email" type="email" placeholder="hermione@hogwarts.edu" value={form.email} onChange={handleChange} error={errors.email} />
      <Field label="Secret Password" name="password" type="password" placeholder="Enter your password" value={form.password} onChange={handleChange} error={errors.password} />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="accent-[#740001] w-3.5 h-3.5" />
          <span className="italic text-xs text-[#d4af37]/50">Remember me</span>
        </label>
        <button className="italic text-xs text-[#d4af37]/50 hover:text-[#d4af37] transition">Forgot password?</button>
      </div>
      <button onClick={submit} disabled={loading}
        className="w-full mt-2 py-3.5 rounded-lg text-sm font-semibold tracking-widest text-[#f4e8c1] transition-all hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 border border-[#d4af37]/30"
        style={{ background: "linear-gradient(135deg, #740001 0%, #5c0001 50%, #740001 100%)", fontFamily: "'Cinzel', serif" }}>
        {loading ? <><span className="inline-block w-4 h-4 border-2 border-[#f4e8c1]/30 border-t-[#f4e8c1] rounded-full animate-spin" /> Casting…</> : "Alohomora"}
      </button>
    </div>
  );
}

function RegisterForm({ onSuccess, onError }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleChange = (name, value) => { setForm((p) => ({ ...p, [name]: value })); setErrors((p) => ({ ...p, [name]: "" })); };

  const submit = async () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid address required";
    if (form.phone.replace(/\D/g, "").length < 9) e.phone = "Valid contact required";
    if (form.password.length < 8) e.password = "At least 8 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords don't match";
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    const { data, error } = await signUp({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, phone: form.phone });
    setLoading(false);
    if (error) { onError(error.message); return; }
    onSuccess(form.firstName, true);
  };

  return (
    <div className="space-y-3 pb-4">
      <p className="text-center italic text-[#d4af37]/50 text-sm mb-4">Await your acceptance letter</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" name="firstName" placeholder="Harry" value={form.firstName} onChange={handleChange} error={errors.firstName} />
        <Field label="Last Name" name="lastName" placeholder="Potter" value={form.lastName} onChange={handleChange} error={errors.lastName} />
      </div>
      <Field label="Owl Address" name="email" type="email" placeholder="harry@hogwarts.edu" value={form.email} onChange={handleChange} error={errors.email} />
      <Field label="Contact Number" name="phone" type="tel" placeholder="0712 345 678" value={form.phone} onChange={handleChange} error={errors.phone} />
      <Field label="Secret Password" name="password" type="password" placeholder="At least 8 characters" value={form.password} onChange={handleChange} error={errors.password} />
      <Field label="Confirm Password" name="confirm" type="password" placeholder="Repeat your password" value={form.confirm} onChange={handleChange} error={errors.confirm} />
      <label className="flex items-start gap-2.5 cursor-pointer mt-1">
        <div onClick={() => setAgreed(!agreed)}
          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition ${agreed ? "bg-[#740001] border-[#d4af37]" : "border-[#1e293b] hover:border-[#d4af37]/50"}`}>
          {agreed && <svg className="w-2.5 h-2.5 text-[#f4e8c1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
        <span className="italic text-xs text-[#d4af37]/50 leading-relaxed">
          I swear solemnly that I am up to no good, and agree to the <span className="text-[#d4af37]/80 hover:text-[#d4af37] cursor-pointer">Terms</span>
        </span>
      </label>
      <button onClick={submit} disabled={loading || !agreed}
        className="w-full py-3.5 rounded-lg text-sm font-semibold tracking-widest text-[#f4e8c1] transition-all hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 border border-[#d4af37]/30"
        style={{ background: "linear-gradient(135deg, #740001 0%, #5c0001 50%, #740001 100%)", fontFamily: "'Cinzel', serif" }}>
        {loading ? <><span className="inline-block w-4 h-4 border-2 border-[#f4e8c1]/30 border-t-[#f4e8c1] rounded-full animate-spin" /> Enchanting…</> : "Sign the Parchment"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState(searchParams.get("tab") === "register" ? "register" : "login");
  const [success, setSuccess] = useState(null);
  const [authError, setAuthError] = useState("");
  const celebrationRef = useRef(null);

  useEffect(() => { if (!authLoading && user) router.push("/account"); }, [user, authLoading]);

  const handleSuccess = (name, isNew) => {
    setSuccess({ name, isNew });
    if (celebrationRef.current) celebrate(celebrationRef.current);
    setTimeout(() => router.push("/account"), 2800);
  };

  const handleError = (msg) => {
    setAuthError(msg);
    setTimeout(() => setAuthError(""), 4000);
  };

  if (authLoading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&family=Playfair+Display:ital,wght@0,400;1,600&display=swap');
        @keyframes bh-float { 0% { transform:translateY(0) rotate(0deg); opacity:0; } 10% { opacity:0.8; } 90% { opacity:0.4; } 100% { transform:translateY(-150px) rotate(15deg); opacity:0; } }
        @keyframes bh-twinkle { 0%,100% { opacity:0.1; transform:scale(1); } 50% { opacity:1; transform:scale(1.5); filter: drop-shadow(0 0 5px #d4af37); } }
        @keyframes bh-pop { 0% { transform:scale(0) rotate(-10deg); } 70% { transform:scale(1.1) rotate(2deg); } 100% { transform:scale(1) rotate(0deg); } }
        /* Custom scrollbar for webkit */
        .magical-scrollbar::-webkit-scrollbar { width: 6px; }
        .magical-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .magical-scrollbar::-webkit-scrollbar-thumb { background: #d4af3740; border-radius: 4px; }
        .magical-scrollbar::-webkit-scrollbar-thumb:hover { background: #d4af3780; }
      `}</style>

      {/* Allowed container to have a height bounds and scroll internally if needed */}
      <div className="min-h-screen flex items-center justify-center bg-[#02040a] p-4 font-['Playfair_Display',_serif]">
        <Link href="/" className="fixed top-6 left-6 z-50 flex items-center gap-2 text-[#d4af37]/50 hover:text-[#d4af37] transition text-sm italic">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
          Return to Diagon Alley
        </Link>

        {/* Added maxHeight and flex to main card */}
        <div className="w-full max-w-4xl flex flex-col md:flex-row rounded-2xl overflow-hidden border border-[#1e293b] max-h-[90vh]"
          style={{ boxShadow: "0 0 100px rgba(11, 17, 32, 0.9), 0 0 40px rgba(212, 175, 55, 0.05)" }}>

          {/* Left atmospheric panel with Background Image */}
          <div className="hidden md:flex md:w-[45%] flex-col items-center justify-center p-10 relative overflow-hidden bg-[#090f1f]"
            style={{ borderRight: "1px solid #1e293b" }}>
            
            {/* Added a gorgeous moody Unsplash library image */}
            <div className="absolute inset-0 opacity-30 mix-blend-screen z-0">
              <img 
                src="https://i.pinimg.com/736x/41/ce/f1/41cef17d1e74836e86c41794d891f13b.jpg" 
                alt="Magical Dark Library" 
                className="w-full h-full object-cover"
              />
            </div>

            {/* Gradient overlay to ensure text stays readable */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#03050a]/80 via-transparent to-[#0f172a]/90 z-0"></div>
            
            {/* Starry Night Sky Elements */}
            {[{ t:"10%",l:"20%",d:"2.1s",dy:"0s" },{ t:"25%",l:"72%",d:"3.4s",dy:"0.5s" },{ t:"15%",l:"55%",d:"2.7s",dy:"1s" },{ t:"38%",l:"14%",d:"4.1s",dy:"0.3s" },{ t:"62%",l:"82%",d:"2.9s",dy:"1.5s" },{ t:"78%",l:"32%",d:"3.7s",dy:"0.8s" },{ t:"88%",l:"68%",d:"2.3s",dy:"0.2s" },{ t:"18%",l:"42%",d:"4.5s",dy:"1.2s" },{ t:"50%",l:"58%",d:"3.1s",dy:"0.6s" }].map((s,i)=>(
              <div key={i} className="absolute rounded-full bg-[#f4e8c1] z-10"
                style={{ width:i%2===0?"2px":"1px", height:i%2===0?"2px":"1px", top:s.t, left:s.l, animation:`bh-twinkle ${s.d} ease-in-out ${s.dy} infinite` }} />
            ))}
            
            {/* Magical Glow */}
            <div className="absolute rounded-full pointer-events-none z-0" style={{ width:"250px",height:"250px",background:"#d4af37",opacity:0.06,filter:"blur(60px)",top:"40%",left:"50%",transform:"translate(-50%,-50%)" }} />
            
            <GreatHallParticles />
            <div ref={celebrationRef} className="absolute inset-0 pointer-events-none overflow-hidden z-20" />
            
            <div className="relative z-10 flex flex-col items-center mt-auto mb-auto">
                <p style={{ fontFamily:"'Cinzel',serif" }} className="text-[#f4e8c1] text-3xl font-bold tracking-[0.15em] text-center mb-2 drop-shadow-[0_0_15px_rgba(212,175,55,0.6)]">
                The Restricted Section
                </p>
                <p style={{ fontFamily:"'Cinzel',serif" }} className="text-[#d4af37] text-[10px] tracking-[0.3em] uppercase text-center opacity-80">
                Hogwarts Castle · Est. 990 A.D.
                </p>
            </div>
            
            <p style={{ fontFamily:"'IM Fell English',serif" }} className="italic text-[#d4af37]/80 text-[15px] text-center mt-auto leading-relaxed relative z-10 bg-[#02040a]/40 p-4 rounded-xl backdrop-blur-sm border border-[#d4af37]/10">
              "Words are, in my not-so-humble opinion,<br/>our most inexhaustible source of magic."<br/>
              <span className="text-[12px] opacity-70 block mt-2">— Albus Dumbledore</span>
            </p>
          </div>

          {/* Right form panel - Fixed scrolling! */}
          <div className="flex-1 bg-[#050814] flex flex-col p-8 sm:p-10 relative overflow-y-auto magical-scrollbar">
            {/* Subtle background glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#1e3a8a]/10 blur-[80px] pointer-events-none" />

            <div className="my-auto">
              {authError && (
                <div className="mb-5 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-red-400 text-sm italic text-center">
                  {authError}
                </div>
              )}

              {success ? (
                <div className="text-center py-8" style={{ animation:"bh-pop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards" }}>
                  <div className="text-6xl mb-5">✨</div>
                  <h2 style={{ fontFamily:"'Cinzel',serif" }} className="text-[#f4e8c1] text-2xl mb-2 drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]">
                    Mischief Managed.
                  </h2>
                  <p className="italic text-[#d4af37]/70 text-base">
                    {success.isNew ? `Welcome to Hogwarts, ${success.name}.` : `Welcome back, ${success.name}.`}
                  </p>
                  {success.isNew && (
                    <p className="text-[#d4af37]/40 text-xs mt-4 italic">An owl has been dispatched to verify your address.</p>
                  )}
                  <p className="text-[#d4af37]/40 text-sm mt-3">Accessing the Restricted Section...</p>
                </div>
              ) : (
                <>
                  <div className="relative flex bg-[#0f172a] border border-[#1e293b] rounded-lg p-1 mb-8 shadow-inner shrink-0">
                    <div className="absolute top-1 left-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-md transition-transform duration-400 ease-in-out shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                      style={{ background:"linear-gradient(135deg, #1e293b, #0f172a)", border: "1px solid rgba(212,175,55,0.3)", transform:tab==="register"?"translateX(100%)":"translateX(0)" }} />
                    {["login","register"].map((t) => (
                      <button key={t} onClick={() => { setTab(t); setAuthError(""); }}
                        className={`flex-1 py-2.5 text-xs tracking-[0.2em] uppercase relative z-10 transition-colors duration-300 rounded-md ${tab===t?"text-[#d4af37] font-bold drop-shadow-[0_0_5px_rgba(212,175,55,0.5)]":"text-[#64748b] hover:text-[#94a3b8]"}`}
                        style={{ fontFamily:"'Cinzel',serif" }}>
                        {t==="login"?"Sign In":"Enroll"}
                      </button>
                    ))}
                  </div>
                  
                  {/* Grid trick replaces absolute positioning to fix the scrolling height bug */}
                  <div className="grid">
                    <div className={`col-start-1 row-start-1 transition-all duration-500 ${tab==="login"?"opacity-100 z-10 translate-x-0":"opacity-0 pointer-events-none z-0 translate-x-8"}`}>
                      <LoginForm onSuccess={handleSuccess} onError={handleError} />
                    </div>
                    <div className={`col-start-1 row-start-1 transition-all duration-500 ${tab==="register"?"opacity-100 z-10 translate-x-0":"opacity-0 pointer-events-none z-0 -translate-x-8"}`}>
                      <RegisterForm onSuccess={handleSuccess} onError={handleError} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}