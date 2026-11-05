// Content-Security-Policy construction, kept pure so it can be tested.
//
// WHY A NONCE, AND WHERE IT CANNOT GO
//   Next.js ships inline bootstrap scripts on every page. A policy with
//   `script-src 'self'` alone blocks them and the page never hydrates; a
//   policy with `'unsafe-inline'` does not stop an injected inline script.
//   The only workable middle is a per-response nonce: Next reads the policy
//   from the request headers, finds the nonce, and stamps it onto the script
//   tags it renders.
//
//   A nonce only exists on a page that is rendered FOR A REQUEST. This app
//   still prerenders some routes (`next build` marks them ○): the home page
//   (ISR, 60 s), /account, /checkout, /about, /help, /privacy, /terms,
//   /access-denied and the static 404. Their HTML is written at build time,
//   so a request-time nonce can never reach their tags. Sending them a nonce
//   policy would block their own scripts and break the header, cart and
//   checkout.
//
//   So there are two tiers:
//     • routes rendered per request (below) — nonce, no 'unsafe-inline';
//     • everything else — 'self' + 'unsafe-inline'. This still blocks
//       scripts from any other origin, and every other directive is equal.
//   The trade-off is recorded in docs/security-audit-2026-10-25.md. If the
//   prerendered routes are switched to `force-dynamic`, add them here and the
//   stricter tier applies with no other change.

export const NONCE_HEADER = "x-nonce";

// Routes Next builds per request (ƒ in the build output). Prefix match.
const NONCE_ROUTE_PREFIXES = ["/admin", "/login", "/books", "/category", "/orders"];

/** True when this pathname is rendered per request, so a nonce can be used. */
export function isNonceRoute(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  // Accept a path that still carries a query or hash (callers sometimes pass
  // nextUrl.href); the router's pathname never does.
  const path = pathname.split(/[?#]/, 1)[0];
  return NONCE_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

/** 128 bits of randomness, base64. Works in the edge runtime and in Node. */
export function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * @param {object} options
 * @param {string|null} [options.nonce]  nonce for request-rendered pages
 * @param {string} [options.supabaseUrl] public Supabase URL (REST, Auth, Realtime, Storage)
 * @param {boolean} [options.isDev]      allow the dev server's eval/websocket needs
 * @returns {string} a Content-Security-Policy header value
 */
export function buildCsp({ nonce = null, supabaseUrl = "", isDev = false } = {}) {
  const host = hostOf(supabaseUrl);

  const scriptSrc = ["'self'"];
  if (nonce) scriptSrc.push(`'nonce-${nonce}'`);
  else scriptSrc.push("'unsafe-inline'");
  // The dev server compiles modules with eval; production does not need it.
  if (isDev) scriptSrc.push("'unsafe-eval'");

  const connectSrc = ["'self'"];
  if (host) connectSrc.push(`https://${host}`, `wss://${host}`);
  // Next's dev HMR socket and React refresh.
  if (isDev) connectSrc.push("ws:", "wss:");

  const imgSrc = ["'self'", "data:", "blob:"];
  if (host) imgSrc.push(`https://${host}`);

  const directives = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", imgSrc],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connectSrc],
    ["media-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["frame-src", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["manifest-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
  ];

  if (!isDev) directives.push(["upgrade-insecure-requests", []]);

  return directives
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}
