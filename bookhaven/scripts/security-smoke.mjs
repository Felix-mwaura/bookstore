#!/usr/bin/env node
// Security regression tests that need no server and no network.
//
//   node scripts/security-smoke.mjs
//
// Each section covers a finding from docs/security-audit-2026-10-25.md and is
// written so that REVERTING the fix makes this file fail. That is the point:
// these are the cases a well-meaning refactor would quietly reintroduce.

import { safeNextPath } from "../app/lib/safe-redirect.js";
import { serialiseJsonLd } from "../app/lib/json-ld.js";
import { buildCsp, createNonce, isNonceRoute } from "../app/lib/csp.js";
import {
  MAX_COD_UNITS,
  MAX_OPEN_COD_ORDERS,
  unitsIn,
  codLimitProblem,
} from "../app/lib/order-limits.js";
import {
  readJsonBody,
  isJsonObject,
  isUuid,
  ADMIN_BODY,
} from "../app/lib/request-guard.js";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const failures = [];
const passes = [];

const ok = (label, cond, detail = "") => {
  if (cond) passes.push(label);
  else failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
};
const eq = (label, actual, expected) =>
  ok(label, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
const section = (name) => console.log(`\n${name}`);

/* ── 1. Post-login redirects cannot leave the site ─────────────────────── */

section("1. /login?next= is same-origin only");

const accepted = [
  ["/checkout", "/checkout"],
  ["/orders/abc", "/orders/abc"],
  ["/books?sort=price-asc", "/books?sort=price-asc"],
  ["/account#orders", "/account"], // hash is dropped, never used for routing
  ["/", "/"],
  ["/admin?tab=orders", "/admin?tab=orders"],
];
for (const [input, expected] of accepted) {
  eq(`accepts ${JSON.stringify(input)}`, safeNextPath(input), expected);
}

const rejected = [
  // The reported bypass: the URL parser strips the tab, leaving "//evil.com".
  ["tab", "/\t/evil.com"],
  ["newline", "/\n/evil.com"],
  ["carriage return", "/\r/evil.com"],
  ["tab inside the host", "//\tevil.com"],
  ["backslash", "/\\evil.com"],
  ["double backslash", "/\\\\evil.com"],
  ["protocol-relative", "//evil.com"],
  ["absolute https", "https://evil.com"],
  ["absolute http", "http://evil.com"],
  ["scheme-relative with userinfo", "//user@evil.com"],
  ["javascript scheme", "javascript:alert(1)"],
  ["data scheme", "data:text/html,<script>alert(1)</script>"],
  ["encoded slashes", "/%2F%2Fevil.com"],
  ["encoded backslash", "/%5Cevil.com"],
  ["empty", ""],
  ["whitespace", "   "],
  ["not a string", null],
  ["number", 42],
  ["object", { toString: () => "/checkout" }],
  ["over the length cap", "/" + "a".repeat(400)],
  ["NUL then path", "/\u0000/evil.com"],
  ["DEL then path", "/\u007f/evil.com"],
];
for (const [label, input] of rejected) {
  eq(`rejects ${label}`, safeNextPath(input), null);
}

// The strongest possible assertion: whatever survives must resolve to this
// origin when the BROWSER parses it against the real site. This catches any
// parser quirk the individual cases above did not think of.
const SITE = "https://bookhaven.co.ke";
const tricky = [
  "/\t/evil.com",
  "/\n/evil.com",
  "/\r\n/evil.com",
  "/\\evil.com",
  "//evil.com",
  "/%2F%2Fevil.com",
  "/%5Cevil.com",
  "/%09/evil.com",
  "////evil.com",
  "/evil.com\\@bookhaven.co.ke",
  "/..//evil.com",
];
for (const input of tricky) {
  const result = safeNextPath(input);
  if (result === null) {
    ok(`parser check: ${JSON.stringify(input)} refused`, true);
    continue;
  }
  const resolved = new URL(result, SITE);
  ok(
    `parser check: ${JSON.stringify(input)} stays on ${SITE}`,
    resolved.origin === SITE,
    `resolved to ${resolved.href}`
  );
}

// Sanity: the dummy-origin trick must not accept an absolute URL that happens
// to mention the placeholder host.
eq("rejects the placeholder origin itself", safeNextPath("https://bookhaven.invalid/checkout"), null);

/* ── 2. JSON-LD cannot break out of its script element ─────────────────── */

section("2. JSON-LD escapes <, > and &");

const HOSTILE = '</script><script>alert(1)</script>';
const jsonLdCases = [
  ["a book description", { "@type": "Book", description: HOSTILE }],
  ["a title", { name: "<img src=x onerror=alert(1)>" }],
  ["an author", { author: { "@type": "Person", name: "A & B <b>" } }],
  ["a nested offer", { offers: { price: 100, url: "https://x.test/?a=1&b=2" } }],
  ["line separators", { description: "line\u2028break\u2029here" }],
];
for (const [label, value] of jsonLdCases) {
  const out = serialiseJsonLd(value);
  ok(`${label}: no raw "<"`, !out.includes("<"), out);
  ok(`${label}: no "</script"`, !out.toLowerCase().includes("</script"), out);
  ok(`${label}: no raw "&"`, !out.includes("&"), out);
  ok(`${label}: no raw U+2028/9`, !/[\u2028\u2029]/.test(out));
  // The escapes must be JSON escapes: parsing returns the original value.
  let parsed = null;
  try { parsed = JSON.parse(out); } catch (error) { ok(`${label}: still valid JSON`, false, error.message); }
  ok(`${label}: round-trips`, JSON.stringify(parsed) === JSON.stringify(value));
}

eq("undefined serialises to null", serialiseJsonLd(undefined), "null");
ok("a plain string is escaped", serialiseJsonLd("<script>") === "\"\\u003cscript\\u003e\"", serialiseJsonLd("<script>"));

/* ── 3. Request bodies are bounded and null-safe ───────────────────────── */

section("3. Body parsing: 400/413, never a 500");

const post = (body, headers = {}) =>
  new Request("https://bookhaven.test/api/example", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });

{
  const parsed = await readJsonBody(post("null"));
  ok("a literal null body parses", parsed.ok === true);
  eq("…and is not an object", isJsonObject(parsed.body), false);
  eq("…so the route answers 400", isJsonObject(parsed.body) ? 200 : 400, 400);

  const empty = await readJsonBody(post("   "));
  eq("an empty body → 400", empty.status, 400);

  const broken = await readJsonBody(post("{not json"));
  eq("malformed JSON → 400", broken.status, 400);

  const array = await readJsonBody(post("[1,2,3]"));
  eq("an array is not an object", isJsonObject(array.body), false);
  const string = await readJsonBody(post('"hello"'));
  eq("a bare string is not an object", isJsonObject(string.body), false);

  const declared = await readJsonBody(post("{}", { "content-length": String(ADMIN_BODY + 1) }));
  eq("oversized Content-Length → 413 before reading", declared.status, 413);

  const huge = await readJsonBody(post(JSON.stringify({ pad: "x".repeat(ADMIN_BODY) })));
  eq("oversized actual body → 413", huge.status, 413);

  const fine = await readJsonBody(post(JSON.stringify({ id: "ok" })));
  eq("a normal body parses", fine.ok, true);
}

eq("uuid: valid v4", isUuid("11111111-1111-4111-8111-111111111111"), true);
eq("uuid: uppercase", isUuid("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE"), true);
eq("uuid: short", isUuid("1111"), false);
eq("uuid: injection", isUuid("1' or 1=1--"), false);
eq("uuid: object", isUuid({ toString: () => "11111111-1111-4111-8111-111111111111" }), false);
eq("uuid: null", isUuid(null), false);

// Static check: no route may read an unbounded JSON body directly. The M-Pesa
// callback is the single exception — it has its own Content-Length guard and
// must answer 200 to Safaricom rather than 413.
{
  const here = dirname(fileURLToPath(import.meta.url));
  const apiDir = join(here, "..", "app", "api");
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name === "route.js") files.push(full);
    }
  }
  await walk(apiDir);

  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (!source.includes("request.json()")) continue;
    const rel = relative(apiDir, file).replaceAll("\\", "/");
    if (rel === "mpesa/callback/route.js") continue;
    offenders.push(rel);
  }
  ok(
    "every route uses readJsonBody() (callback excepted)",
    offenders.length === 0,
    offenders.join(", ")
  );
  ok("the scan actually found routes", files.length > 10, `${files.length} routes`);
}

/* ── 4. The Content-Security-Policy ────────────────────────────────────── */

section("4. CSP is nonce-based where a nonce can exist");

const SUPABASE = "https://exampleproject.supabase.co";

for (const path of ["/books", "/books/deep-work-4", "/books?q=x", "/category/fiction",
                    "/login", "/orders/11111111-1111-4111-8111-111111111111",
                    "/admin", "/admin/orders"]) {
  ok(`nonce route: ${path}`, isNonceRoute(path));
}
for (const path of ["/", "/about", "/checkout", "/account", "/help", "/privacy",
                    "/terms", "/access-denied", "/robots.txt", "/sitemap.xml",
                    "/a-missing-page", "books", "", null]) {
  ok(`prerendered/unknown route: ${String(path)}`, !isNonceRoute(path));
}

const nonce = createNonce();
const strict = buildCsp({ nonce, supabaseUrl: SUPABASE });
ok("strict: carries the nonce", strict.includes(`'nonce-${nonce}'`));
ok("strict: script-src has no unsafe-inline", !/script-src[^;]*'unsafe-inline'/.test(strict));
ok("strict: frame-ancestors none", strict.includes("frame-ancestors 'none'"));
ok("strict: default-src self", strict.includes("default-src 'self'"));
ok("strict: object-src none", strict.includes("object-src 'none'"));
ok("strict: base-uri self", strict.includes("base-uri 'self'"));
ok("strict: form-action self", strict.includes("form-action 'self'"));
ok("strict: Supabase REST/Auth allowed", strict.includes("connect-src 'self' https://exampleproject.supabase.co"));
ok("strict: Supabase realtime allowed", strict.includes("wss://exampleproject.supabase.co"));
ok("strict: Supabase storage images allowed", strict.includes("img-src 'self' data: blob: https://exampleproject.supabase.co"));
ok("strict: no eval in production", !strict.includes("'unsafe-eval'"));
ok("strict: upgrades insecure requests", strict.includes("upgrade-insecure-requests"));

const weak = buildCsp({ supabaseUrl: SUPABASE });
ok("prerendered tier: unsafe-inline is present", /script-src[^;]*'unsafe-inline'/.test(weak));
ok("prerendered tier: no nonce", !weak.includes("nonce-"));
ok("prerendered tier: still blocks other origins", !/script-src[^;]*\*/.test(weak));

const dev = buildCsp({ nonce, supabaseUrl: SUPABASE, isDev: true });
ok("dev: allows eval for HMR", dev.includes("'unsafe-eval'"));
ok("dev: allows the HMR websocket", /connect-src[^;]*ws:/.test(dev));
ok("dev: does not force https upgrades", !dev.includes("upgrade-insecure-requests"));

const noUrl = buildCsp({ nonce });
ok("empty Supabase URL: no empty allow-list entry", !noUrl.includes("https://;"));
ok("empty Supabase URL: still self-only", noUrl.includes("connect-src 'self'"));

const nonces = new Set(Array.from({ length: 50 }, () => createNonce()));
eq("nonces are unique per response", nonces.size, 50);
ok("nonce is base64 of 16 bytes", [...nonces].every((n) => /^[A-Za-z0-9+/]{22}==$/.test(n)));

/* ── 5. Cash-on-delivery limits ────────────────────────────────────────── */

section("5. COD cannot hoard stock");

eq("units: sums lines", unitsIn([{ id: 1, quantity: 2 }, { id: 2, quantity: 3 }]), 5);
eq("units: ignores a bad quantity", unitsIn([{ quantity: 2 }, { quantity: "lots" }, { quantity: -4 }]), 2);
eq("units: empty cart", unitsIn([]), 0);
eq("units: a non-array is zero", unitsIn(null), 0);
eq("the per-order cap is 20 books", MAX_COD_UNITS, 20);
eq("three COD orders may be open", MAX_OPEN_COD_ORDERS, 3);

eq("20 books, no other order: allowed", codLimitProblem({ units: 20, openOrders: 0 }), null);
eq("2 open orders, 1 book: allowed", codLimitProblem({ units: 1, openOrders: 2 }), null);

const tooMany = codLimitProblem({ units: 21, openOrders: 0 });
eq("21 books: refused", tooMany?.status, 400);
eq("21 books: code", tooMany?.code, "COD_ORDER_TOO_LARGE");
ok("21 books: says how to proceed", /M-Pesa|pay online/i.test(tooMany?.message || ""));

const openLimit = codLimitProblem({ units: 1, openOrders: 3 });
eq("3 open orders: refused", openLimit?.status, 409);
eq("3 open orders: code", openLimit?.code, "TOO_MANY_OPEN_COD_ORDERS");
ok("3 open orders: says what to do", /wait|arrive|cancel/i.test(openLimit?.message || ""));

eq("4 open orders: still refused", codLimitProblem({ units: 1, openOrders: 4 })?.status, 409);

/* ── report ─────────────────────────────────────────────────────────────── */

console.log("");
if (failures.length) {
  console.error(`FAIL — ${failures.length} problem(s), ${passes.length} passed:`);
  for (const message of failures) console.error(`  • ${message}`);
  process.exit(1);
}
console.log(`PASS — ${passes.length} security checks (no server, no network)`);
