#!/usr/bin/env node
// M-Pesa STK abuse-guard test.
//
//   node scripts/security-mpesa-limits-smoke.mjs
//
// An STK push rings somebody's phone and costs the merchant nothing to start,
// so the endpoint is a free way to harass a number. The old guard counted
// pushes per *account* only — one account could rotate numbers, and several
// accounts could take turns on one victim's phone. The number is now stored on
// the intent, which is what makes a per-phone window possible at all.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  MPESA_MAX_PER_ACCOUNT,
  MPESA_MAX_PER_PHONE,
  MPESA_WINDOW_MS,
  mpesaAttemptVerdict,
  mpesaLimitMessage,
} from "../app/lib/request-limits.js";

const here = dirname(fileURLToPath(import.meta.url));
const stk = readFileSync(join(here, "..", "app", "api", "mpesa", "stk", "route.js"), "utf8");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

console.log("Policy");
check("window is 10 minutes", MPESA_WINDOW_MS === 10 * 60 * 1000);
check("5 per account", MPESA_MAX_PER_ACCOUNT === 5);
check("3 per phone", MPESA_MAX_PER_PHONE === 3);

console.log("\nVerdicts");
check("fresh -> allowed", mpesaAttemptVerdict({ accountAttempts: 0, phoneAttempts: 0 }) === null);
check("2/account, 2/phone -> allowed", mpesaAttemptVerdict({ accountAttempts: 2, phoneAttempts: 2 }) === null);
check("5/account -> account", mpesaAttemptVerdict({ accountAttempts: 5, phoneAttempts: 0 }) === "account");
check("3/phone -> phone", mpesaAttemptVerdict({ accountAttempts: 0, phoneAttempts: 3 }) === "phone");
check(
  "account takes precedence when both are over",
  mpesaAttemptVerdict({ accountAttempts: 9, phoneAttempts: 9 }) === "account"
);
check("missing counts treated as 0", mpesaAttemptVerdict({}) === null);
check("numeric strings are coerced", mpesaAttemptVerdict({ accountAttempts: "3", phoneAttempts: "3" }) === "phone");

console.log("\nMessages");
check("account message mentions waiting", /wait/i.test(mpesaLimitMessage("account")));
check("phone message names the number", /number/i.test(mpesaLimitMessage("phone")));
check("phone message offers COD", /delivery/i.test(mpesaLimitMessage("phone")));

console.log("\nRoute wiring");
check("stores the payer phone on the intent", /phone:\s*formattedPhone/.test(stk));
check("counts phone attempts in a window", /\.eq\("phone",\s*formattedPhone\)/.test(stk));
check("counts account attempts in a window", /\.eq\("user_id",\s*user\.id\)/.test(stk));
check("uses the shared window", /MPESA_WINDOW_MS/.test(stk));
check("returns 429 on a limit", /status:\s*429/.test(stk));
check("intent is still written before the push", stk.indexOf("expected_amount") < stk.indexOf("stkpush"));
check("no client-supplied amount", !/Amount:\s*(body|items|Number\(body)/.test(stk));

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll M-Pesa limit cases passed");
