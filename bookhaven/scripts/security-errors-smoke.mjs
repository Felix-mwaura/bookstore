#!/usr/bin/env node
// Error-response test.
//
//   node scripts/security-errors-smoke.mjs
//
// The API used to answer with `{ error: error.message }`. Postgres writes those
// messages for the person running the database, not for a shopper:
//
//   duplicate key value violates unique constraint "addresses_user_id_is_default_idx"
//   new row violates row-level security policy for table "wishlists"
//   column "phone_number" does not exist
//
// Each one names a table, a column or a constraint, and none of them tells the
// customer what to do. They are now logged server-side and replaced with a
// sentence. This test pins down both halves: the message that goes to the
// browser, and the message that goes to the log.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

import { dbErrorResponse, logRouteError } from "../app/lib/api-error.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..", "app");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

/** Capture what the route wrote to the server log. */
function captureLog(fn) {
  const calls = [];
  const original = console.error;
  console.error = (...args) => calls.push(args.map(String).join(" "));
  try {
    return { result: fn(), calls };
  } finally {
    console.error = original;
  }
}

const SECRET = {
  code: "23502",
  message: 'null value in column "user_id" of relation "wishlists" violates not-null constraint',
  details: 'Failing row contains (null, 42, 2026-10-25 10:00:00+00).',
  hint: null,
};

console.log("The browser gets a sentence, the log gets the error");
const { result: response, calls } = captureLog(() =>
  dbErrorResponse({ route: "GET /api/wishlist", error: SECRET, fallback: "We could not load your wishlist. Please try again." })
);
const body = await response.json();

check("status 500", response.status === 500);
check("message is the caller's fallback", body.error === "We could not load your wishlist. Please try again.");
check("no table name", !body.error.includes("wishlists"));
check("no column name", !body.error.includes("user_id"));
check("no SQL", !/null value|violates|Failing row/i.test(body.error));
check("only an `error` key", Object.keys(body).join() === "error");
check("the real error is in the log", calls.some((line) => line.includes("null value in column")));
check("the route is in the log", calls.some((line) => line.includes("GET /api/wishlist")));
check("the database code is in the log", calls.some((line) => line.includes("23502")));
check("logged exactly once", calls.length === 1);

console.log("\nContext goes to the log, never to the browser");
const { result: withContext, calls: contextLog } = captureLog(() =>
  dbErrorResponse({
    route: "PATCH /api/admin/books",
    error: SECRET,
    fallback: "Could not save your changes.",
    context: { bookId: 7 },
  })
);
const contextBody = await withContext.json();
check("context absent from the response", !JSON.stringify(contextBody).includes("7"));
check("context present in the log", contextLog.some((line) => line.includes("bookId")));

console.log("\nA duplicate is a 409 with no detail");
const { result: dup } = captureLog(() =>
  dbErrorResponse({
    route: "POST /api/addresses",
    error: { code: "23505", message: 'duplicate key value violates unique constraint "addresses_pkey"' },
    fallback: "We could not save that address. Please try again.",
  })
);
const dupBody = await dup.json();
check("unique violation is 409", dup.status === 409);
check("constraint name withheld", !dupBody.error.includes("addresses_pkey"));

console.log("\nNon-Error values do not crash the logger");
const { result: odd, calls: oddLog } = captureLog(() =>
  dbErrorResponse({ route: "GET /api/orders", error: { message: undefined }, fallback: "Nope." })
);
check("still a response", odd.status === 500);
check("logged something", oddLog.length === 1 && oddLog[0].length > 0);
const { calls: plainLog } = captureLog(() => logRouteError("GET /api/x", "a string"));
check("a string error logs", plainLog.some((line) => line.includes("a string")));

// ---------------------------------------------------------------- static sweep

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name === "route.js") out.push(full);
  }
  return out;
}
const routes = walk(join(app, "api"));

console.log(`\nNo route returns a database message (${routes.length} routes scanned)`);
const LEAK = [
  /error:\s*\w*[eE]rror\??\.message/, // { error: error.message }
  /error:\s*\w+\.message/, // { error: dbError.message }
  /NextResponse\.json\(\s*\{\s*error:\s*[^,}]*\.message/,
  /json\(\s*\{\s*error:\s*msg\s*\}/, // { error: msg } where msg came from .message
];
// A match only counts as a leak when it is part of a JSON response. The
// M-Pesa route logs `error: attachError?.message` inside console.error, which
// is exactly where a real error belongs.
function returnedToClient(source, index) {
  const before = source.slice(Math.max(0, index - 400), index);
  const response = before.lastIndexOf("NextResponse.json(");
  if (response === -1) return false;
  const log = before.lastIndexOf("console.error(");
  return log < response;
}

const leaks = [];
for (const file of routes) {
  const source = readFileSync(file, "utf8");
  for (const pattern of LEAK) {
    const global = new RegExp(pattern.source, "g");
    let match;
    while ((match = global.exec(source))) {
      if (returnedToClient(source, match.index)) {
        leaks.push(`${relative(app, file)}: ${match[0]}`);
      }
    }
  }
}
check("none", leaks.length === 0, leaks.join("\n  "));

const readFailures = routes
  .filter((file) => /readFileSync\(file, "utf8"\)/.test(readFileSync(file, "utf8")))
  .map((file) => relative(app, file));
check("no route reads its own source", readFailures.length === 0, readFailures.join(", "));

const previouslyLeaking = [
  "api/admin/activity/route.js",
  "api/admin/books/route.js",
  "api/admin/orders/route.js",
  "api/admin/users/route.js",
  "api/orders/route.js",
  "api/wishlist/route.js",
  "api/addresses/route.js",
];
for (const rel of previouslyLeaking) {
  const source = readFileSync(join(app, rel), "utf8");
  check(`${rel} uses dbErrorResponse`, source.includes("dbErrorResponse("));
}

console.log("\nEvery raw request.json() is gone (or is deliberate)");
const rawJson = routes
  .filter((file) => /await request\.json\(\)/.test(readFileSync(file, "utf8")))
  .map((file) => relative(app, file));
// The Safaricom callback reads its own envelope with a 64 KB cap and must keep
// accepting whatever Safaricom sends; it is the one documented exception.
check(
  "only the M-Pesa callback",
  rawJson.length === 1 && rawJson[0].endsWith("api/mpesa/callback/route.js"),
  rawJson.join(", ")
);
const callback = readFileSync(join(app, "api/mpesa/callback/route.js"), "utf8");
check("and it is capped", callback.includes("CALLBACK_BODY"));

console.log("\nThe renamed address route");
const addresses = readFileSync(join(app, "api/addresses/route.js"), "utf8");
check("handlers live in /api/addresses", /export async function (GET|POST|PATCH|DELETE)/.test(addresses));
check("writes still scoped to the caller", addresses.includes('.eq("user_id", user.id)'));
check("no user_id from the body", !/user_id:\s*body/.test(addresses));
const alias = readFileSync(join(app, "api/adresses/route.js"), "utf8");
check("the old spelling re-exports the new handlers", alias.includes('from "../addresses/route"'));

const clients = [
  "checkout/page.js",
  "components/AddressBook.js",
];
for (const rel of clients) {
  const source = readFileSync(join(app, rel), "utf8");
  check(`${rel} calls /api/addresses`, source.includes("/api/addresses") && !source.includes("/api/adresses"));
}

console.log("\nM-Pesa status and token stay as they were");
const status = readFileSync(join(app, "api/mpesa/status/route.js"), "utf8");
check("status is public", !/requireAdmin|bearerToken/.test(status));
check("status returns only enabled/environment", /enabled/.test(status) && /environment/.test(status));
check("status reveals no key", !/CONSUMER_KEY|CONSUMER_SECRET|PASSKEY/.test(status));
const token = readFileSync(join(app, "api/mpesa/token/route.js"), "utf8");
check("token requires an admin", token.includes("requireAdmin"));
check("token returns no credential", !/access_token:|consumer_secret|passkey/i.test(token));

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll error-response cases passed");
