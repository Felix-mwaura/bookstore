#!/usr/bin/env node
// M-Pesa callback shared-secret test.
//
//   node scripts/security-callback-token-smoke.mjs
//
// Daraja does not sign callbacks, so /api/mpesa/callback is a public endpoint
// that accepts a claim and then spends database reads and a Daraja STK Query on
// it. The token is optional (unset must change nothing, or the URL Safaricom
// already holds would start failing), and the comparison must not leak the
// secret through timing or through a thrown length error.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  presentedToken,
  secretMatches,
  verifyCallbackToken,
} from "../app/lib/callback-secret.js";

const here = dirname(fileURLToPath(import.meta.url));
const route = readFileSync(join(here, "..", "app", "api", "mpesa", "callback", "route.js"), "utf8");

const TOKEN = "s3cret-token-value";
const URL_OK = `https://bookstore.example/api/mpesa/callback?k=${TOKEN}`;
const URL_WRONG = "https://bookstore.example/api/mpesa/callback?k=nope";
const URL_BARE = "https://bookstore.example/api/mpesa/callback";

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

function headers(map) {
  return new Headers(map);
}

console.log("Unset token keeps the endpoint exactly as it is");
for (const request of [{ url: URL_BARE }, { url: URL_WRONG }, { url: URL_OK }, {}]) {
  const verdict = verifyCallbackToken(request, undefined);
  check(`unset + ${JSON.stringify(request.url ?? "no url")} -> ok`, verdict.ok === true && verdict.skipped === true);
}
check("empty-string env is treated as unset", verifyCallbackToken({ url: URL_BARE }, "").ok === true);

console.log("\nSet token: the happy paths");
check("?k=token", verifyCallbackToken({ url: URL_OK }, TOKEN).ok === true);
check(
  "?token=token",
  verifyCallbackToken({ url: `https://x/api/mpesa/callback?token=${TOKEN}` }, TOKEN).ok === true
);
check(
  "x-callback-token header",
  verifyCallbackToken({ url: URL_BARE, headers: headers({ "x-callback-token": TOKEN }) }, TOKEN).ok === true
);

console.log("\nSet token: refusals");
check("no token at all -> missing", verifyCallbackToken({ url: URL_BARE }, TOKEN).reason === "missing");
check("no request data -> missing", verifyCallbackToken({}, TOKEN).reason === "missing");
check("wrong token -> mismatch", verifyCallbackToken({ url: URL_WRONG }, TOKEN).reason === "mismatch");
check(
  "wrong header -> mismatch",
  verifyCallbackToken({ url: URL_BARE, headers: headers({ "x-callback-token": "nope" }) }, TOKEN).reason === "mismatch"
);
check("empty header -> missing", verifyCallbackToken({ url: URL_BARE, headers: headers({}) }, TOKEN).reason === "missing");
check("prefix of the token is not enough", verifyCallbackToken({ url: `${URL_BARE}?k=${TOKEN.slice(0, -1)}` }, TOKEN).ok === false);
check("token plus suffix is not enough", verifyCallbackToken({ url: `${URL_BARE}?k=${TOKEN}x` }, TOKEN).ok === false);
check(
  "case difference is a mismatch",
  verifyCallbackToken({ url: `${URL_BARE}?k=${TOKEN.toUpperCase()}` }, TOKEN).ok === false
);
check("query beats header", presentedToken({ url: URL_WRONG, headers: headers({ "x-callback-token": TOKEN }) }) === "nope");

console.log("\nComparison is length-safe and constant-time by construction");
check("different lengths do not throw", secretMatches("a", "a-much-longer-secret") === false);
check("equal strings match", secretMatches(TOKEN, TOKEN) === true);
check("empty vs non-empty", secretMatches("", TOKEN) === false);
check("non-strings rejected", secretMatches(null, TOKEN) === false);
check("long strings are fine", secretMatches("x".repeat(4096), "x".repeat(4096)) === true);

console.log("\nMalformed input cannot throw");
for (const url of ["", "not a url", "://", "/api/mpesa/callback?k=", "https://x/?k=%E0%A4%A"]) {
  let threw = false;
  try {
    presentedToken({ url });
  } catch {
    threw = true;
  }
  check(`${JSON.stringify(url)} handled`, !threw);
}

console.log("\nRoute wiring");
check("verifies before parsing the body", route.indexOf("verifyCallbackToken") < route.indexOf("request.json()"));
check("returns 403 on refusal", /status:\s*403/.test(route));
check("reads the env var", route.includes("process.env.MPESA_CALLBACK_TOKEN"));
check("still caps the body", route.includes("exceedsBodyLimit"));
check("still asks Daraja for a verdict", route.includes("stkQuery"));

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll callback-token cases passed");
