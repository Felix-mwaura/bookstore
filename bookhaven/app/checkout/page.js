"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BookCover } from "../components/BookCard";
import { supabase } from "../lib/supabase";
function generateOrderId() {
  return "BH-" + Math.random().toString(36).substring(2, 7).toUpperCase();
}

function formatPhone(raw) {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 10) return "254" + d.slice(1);
  if (d.startsWith("254") && d.length === 12) return d;
  return d;
}

function StepBar({ step }) {
  const steps = ["Your Details", "Payment", "Confirmation"];
  return (
    <div className="flex items-center justify-center mb-10">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = step > idx;
        const active = step === idx;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 ${done ? "bg-[#991B1B] border-[#991B1B] text-white" : active ? "bg-white border-[#991B1B] text-[#991B1B]" : "bg-white border-stone-300 text-stone-400"}`}>
                {done ? (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>) : idx}
              </div>
              <span className={`text-xs font-semibold mt-1.5 whitespace-nowrap ${active ? "text-[#991B1B]" : done ? "text-stone-500" : "text-stone-400"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-20 sm:w-32 h-0.5 mx-2 mb-5 transition-all duration-500 ${done ? "bg-[#991B1B]" : "bg-stone-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function OrderSummary({ cart, total }) {
  const delivery = total >= 3000 ? 0 : 300;
  const grand = total + delivery;
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 sticky top-24">
      <h3 className="font-bold text-[#1C1917] text-lg mb-5">Order Summary</h3>
      <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
        {cart.map((item) => (
          <div key={item.id} className="flex gap-3 items-start">
            <div className="w-10 flex-shrink-0 rounded-sm overflow-hidden" style={{ aspectRatio: "2/3", boxShadow: "-1px 0 3px rgba(0,0,0,0.1), 2px 4px 10px rgba(0,0,0,0.1)" }}>
              <BookCover book={item} className="w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1C1917] line-clamp-1">{item.title}</p>
              <p className="text-xs text-stone-400">{item.author}</p>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-stone-400">Qty: {item.quantity}</span>
                <span className="text-sm font-bold text-[#1C1917]">KSh {(item.price * item.quantity).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-stone-100 mt-5 pt-4 space-y-2.5">
        <div className="flex justify-between text-sm"><span className="text-stone-500">Subtotal</span><span className="font-semibold">KSh {total.toLocaleString()}</span></div>
        <div className="flex justify-between text-sm"><span className="text-stone-500">Delivery</span>{delivery === 0 ? <span className="font-semibold text-green-600">Free 🎉</span> : <span className="font-semibold">KSh {delivery.toLocaleString()}</span>}</div>
        {delivery > 0 && <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">Add KSh {(3000 - total).toLocaleString()} more for free delivery</p>}
        <div className="flex justify-between text-lg font-black text-[#1C1917] border-t border-stone-200 pt-3"><span>Total</span><span>KSh {grand.toLocaleString()}</span></div>
      </div>
      <div className="mt-5 pt-4 border-t border-stone-100 space-y-2">
        {["🔒 Secure & encrypted checkout", "🔄 30-day hassle-free returns", "📦 Nationwide delivery"].map((t) => <p key={t} className="text-xs text-stone-400">{t}</p>)}
      </div>
    </div>
  );
}

// Defined OUTSIDE StepDetails so it doesn't remount on every keystroke
function Field({ label, name, type = "text", placeholder, span2, value, onChange, error }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(name, e.target.value)}
        className={`w-full bg-stone-50 border rounded-xl px-4 py-3 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-[#991B1B]/20 ${error ? "border-red-400 bg-red-50/50" : "border-stone-200 focus:border-[#991B1B]"}`}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function StepDetails({ data, onChange, onNext }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!data.firstName.trim()) e.firstName = "Required";
    if (!data.lastName.trim()) e.lastName = "Required";
    if (!data.email.trim() || !/\S+@\S+\.\S+/.test(data.email)) e.email = "Valid email required";
    if (data.phone.replace(/\D/g, "").length < 9) e.phone = "Valid phone required";
    if (!data.address.trim()) e.address = "Required";
    if (!data.city) e.city = "Select a city";
    return e;
  };

  const handleNext = () => { const e = validate(); if (Object.keys(e).length) { setErrors(e); return; } onNext(); };

  const handleChange = (name, value) => {
    onChange(name, value);
    setErrors((p) => ({ ...p, [name]: "" }));
  };

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-[#1C1917] mb-1">Delivery Details</h2>
      <p className="text-stone-500 text-sm mb-5 sm:mb-7">Where should we send your books?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Field label="First Name" name="firstName" placeholder="Grace" value={data.firstName} onChange={handleChange} error={errors.firstName} />
        <Field label="Last Name" name="lastName" placeholder="Wambui" value={data.lastName} onChange={handleChange} error={errors.lastName} />
        <Field label="Email Address" name="email" type="email" placeholder="grace@example.com" span2 value={data.email} onChange={handleChange} error={errors.email} />
        <Field label="Phone Number" name="phone" type="tel" placeholder="0712 345 678" span2 value={data.phone} onChange={handleChange} error={errors.phone} />
        <Field label="Street Address" name="address" placeholder="Estate, street, building..." span2 value={data.address} onChange={handleChange} error={errors.address} />
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">City / Town</label>
          <select value={data.city} onChange={(e) => { onChange("city", e.target.value); setErrors((p) => ({ ...p, city: "" })); }}
            className={`w-full bg-stone-50 border rounded-xl px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-[#991B1B] ${errors.city ? "border-red-400" : "border-stone-200"}`}>
            <option value="">Select city</option>
            {["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Nyeri","Machakos","Meru","Garissa","Kakamega","Malindi","Kisii","Kericho","Naivasha"].map((c) => <option key={c}>{c}</option>)}
          </select>
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Notes <span className="text-stone-300 normal-case font-normal">(optional)</span></label>
          <input type="text" value={data.notes} placeholder="Landmark, nearest stage..." onChange={(e) => onChange("notes", e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-[#991B1B]" />
        </div>
      </div>
      <button onClick={handleNext} className="w-full mt-8 bg-[#1C1917] hover:bg-[#991B1B] text-white py-4 rounded-xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2">
        Continue to Payment
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
      </button>
    </div>
  );
}

function MpesaFlow({ phone, total, orderId, onSuccess }) {
  const [stage, setStage] = useState("idle"); // idle | sending | waiting | polling | success | failed | cancelled
  const [mpesaPhone, setMpesaPhone] = useState(phone || "");
  const [phoneError, setPhoneError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  // Countdown timer while waiting for user to enter PIN on phone
  useEffect(() => {
    if (stage !== "waiting") return;
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          // After countdown, poll once more to check if they paid
          checkPaymentStatus();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [stage]);

  // Poll payment status every 5 seconds while waiting
  useEffect(() => {
    if (stage !== "waiting" || !checkoutRequestId) return;
    pollRef.current = setInterval(() => checkPaymentStatus(), 5000);
    return () => clearInterval(pollRef.current);
  }, [stage, checkoutRequestId]);

  const checkPaymentStatus = async () => {
    if (!checkoutRequestId) return;
    try {
      const res = await fetch("/api/mpesa/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutRequestId }),
      });
      const data = await res.json();

      if (data.success) {
        clearInterval(timerRef.current);
        clearInterval(pollRef.current);
        setStage("success");
        setTimeout(() => onSuccess("mpesa"), 1500);
      } else if (data.cancelled) {
        clearInterval(timerRef.current);
        clearInterval(pollRef.current);
        setStage("cancelled");
      }
      // If neither, keep polling — user might still be entering PIN
    } catch {}
  };

  const sendSTK = async () => {
    setPhoneError("");
    const formatted = formatPhone(mpesaPhone);
    if (formatted.length < 12) { setPhoneError("Please enter a valid Safaricom number (07XX or 01XX)"); return; }

    setStage("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/mpesa/stk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mpesaPhone, amount: total, orderId }),
      });
      const data = await res.json();

      if (data.success) {
        setCheckoutRequestId(data.checkoutRequestId);
        setStage("waiting");
      } else {
        setErrorMsg(data.error || "Failed to send M-Pesa request. Please try again.");
        setStage("idle");
      }
    } catch (err) {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStage("idle");
    }
  };

  const reset = () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    setStage("idle");
    setCheckoutRequestId(null);
    setErrorMsg("");
  };

  // ── IDLE ──
  if (stage === "idle") return (
    <div className="space-y-5">
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex gap-4">
        <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
          <span className="text-white font-black text-lg">M</span>
        </div>
        <div>
          <p className="font-bold text-green-800">Real M-Pesa STK Push</p>
          <p className="text-sm text-green-700 mt-0.5">A payment prompt will be sent directly to your Safaricom number. Enter your M-Pesa PIN on your phone to complete.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ {errorMsg}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Safaricom Number</label>
        <input type="tel" value={mpesaPhone} onChange={(e) => { setMpesaPhone(e.target.value); setPhoneError(""); }}
          placeholder="0712 345 678"
          className={`w-full bg-stone-50 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-200 transition ${phoneError ? "border-red-400 bg-red-50/50" : "border-stone-200 focus:border-green-500"}`} />
        {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
        <p className="text-xs text-stone-400 mt-1.5">Safaricom lines only (07XX / 01XX)</p>
      </div>

      <div className="bg-stone-50 rounded-xl p-4 flex justify-between items-center">
        <span className="text-stone-500 text-sm">Amount to pay</span>
        <span className="text-2xl font-black text-[#1C1917]">KSh {total.toLocaleString()}</span>
      </div>

      <button onClick={sendSTK}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Send M-Pesa Request
      </button>
    </div>
  );

  // ── SENDING ──
  if (stage === "sending") return (
    <div className="text-center py-12 space-y-4">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
        <span className="text-green-600 font-black text-3xl">M</span>
      </div>
      <p className="font-bold text-[#1C1917] text-lg">Connecting to Safaricom…</p>
      <p className="text-stone-500 text-sm">Sending payment request to {mpesaPhone}</p>
      <div className="flex justify-center gap-1.5 pt-2">
        {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
      </div>
    </div>
  );

  // ── WAITING (STK sent, user needs to enter PIN on phone) ──
  if (stage === "waiting") return (
    <div className="space-y-5">
      {/* Simulated phone screen */}
      <div className="bg-green-600 rounded-2xl p-6 text-white text-center shadow-xl">
        <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="font-black text-2xl">M</span>
        </div>
        <p className="font-black text-lg tracking-wide">M-PESA</p>
        <p className="text-green-200 text-sm mt-1">Payment Request Sent ✓</p>
        <div className="bg-white/10 rounded-xl p-4 mt-4 space-y-1">
          <p className="text-green-100 text-xs">Pay To</p>
          <p className="font-black text-base">BOOK HAVEN KENYA</p>
          <p className="text-green-200 text-xs mt-2">Amount</p>
          <p className="font-black text-3xl">KSh {total.toLocaleString()}</p>
          <p className="text-green-300 text-xs mt-2">Ref: {orderId}</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <p className="font-bold text-amber-800 text-sm">📱 Check your phone!</p>
        <ul className="text-xs text-amber-700 space-y-1">
          <li>1. An M-Pesa prompt has been sent to <strong>{mpesaPhone}</strong></li>
          <li>2. Enter your M-Pesa PIN on your phone</li>
          <li>3. This page will update automatically once paid</li>
        </ul>
      </div>

      {/* Countdown + polling indicator */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full animate-pulse ${countdown > 15 ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-stone-500">Waiting for payment · </span>
          <span className={`font-bold tabular-nums ${countdown <= 15 ? "text-red-500" : "text-stone-700"}`}>{countdown}s</span>
        </div>
        <div className="w-full bg-stone-100 rounded-full h-1.5">
          <div className="h-1.5 rounded-full transition-all duration-1000"
            style={{ width: `${(countdown / 60) * 100}%`, backgroundColor: countdown > 15 ? "#16a34a" : "#ef4444" }} />
        </div>
        <p className="text-xs text-stone-400">Checking payment status automatically…</p>
      </div>

      <div className="flex gap-3">
        <button onClick={checkPaymentStatus}
          className="flex-1 border border-green-200 text-green-700 hover:bg-green-50 py-3 rounded-xl font-semibold text-sm transition">
          ↻ Check Now
        </button>
        <button onClick={reset}
          className="flex-1 border border-stone-200 text-stone-500 hover:bg-stone-50 py-3 rounded-xl font-semibold text-sm transition">
          ← Change Number
        </button>
      </div>
    </div>
  );

  // ── SUCCESS ──
  if (stage === "success") return (
    <div className="text-center py-8 space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="font-bold text-[#1C1917] text-lg">Payment Confirmed! 🎉</p>
      <p className="text-stone-500 text-sm">Your M-Pesa payment was successful</p>
    </div>
  );

  // ── CANCELLED ──
  if (stage === "cancelled") return (
    <div className="text-center py-8 space-y-4">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="font-bold text-[#1C1917]">Payment Cancelled</p>
      <p className="text-stone-500 text-sm">You cancelled the M-Pesa request or it timed out.</p>
      <button onClick={reset} className="bg-[#1C1917] hover:bg-[#991B1B] text-white px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95">
        Try Again
      </button>
    </div>
  );
}

function CardFlow({ total, onSuccess }) {
  const [form, setForm] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);
  const formatCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; };
  const validate = () => {
    const e = {};
    if (form.number.replace(/\s/g, "").length < 16) e.number = "Enter a valid 16-digit number";
    if (!form.name.trim()) e.name = "Name on card required";
    if (form.expiry.length < 5) e.expiry = "Enter MM/YY";
    if (form.cvv.length < 3) e.cvv = "Enter 3-digit CVV";
    return e;
  };
  const submit = () => { const e = validate(); if (Object.keys(e).length) { setErrors(e); return; } setProcessing(true); setTimeout(() => { setProcessing(false); onSuccess("card"); }, 3000); };
  const num = form.number.replace(/\s/g, "");
  const brand = num.startsWith("4") ? "VISA" : num.startsWith("5") ? "MC" : null;
  if (processing) return (
    <div className="text-center py-14 space-y-5">
      <div className="w-16 h-16 border-4 border-stone-200 border-t-[#991B1B] rounded-full animate-spin mx-auto" />
      <p className="font-bold text-[#1C1917] text-lg">Processing payment…</p>
      <p className="text-stone-500 text-sm">Please don't close this page</p>
    </div>
  );
  const InputField = ({ label, name, placeholder }) => (
    <div>
      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input value={form[name]} placeholder={placeholder}
        onChange={(e) => { let v = e.target.value; if (name === "number") v = formatCard(v); if (name === "expiry") v = formatExpiry(v); if (name === "cvv") v = v.replace(/\D/g, "").slice(0, 4); setForm((p) => ({ ...p, [name]: v })); setErrors((p) => ({ ...p, [name]: "" })); }}
        className={`w-full bg-stone-50 border rounded-xl px-4 py-3 text-sm font-mono outline-none transition focus:bg-white focus:ring-2 focus:ring-[#991B1B]/20 ${errors[name] ? "border-red-400 bg-red-50/50" : "border-stone-200 focus:border-[#991B1B]"}`} />
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]}</p>}
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-4 bg-stone-50 border border-stone-200 rounded-2xl">
        {["VISA", "MC", "KCB", "EQUITY"].map((b) => <span key={b} className={`px-2 py-1 text-[10px] font-black rounded border shadow-sm transition ${brand === b ? "bg-[#1C1917] text-white border-[#1C1917]" : "bg-white text-stone-500 border-stone-200"}`}>{b}</span>)}
        <span className="text-xs text-stone-500 ml-1">All major cards accepted</span>
      </div>
      <div className="relative"><InputField label="Card Number" name="number" placeholder="1234 5678 9012 3456" />{brand && <span className="absolute right-3 top-8 text-xs font-black text-stone-400 bg-white px-2 py-0.5 rounded border border-stone-200">{brand}</span>}</div>
      <InputField label="Name on Card" name="name" placeholder="GRACE WAMBUI" />
      <div className="grid grid-cols-2 gap-4"><InputField label="Expiry" name="expiry" placeholder="MM/YY" /><InputField label="CVV" name="cvv" placeholder="123" /></div>
      <div className="flex items-start gap-2 text-xs text-stone-500 bg-stone-50 rounded-xl p-3">
        <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        Your card details are encrypted with 256-bit SSL and never stored.
      </div>
      <button onClick={submit} className="w-full bg-[#1C1917] hover:bg-[#991B1B] text-white py-4 rounded-xl font-bold text-base transition-all active:scale-95">Pay KSh {total.toLocaleString()}</button>
    </div>
  );
}

function CodFlow({ total, onSuccess }) {
  const [agreed, setAgreed] = useState(false);
  const codTotal = total + 50;
  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4"><span className="text-3xl">💵</span><div><p className="font-bold text-amber-800">Cash on Delivery</p><p className="text-sm text-amber-700">Pay in cash when your books arrive</p></div></div>
        <ul className="space-y-2.5">
          {[`Have exact change ready — KSh ${codTotal.toLocaleString()}`, "Our rider will call 30 minutes before arrival", "Available in Nairobi, Mombasa, Kisumu & Nakuru", "A KSh 50 handling fee applies for COD orders"].map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm text-amber-800">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{t}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-stone-50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-stone-500">Order total</span><span className="font-semibold">KSh {total.toLocaleString()}</span></div>
        <div className="flex justify-between"><span className="text-stone-500">COD handling fee</span><span className="font-semibold">KSh 50</span></div>
        <div className="flex justify-between font-bold text-[#1C1917] border-t border-stone-200 pt-2"><span>Pay on delivery</span><span>KSh {codTotal.toLocaleString()}</span></div>
      </div>
      <label className="flex items-start gap-3 cursor-pointer group">
        <div onClick={() => setAgreed(!agreed)} className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition ${agreed ? "bg-[#1C1917] border-[#1C1917]" : "border-stone-300 group-hover:border-stone-400"}`}>
          {agreed && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
        <span className="text-sm text-stone-600 leading-relaxed">I understand I must pay <strong className="text-[#1C1917]">KSh {codTotal.toLocaleString()}</strong> in cash to the delivery rider.</span>
      </label>
      <button onClick={() => agreed && onSuccess("cod")} disabled={!agreed} className="w-full bg-[#1C1917] hover:bg-[#991B1B] disabled:bg-stone-200 disabled:text-stone-400 text-white py-4 rounded-xl font-bold text-base transition-all active:scale-95">Place Order — Pay on Delivery</button>
    </div>
  );
}

function StepPayment({ details, total, orderId, onSuccess, onBack }) {
  const [method, setMethod] = useState("mpesa");
  const delivery = total >= 3000 ? 0 : 300;
  const grand = total + delivery;
  const methods = [
    { id: "mpesa", label: "M-Pesa", sub: "STK Push", icon: "M", color: "bg-green-600" },
    { id: "card", label: "Card", sub: "Visa / Mastercard", icon: "💳", color: "bg-blue-600" },
    { id: "cod", label: "Cash on Delivery", sub: "Pay on arrival", icon: "💵", color: "bg-amber-500" },
  ];
  return (
    <div>
      <h2 className="text-2xl font-bold text-[#1C1917] mb-1">Payment</h2>
      <p className="text-stone-500 text-sm mb-7">Delivering to <span className="font-semibold text-[#1C1917]">{details.firstName} {details.lastName}</span> · {details.city}</p>
      <div className="grid grid-cols-3 gap-3 mb-7">
        {methods.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} className={`p-3 rounded-xl border-2 text-center transition-all duration-200 ${method === m.id ? "border-[#991B1B] bg-[#991B1B]/5" : "border-stone-200 hover:border-stone-300 bg-white"}`}>
            <div className={`w-9 h-9 ${m.color} rounded-lg flex items-center justify-center mx-auto mb-2`}><span className="text-white font-black text-sm">{m.icon}</span></div>
            <p className={`text-xs font-bold leading-tight ${method === m.id ? "text-[#991B1B]" : "text-stone-700"}`}>{m.label}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">{m.sub}</p>
          </button>
        ))}
      </div>
      <div className="bg-stone-50/50 rounded-2xl p-1">
        <div className="bg-white rounded-xl p-5 border border-stone-100">
          {method === "mpesa" && <MpesaFlow phone={details.phone} total={grand} orderId={orderId} onSuccess={onSuccess} />}
          {method === "card" && <CardFlow total={grand} onSuccess={onSuccess} />}
          {method === "cod" && <CodFlow total={grand} onSuccess={onSuccess} />}
        </div>
      </div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition mt-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to details
      </button>
    </div>
  );
}

function StepConfirmation({ orderId, details, method, cart, total }) {
  const delivery = total >= 3000 ? 0 : 300;
  const grand = total + delivery + (method === "cod" ? 50 : 0);
  const methodLabels = { mpesa: "M-Pesa", card: "Card", cod: "Cash on Delivery" };
  const eta = details.city === "Nairobi" ? "1–2 business days" : "2–4 business days";
  return (
    <div className="text-center py-4 animate-slide-up">
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <div className="absolute inset-0 border-4 border-green-300 rounded-full animate-ping opacity-20" />
      </div>
      <h2 className="text-3xl font-black text-[#1C1917]">Order Confirmed! 🎉</h2>
      <p className="text-stone-500 mt-2 mb-8">Thank you {details.firstName}! Your books are on their way.</p>
      <div className="bg-stone-50 rounded-2xl p-6 text-left max-w-sm mx-auto space-y-3 mb-6">
        {[{ label: "Order ID", value: orderId, mono: true }, { label: "Delivering to", value: `${details.address}, ${details.city}` }, { label: "Payment", value: methodLabels[method] || method }, { label: "Amount paid", value: `KSh ${grand.toLocaleString()}` }, { label: "Estimated delivery", value: eta }].map(({ label, value, mono }) => (
          <div key={label} className="flex justify-between text-sm gap-4">
            <span className="text-stone-500 flex-shrink-0">{label}</span>
            <span className={`font-semibold text-[#1C1917] text-right ${mono ? "font-mono" : ""}`}>{value}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-3 mb-6">
        {cart.slice(0, 4).map((item) => (
          <div key={item.id} className="w-12 rounded-r-sm overflow-hidden flex-shrink-0" style={{ aspectRatio: "2/3", boxShadow: "-1px 0 3px rgba(0,0,0,0.1), 2px 4px 10px rgba(0,0,0,0.12)" }}>
            <BookCover book={item} className="w-full h-full" />
          </div>
        ))}
        {cart.length > 4 && <div className="w-12 bg-stone-100 rounded-r-sm flex items-center justify-center text-xs font-bold text-stone-500" style={{ aspectRatio: "2/3" }}>+{cart.length - 4}</div>}
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700 max-w-sm mx-auto mb-8">
        📧 A confirmation has been sent to <strong>{details.email}</strong>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/" className="bg-[#1C1917] hover:bg-[#991B1B] text-white px-8 py-3.5 rounded-xl font-bold transition-all active:scale-95">Continue Shopping</Link>
        <button onClick={() => window.print()} className="border-2 border-stone-200 hover:border-stone-300 text-stone-600 px-8 py-3.5 rounded-xl font-bold transition-all">🖨️ Print Receipt</button>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const [cart, setCart] = useState([]);
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [orderId] = useState(generateOrderId);
  const [details, setDetails] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", city: "", notes: "" });

  useEffect(() => { try { const saved = localStorage.getItem("bh_cart"); if (saved) setCart(JSON.parse(saved)); } catch {} }, []);

  const updateDetail = (key, val) => setDetails((p) => ({ ...p, [key]: val }));
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const handlePaymentSuccess = async (method) => {
    setPaymentMethod(method);
    // Save order to Supabase if user is logged in
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ items: cart, total, deliveryDetails: details, paymentMethod: method }),
        });
      }
    } catch (e) { console.error("Order save failed", e); }
    localStorage.removeItem("bh_cart");
    setStep(3);
  };

  if (cart.length === 0 && step < 3) return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-7xl">📚</div>
      <h2 className="text-2xl font-bold text-[#1C1917]">Your basket is empty</h2>
      <p className="text-stone-500">Add some books before checking out.</p>
      <Link href="/books" className="bg-[#1C1917] hover:bg-[#991B1B] text-white px-8 py-3 rounded-xl font-bold transition">Browse Books</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl sm:text-2xl">📚</span>
            <div>
              <p className="text-base sm:text-lg font-black text-[#1C1917] leading-none group-hover:text-[#991B1B] transition">Book Haven</p>
              <p className="text-[9px] uppercase tracking-widest text-stone-400 font-semibold hidden sm:block">Kenya</p>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secure Checkout
          </div>
        </div>
      </header>

      {/* Mobile order summary strip */}
      {step < 3 && (
        <div className="lg:hidden bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-600">Order total</span>
            <span className="text-sm font-black text-[#1C1917]">KSh {(total + (total >= 3000 ? 0 : 300)).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {cart.slice(0, 3).map((item, i) => (
              <div key={i} className="w-7 rounded-sm overflow-hidden" style={{ aspectRatio: "2/3" }}>
                <BookCover book={item} className="w-full h-full" />
              </div>
            ))}
            {cart.length > 3 && <span className="text-xs text-stone-400 font-medium">+{cart.length - 3}</span>}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <StepBar step={step} />
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">
          <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 lg:p-8">
            {step === 1 && <StepDetails data={details} onChange={updateDetail} onNext={() => setStep(2)} />}
            {step === 2 && <StepPayment details={details} total={total} orderId={orderId} onSuccess={handlePaymentSuccess} onBack={() => setStep(1)} />}
            {step === 3 && <StepConfirmation orderId={orderId} details={details} method={paymentMethod} cart={cart} total={total} />}
          </div>
          {step < 3 && (
            <div className="hidden lg:block">
              <OrderSummary cart={cart} total={total} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}