"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "../lib/supabase";
import { useAuth, signIn, signUp } from "../lib/auth";
import KittenScene from "../components/KittenScene";

/* ── icons ────────────────────────────────────────────────────────────────
   Decorative line icons for the inputs and the feature list. They are all
   aria-hidden: the label already tells a screen reader what the field is. */

function Icon({ path, className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={path} />
    </svg>
  );
}

const ICONS = {
  person: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0",
  mail: "M3 7.5A2.25 2.25 0 015.25 5.25h13.5A2.25 2.25 0 0121 7.5v9a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 16.5v-9zm0 .75l8.4 5.6a2 2 0 002.2 0L21 8.25",
  lock: "M16.5 10.5V7.5a4.5 4.5 0 10-9 0v3M6 10.5h12a1.5 1.5 0 011.5 1.5v7.5A1.5 1.5 0 0118 21H6a1.5 1.5 0 01-1.5-1.5V12A1.5 1.5 0 016 10.5z",
  personAdd: "M15 21v-1.5a4.5 4.5 0 00-4.5-4.5H6a4.5 4.5 0 00-4.5 4.5V21M8.25 11.25a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5zM19 8v6M22 11h-6",
  book: "M12 6.75C12 5 10.5 3.75 8 3.75H3.75v13.5H8c2.5 0 4 1.25 4 3M12 6.75c0-1.75 1.5-3 4-3h4.25v13.5H16c-2.5 0-4 1.25-4 3",
  heart: "M21 8.25c0 5.25-9 11.25-9 11.25s-9-6-9-11.25a4.5 4.5 0 019-1.2 4.5 4.5 0 019 1.2z",
  truck: "M2.25 6.75h11.25v9.75H2.25zM13.5 10.5h4.5l3 3v3h-7.5M6 19.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm12 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
};

// The primary action on this page is navy rather than the store's usual
// sienna, following the sign-in reference. Contrast is 13:1 (white on
// #1B2A4A), and sienna stays the colour for inline links, so the page still
// reads as Book Haven.
const PRIMARY_BUTTON =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy px-6 text-sm font-semibold text-white transition-colors hover:bg-navy-hover disabled:opacity-70";

/* ── field with a real label, error wiring and a password toggle ── */

function Field({
  label, name, type = "text", placeholder, value, onChange, error, autoComplete, inputMode,
  hint, icon, extra, extraId,
}) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const id = `auth-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null, extraId || null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-navy">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/70">
            <Icon path={icon} className="h-[18px] w-[18px]" />
          </span>
        )}
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
          className={`min-h-12 w-full rounded-xl border bg-white py-3 text-[15px] text-ink outline-none transition
            placeholder:text-muted/60 focus:ring-4 focus:ring-navy/10
            ${icon ? "pl-11" : "pl-3.5"} ${isPassword ? "pr-12" : "pr-3.5"}
            ${error ? "border-error focus:border-error" : "border-line focus:border-navy"}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-navy"
          >
            {revealed ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.05 10.05 0 012.122-.063c4.478 0 8.268 2.943 9.543 7a10.05 10.05 0 01-4.132 5.411M3 3l18 18" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {hint && !error && <p id={hintId} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} className="mt-1 text-xs font-medium text-error">{error}</p>}
      {extra}
    </div>
  );
}

/* ── password rules ──────────────────────────────────────────────────────
   Enforced in RegisterForm below. The list is always visible so the rule is
   known before typing, and each item changes icon as well as colour, so the
   state is never carried by colour alone. */

const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "num", label: "One number", test: (v) => /[0-9]/.test(v) },
  { id: "special", label: "One special character (e.g. @, #, !)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function passwordIsStrong(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

function PasswordRules({ value }) {
  return (
    <ul id="auth-password-rules" className="mt-2.5 grid gap-1.5 rounded-xl bg-subtle/70 p-3.5 sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.id} className={`flex items-center gap-2 text-[12.5px] ${met ? "text-success" : "text-muted"}`}>
            {met ? (
              <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5 flex-shrink-0 text-line" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" strokeWidth={3} />
              </svg>
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
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
    return "That password is not strong enough. Use at least 8 characters with a capital letter and a number.";
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
        <div role="alert" className="rounded-xl border border-error/30 bg-error/5 px-3.5 py-2.5 text-sm text-error">
          {formError}
          {unconfirmed && (
            <button type="button" onClick={resend} disabled={busy} className="mt-2 block font-semibold underline underline-offset-2">
              {resent ? "Verification email sent again." : "Resend the verification email"}
            </button>
          )}
        </div>
      )}

      <Field
        label="Email address" name="email" type="email" placeholder="e.g. you@example.com"
        autoComplete="email" value={email} icon={ICONS.mail}
        onChange={(_, value) => { setEmail(value); setErrors((p) => ({ ...p, email: "" })); }}
        error={errors.email}
      />
      <Field
        label="Password" name="password" type="password" placeholder="Your password"
        autoComplete="current-password" value={password} icon={ICONS.lock}
        onChange={(_, value) => { setPassword(value); setErrors((p) => ({ ...p, password: "" })); }}
        error={errors.password}
      />

      <div className="flex justify-end">
        <Link href="/login?mode=reset" className="text-xs font-semibold text-sienna underline underline-offset-2 hover:text-sienna-hover">
          Forgot your password?
        </Link>
      </div>

      <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            Signing in…
          </>
        ) : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        New to Book Haven?{" "}
        <Link href={nextPath ? `/login?tab=register&next=${encodeURIComponent(nextPath)}` : "/login?tab=register"} className="font-semibold text-sienna underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </form>
  );
}

function RegisterForm({ nextPath, onSignedUp }) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const fullName = form.fullName.trim().replace(/\s+/g, " ");
    const [firstName, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ");

    const found = {};
    if (fullName.length < 2) found.fullName = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) found.email = "Enter a valid email address.";
    if (!passwordIsStrong(form.password)) {
      found.password = "Use at least 8 characters with a capital letter, a number and a symbol.";
    }
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
      firstName,
      lastName,
      phone: "",
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
        <div role="alert" className="rounded-xl border border-error/30 bg-error/5 px-3.5 py-2.5 text-sm text-error">
          {formError}
        </div>
      )}

      <Field
        label="Full name" name="fullName" placeholder="e.g. Alex Mwangi"
        autoComplete="name" value={form.fullName} onChange={update} error={errors.fullName}
        icon={ICONS.person}
      />
      <Field
        label="Email address" name="email" type="email" placeholder="e.g. you@example.com"
        autoComplete="email" value={form.email} onChange={update} error={errors.email}
        icon={ICONS.mail}
      />
      <Field
        label="Password" name="password" type="password" placeholder="Create a strong password"
        autoComplete="new-password" value={form.password} onChange={update} error={errors.password}
        icon={ICONS.lock} extraId="auth-password-rules" extra={<PasswordRules value={form.password} />}
      />
      <Field
        label="Confirm password" name="confirm" type="password" placeholder="Repeat your password"
        autoComplete="new-password" value={form.confirm} onChange={update} error={errors.confirm}
        icon={ICONS.lock}
      />

      <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            Creating account…
          </>
        ) : (
          <>
            <Icon path={ICONS.personAdd} className="h-[18px] w-[18px]" />
            Create account
          </>
        )}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"} className="font-semibold text-sienna underline underline-offset-2">
          Log in
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
        <h2 className="font-inter text-xl font-semibold text-navy">Check your email</h2>
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
      {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/5 px-3.5 py-2.5 text-sm text-error">{error}</p>}
      <Field
        label="Email address" name="email" type="email" autoComplete="email" placeholder="e.g. you@example.com"
        icon={ICONS.mail} value={email} onChange={(_, value) => { setEmail(value); setError(""); }}
      />
      <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-sienna underline underline-offset-2">Back to sign in</Link>
      </p>
    </form>
  );
}

/* ── page ─────────────────────────────────────────────── */

const FEATURES = [
  { icon: ICONS.book, text: "Discover amazing books" },
  { icon: ICONS.heart, text: "Track your favourites" },
  { icon: ICONS.truck, text: "Enjoy fast, reliable delivery" },
];

// The page shell is a server component so the room, the headline and the
// form labels are in the first byte of HTML. Only the interactive parts —
// the inputs, the password checklist and the Supabase calls — hydrate.
export default function AuthPage({ mode, tab, nextPath }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const isRegister = mode !== "reset" && tab === "register";

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

  const cardTitle =
    mode === "reset" ? "Reset your password"
    : isRegister ? "Create your account"
    : "Welcome back";

  const cardSubtitle =
    mode === "reset" ? "We will email you a link to choose a new one."
    : isRegister ? "It only takes a minute. Let's get started!"
    : "Sign in for your orders, saved books and delivery details.";

  const heroTitle =
    mode === "reset" ? "A fresh start."
    : isRegister ? "Join Book Haven!"
    : "Good to see you again.";

  const heroCopy =
    mode === "reset" ? "Choose a new password and get back to your reading list."
    : isRegister ? "Create your account and start your reading journey with us."
    : "Your next favourite read is waiting where you left it.";

  return (
    <div className="min-h-[100dvh] bg-cream">
      <header className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Book Haven home">
          <svg className="h-9 w-9 flex-shrink-0 text-navy" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 8.5C16 6.6 14.2 5.2 11.4 5.2H5.6v17.6h5.8c2.8 0 4.6 1.4 4.6 3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 8.5c0-1.9 1.8-3.3 4.6-3.3h5.8v17.6h-5.8c-2.8 0-4.6 1.4-4.6 3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="leading-tight">
            <span className="block font-playfair text-[22px] font-bold text-navy">Book Haven</span>
            <span className="block text-[11px] font-medium tracking-wide text-muted">More Books. Happier You.</span>
          </span>
        </Link>

        <p className="hidden text-sm text-muted sm:block">
          {mode === "reset" ? null : isRegister ? (
            <>
              Already have an account?{" "}
              <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"} className="font-semibold text-navy underline-offset-4 hover:text-sienna hover:underline">
                Log in
              </Link>
            </>
          ) : (
            <>
              New to Book Haven?{" "}
              <Link href={nextPath ? `/login?tab=register&next=${encodeURIComponent(nextPath)}` : "/login?tab=register"} className="font-semibold text-navy underline-offset-4 hover:text-sienna hover:underline">
                Create an account
              </Link>
            </>
          )}
        </p>
      </header>

      <main className="mx-auto grid w-full max-w-[1360px] items-stretch gap-6 px-4 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-8 lg:pb-14">
        {/* ── the room ── */}
        <section className="relative order-2 overflow-hidden rounded-[26px] bg-[#F6EDDD] px-6 pt-8 pb-[176px] sm:px-10 sm:pt-10 lg:order-1 lg:flex lg:min-h-[600px] lg:flex-col lg:justify-center lg:px-12 lg:pt-12 lg:pb-[248px]">
          <div className="relative z-10 max-w-[460px]">
            <h1 className="font-playfair text-[34px] font-bold leading-[1.12] text-navy sm:text-[42px] lg:text-[46px]">
              {heroTitle}
            </h1>
            <p className="mt-3.5 max-w-[400px] text-[15px] leading-relaxed text-muted sm:text-base">
              {heroCopy}
            </p>

            {isRegister && (
              <ul className="mt-7 space-y-3.5">
                {FEATURES.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-3 text-[15px] text-navy">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/70 text-navy">
                      <Icon path={feature.icon} className="h-[18px] w-[18px]" />
                    </span>
                    {feature.text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <KittenScene />
        </section>

        {/* ── the form ── */}
        <section className="order-1 flex items-start justify-center lg:order-2 lg:items-center">
          <div className="w-full max-w-[520px]">
            <div className="rounded-[26px] border border-line/70 bg-white p-6 shadow-[0_18px_48px_rgba(27,42,74,0.07)] sm:p-8">
              <h2 className="font-inter text-[25px] font-semibold leading-tight text-navy sm:text-[27px]">
                {cardTitle}
              </h2>
              <p className="mt-1.5 mb-6 text-sm text-muted">{cardSubtitle}</p>

              {pendingEmail ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10" aria-hidden="true">
                    <svg className="h-6 w-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-inter text-lg font-semibold text-navy">Check your email</h3>
                  <p className="mt-2 text-sm text-muted">
                    We sent a confirmation link to <span className="font-semibold text-ink">{pendingEmail}</span>.
                    Open it to finish creating your account.
                  </p>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resendBusy || resent}
                    className="mt-5 min-h-11 w-full rounded-xl border border-line bg-white text-sm font-semibold text-navy transition hover:border-navy disabled:text-muted"
                  >
                    {resent ? "Email sent again" : resendBusy ? "Sending…" : "Resend the email"}
                  </button>
                  <Link href="/login" className="mt-3 inline-block text-sm font-semibold text-sienna underline underline-offset-2">
                    Back to sign in
                  </Link>
                </div>
              ) : mode === "reset" ? (
                <ResetForm />
              ) : isRegister ? (
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

            <p className="mt-4 px-2 text-center text-xs leading-relaxed text-muted">
              {isRegister
                ? "By creating an account you agree to us using your details to fulfil your orders and to contact you about them."
                : "Book Haven uses your details only to fulfil your orders and keep your account secure."}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
