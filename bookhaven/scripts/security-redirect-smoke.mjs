#!/usr/bin/env node
// Post-login redirect safety test.
//
//   node scripts/security-redirect-smoke.mjs
//
// `?next=` is attacker-controlled: a link to
// https://bookstore-puce-sigma.vercel.app/login?next=<anything> is a link the
// shop itself publishes. If the value can leave the origin, the real sign-in
// page becomes the first hop of a phishing chain.
//
// The old check was a deny-list of prefixes:
//
//     raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
//
// A browser strips C0 control characters *before* it parses a URL, so
// "/\t/evil.com", "/\n/evil.com" and "/\r/evil.com" all passed it and resolved
// to https://evil.com/. The tests below fail against that expression and pass
// against safeNextPath(), which is the point.

import { safeNextPath, hasUnsafeCharacters } from "../app/lib/safe-redirect.js";

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) {
    failures += 1;
    console.error(`FAIL ${label}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

console.log("Same-origin paths are kept");
for (const [input, expected] of [
  ["/", "/"],
  ["/cart", "/cart"],
  ["/books/atomic-habits-3", "/books/atomic-habits-3"],
  ["/books?q=fiction&page=2", "/books?q=fiction&page=2"],
  ["/admin?tab=orders", "/admin?tab=orders"],
  ["/checkout#payment", "/checkout#payment"],
]) {
  check(JSON.stringify(input), safeNextPath(input), expected);
}

console.log("\nOff-origin values are rejected");
const attacks = [
  ["//evil.com", "protocol-relative"],
  ["///evil.com", "triple slash"],
  ["/\\evil.com", "backslash host"],
  ["/\\\\evil.com", "double backslash"],
  ["/\\/evil.com", "backslash then slash"],
  ["/\t/evil.com", "tab (was ACCEPTED before the fix)"],
  ["/\n/evil.com", "LF (was ACCEPTED before the fix)"],
  ["/\r/evil.com", "CR (was ACCEPTED before the fix)"],
  ["/\u0000/evil.com", "NUL"],
  ["/\u2028/evil.com", "line separator"],
  ["https://evil.com", "absolute URL"],
  ["http://evil.com", "absolute URL"],
  ["javascript:alert(1)", "javascript scheme"],
  ["data:text/html,<script>alert(1)</script>", "data scheme"],
  ["evil.com", "bare host"],
  ["/..//evil.com", "path traversal into protocol-relative"],
  ["/%2F%2Fevil.com", "encoded slashes"],
  ["/%5Cevil.com", "encoded backslash"],
];
for (const [input, label] of attacks) {
  check(label, safeNextPath(input), null);
}

console.log("\nShape limits");
check("empty string", safeNextPath(""), null);
check("non-string (array)", safeNextPath(["/cart"]), null);
check("non-string (undefined)", safeNextPath(undefined), null);
check("over 300 chars", safeNextPath(`/${"a".repeat(400)}`), null);
check("control-character probe", hasUnsafeCharacters("/a\tb"), true);
check("clean probe", hasUnsafeCharacters("/a/b"), false);

// The fix must keep the *reason* visible: if someone "simplifies" this back to
// a startsWith() chain, these two lines are the regression alarm.
console.log("\nRegression guard: the old expression would have allowed these");
for (const raw of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com"]) {
  const oldRule = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\");
  if (!oldRule) {
    failures += 1;
    console.error(`FAIL expected the old rule to accept ${JSON.stringify(raw)}`);
  } else {
    console.log(`ok   old rule accepts ${JSON.stringify(raw)} -> new rule returns null`);
  }
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll redirect cases passed");
