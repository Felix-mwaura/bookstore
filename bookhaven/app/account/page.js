"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import StoreLayout from "../components/StoreLayout";
import {
  FULFILMENT_META,
  PAYMENT_META,
  orderReference,
  paymentDue,
  toneClass,
} from "../lib/orders";
import { formatKsh } from "../lib/site";

// ─────────────────────────────────────────────────────────
// Small presentational helpers
// ─────────────────────────────────────────────────────────
function StatusPill({ meta, fallback }) {
  const tone = meta?.tone || "stone";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClass(tone)}`}>
      <span aria-hidden="true">{tone === "green" ? "✓" : tone === "red" ? "!" : "•"}</span>
      {meta?.label || fallback}
    </span>
  );
}

function Field({ id, label, hint, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-error">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full min-h-11 rounded-control border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-navy focus-visible:ring-2 focus-visible:ring-navy/20 disabled:opacity-60";

function LoadingPanel() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10" aria-busy="true" aria-live="polite">
      <div className="h-7 w-48 rounded bg-subtle animate-pulse" />
      <div className="mt-3 h-4 w-64 rounded bg-subtle animate-pulse" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-32 rounded-card bg-white border border-line" />
        <div className="h-32 rounded-card bg-white border border-line" />
      </div>
      <span className="sr-only">Loading your account…</span>
    </div>
  );
}

const TABS = [
  { id: "orders", label: "Orders" },
  { id: "profile", label: "Profile" },
  { id: "security", label: "Password" },
];

export default function AccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({});
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("orders");

  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Password state. `recovering` is true when the visitor arrived from a
  // reset email, which is the only moment they are allowed to change a
  // password without knowing the old one.
  const [recovering, setRecovering] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  // ── load session, profile and orders ───────────────────
  useEffect(() => {
    let cancelled = false;
    let giveUp = null;

    // A password-reset email can arrive in either shape: an implicit-flow
    // hash (#access_token=…&type=recovery) or a PKCE `?code=` that the
    // Supabase client exchanges in the background. Both leave the tokens in
    // the URL for a moment, so the page must not bounce the visitor to
    // /login while that exchange is still in flight.
    const fromLink =
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).has("code") ||
        window.location.hash.includes("type=recovery"));

    async function load() {
      if (fromLink) {
        setRecovering(true);
        setActiveTab("security");
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        if (fromLink) {
          // Wait for the exchange. If it never completes, send them back to
          // the reset form rather than showing a spinner forever.
          giveUp = window.setTimeout(() => {
            if (!cancelled) router.replace("/login?mode=reset");
          }, 8000);
          return;
        }
        router.replace("/login?next=%2Faccount");
        return;
      }

      if (cancelled) return;
      setUser(session.user);

      const [{ data: prof }, { data: orderRows, error: orderError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        supabase
          .from("orders")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;
      setProfile(prof || {});
      setForm({
        firstName: prof?.first_name || session.user.user_metadata?.first_name || "",
        lastName: prof?.last_name || session.user.user_metadata?.last_name || "",
        phone: prof?.phone || session.user.user_metadata?.phone || "",
      });
      if (orderError) setLoadError("We couldn’t load your orders just now. Refresh to try again.");
      setOrders(orderRows || []);
      setLoading(false);
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovering(true);
        setActiveTab("security");
        setLoading(false);
        if (session?.user) setUser(session.user);
      }
      // PKCE does not emit PASSWORD_RECOVERY; it just signs the visitor in
      // after the code exchange. Re-run the loader once that session exists.
      if (event === "SIGNED_IN" && session && fromLink && !cancelled) {
        setRecovering(true);
        setActiveTab("security");
        load();
      }
      if (event === "SIGNED_OUT") router.replace("/login");
    });

    return () => {
      cancelled = true;
      if (giveUp) window.clearTimeout(giveUp);
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.payment_status === "paid" && o.status !== "Cancelled");
    return {
      orders: orders.length,
      spent: paid.reduce((sum, o) => sum + (o.total || 0), 0),
      open: orders.filter((o) => !["Delivered", "Cancelled"].includes(o.status)).length,
    };
  }, [orders]);

  // ── profile save ────────────────────────────────────────
  async function saveProfile(event) {
    event.preventDefault();
    const errors = {};
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const phone = form.phone.trim();

    if (firstName.length < 2) errors.firstName = "Enter your first name.";
    if (lastName.length < 2) errors.lastName = "Enter your last name.";
    if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) errors.phone = "Use digits, spaces, +, - or brackets.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName, phone })
      .eq("id", user.id);

    if (error) {
      setSaving(false);
      showToast("We couldn’t save your details. Try again.", "error");
      return;
    }

    // Keep auth metadata in step so the header greeting follows the profile.
    await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName, phone },
    });

    setProfile((p) => ({ ...p, first_name: firstName, last_name: lastName, phone }));
    setSaving(false);
    showToast("Profile saved.");
  }

  // ── password change / recovery ─────────────────────────
  async function savePassword(event) {
    event.preventDefault();
    setPwError("");

    if (pw.next.length < 8) return setPwError("Use at least 8 characters.");
    if (!/[A-Za-z]/.test(pw.next) || !/[0-9]/.test(pw.next)) {
      return setPwError("Include at least one letter and one number.");
    }
    if (pw.next !== pw.confirm) return setPwError("The two passwords don’t match.");
    if (user?.email && pw.next.toLowerCase() === user.email.toLowerCase()) {
      return setPwError("Choose a password that isn’t your email address.");
    }

    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwBusy(false);

    if (error) {
      setPwError(
        /should be different|same password/i.test(error.message)
          ? "That is already your password. Choose a new one."
          : "We couldn’t change your password. Request a fresh reset link and try again."
      );
      return;
    }

    setPw({ next: "", confirm: "" });
    setRecovering(false);
    // Drop the recovery tokens from the address bar once they are spent.
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    showToast("Password updated. Use it next time you sign in.");
  }

  if (loading) {
    return (
      <StoreLayout>
        <LoadingPanel />
      </StoreLayout>
    );
  }

  const displayName = profile.first_name || user?.user_metadata?.first_name || "";

  return (
    <StoreLayout>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
        {toast && (
          <div
            role="status"
            className={`fixed inset-x-4 top-4 z-[100] mx-auto max-w-sm rounded-card px-4 py-3 text-sm font-medium text-white shadow-pop sm:left-auto sm:right-6 ${
              toast.type === "error" ? "bg-error" : "bg-navy"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {recovering && (
          <div role="status" className="mb-6 rounded-card border border-warning/40 bg-warning/10 px-4 py-3">
            <p className="text-sm font-semibold text-navy">Set a new password</p>
            <p className="mt-0.5 text-xs text-muted">
              You arrived from an emailed link. If you asked to reset your password, choose a new one
              below — the link stops working once you save. Otherwise you can ignore this and use the
              other tabs.
            </p>
          </div>
        )}

        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-sienna">Your account</p>
          <h1 className="mt-1 font-playfair text-2xl font-bold text-navy sm:text-3xl">
            {displayName ? `Hello, ${displayName}` : "Your account"}
          </h1>
          <p className="mt-1 text-sm text-muted">{user?.email}</p>
        </header>

        <dl className="mb-8 grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { label: "Orders", value: stats.orders },
            { label: "In progress", value: stats.open },
            { label: "Paid to date", value: formatKsh(stats.spent) },
          ].map((item) => (
            <div key={item.label} className="rounded-card border border-line bg-white p-3 text-center sm:p-4">
              <dd className="text-lg font-bold text-navy sm:text-2xl">{item.value}</dd>
              <dt className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">{item.label}</dt>
            </div>
          ))}
        </dl>

        <div role="tablist" aria-label="Account sections" className="mb-6 flex w-full gap-1 overflow-x-auto rounded-card border border-line bg-white p-1 sm:w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-11 flex-1 whitespace-nowrap rounded-[6px] px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
                activeTab === tab.id ? "bg-navy text-white" : "text-muted hover:bg-subtle hover:text-navy"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── orders ─────────────────────────────────────── */}
        {activeTab === "orders" && (
          <section role="tabpanel" id="panel-orders" aria-labelledby="tab-orders" className="space-y-4">
            {loadError && (
              <p role="alert" className="rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
                {loadError}
              </p>
            )}

            {orders.length === 0 ? (
              <div className="rounded-card border border-line bg-white px-6 py-14 text-center">
                <h2 className="font-playfair text-xl font-bold text-navy">No orders yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  When you place an order it will appear here, with its delivery status and what you still owe.
                </p>
                <Link href="/books" className="btn-primary mt-6 text-sm">Browse the shelf</Link>
              </div>
            ) : (
              orders.map((order) => (
                <article key={order.id} className="overflow-hidden rounded-card border border-line bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted">{orderReference(order.id)}</p>
                      <p className="text-xs text-muted">
                        {new Date(order.created_at).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill meta={FULFILMENT_META[order.status]} fallback={order.status} />
                      <StatusPill meta={PAYMENT_META[order.payment_status]} fallback={order.payment_status} />
                    </div>
                  </div>

                  <div className="px-4 py-4 sm:px-5">
                    <ul className="space-y-2">
                      {(order.items || []).map((item, index) => (
                        <li key={`${order.id}-${index}`} className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-navy">{item.title}</p>
                            <p className="truncate text-xs text-muted">
                              {item.author}
                              {item.quantity > 1 ? ` · ${item.quantity} copies` : ""}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-navy">
                            {formatKsh((item.price || 0) * (item.quantity || 1))}
                          </p>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                      <div className="text-xs text-muted">
                        <p>
                          {order.payment_method === "cod"
                            ? "Cash on delivery"
                            : order.payment_method === "mpesa"
                              ? "M-Pesa"
                              : order.payment_method}
                          {order.delivery_details?.city ? ` · ${order.delivery_details.city}` : ""}
                        </p>
                        {paymentDue(order) && (
                          <p className="mt-0.5 font-semibold text-navy">
                            {formatKsh(order.total)} due on delivery
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-navy">{formatKsh(order.total)}</span>
                        <Link
                          href={`/orders/${order.id}`}
                          className="inline-flex min-h-11 items-center text-sm font-semibold text-sienna underline underline-offset-2 hover:text-sienna-hover"
                        >
                          View order
                          <span className="sr-only"> {orderReference(order.id)}</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        )}

        {/* ── profile ────────────────────────────────────── */}
        {activeTab === "profile" && (
          <section role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">
            <form onSubmit={saveProfile} className="rounded-card border border-line bg-white p-4 sm:p-6" noValidate>
              <h2 className="font-playfair text-lg font-bold text-navy">Your details</h2>
              <p className="mt-1 text-sm text-muted">
                We use these to address your orders. Your email ({user?.email}) is managed by your sign-in and can’t be edited here.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field id="first-name" label="First name" error={fieldErrors.firstName}>
                  <input
                    id="first-name"
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    aria-invalid={Boolean(fieldErrors.firstName)}
                    aria-describedby={fieldErrors.firstName ? "first-name-error" : undefined}
                    className={inputClass}
                  />
                </Field>
                <Field id="last-name" label="Last name" error={fieldErrors.lastName}>
                  <input
                    id="last-name"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    aria-invalid={Boolean(fieldErrors.lastName)}
                    aria-describedby={fieldErrors.lastName ? "last-name-error" : undefined}
                    className={inputClass}
                  />
                </Field>
                <Field
                  id="phone"
                  label="Phone (optional)"
                  hint="Used by the courier if they need to reach you."
                  error={fieldErrors.phone}
                >
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? "phone-error" : "phone-hint"}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="submit" disabled={saving} className="btn-primary min-h-11 text-sm disabled:opacity-60">
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      firstName: profile.first_name || "",
                      lastName: profile.last_name || "",
                      phone: profile.phone || "",
                    })
                  }
                  className="btn-secondary min-h-11 text-sm"
                >
                  Reset
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ── password ───────────────────────────────────── */}
        {activeTab === "security" && (
          <section role="tabpanel" id="panel-security" aria-labelledby="tab-security">
            <form onSubmit={savePassword} className="rounded-card border border-line bg-white p-4 sm:p-6" noValidate>
              <h2 className="font-playfair text-lg font-bold text-navy">
                {recovering ? "Set a new password" : "Change your password"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                At least 8 characters, with one letter and one number. You’ll stay signed in on this device.
              </p>

              <div className="mt-5 grid gap-4 sm:max-w-md">
                <Field
                  id="new-password"
                  label="New password"
                  hint="Never reuse a password from another site."
                  error={pwError && /8 characters|letter and one number|email address|don’t match/i.test(pwError) ? pwError : ""}
                >
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={pw.next}
                    onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                    aria-describedby="new-password-hint"
                    className={inputClass}
                  />
                </Field>
                <Field id="confirm-password" label="Confirm new password">
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={pw.confirm}
                    onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
              </div>

              {pwError && (
                <p role="alert" className="mt-4 rounded-control border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
                  {pwError}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={pwBusy} className="btn-primary min-h-11 text-sm disabled:opacity-60">
                  {pwBusy ? "Updating…" : recovering ? "Save new password" : "Update password"}
                </button>
                <Link href="/login?mode=reset" className="text-sm font-semibold text-sienna underline underline-offset-2 hover:text-sienna-hover">
                  Forgot your current password?
                </Link>
              </div>
            </form>
          </section>
        )}
      </div>
    </StoreLayout>
  );
}
