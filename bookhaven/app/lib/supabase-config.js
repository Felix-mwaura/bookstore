// Single source of truth for the *public* Supabase configuration.
//
// The URL and anon key are public by design (they ship to every browser), but
// they are still configuration: they decide which project the shop talks to.
// Hard-coded production values used to sit here as fallbacks, and that was not
// harmless — every Vercel *preview* deployment (the environment has no
// NEXT_PUBLIC_* variables) silently read and wrote the live database. A pull
// request preview is supposed to be a sandbox.
//
// The rules now:
//
//   configured                   → use it.
//   production, not configured   → throw at import, on the server only. A
//                                  deploy that cannot talk to a database must
//                                  fail where somebody sees it, not serve an
//                                  empty shop. In a browser bundle the same
//                                  situation falls back to the placeholder:
//                                  throwing there is a blank page instead of
//                                  a diagnosable one.
//   everything else, unconfigured→ a reserved, unresolvable placeholder
//                                  (".invalid" can never be registered), so a
//                                  preview or a fresh clone renders empty
//                                  states and can never reach a real project.
//                                  The console says exactly what is missing.
//
// Server-only secrets (SUPABASE_SERVICE_ROLE_KEY, M-Pesa credentials) are
// NEVER read here — they live only in process.env on the server.

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const isConfigured = Boolean(rawUrl && rawKey);
const isVercelPreview = process.env.VERCEL_ENV === "preview";

// lib/supabase.js is imported by client components, so this module is
// evaluated in the browser as well — and a browser bundle only ever contains
// the NEXT_PUBLIC_* values that were set at build time. VERCEL_ENV is not one
// of them, so `isVercelPreview` is always false there and the guard below
// used to fire on every preview deployment, blanking the page before React
// had a chance to render. A missing key in a browser is a build problem the
// server has already refused; the browser's job is to fall back to the
// placeholder below and let the page draw.
const isBrowser = typeof window !== "undefined";
const mustBeConfigured =
  process.env.NODE_ENV === "production" && !isVercelPreview && !isBrowser;

// RFC 2606 reserves .invalid; it cannot resolve, so these values cannot leak
// traffic anywhere even if a request is made with them.
const PLACEHOLDER_URL = "https://unconfigured-preview.invalid";
const PLACEHOLDER_KEY = "unconfigured-preview-anon-key";

export const SUPABASE_CONFIG_ERROR = isConfigured
  ? null
  : "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).";

if (SUPABASE_CONFIG_ERROR && mustBeConfigured) {
  // Deliberately a throw, not a console.warn: a warning scrolls past in a
  // serverless log, and the page that follows would render an empty shop.
  throw new Error(SUPABASE_CONFIG_ERROR);
}

if (SUPABASE_CONFIG_ERROR) {
  console.error(
    `${SUPABASE_CONFIG_ERROR} This deployment will render empty states; it is NOT connected to any live project.`
  );
}

export const SUPABASE_URL = (isConfigured ? rawUrl : PLACEHOLDER_URL).replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = isConfigured ? rawKey : PLACEHOLDER_KEY;

/** True when the app is running against the placeholder (no real project). */
export const SUPABASE_IS_PLACEHOLDER = !isConfigured;
