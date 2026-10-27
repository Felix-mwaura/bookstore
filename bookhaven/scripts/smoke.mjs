#!/usr/bin/env node
// HTTP smoke test for a running Book Haven deployment.
//
//   npm run build && npm start -- -p 3125
//   node scripts/smoke.mjs http://127.0.0.1:3125
//   node scripts/smoke.mjs https://bookstore-puce-sigma.vercel.app
//
// Checks public status codes, redirects, security headers and that every
// privileged API answers 401 without a token. It never signs in and never
// creates data, so it is safe to point at production.

const base = (process.argv[2] || process.env.SMOKE_BASE || "http://127.0.0.1:3000").replace(/\/+$/, "");
const failures = [];
const results = [];

async function request(path, options = {}) {
  try {
    return await fetch(`${base}${path}`, { redirect: "manual", ...options });
  } catch (error) {
    failures.push(`${path} — request failed: ${error.message}`);
    return null;
  }
}

function expect(label, condition, detail = "") {
  if (condition) results.push(`ok    ${label}`);
  else failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
}

async function expectStatus(path, expected, label = path) {
  const res = await request(path);
  if (!res) return null;
  const ok = Array.isArray(expected) ? expected.includes(res.status) : res.status === expected;
  expect(`${label} → ${Array.isArray(expected) ? expected.join("/") : expected}`, ok, `got ${res.status}`);
  return res;
}

async function expectRedirect(path, target) {
  const res = await request(path);
  if (!res) return;
  const location = res.headers.get("location") || "";
  expect(
    `${path} → redirect`,
    [301, 302, 303, 307, 308].includes(res.status) && location.includes(target),
    `got ${res.status} ${location}`
  );
}

/* ── public pages ───────────────────────────────────────────────────── */

for (const path of [
  "/",
  "/books",
  "/books?sort=price-asc&price=under-1000",
  "/books?page=2",
  "/category/finance",
  "/books/deep-work-4",
  "/login",
  "/login?tab=register",
  "/login?mode=reset",
  "/checkout",
  "/access-denied",
  "/robots.txt",
  "/sitemap.xml",
]) {
  await expectStatus(path, 200);
}

/* ── redirects and gates ────────────────────────────────────────────── */

await expectRedirect("/admin", "/login");
await expectRedirect("/orders/00000000-0000-4000-8000-000000000000", "/login");

/* ── security headers ───────────────────────────────────────────────── */

const home = await request("/");
if (home) {
  const h = (name) => home.headers.get(name) || "";
  expect("header: content-security-policy", h("content-security-policy").includes("frame-ancestors 'none'"));
  expect("header: x-frame-options", h("x-frame-options").toUpperCase() === "DENY");
  expect("header: x-content-type-options", h("x-content-type-options") === "nosniff");
  expect("header: referrer-policy", h("referrer-policy") === "strict-origin-when-cross-origin");
  expect("header: strict-transport-security", h("strict-transport-security").includes("max-age="));
  expect("header: no x-powered-by", !home.headers.get("x-powered-by"));
  expect("header: permissions-policy", h("permissions-policy").includes("geolocation=()"));
}

/* ── privileged APIs refuse anonymous callers ───────────────────────── */

/**
 * A privileged route must refuse an anonymous caller. 401/403 is the answer on
 * a configured deployment. A local `next start` has no service-role key, so
 * requireAdmin() returns a 500 that names the missing variable — that is
 * configuration, not an open door, and it is reported separately.
 */
async function expectAdminGuard(path, options = {}) {
  const res = await request(path, options);
  if (!res) return;

  if ([401, 403].includes(res.status)) {
    results.push(`ok    ${path} refuses anonymous callers (${res.status})`);
    return;
  }

  const body = await res.clone().text();
  if (res.status === 500 && body.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    results.push(`skip  ${path} — no service-role key in this environment (500, correctly named)`);
    return;
  }

  failures.push(`${path} refuses anonymous callers — got ${res.status}`);
}

const adminRoutes = [
  "/api/admin/agent",
  "/api/admin/metrics",
  "/api/admin/orders",
  "/api/admin/books",
  "/api/admin/inventory",
  "/api/admin/users",
  "/api/admin/emails",
  "/api/admin/activity",
];

for (const path of adminRoutes) {
  await expectAdminGuard(path);
}

await expectStatus("/api/orders", 401, "/api/orders GET (no token)");

await expectAdminGuard("/api/admin/agent", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
});

/* ── the product card must stay clickable on a mouse ────────────────── */

// `.card-3d` lifts and tilts on hover, but only on devices with a real
// pointer — which is why a phone kept working while a desktop card went dead.
// A rotated `preserve-3d` subtree makes the browser hand every click inside
// the card to the flat footer div instead of the link or the Add button, so
// the card must not declare preserve-3d. This is a text check on the built
// stylesheet: the only browser that could catch it by clicking is a headed
// one with a mouse, which CI does not have.
const booksPage = await request("/books");
if (booksPage && booksPage.ok) {
  const html = await booksPage.text();
  const hrefs = [...html.matchAll(/href="([^"]+\.css)"/g)].map((m) => m[1]);
  if (hrefs.length === 0) {
    results.push("skip  .card-3d is flat — no stylesheet linked from /books");
  } else {
    const cards = [];
    for (const href of hrefs) {
      const sheet = await request(href);
      if (!sheet || !sheet.ok) continue;
      const css = await sheet.text();
      for (const rule of css.matchAll(/\.card-3d\{([^}]*)\}/g)) cards.push(rule[1]);
    }
    expect(
      ".card-3d is not a preserve-3d subtree (clicks reach the Add button)",
      cards.length > 0 && cards.every((body) => !/transform-style:\s*preserve-3d/.test(body)),
      cards.length === 0 ? "no .card-3d rule found in the stylesheet" : cards.join(" | ")
    );
  }
}

/* ── public writes validate input ───────────────────────────────────── */

const newsletter = await request("/api/newsletter", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "not-an-email" }),
});
if (newsletter) {
  expect("/api/newsletter rejects a bad address → 400", newsletter.status === 400, `got ${newsletter.status}`);
}

/* ── M-Pesa endpoints stay as narrow as they were ───────────────────── */

// The checkout asks whether M-Pesa is available. That answer is public on
// purpose, so it must not carry anything else: no shortcode, no callback URL,
// no hint about which credential is missing.
const mpesaStatus = await request("/api/mpesa/status");
if (mpesaStatus) {
  const payText = await mpesaStatus.text();
  let payJson = null;
  try {
    payJson = JSON.parse(payText);
  } catch {
    // Reported by the assertion below.
  }
  const keys = payJson ? Object.keys(payJson).sort().join(",") : "(unparseable)";
  expect("/api/mpesa/status is public → 200", mpesaStatus.status === 200, `got ${mpesaStatus.status}`);
  expect("/api/mpesa/status returns only enabled/environment", keys === "enabled,environment", `keys: ${keys}`);
  expect(
    "/api/mpesa/status names no credential",
    !/shortcode|consumer|passkey|callback|secret/i.test(payText),
    payText.slice(0, 120)
  );
}

await expectAdminGuard("/api/mpesa/token");

const mpesaToken = await request("/api/mpesa/token");
if (mpesaToken) {
  const tokenText = await mpesaToken.text();
  expect("/api/mpesa/token is admin-only → 401", mpesaToken.status === 401, `got ${mpesaToken.status}`);
  expect("/api/mpesa/token leaks nothing to an anonymous caller", !/token|secret|password/i.test(tokenText), tokenText.slice(0, 120));
}

/* ── the address route answers on both spellings ─────────────────────── */

for (const path of ["/api/addresses", "/api/adresses"]) {
  await expectStatus(path, 401, `${path} GET (no token)`);
}

/* ── report ─────────────────────────────────────────────────────────── */

console.log(`\nBook Haven smoke test — ${base}\n`);
for (const line of results) console.log(line);

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

const skipped = results.filter((line) => line.startsWith("skip")).length;
console.log(`\nAll ${results.length - skipped} checks passed${skipped ? `, ${skipped} skipped` : ""}.`);
