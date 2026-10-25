#!/usr/bin/env node
// Security regression tests that need no server and no network.
//
//   node scripts/security-smoke.mjs
//
// Each section covers a finding from docs/security-audit-2026-10-25.md and is
// written so that REVERTING the fix makes this file fail. That is the point:
// these are the cases a well-meaning refactor would quietly reintroduce.

import { safeNextPath } from "../app/lib/safe-redirect.js";

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

/* ── report ─────────────────────────────────────────────────────────────── */

console.log("");
if (failures.length) {
  console.error(`FAIL — ${failures.length} problem(s), ${passes.length} passed:`);
  for (const message of failures) console.error(`  • ${message}`);
  process.exit(1);
}
console.log(`PASS — ${passes.length} security checks (no server, no network)`);
