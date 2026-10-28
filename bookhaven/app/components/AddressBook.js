"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "../lib/supabase";

// The customer's address book.
//
// /api/addresses has existed since the checkout work but nothing in the
// customer UI ever called it, so the table sits empty and every order asks
// for the same address again. This is the missing half: list, add, edit,
// delete and choose a default.
//
// All of it runs against the customer's own token, and the route re-checks
// ownership on every write — the browser cannot address somebody else's row.

const CITIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Nyeri",
  "Machakos", "Meru", "Garissa", "Kakamega", "Malindi", "Kisii", "Kericho", "Naivasha",
];

const LABELS = ["Home", "Work", "Other"];

const EMPTY = { label: "Home", name: "", address: "", city: "", phone: "" };

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in again.");
  return { authorization: `Bearer ${session.access_token}` };
}

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Enter the recipient's name.";
  if (!form.phone.trim()) errors.phone = "Enter a phone number.";
  else if (!/^(?:\+254|0)?(?:7|1)\d{8}$/.test(form.phone.replace(/[\s-]/g, ""))) {
    errors.phone = "Enter a Kenyan mobile number, e.g. 0712 345 678.";
  }
  if (!form.address.trim()) errors.address = "Enter a street address.";
  if (!form.city) errors.city = "Choose a town or city.";
  return errors;
}

export default function AddressBook() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const [editing, setEditing] = useState(null); // null | "new" | address id
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});

  const load = useCallback(async () => {
    try {
      const headers = await authHeader();
      const res = await fetch("/api/addresses", { headers, cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not load your addresses.");
      setAddresses(Array.isArray(json?.addresses) ? json.addresses : []);
      setError("");
    } catch (err) {
      setError(err?.message || "Could not load your addresses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Kicked off in a microtask: `load` sets state when it resolves, and doing
    // that synchronously inside the effect body would trigger a cascading
    // render (and the lint rule that exists to prevent one).
    let alive = true;
    void (async () => { if (alive) await load(); })();
    return () => { alive = false; };
  }, [load]);

  const startNew = () => {
    setEditing("new");
    setForm(EMPTY);
    setFieldErrors({});
    setNotice("");
    setError("");
  };

  const startEdit = (address) => {
    setEditing(address.id);
    setForm({
      label: address.label || "Home",
      name: address.name || "",
      address: address.address || "",
      city: address.city || "",
      phone: address.phone || "",
    });
    setFieldErrors({});
    setNotice("");
    setError("");
  };

  const cancel = () => {
    setEditing(null);
    setForm(EMPTY);
    setFieldErrors({});
  };

  const save = async (event) => {
    event.preventDefault();
    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setFieldErrors(found);
      return;
    }

    setBusy("save");
    setError("");
    setNotice("");
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const payload = {
        label: form.label,
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city,
        phone: form.phone.trim(),
        // The first address becomes the default; later ones do not steal it.
        is_default: editing === "new" ? addresses.length === 0 : undefined,
      };
      if (editing !== "new" && payload.is_default === undefined) delete payload.is_default;

      const res = await fetch("/api/addresses", {
        method: editing === "new" ? "POST" : "PATCH",
        headers,
        body: JSON.stringify(editing === "new" ? payload : { ...payload, id: editing }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not save that address.");

      setNotice(editing === "new" ? "Address saved." : "Address updated.");
      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err?.message || "Could not save that address.");
    } finally {
      setBusy("");
    }
  };

  const makeDefault = async (address) => {
    setBusy(address.id);
    setError("");
    setNotice("");
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const res = await fetch("/api/addresses", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: address.id, is_default: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not update that address.");
      setNotice("Default address updated.");
      await load();
    } catch (err) {
      setError(err?.message || "Could not update that address.");
    } finally {
      setBusy("");
    }
  };

  const remove = async (address) => {
    if (!window.confirm(`Delete the “${address.label || "saved"}” address? This cannot be undone.`)) return;
    setBusy(address.id);
    setError("");
    setNotice("");
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const res = await fetch("/api/addresses", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ id: address.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not delete that address.");
      setNotice("Address deleted.");
      await load();
    } catch (err) {
      setError(err?.message || "Could not delete that address.");
    } finally {
      setBusy("");
    }
  };

  // `span2` is a layout hint for this helper, not an input attribute — it is
  // pulled out here so React never sees it as an unknown DOM prop.
  const field = (key, label, { span2 = false, ...inputProps } = {}) => (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label htmlFor={`addr-${key}`} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
        {label}
      </label>
      <input
        id={`addr-${key}`}
        value={form[key]}
        onChange={(e) => {
          setForm((prev) => ({ ...prev, [key]: e.target.value }));
          setFieldErrors((prev) => ({ ...prev, [key]: "" }));
        }}
        aria-invalid={fieldErrors[key] ? "true" : undefined}
        aria-describedby={fieldErrors[key] ? `addr-${key}-error` : undefined}
        className={`min-h-11 w-full rounded-control border bg-white px-3 text-sm outline-none transition focus:border-navy ${
          fieldErrors[key] ? "border-error" : "border-line"
        }`}
        {...inputProps}
      />
      {fieldErrors[key] && (
        <p id={`addr-${key}-error`} className="mt-1 text-xs text-error">{fieldErrors[key]}</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <section role="tabpanel" id="panel-addresses" aria-labelledby="tab-addresses" className="space-y-3">
        <div className="h-28 animate-pulse rounded-card border border-line bg-white" />
        <span className="sr-only">Loading your addresses…</span>
      </section>
    );
  }

  return (
    <section role="tabpanel" id="panel-addresses" aria-labelledby="tab-addresses" className="space-y-4">
      {(error || notice) && (
        <p
          role={error ? "alert" : "status"}
          className={`rounded-card border px-4 py-3 text-sm ${
            error ? "border-error/30 bg-error/5 text-error" : "border-success/30 bg-success/5 text-success"
          }`}
        >
          {error || notice}
        </p>
      )}

      {addresses.length === 0 && editing === null && (
        <div className="rounded-card border border-line bg-white p-6 text-center">
          <p className="font-semibold text-navy">No saved addresses yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Save an address once and checkout will offer it next time — no retyping the same
            estate and phone number for every order.
          </p>
          <button type="button" onClick={startNew} className="btn-primary mt-5 text-sm">
            Add an address
          </button>
        </div>
      )}

      {addresses.length > 0 && (
        <ul role="list" className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-card border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
                    {address.label || "Address"}
                    {address.is_default && (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-ink">{address.name}</p>
                  <p className="text-sm text-muted">{address.address}, {address.city}</p>
                  <p className="mt-0.5 text-sm text-muted">{address.phone}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(address)}
                  className="min-h-9 rounded-control border border-line px-3 text-xs font-semibold text-navy transition hover:border-navy"
                >
                  Edit
                </button>
                {!address.is_default && (
                  <button
                    type="button"
                    onClick={() => makeDefault(address)}
                    disabled={busy === address.id}
                    className="min-h-9 rounded-control border border-line px-3 text-xs font-semibold text-navy transition hover:border-navy disabled:opacity-60"
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(address)}
                  disabled={busy === address.id}
                  className="min-h-9 rounded-control border border-line px-3 text-xs font-semibold text-error transition hover:border-error disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {addresses.length > 0 && editing === null && (
        <button type="button" onClick={startNew} className="btn-primary text-sm">
          Add another address
        </button>
      )}

      {editing !== null && (
        <form onSubmit={save} className="rounded-card border border-line bg-white p-5">
          <h2 className="text-base font-bold text-navy">
            {editing === "new" ? "New address" : "Edit address"}
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="addr-label" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                Label
              </label>
              <select
                id="addr-label"
                value={form.label}
                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                className="min-h-11 w-full rounded-control border border-line bg-white px-3 text-sm outline-none transition focus:border-navy"
              >
                {LABELS.map((label) => <option key={label}>{label}</option>)}
              </select>
            </div>
            {field("name", "Recipient name", { autoComplete: "name", placeholder: "Grace Wambui" })}
            {field("phone", "Phone number", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "0712 345 678" })}
            {field("address", "Street address", { span2: true, autoComplete: "street-address", placeholder: "Estate, street, building…" })}
            <div>
              <label htmlFor="addr-city" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                City / town
              </label>
              <select
                id="addr-city"
                value={form.city}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, city: e.target.value }));
                  setFieldErrors((prev) => ({ ...prev, city: "" }));
                }}
                aria-invalid={fieldErrors.city ? "true" : undefined}
                className={`min-h-11 w-full rounded-control border bg-white px-3 text-sm outline-none transition focus:border-navy ${
                  fieldErrors.city ? "border-error" : "border-line"
                }`}
              >
                <option value="">Select city</option>
                {CITIES.map((city) => <option key={city}>{city}</option>)}
              </select>
              {fieldErrors.city && <p className="mt-1 text-xs text-error">{fieldErrors.city}</p>}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" disabled={busy === "save"} className="btn-primary text-sm disabled:opacity-60">
              {busy === "save" ? "Saving…" : "Save address"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="min-h-11 rounded-control border border-line px-4 text-sm font-semibold text-muted transition hover:border-navy hover:text-navy"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
