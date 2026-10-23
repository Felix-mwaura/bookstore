"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { BookCover } from "../components/BookCover";
import { supabase } from "../lib/supabase";
import { orderReference } from "../lib/orders";
import { DELIVERY_PERCENT, deliveryFeeFor } from "../lib/site";

function formatPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 10) return "254" + d.slice(1);
  if (d.startsWith("254") && d.length === 12) return d;
  if (d.startsWith("7") && d.length === 9) return "254" + d;
  if (d.startsWith("1") && d.length === 9) return "254" + d;
  return d;
}

/** A Kenyan mobile number: 07XXXXXXXX, 01XXXXXXXX, 2547… or +2547… */
function isValidKenyanPhone(raw) {
  const value = String(raw || "").trim();
  if (!/^\+?[\d\s()-]+$/.test(value)) return false;
  return /^254(7|1)\d{8}$/.test(formatPhone(value));
}

function StepBar({ step }) {
  const steps = ["Your Details", "Payment", "Confirmation"];
  return (
    <div className="flex items-center justify-center mb-8 sm:mb-10">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = step > idx;
        const active = step === idx;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm border-2 transition-colors ${done ? "bg-[#B5532F] border-[#B5532F] text-white" : active ? "bg-white border-[#B5532F] text-[#B5532F]" : "bg-white border-stone-300 text-muted"}`}>
                {done ? (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>) : idx}
              </div>
              <span className={`text-[10px] sm:text-xs font-semibold mt-1.5 whitespace-nowrap ${active ? "text-[#B5532F]" : done ? "text-stone-500" : "text-muted"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-8 sm:w-24 h-0.5 mx-1.5 sm:mx-3 mb-5 transition-colors ${done ? "bg-sienna" : "bg-line"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function OrderSummary({ cart, total, onChangeQty, onRemove }) {
  // Same rule the server applies in place_order, imported rather than
  // duplicated so the displayed total cannot disagree with the charged one.
  const delivery = deliveryFeeFor(total);
  const grand = total + delivery;
  return (
    <div className="bg-white rounded-card border border-line p-5 sm:p-6 lg:sticky lg:top-24">
      <h3 className="font-bold text-[#1B2A4A] text-lg mb-5">Order Summary</h3>
      <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
        {cart.map((item) => (
          <div key={item.id} className="flex gap-3 items-start">
            <div className="w-10 flex-shrink-0 rounded-sm overflow-hidden" style={{ aspectRatio: "2/3", boxShadow: "-1px 0 3px rgba(0,0,0,0.1), 2px 4px 10px rgba(0,0,0,0.1)" }}>
              <BookCover book={item} className="w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1B2A4A] line-clamp-1">{item.title}</p>
              <p className="text-xs text-muted">{item.author}</p>
              <div className="flex justify-between items-center mt-1">
                {onChangeQty ? (
                  <div className="flex items-center border border-stone-300 rounded-lg">
                    <button type="button" aria-label={`Decrease quantity of ${item.title}`} onClick={() => onChangeQty(item.id, -1)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-stone-100 font-bold text-sm">−</button>
                    <span className="w-7 text-center text-xs font-semibold" aria-live="polite">{item.quantity}</span>
                    <button type="button" aria-label={`Increase quantity of ${item.title}`} onClick={() => onChangeQty(item.id, 1)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-stone-100 font-bold text-sm">+</button>
                  </div>
                ) : (
                  <span className="text-xs text-muted">Qty: {item.quantity}</span>
                )}
                <span className="text-sm font-bold text-[#1B2A4A]">KSh {(item.price * item.quantity).toLocaleString()}</span>
              </div>
              {onRemove && (
                <button type="button" onClick={() => onRemove(item.id)} className="text-[11px] text-muted hover:text-red-600 underline mt-1">
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-stone-100 mt-5 pt-4 space-y-2.5">
        <div className="flex justify-between text-sm"><span className="text-stone-500">Subtotal</span><span className="font-semibold">KSh {total.toLocaleString()}</span></div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">Delivery ({DELIVERY_PERCENT}%)</span>
          <span className="font-semibold">KSh {delivery.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-navy border-t border-line pt-3"><span>Total</span><span>KSh {grand.toLocaleString()}</span></div>
      </div>
      <div className="mt-5 pt-4 border-t border-line space-y-1.5">
        <p className="text-xs text-muted">Delivery is {DELIVERY_PERCENT}% of the book total, worked out here and charged once — nothing is added at the door.</p>
        <p className="text-xs text-muted">You will see the full total before you confirm.</p>
      </div>
    </div>
  );
}

// Defined OUTSIDE StepDetails so it doesn't remount on every keystroke
function Field({ label, name, type = "text", placeholder, span2, value, onChange, error, autoComplete, inputMode }) {
  const id = `checkout-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(name, e.target.value)}
        className={`w-full min-h-11 bg-white border rounded-control px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sienna/20 ${error ? "border-error bg-error/5" : "border-line focus:border-navy"}`}
      />
      {error && <p id={errorId} className="text-error text-xs mt-1">{error}</p>}
    </div>
  );
}

function validateDetails(data) {
  const found = {};
  if (!data.firstName.trim()) found.firstName = "Enter your first name.";
  if (!data.lastName.trim()) found.lastName = "Enter your last name.";
  if (!data.email.trim() || !/\S+@\S+\.\S+/.test(data.email)) found.email = "Enter a valid email address.";
  if (!isValidKenyanPhone(data.phone)) found.phone = "Enter a Kenyan mobile number, e.g. 0712 345 678.";
  if (!data.address.trim()) found.address = "Enter a delivery address.";
  if (!data.city) found.city = "Choose your town or city.";
  return found;
}

function StepDetails({ data, onChange, onNext, saved = [], onPickSaved, remember, onRemember }) {
  const [errors, setErrors] = useState({});

  const validate = () => validateDetails(data);

  const handleNext = () => {
    const found = validate();
    const firstKey = Object.keys(found)[0];
    if (firstKey) {
      setErrors(found);
      // Send the caret to the first problem instead of leaving the reader
      // to hunt for the red text.
      const el = document.getElementById(`checkout-${firstKey}`);
      el?.focus();
      return;
    }
    onNext();
  };

  const handleChange = (name, value) => {
    onChange(name, value);
    setErrors((p) => ({ ...p, [name]: "" }));
  };

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-sienna">Step 1 of 3</p>
      <h2 className="mt-1 text-xl sm:text-2xl font-bold text-navy">Delivery details</h2>
      <p className="text-muted text-sm mt-1 mb-5">Where should we send your books?</p>

      {/* Saved addresses. Only rendered for a signed-in customer who has one,
          so a first-time buyer sees the plain form and nothing else. */}
      {saved.length > 0 && (
        <div className="mb-5 rounded-xl border border-line bg-stone-50 p-3">
          <label htmlFor="checkout-saved-address" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
            Use a saved address
          </label>
          <select
            id="checkout-saved-address"
            defaultValue=""
            onChange={(e) => {
              const chosen = saved.find((a) => a.id === e.target.value);
              if (chosen) onPickSaved?.(chosen);
              // Return the control to its prompt so the same address can be
              // picked again after editing a field by hand.
              e.target.value = "";
            }}
            className="min-h-11 w-full rounded-xl border border-[#E3DCCB] bg-white px-4 text-sm outline-none transition focus:border-[#B5532F]"
          >
            <option value="">Choose a saved address…</option>
            {saved.map((a) => (
              <option key={a.id} value={a.id}>
                {(a.label || "Address") + " — " + a.address + ", " + a.city}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Field label="First name" name="firstName" placeholder="Grace" autoComplete="given-name" value={data.firstName} onChange={handleChange} error={errors.firstName} />
        <Field label="Last name" name="lastName" placeholder="Wambui" autoComplete="family-name" value={data.lastName} onChange={handleChange} error={errors.lastName} />
        <Field label="Email address" name="email" type="email" placeholder="grace@example.com" autoComplete="email" span2 value={data.email} onChange={handleChange} error={errors.email} />
        <Field label="Phone number" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" autoComplete="tel" span2 value={data.phone} onChange={handleChange} error={errors.phone} />
        <Field label="Street address" name="address" placeholder="Estate, street, building…" autoComplete="street-address" span2 value={data.address} onChange={handleChange} error={errors.address} />
        <div>
          <label htmlFor="checkout-city" className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">City / town</label>
          <select id="checkout-city" value={data.city} onChange={(e) => { onChange("city", e.target.value); setErrors((p) => ({ ...p, city: "" })); }}
            className={`w-full bg-stone-50 border rounded-xl px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-[#B5532F] ${errors.city ? "border-red-400" : "border-[#E3DCCB]"}`}>
            <option value="">Select city</option>
            {["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Nyeri","Machakos","Meru","Garissa","Kakamega","Malindi","Kisii","Kericho","Naivasha"].map((c) => <option key={c}>{c}</option>)}
          </select>
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
        </div>
        <div>
          <label htmlFor="checkout-notes" className="block text-xs font-bold text-muted uppercase tracking-wider mb-1.5">Notes <span className="text-stone-300 normal-case font-normal">(optional)</span></label>
          <input id="checkout-notes" type="text" value={data.notes} placeholder="Landmark, nearest stage..." onChange={(e) => onChange("notes", e.target.value)}
            className="w-full bg-stone-50 border border-[#E3DCCB] rounded-xl px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-[#B5532F]" />
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => onRemember?.(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-line"
        />
        <span>Save this address to my account for next time</span>
      </label>

      <button type="button" onClick={handleNext} className="btn-primary w-full mt-8 text-base">
        Continue to payment
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
      </button>
    </div>
  );
}

function MpesaFlow({ phone, total, reference, items, ready = true, onSuccess, onFallback }) {
  const [stage, setStage] = useState("idle"); // idle | sending | waiting | polling | success | failed | cancelled | unconfirmed
  const [mpesaPhone, setMpesaPhone] = useState(phone || "");
  const [phoneError, setPhoneError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  // Safaricom's own verdict when a payment failed for a reason that is not
  // the customer's: a rejected short code, a bad passkey, a merchant Daraja
  // does not recognise. Kept so the screen can promise "you did not cancel
  // this" honestly.
  const [failure, setFailure] = useState(null);
  // True when the failure was on our side (no M-Pesa prompt ever reached
  // the phone), so the customer can switch to pay-on-delivery instead of
  // being stuck on a dead end.
  const [canFallBack, setCanFallBack] = useState(false);
  const [chargedAmount, setChargedAmount] = useState(total);
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  // Ask the server (which asks Safaricom) whether this payment went through.
  // Defined before the effects that schedule it so it is never referenced
  // before it exists.
  const checkPaymentStatus = useCallback(async () => {
    if (!checkoutRequestId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/mpesa/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ checkoutRequestId }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.success) {
        clearInterval(timerRef.current);
        clearInterval(pollRef.current);
        setStage("success");
        setTimeout(() => onSuccess("mpesa", checkoutRequestId), 1200);
      } else if (data.cancelled || data.timedOut) {
        // Only a real customer cancellation (1032) or timeout (1037) lands
        // here; the server separates those from every other failure.
        clearInterval(timerRef.current);
        clearInterval(pollRef.current);
        setStage("cancelled");
      } else if (data.pending === false) {
        // A failure Safaricom reported that was not a cancellation — most
        // often a merchant or configuration error. The customer never saw a
        // prompt, or saw one that failed for our reasons, so do not tell them
        // they cancelled it.
        clearInterval(timerRef.current);
        clearInterval(pollRef.current);
        setFailure({
          resultCode: data.resultCode ?? null,
          resultDesc: data.resultDesc || "",
        });
        setStage("failed");
      }
      // Otherwise still pending — the customer may not have entered their
      // PIN yet, so keep polling until the countdown ends.
    } catch {}
  }, [checkoutRequestId, onSuccess]);

  // Countdown timer while waiting for user to enter PIN on phone
  useEffect(() => {
    if (stage !== "waiting") return;
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          // Last chance to see a confirmed payment before we admit we do not
          // know. The server only reports success once Safaricom's callback
          // has been verified, so silence here genuinely means "unknown".
          checkPaymentStatus();
          setStage((current) => (current === "waiting" ? "unconfirmed" : current));
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [stage, checkPaymentStatus]);

  // Poll payment status every 5 seconds while waiting
  useEffect(() => {
    if (stage !== "waiting" || !checkoutRequestId) return;
    pollRef.current = setInterval(() => checkPaymentStatus(), 5000);
    return () => clearInterval(pollRef.current);
  }, [stage, checkoutRequestId, checkPaymentStatus]);

  // The idle screen shows the live cart total; once a prompt is in flight it
  // must keep showing the amount Safaricom was actually asked for.
  const displayAmount = stage === "idle" ? total : chargedAmount;

  const sendSTK = async () => {
    setPhoneError("");
    if (!isValidKenyanPhone(mpesaPhone)) {
      setPhoneError("Enter a valid Safaricom number, for example 0712 345 678.");
      return;
    }

    setStage("sending");
    setErrorMsg("");
    setCanFallBack(false);
    setCountdown(60);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in again to pay.");

      const res = await fetch("/api/mpesa/stk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        // Only the items and the phone number: the server prices the cart
        // itself, so the amount cannot be tampered with in the browser.
        body: JSON.stringify({ phone: mpesaPhone, items }),
      });
      const data = await res.json();

      if (data.success) {
        setCheckoutRequestId(data.checkoutRequestId);
        if (Number.isFinite(data.amount)) setChargedAmount(data.amount);
        setStage("waiting");
      } else {
        setErrorMsg(data.error || "Failed to send M-Pesa request. Please try again.");
        // 5xx means the request never reached Safaricom; 429 means we stopped
        // it ourselves. Either way the customer can still order.
        setCanFallBack(res.status >= 500 || res.status === 429);
        setStage("idle");
      }
    } catch (err) {
      setErrorMsg("Network error. Please check your connection and try again.");
      setCanFallBack(true);
      setStage("idle");
    }
  };

  const reset = () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    setStage("idle");
    setCheckoutRequestId(null);
    setErrorMsg("");
    setFailure(null);
  };

  // ── IDLE ──
  if (stage === "idle") return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-control border border-line bg-subtle/60 p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-control bg-[#2F7D4F]" aria-hidden="true">
          <span className="text-sm font-black text-white">M</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-navy">Pay with M-Pesa</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            We send a payment request to your phone. Enter your M-Pesa PIN there and this
            page updates by itself — no code to copy.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-control border border-error/30 bg-error/5 p-3" role="alert">
          <p className="text-sm text-error">{errorMsg}</p>
          {canFallBack && onFallback && (
            <>
              <p className="mt-1.5 text-xs leading-relaxed text-ink/70">
                Nothing was sent to your phone, so you can order now and pay the rider instead.
              </p>
              <button
                type="button"
                onClick={() => { setErrorMsg(""); setCanFallBack(false); onFallback(); }}
                className="mt-2.5 min-h-11 w-full rounded-control border border-navy bg-white px-4 text-sm font-semibold text-navy transition hover:bg-navy hover:text-white"
              >
                Continue with cash on delivery
              </button>
            </>
          )}
        </div>
      )}

      <div>
        <label htmlFor="mpesa-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
          Safaricom number
        </label>
        <input
          id="mpesa-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={mpesaPhone}
          onChange={(e) => { setMpesaPhone(e.target.value); setPhoneError(""); }}
          placeholder="0712 345 678"
          aria-invalid={phoneError ? "true" : undefined}
          aria-describedby={phoneError ? "mpesa-phone-error" : "mpesa-phone-help"}
          className={`min-h-11 w-full rounded-control border bg-white px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sienna/20 ${phoneError ? "border-error" : "border-line focus:border-navy"}`}
        />
        {phoneError
          ? <p id="mpesa-phone-error" className="mt-1 text-xs text-error">{phoneError}</p>
          : <p id="mpesa-phone-help" className="mt-1.5 text-xs text-muted">Safaricom lines only (07XX / 01XX).</p>}
      </div>

      <div className="flex items-center justify-between rounded-control bg-subtle px-4 py-3">
        <span className="text-sm text-muted">Amount to pay</span>
        <span className="text-xl font-bold text-navy">KSh {displayAmount.toLocaleString()}</span>
      </div>

      <button
        type="button"
        onClick={sendSTK}
        disabled={!ready}
        className="btn-primary w-full text-base disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-muted"
      >
        Send M-Pesa request
      </button>
      {!ready && (
        <p className="text-center text-xs text-muted">Add your delivery details above before paying.</p>
      )}
    </div>
  );

  // ── SENDING ──
  if (stage === "sending") return (
    <div className="space-y-3 py-10 text-center" role="status">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-subtle">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-sienna" aria-hidden="true" />
      </div>
      <p className="font-semibold text-navy">Sending the request to Safaricom…</p>
      <p className="text-sm text-muted">{mpesaPhone}</p>
    </div>
  );

  // ── WAITING (STK sent, user needs to enter PIN on phone) ──
  if (stage === "waiting") return (
    <div className="space-y-5">
      <div className="rounded-card bg-navy p-5 text-cream">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cream/70">M-Pesa request sent</p>
        <p className="mt-2 text-3xl font-bold text-white">KSh {displayAmount.toLocaleString()}</p>
        <p className="mt-1 text-sm text-cream/80">
          to {mpesaPhone}{reference ? ` · ref ${reference}` : ""}
        </p>
      </div>

      <div className="rounded-control border border-line bg-white p-4">
        <p className="text-sm font-semibold text-navy">Check your phone</p>
        <ol className="mt-2 space-y-1.5 text-sm text-muted">
          <li>1. A prompt from M-Pesa is waiting on your handset.</li>
          <li>2. Enter your M-Pesa PIN to approve it.</li>
          <li>3. This page updates on its own once it clears.</li>
        </ol>
      </div>

      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 text-sm" role="status">
          <span className={`h-2 w-2 rounded-full ${countdown > 15 ? "bg-success" : "bg-warning"}`} aria-hidden="true" />
          <span className="text-muted">Waiting for payment</span>
          <span className={`font-semibold tabular-nums ${countdown <= 15 ? "text-warning" : "text-ink"}`}>{countdown}s</span>
        </div>
        <p className="text-xs text-muted">Checking automatically. You can also check now.</p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={checkPaymentStatus}
          className="flex-1 rounded-control border border-line py-3 text-sm font-semibold text-navy transition hover:border-navy"
        >
          Check now
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex-1 rounded-control border border-line py-3 text-sm font-semibold text-muted transition hover:border-navy hover:text-navy"
        >
          Change number
        </button>
      </div>
    </div>
  );

  // ── UNCONFIRMED (the 60s window closed without a settled answer) ──
  // Nothing here says the payment failed, because it may not have. The one
  // thing the customer must not do is pay twice.
  if (stage === "unconfirmed") return (
    <div className="space-y-5">
      <div className="rounded-control border border-line bg-white p-5">
        <p className="text-sm font-semibold text-navy">We are still confirming this payment</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Safaricom has not sent us a final answer for {mpesaPhone ? <span className="font-medium text-ink">{mpesaPhone}</span> : "this number"} yet.
          If your M-Pesa SMS shows the money left your account, <strong className="font-semibold text-ink">do not pay again</strong> —
          your order is completed as soon as the confirmation arrives.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Nothing was charged twice and no order has been created yet.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setCountdown(60);
            setStage("waiting");
          }}
          className="flex-1 rounded-control bg-navy py-3 text-sm font-semibold text-white transition hover:bg-navy-hover"
        >
          Check again
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex-1 rounded-control border border-line py-3 text-sm font-semibold text-navy transition hover:border-navy"
        >
          Change number
        </button>
      </div>
    </div>
  );

  // ── SUCCESS ──
  if (stage === "success") return (
    <div className="space-y-3 py-8 text-center" role="status">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
        <svg className="h-7 w-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="font-semibold text-navy">Payment received</p>
      <p className="text-sm text-muted">Saving your order…</p>
    </div>
  );

  // ── UNCONFIRMED ──
  // The prompt was sent but neither the callback nor a status check has
  // confirmed it. We do not know, so we say so — and we never invite a second
  // payment for the same order while the first might still land.
  if (stage === "unconfirmed") return (
    <div className="space-y-4 rounded-control border border-line bg-white p-5">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
          <span className="text-2xl font-bold text-warning" aria-hidden="true">?</span>
        </div>
        <p className="font-semibold text-navy">Still confirming your payment</p>
        <p className="text-sm text-muted">
          We have not heard back from M-Pesa yet. If your phone shows an M-Pesa
          message for KSh {displayAmount.toLocaleString()}, the payment went
          through — <strong className="font-semibold text-navy">do not pay again</strong>.
          Your order is saved as soon as the confirmation arrives.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setCountdown(60);
            setStage("waiting");
            checkPaymentStatus();
          }}
          className="flex-1 rounded-control border border-line py-3 text-sm font-semibold text-navy transition hover:border-navy"
        >
          Check again
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex-1 rounded-control border border-line py-3 text-sm font-semibold text-muted transition hover:border-navy hover:text-navy"
        >
          Use another number
        </button>
      </div>
    </div>
  );

  // ── FAILED (not the customer's doing) ──
  // Safaricom refused the payment for a reason that is ours — a short code or
  // passkey it does not recognise, a merchant that "does not exist". The
  // customer did nothing wrong and is told nothing they cannot act on; the
  // code goes to the console and, from there, to support.
  if (stage === "failed") return (
    <div className="space-y-3 py-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error/10">
        <svg className="h-7 w-7 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="font-semibold text-navy">Payment not completed</p>
      <p className="text-sm text-muted">
        Payment could not be started. Please try again or contact support.
      </p>
      <p className="text-xs text-muted">Nothing was charged.</p>
      {failure?.resultCode !== null && failure?.resultCode !== undefined && (
        <p className="text-[11px] text-muted">
          Reference for support: M-Pesa result {failure.resultCode}
          {failure.resultDesc ? ` — ${failure.resultDesc}` : ""}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" onClick={reset} className="btn-primary text-sm">
          Try again
        </button>
        {onFallback && (
          <button
            type="button"
            onClick={() => { reset(); onFallback(); }}
            className="min-h-11 rounded-control border border-line px-4 text-sm font-semibold text-navy transition hover:border-navy"
          >
            Pay on delivery instead
          </button>
        )}
      </div>
    </div>
  );

  // ── CANCELLED ──
  // Reached only for ResultCode 1032 (cancelled on the phone) or 1037
  // (timed out), so the sentence below is always true.
  if (stage === "cancelled") return (
    <div className="space-y-3 py-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error/10">
        <svg className="h-7 w-7 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="font-semibold text-navy">Payment not completed</p>
      <p className="text-sm text-muted">The request was cancelled or timed out. Nothing was charged.</p>
      <button type="button" onClick={reset} className="btn-primary text-sm">
        Try again
      </button>
    </div>
  );
}

function CodFlow({ total, onSuccess, disabled = false }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4"><div><p className="font-bold text-amber-800">Cash on delivery</p><p className="text-sm text-amber-700">Pay in cash when your books arrive.</p></div></div>
        <ul className="space-y-2.5">
          {[
            `Have KSh ${total.toLocaleString()} ready when the books arrive`,
            "The rider will call the phone number you gave us",
            "We use this number if we need to reach you about the delivery",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm text-amber-800">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{t}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-stone-50 rounded-xl p-4 text-sm">
        <div className="flex justify-between font-bold text-[#1B2A4A]"><span>Pay on delivery</span><span>KSh {total.toLocaleString()}</span></div>
      </div>
      <label className="flex items-start gap-3 cursor-pointer group">
        <div onClick={() => setAgreed(!agreed)} className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition ${agreed ? "bg-[#1B2A4A] border-[#1B2A4A]" : "border-stone-300 group-hover:border-stone-400"}`}>
          {agreed && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
        <span className="text-sm text-stone-600 leading-relaxed">I understand I must pay <strong className="text-[#1B2A4A]">KSh {total.toLocaleString()}</strong> in cash to the delivery rider.</span>
      </label>
      <button
        type="button"
        onClick={() => agreed && !disabled && onSuccess("cod")}
        disabled={!agreed || disabled}
        className="btn-primary w-full text-base disabled:bg-stone-200 disabled:text-muted disabled:cursor-not-allowed"
      >
        Place order — pay on delivery
      </button>
      {disabled && (
        <p className="text-center text-xs text-muted">Add your delivery details above to place the order.</p>
      )}
    </div>
  );
}

// Whether M-Pesa can be offered is decided by the server, which is the only
// place that can see the Daraja credentials. A build-time flag used to gate
// this, which meant the UI and the API could disagree after a settings change:
// now the tab appears only when /api/mpesa/status says a real push can be sent.
function StepPayment({ details, total, items, reference, canPay, ready = true, mpesaEnabled = false, onSuccess, onBack }) {
  const [chosen, setChosen] = useState(null);
  const method = chosen ?? (mpesaEnabled ? "mpesa" : "cod");
  const grand = total + deliveryFeeFor(total);
  const methods = [
    ...(mpesaEnabled ? [{ id: "mpesa", label: "M-Pesa", sub: "Pay from your phone", icon: "M", color: "bg-[#2F7D4F]" }] : []),
    { id: "cod", label: "Cash on delivery", sub: "Pay the rider", icon: "KSh", color: "bg-navy" },
  ];

  // Orders are attached to a verified account server-side, so payment needs
  // a session. Say so plainly instead of taking money for an unsaved order.
  if (!canPay) {
    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-bold text-[#1B2A4A] mb-1">Sign in to complete your order</h2>
        <p className="text-stone-500 text-sm">
          Orders are linked to your BookHaven account so you can track them and we can reach
          you about delivery.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Your basket is saved. Sign in or create an account and you will return straight to checkout.
        </div>
        <Link href="/login?next=/checkout" className="block text-center bg-[#1B2A4A] hover:bg-[#B5532F] text-white py-4 rounded-xl font-bold transition">
          Sign in to continue
        </Link>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-stone-600 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to details
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-sienna">Step 2 of 3</p>
      <h2 className="mt-1 text-2xl font-bold text-navy">Payment</h2>
      <p className="text-muted text-sm mt-1 mb-6">
        {details.firstName || details.city
          ? <>Delivering to <span className="font-semibold text-ink">{[details.firstName, details.lastName].filter(Boolean).join(" ")}</span>{details.city ? ` · ${details.city}` : ""}</>
          : "Choose how you would like to pay."}
      </p>
      <div className={`grid gap-3 mb-7 ${methods.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {methods.map((m) => (
          <button key={m.id} onClick={() => setChosen(m.id)} className={`p-3 rounded-xl border-2 text-center transition-all duration-200 ${method === m.id ? "border-[#B5532F] bg-[#B5532F]/5" : "border-[#E3DCCB] hover:border-stone-300 bg-white"}`}>
            <div className={`w-9 h-9 ${m.color} rounded-lg flex items-center justify-center mx-auto mb-2`}><span className="text-white font-black text-sm">{m.icon}</span></div>
            <p className={`text-xs font-bold leading-tight ${method === m.id ? "text-[#B5532F]" : "text-stone-700"}`}>{m.label}</p>
            <p className="text-[10px] text-muted mt-0.5">{m.sub}</p>
          </button>
        ))}
      </div>
      <div className="bg-stone-50/50 rounded-2xl p-1">
        <div className="bg-white rounded-xl p-5 border border-stone-100">
          {method === "mpesa" && <MpesaFlow phone={details.phone} total={grand} reference={reference} items={items} ready={ready} onSuccess={onSuccess} onFallback={() => setChosen("cod")} />}
          {method === "cod" && <CodFlow total={grand} onSuccess={onSuccess} disabled={!ready} />}
        </div>
      </div>
      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        Paying places an order under our{" "}
        <Link href="/terms" className="font-semibold text-sienna underline-offset-2 hover:underline">terms of sale</Link>.
        Delivery is {DELIVERY_PERCENT}% of the book total, shown above before you pay —{" "}
        <Link href="/help#delivery" className="font-semibold text-sienna underline-offset-2 hover:underline">how delivery works</Link>.
      </p>
      {onBack && (
        <button type="button" onClick={onBack} className="mt-4 text-sm text-muted hover:text-navy underline underline-offset-2">
          Back to delivery details
        </button>
      )}
    </div>
  );
}

function StepConfirmation({ order, reference, details, method, cart, total, saveError, stockError, saving, onRetry }) {
  const grand = order?.total ?? total + deliveryFeeFor(total);
  const methodLabels = { mpesa: "M-Pesa", cod: "Cash on Delivery" };
  // The reference customers quote to support is derived from the saved order
  // id. Before the order exists there is nothing real to quote, so we show
  // the M-Pesa transaction instead of inventing a code.
  const shownRef = order ? orderReference(order.id) : (reference || "—");
  const paidAlready = method === "mpesa";

  return (
    <div className="text-center py-4 animate-slide-up">
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center ${order ? "bg-green-100" : "bg-amber-100"}`}>
          {order
            ? <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-12 h-12 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-navy">{order ? "Order received" : "Your order could not be saved"}</h1>
      <p className="text-stone-500 mt-2 mb-8">
        {order
          ? `Thank you ${details.firstName}. We have your order and will be in touch about delivery.`
          : `Thank you ${details.firstName}. We need to sort one thing out before this order is complete.`}
      </p>

      {stockError && (
        <div className="max-w-sm mx-auto mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-left text-sm text-red-800">
          {stockError}
          {paidAlready && <> Your payment was received — please contact support with reference <strong>{shownRef}</strong> and we&apos;ll sort out a substitute or refund for that item.</>}
        </div>
      )}

      {saveError && !stockError && (
        <div className="max-w-sm mx-auto mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm text-amber-800 space-y-2">
          <p>{saveError}</p>
          <p>
            {paidAlready
              ? <>Your M-Pesa payment went through but the order was not recorded. Save this reference and contact support — do <strong>not</strong> pay again.</>
              : <>Nothing has been charged. You can safely try again.</>}
          </p>
          <button onClick={onRetry} disabled={saving} className="w-full bg-[#1B2A4A] hover:bg-[#B5532F] disabled:opacity-60 text-white py-3 rounded-xl font-bold text-sm transition">
            {saving ? "Saving…" : "Try saving the order again"}
          </button>
        </div>
      )}

      <div className="bg-stone-50 rounded-2xl p-6 text-left max-w-sm mx-auto space-y-3 mb-6">
        {[
          { label: order ? "Order reference" : "Payment reference", value: shownRef, mono: true },
          { label: "Delivering to", value: `${details.address}, ${details.city}` },
          { label: "Payment", value: methodLabels[method] || method },
          { label: order ? "Amount due" : "Amount", value: `KSh ${grand.toLocaleString()}` },
          ...(order?.subtotal != null ? [{ label: "Subtotal", value: `KSh ${order.subtotal.toLocaleString()}` }, { label: "Delivery", value: order.delivery_fee ? `KSh ${order.delivery_fee.toLocaleString()}` : "Free" }] : []),
        ].map(({ label, value, mono }) => (
          <div key={label} className="flex justify-between text-sm gap-4">
            <span className="text-stone-500 flex-shrink-0">{label}</span>
            <span className={`font-semibold text-[#1B2A4A] text-right ${mono ? "font-mono" : ""}`}>{value}</span>
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
        {order
          ? "No receipt email is sent yet. This page and your account page are the record of this order."
          : "Keep the reference above. If money left your account, contact us before trying again."}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/account" className="bg-[#1B2A4A] hover:bg-[#B5532F] text-white px-8 py-3.5 rounded-xl font-bold transition-all active:scale-95">View my orders</Link>
        <Link href="/books" className="border-2 border-[#E3DCCB] hover:border-stone-300 text-stone-600 px-8 py-3.5 rounded-xl font-bold transition-all">Continue shopping</Link>
      </div>
    </div>
  );
}

// Minimal chrome for the states that are decided before the checkout form
// exists: a focused page still needs a way back to the shop and to the basket.
function CheckoutChrome({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link href="/" className="font-playfair text-lg font-bold text-navy transition-colors hover:text-sienna">
            Book Haven
          </Link>
          <Link href="/books" className="text-sm text-muted underline-offset-2 hover:text-navy hover:underline">
            Continue shopping
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">{children}</main>
    </div>
  );
}

export default function CheckoutPage() {
  const [cart, setCart] = useState([]);
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [order, setOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [stockError, setStockError] = useState(null);
  const [signedIn, setSignedIn] = useState(null); // null = still checking
  // Payment options come from the server, never from a build-time flag: only
  // the server can see whether the Daraja credentials are present.
  const [mpesaEnabled, setMpesaEnabled] = useState(false);
  const [details, setDetails] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", city: "", notes: "" });
  // Saved addresses and the "remember this one" choice. Both only apply to a
  // signed-in customer; a guest checkout never sees the picker.
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [rememberAddress, setRememberAddress] = useState(true);


  // There is deliberately no invented "order reference" here. Before the
  // order exists the only real identifier is the M-Pesa checkout request id,
  // and that is what the confirmation shows if saving the order fails.
  const reference = checkoutRequestId;

  // Stable per checkout attempt: a double click or a retry with the same
  // key returns the original order instead of creating a duplicate.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `bh-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const [basketNotice, setBasketNotice] = useState("");
  // False until the saved basket has been read and reconciled, so an empty
  // basket is never shown to someone who has items on their device.
  const [cartReady, setCartReady] = useState(false);

  // Restore the basket, then reconcile it with the live catalogue. A customer
  // can leave items in the basket for days; prices and stock may have moved on
  // since. Showing yesterday's total and only failing at submit is the
  // behaviour this replaces.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem("bh_cart") || "[]");
      } catch {
        saved = [];
      }
      if (!Array.isArray(saved) || saved.length === 0) {
        if (!cancelled) {
          setCart([]);
          setCartReady(true);
        }
        return;
      }

      const { data } = await supabase
        .from("books")
        .select("id,title,price,stock_quantity,is_archived")
        .in("id", saved.map((i) => i.id));

      const live = new Map((data || []).map((row) => [row.id, row]));
      const notes = [];

      const next = saved.flatMap((item) => {
        const row = live.get(item.id);
        if (!row || row.is_archived) {
          notes.push(`“${item.title}” is no longer available and was removed.`);
          return [];
        }
        const cap = Math.max(0, Number(row.stock_quantity) || 0);
        if (cap === 0) {
          notes.push(`“${item.title}” sold out and was removed.`);
          return [];
        }
        const quantity = Math.min(Number(item.quantity) || 1, cap);
        if (quantity !== item.quantity) {
          notes.push(`Only ${cap} copies of “${item.title}” remain — quantity reduced.`);
        }
        if (Number(row.price) !== Number(item.price)) {
          notes.push(`The price of “${item.title}” changed to KSh ${Number(row.price).toLocaleString("en-KE")}.`);
        }
        return [{ ...item, price: row.price, stock_quantity: cap, quantity }];
      });

      if (cancelled) return;
      setCart(next);
      setCartReady(true);
      setBasketNotice(notes.join(" "));
      try {
        localStorage.setItem("bh_cart", JSON.stringify(next));
      } catch {}
    })();

    return () => { cancelled = true; };
  }, []);

  // Quantity edits made here must survive a refresh and stay in step with the
  // drawer on the other pages, which reads the same key.
  const commitCart = (next) => {
    setCart(next);
    try {
      localStorage.setItem("bh_cart", JSON.stringify(next));
    } catch {}
  };

  const changeQty = (id, delta) => {
    commitCart(cart.map((item) => {
      if (item.id !== id) return item;
      const cap = Number.isFinite(Number(item.stock_quantity)) ? Number(item.stock_quantity) : 99;
      return { ...item, quantity: Math.min(cap, Math.max(0, item.quantity + delta)) };
    }).filter((item) => item.quantity > 0));
  };

  const removeItem = (id) => commitCart(cart.filter((item) => item.id !== id));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mpesa/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setMpesaEnabled(!!data?.enabled); })
      .catch(() => { if (!cancelled) setMpesaEnabled(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => { if (!cancelled) setSignedIn(!!session); })
      .catch(() => { if (!cancelled) setSignedIn(false); });
    return () => { cancelled = true; };
  }, []);

  // Load the customer's saved addresses once we know they are signed in.
  // Failure is silent on purpose: the delivery form still works without them.
  useEffect(() => {
    if (signedIn !== true) return;
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch("/api/adresses", {
          headers: { authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setSavedAddresses(Array.isArray(json?.addresses) ? json.addresses : []);
      } catch {
        // Ignored: an address book is a convenience, not a checkout blocker.
      }
    })();

    return () => { cancelled = true; };
  }, [signedIn]);

  const useSavedAddress = (addr) => {
    setDetails((prev) => ({
      ...prev,
      address: addr.address || "",
      city: addr.city || "",
      phone: addr.phone || prev.phone,
      firstName: addr.name?.split(" ")[0] || prev.firstName,
      lastName: addr.name?.split(" ").slice(1).join(" ") || prev.lastName,
    }));
  };

  // Store the address after a successful order. Deduplicated against what is
  // already saved; a failure here must never surface as an order error,
  // because the order itself is already safely in the database.
  const rememberDeliveryAddress = async (session) => {
    if (!rememberAddress || !session) return;
    const name = [details.firstName, details.lastName].filter(Boolean).join(" ").trim();
    if (!name || !details.address || !details.city || !details.phone) return;

    const duplicate = savedAddresses.some(
      (a) => a.address === details.address && a.city === details.city && a.phone === details.phone
    );
    if (duplicate) return;

    try {
      await fetch("/api/adresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          label: "Home",
          name,
          address: details.address,
          city: details.city,
          phone: details.phone,
          is_default: savedAddresses.length === 0,
        }),
      });
    } catch {
      // Ignored by design — see the note above.
    }
  };

  const updateDetail = (key, val) => setDetails((p) => ({ ...p, [key]: val }));
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const detailsValid = Object.keys(validateDetails(details)).length === 0;

  const saveOrder = async (method, checkoutId) => {
    setSaving(true);
    setSaveError(null);
    setStockError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in to save your order.");

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        // Prices/totals are NOT sent: the server recomputes them from the
        // catalogue and returns the authoritative order.
        body: JSON.stringify({
          items: cart.map(({ id, quantity }) => ({ id, quantity })),
          deliveryDetails: details,
          paymentMethod: method,
          checkoutRequestId: checkoutId || null,
          idempotencyKey,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.order) {
        if (json.code === "INSUFFICIENT_STOCK") {
          setStockError(json.error);
          setStep(3);
          return;
        }
        throw new Error(json.error || `Could not save the order (${res.status}).`);
      }

      setOrder(json.order);
      setStep(3);
      // Only empty the basket once the order really exists in the database.
      localStorage.removeItem("bh_cart");
      void rememberDeliveryAddress(session);
    } catch (err) {
      console.error("Order save failed:", err);
      setSaveError(err.message || "Could not save your order.");
      setStep(3);
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentSuccess = (method, checkoutId) => {
    setPaymentMethod(method);
    setCheckoutRequestId(checkoutId || null);
    saveOrder(method, checkoutId);
  };

  // An empty basket is a dead end whether or not the visitor is signed in,
  // so answer that question first instead of asking them to sign in.
  if (cartReady && cart.length === 0 && step < 3) {
    return (
      <CheckoutChrome>
        <h1 className="font-playfair text-2xl font-bold text-navy">Your basket is empty</h1>
        <p className="mt-2 text-sm text-muted">Add a book before checking out.</p>
        <Link href="/books" className="btn-primary mt-6 text-sm">Browse the shelf</Link>
      </CheckoutChrome>
    );
  }

  // The order is attached to an account, so paying before signing in could
  // take money for an order we cannot create. Ask first, and say why.
  if (signedIn === false && step < 3) {
    return (
      <CheckoutChrome>
        <div className="rounded-card border border-line bg-white p-6 text-center sm:p-7">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-subtle" aria-hidden="true">
            <svg className="h-6 w-6 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#1B2A4A]">Sign in to finish your order</h1>
          <p className="text-sm text-stone-500 mt-2">
            Orders are tied to your account so you can track delivery and keep a record of every purchase.
          </p>
          <p className="text-xs text-muted mt-3">
            {cart.length === 0
              ? "Your basket is empty."
              : `Your ${cart.reduce((n, i) => n + i.quantity, 0)} item basket is saved on this device — nothing is lost.`}
          </p>
          <div className="mt-6 space-y-2">
            <Link
              href="/login?next=%2Fcheckout"
              className="block w-full bg-[#B5532F] hover:bg-[#96431F] text-white py-3 rounded-xl font-bold transition"
            >
              Sign in
            </Link>
            <Link
              href="/login?tab=register&next=%2Fcheckout"
              className="block w-full border-2 border-[#E3DCCB] hover:border-[#B5532F] text-stone-700 py-3 rounded-xl font-bold transition"
            >
              Create an account
            </Link>
          </div>
          <Link href="/books" className="mt-5 inline-block text-xs text-muted hover:text-sienna">
            ← Continue browsing
          </Link>
        </div>
      </CheckoutChrome>
    );
  }

  if (signedIn === null && step < 3) {
    return (
      <CheckoutChrome>
        <p className="text-sm text-muted" role="status">Checking your session…</p>
      </CheckoutChrome>
    );
  }


  return (
    <div className="min-h-screen bg-[#FAF6EE]">
      <header className="bg-white border-b border-[#E3DCCB] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="font-playfair text-lg font-bold text-navy hover:text-sienna transition-colors">
            Book Haven
          </Link>
          <Link href="/books" className="text-sm text-muted hover:text-navy underline-offset-2 hover:underline">
            Continue shopping
          </Link>
        </div>
      </header>

      {step < 3 && (
        <div className="lg:hidden bg-white border-b border-[#E3DCCB] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-600">Order total</span>
            <span className="text-sm font-black text-[#1B2A4A]">KSh {(total + deliveryFeeFor(total)).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {cart.slice(0, 3).map((item, i) => (
              <div key={i} className="w-7 rounded-sm overflow-hidden" style={{ aspectRatio: "2/3" }}>
                <BookCover book={item} className="w-full h-full" />
              </div>
            ))}
            {cart.length > 3 && <span className="text-xs text-muted font-medium">+{cart.length - 3}</span>}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6 text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-navy">Checkout</h1>
          <p className="mt-1 text-sm text-muted">Delivery and payment on one page.</p>
        </div>
        <StepBar step={step === 3 ? 3 : detailsValid ? 2 : 1} />
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">
          <div className="bg-white rounded-card border border-line p-4 sm:p-6 lg:p-8">
            {basketNotice && step < 3 && (
              <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800" role="status">
                {basketNotice}
              </div>
            )}
            {step < 3 && (
              <>
                <StepDetails
                  data={details}
                  onChange={updateDetail}
                  saved={savedAddresses}
                  onPickSaved={useSavedAddress}
                  remember={rememberAddress}
                  onRemember={setRememberAddress}
                  onNext={() => document.getElementById("payment-block")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                />

                <section id="payment-block" aria-labelledby="payment-heading" className="mt-8 border-t border-line pt-8 scroll-mt-24">
                  <StepPayment
                    details={details}
                    total={total}
                    items={cart.map(({ id, quantity }) => ({ id, quantity }))}
                    reference={reference}
                    canPay={signedIn === true}
                    ready={detailsValid}
                    mpesaEnabled={mpesaEnabled}
                    onSuccess={handlePaymentSuccess}
                  />
                </section>
              </>
            )}
            {step === 3 && (
              <StepConfirmation
                order={order}
                reference={reference}
                details={details}
                method={paymentMethod}
                cart={cart}
                total={total}
                saveError={saveError}
                stockError={stockError}
                saving={saving}
                onRetry={() => saveOrder(paymentMethod, checkoutRequestId)}
              />
            )}
          </div>
          {step < 3 && (
            <div className="hidden lg:block">
              <OrderSummary cart={cart} total={total} onChangeQty={changeQty} onRemove={removeItem} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
