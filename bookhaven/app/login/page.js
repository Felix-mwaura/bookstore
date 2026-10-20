"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "../lib/supabase";
import { useAuth, signIn, signUp } from "../lib/auth";

/* ── field with a real label, error wiring and a password toggle ── */

function Field({
  label, name, type = "text", placeholder, value, onChange, error, autoComplete, inputMode, hint,
}) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const id = `auth-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && revealed ? "text" : type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          required
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(name, event.target.value)}
          className={`w-full min-h-11 rounded-control border bg-white px-3.5 py-2.5 text-[15px] outline-none transition focus:ring-2 focus:ring-sienna/20 ${
            error ? "border-error" : "border-line focus:border-navy"
          } ${isPassword ? "pr-12" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-control text-muted hover:text-navy"
          >
            {revealed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.05 10.05 0 012.122-.063c4.478 0 8.268 2.943 9.543 7a10.05 10.05 0 01-4.132 5.411M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {hint && !error && <p id={hintId} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} className="mt-1 text-xs font-medium text-error">{error}</p>}
    </div>
  );
}

/* ── messages ─────────────────────────────────────────── */

// Supabase messages are written for developers. These are written for a
// customer, and deliberately do not reveal whether an address is registered.
function friendlyAuthError(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) {
    return "That email and password did not match. Check them and try again, or create an account.";
  }
  if (message.includes("email not confirmed")) {
    return "That address still needs confirming. Use the resend button below and check your inbox.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts in a short time. Please wait a minute and try again.";
  }
  if (message.includes("password")) {
    return "That password is not strong enough. Use at least 8 characters.";
  }
  if (message.includes("fetch") || message.includes("network")) {
    return "We could not reach the server. Check your connection and try again.";
  }
  return "Something went wrong on our side. Please try again in a moment.";
}

/* ── forms ────────────────────────────────────────────── */

function SignInForm({ nextPath, onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resent, setResent] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) found.email = "Enter a valid email address.";
    if (!password) found.password = "Enter your password.";
    if (Object.keys(found).length) {
      setErrors(found);
      document.getElementById(`auth-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    setBusy(true);
    setFormError("");
    setResent(false);
    setUnconfirmed(false);

    const { data, error } = await signIn({ email: email.trim().toLowerCase(), password });
    if (error) {
      setBusy(false);
      const message = String(error.message || "").toLowerCase();
      setUnconfirmed(message.includes("email not confirmed"));
      setFormError(friendlyAuthError(error));
      return;
    }

    await onSignedIn(data?.user);
  };

  const resend = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase() });
    setBusy(false);
    if (!error) setResent(true);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && (
        <div role="alert" className="rounded-control border border-error/30 bg-error/5 px-3 py-2.5 text-sm text-error">
          {formError}
          {unconfirmed && (
            <button type="button" onClick={resend} disabled={busy} className="mt-2 block font-semibold underline underline-offset-2">
              {resent ? "Verification email sent again." : "Resend the verification email"}
            </button>
          )}
        </div>
      )}

      <Field
        label="Email address" name="email" type="email" placeholder="you@example.com"
        autoComplete="email" value={email} onChange={(_, value) => { setEmail(value); setErrors((p) => ({ ...p, email: "" })); }}
        error={errors.email}
      />
      <Field
        label="Password" name="password" type="password" placeholder="Your password"
        autoComplete="current-password" value={password} onChange={(_, value) => { setPassword(value); setErrors((p) => ({ ...p, password: "" })); }}
        error={errors.password}
      />

      <div className="flex justify-end">
        <Link href="/login?mode=reset" className="text-xs font-semibold text-sienna underline underline-offset-2 hover:text-sienna-hover">
          Forgot your password?
        </Link>
      </div>

      <button type="submit" disabled={busy} className="btn-primary w-full text-sm disabled:opacity-70">
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            Signing in…
          </>
        ) : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href={nextPath ? `/login?tab=register&next=${encodeURIComponent(nextPath)}` : "/login?tab=register"} className="font-semibold text-sienna underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </form>
  );
}

function RegisterForm({ nextPath, onSignedUp }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!form.firstName.trim()) found.firstName = "Enter your first name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) found.email = "Enter a valid email address.";
    if (form.phone && !/^(?:\+?254|0)(?:7|1)\d{8}$/.test(form.phone.replace(/[\s-]/g, ""))) {
      found.phone = "Enter a Kenyan mobile number, e.g. 0712 345 678.";
    }
    if (form.password.length < 8) found.password = "Use at least 8 characters.";
    if (form.password !== form.confirm) found.confirm = "The two passwords do not match.";

    if (Object.keys(found).length) {
      setErrors(found);
      document.getElementById(`auth-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    setBusy(true);
    setFormError("");
    const { data, error } = await signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
    });

    if (error) {
      setBusy(false);
      setFormError(friendlyAuthError(error));
      return;
    }

    // If email confirmation is on, there is no session yet: tell the reader
    // to check their inbox instead of pretending they are signed in.
    if (data?.session) {
      await onSignedUp(data.user);
      return;
    }
    setBusy(false);
    onSignedUp(null, form.email.trim().toLowerCase());
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && (
        <div role="alert" className="rounded-control border border-error/30 bg-error/5 px-3 py-2.5 text-sm text-error">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="firstName" placeholder="Grace" autoComplete="given-name" value={form.firstName} onChange={update} error={errors.firstName} />
        <Field label="Last name" name="lastName" placeholder="Wambui" autoComplete="family-name" value={form.lastName} onChange={update} error={errors.lastName} />
      </div>
      <Field label="Email address" name="email" type="email" placeholder="you@example.com" autoComplete="email" value={form.email} onChange={update} error={errors.email} />
      <Field label="Phone (optional)" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" autoComplete="tel" value={form.phone} onChange={update} error={errors.phone} hint="Used for delivery updates only." />
      <Field label="Password" name="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" value={form.password} onChange={update} error={errors.password} />
      <Field label="Confirm password" name="confirm" type="password" placeholder="Repeat your password" autoComplete="new-password" value={form.confirm} onChange={update} error={errors.confirm} />

      <button type="submit" disabled={busy} className="btn-primary w-full text-sm disabled:opacity-70">
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            Creating account…
          </>
        ) : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"} className="font-semibold text-sienna underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/* ── password reset ───────────────────────────────────── */

function ResetForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email address you signed up with.");
      document.getElementById("auth-email")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/account`,
    });
    setBusy(false);
    if (resetError) setError(friendlyAuthError(resetError));
    else setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-bold text-navy">Check your email</h2>
        <p className="mt-2 text-sm text-muted">
          If an account exists for {email.trim()}, a reset link is on its way. The link expires after a short while.
        </p>
        <Link href="/login" className="btn-secondary mt-5 w-full text-sm">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-muted">Enter your email address and we will send you a link to set a new password.</p>
      {error && <p role="alert" className="rounded-control border border-error/30 bg-error/5 px-3 py-2.5 text-sm text-error">{error}</p>}
      <Field label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(_, value) => { setEmail(value); setError(""); }} />
      <button type="submit" disabled={busy} className="btn-primary w-full text-sm disabled:opacity-70">
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-sienna underline underline-offset-2">Back to sign in</Link>
      </p>
    </form>
  );
}

/* ── page ─────────────────────────────────────────────── */

function AuthInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const mode = searchParams.get("mode") === "reset" ? "reset" : "signin";
  const tab = searchParams.get("tab") === "register" ? "register" : "signin";
  const nextParam = searchParams.get("next") || "";
  // Only same-origin paths are accepted, so /login cannot be used as an
  // open redirect.
  const nextPath = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

  const [pendingEmail, setPendingEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const freshSignIn = useRef(false);

  const destinationFor = async (account) => {
    if (nextPath) return nextPath;
    if (!account) return "/account";
    try {
      const { data } = await supabase.from("profiles").select("role").eq("id", account.id).maybeSingle();
      return data?.role === "admin" ? "/admin" : "/account";
    } catch {
      return "/account";
    }
  };

  const finishSignIn = async (account) => {
    freshSignIn.current = true;
    router.replace(await destinationFor(account));
  };

  // Already signed in when the page loads: skip the form.
  useEffect(() => {
    if (loading || !user || freshSignIn.current) return;
    let cancelled = false;
    destinationFor(user).then((destination) => {
      if (!cancelled) router.replace(destination);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per session change
  }, [user, loading]);

  const resend = async () => {
    setResendBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: pendingEmail });
    setResendBusy(false);
    if (!error) setResent(true);
  };

  const heading =
    mode === "reset" ? "Reset your password"
    : tab === "register" ? "Create your account"
    : "Sign in to Book Haven";

  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col">
      <header className="px-4 sm:px-6 py-4">
        <Link href="/" className="font-playfair text-lg font-bold text-navy hover:text-sienna transition-colors">
          Book Haven
        </Link>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-card border border-line bg-white p-6 sm:p-8 shadow-card">
            <h1 className="text-xl sm:text-2xl font-bold text-navy">{heading}</h1>
            <p className="mt-1.5 mb-6 text-sm text-muted">
              {mode === "reset"
                ? "We will email you a link to choose a new one."
                : tab === "register"
                  ? "Save your basket, track orders and reorder in a tap."
                  : "Your orders, saved books and delivery details."}
            </p>

            {pendingEmail ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10" aria-hidden="true">
                  <svg className="h-6 w-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-navy">Check your email</h2>
                <p className="mt-2 text-sm text-muted">
                  We sent a confirmation link to <span className="font-semibold text-ink">{pendingEmail}</span>.
                  Open it to finish creating your account.
                </p>
                <button
                  type="button"
                  onClick={resend}
                  disabled={resendBusy || resent}
                  className="mt-5 w-full min-h-11 rounded-control border border-line bg-white text-sm font-semibold text-navy hover:border-navy disabled:text-muted"
                >
                  {resent ? "Email sent again" : resendBusy ? "Sending…" : "Resend the email"}
                </button>
                <Link href="/login" className="mt-3 inline-block text-sm font-semibold text-sienna underline underline-offset-2">
                  Back to sign in
                </Link>
              </div>
            ) : mode === "reset" ? (
              <ResetForm />
            ) : tab === "register" ? (
              <RegisterForm
                nextPath={nextPath}
                onSignedUp={(account, email) => {
                  if (account) finishSignIn(account);
                  else setPendingEmail(email);
                }}
              />
            ) : (
              <SignInForm nextPath={nextPath} onSignedIn={finishSignIn} />
            )}
          </div>

          <p className="mt-5 text-center text-xs text-muted">
            By continuing you agree to us using your details to fulfil your orders.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-cream flex items-center justify-center">
          <p className="text-sm text-muted" role="status">Loading…</p>
        </div>
      }
    >
      <AuthInner />
    </Suspense>
  );
}
