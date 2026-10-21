#!/usr/bin/env node
// Delivery rule + M-Pesa configuration test.
//
//   node scripts/delivery-smoke.mjs
//
// Delivery is free, so the total a customer reads must be the sum of the
// books and nothing else. That number is computed in three places — the
// checkout, the basket drawer and (after this change) the STK route — and it
// is written once more by place_order(). If any of them still carries the old
// KSh 300 rule, a customer can be quoted one total and charged another, or be
// charged a total the database then refuses to turn into an order.
//
// Also checks the M-Pesa config helpers, which are the gate between "the shop
// takes money" and "the shop shows a payment method that fails".

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { DELIVERY_FEE, SITE_DESCRIPTION } from "../app/lib/site.js";
import { mpesaConfig, normalisePhone } from "../app/lib/mpesa.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const failures = [];
const check = (label, actual, expected) => {
  if (String(actual) !== String(expected)) {
    failures.push(`${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
};
const ok = (label, condition) => {
  if (!condition) failures.push(label);
};

// ── the rule itself ─────────────────────────────────────────────
check("delivery is free", DELIVERY_FEE, 0);
ok("the description says delivery is free", /free delivery on every order/i.test(SITE_DESCRIPTION));

// ── no stale copies of the old rule ─────────────────────────────
for (const file of [
  "app/checkout/page.js",
  "app/components/StoreShell.js",
  "app/components/HomeClient.js",
  "app/components/StoreHeader.js",
  "app/books/[slug]/page.js",
  "app/lib/site.js",
  "app/api/mpesa/stk/route.js",
]) {
  const source = read(file);
  ok(`${file} no longer imports the delivery threshold`, !source.includes("FREE_DELIVERY_THRESHOLD"));
  ok(`${file} no longer imports the standard fee`, !source.includes("STANDARD_DELIVERY_FEE"));
  ok(`${file} does not say "flat KSh 300"`, !/flat KSh 300/i.test(source));
}

// The order writer is the one that actually bills. It must agree.
const migration = read("supabase/migrations/20261021090000_free_delivery.sql");
ok("place_order writes a zero delivery fee", /v_delivery := 0;/.test(migration));
ok("place_order no longer branches on 3000", !/v_subtotal >= 3000/.test(migration));
ok("the delivery rule is readable by the status check", /create or replace function public\.delivery_fee_rule/.test(migration));

// ── M-Pesa configuration ────────────────────────────────────────
const creds = {
  MPESA_CONSUMER_KEY: "key",
  MPESA_CONSUMER_SECRET: "secret",
  MPESA_SHORTCODE: "174379",
  MPESA_PASSKEY: "passkey",
};
const withEnv = (env, fn) => {
  const saved = {};
  for (const k of ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY", "MPESA_ENV", "MPESA_CALLBACK_URL", "MPESA_TRANSACTION_TYPE"]) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

withEnv({}, () => {
  const config = mpesaConfig();
  ok("no credentials → refused", Boolean(config.error));
  ok("the refusal names the missing variables", config.error.includes("MPESA_CONSUMER_KEY"));
  ok("the refusal never contains a secret", !config.error.includes("passkey"));
});

withEnv(creds, () => {
  const config = mpesaConfig();
  ok("complete credentials → configured", !config.error);
  check("sandbox is the default", config.base, "https://sandbox.safaricom.co.ke");
  check("paybill is the default transaction type", config.transactionType, "CustomerPayBillOnline");
  ok("callback defaults to this site's own HTTPS address", /^https:\/\/.+\/api\/mpesa\/callback$/.test(config.callbackUrl));
});

withEnv({ ...creds, MPESA_ENV: "production" }, () => {
  check("production base", mpesaConfig().base, "https://api.safaricom.co.ke");
});

withEnv({ ...creds, MPESA_TRANSACTION_TYPE: "CustomerBuyGoodsOnline" }, () => {
  check("buy goods is honoured", mpesaConfig().transactionType, "CustomerBuyGoodsOnline");
});

withEnv({ ...creds, MPESA_CALLBACK_URL: "http://insecure.example/cb" }, () => {
  ok("a non-HTTPS callback is refused", Boolean(mpesaConfig().error));
});

withEnv({ ...creds, MPESA_CALLBACK_URL: "https://shop.example/api/mpesa/callback" }, () => {
  check("an explicit callback is kept", mpesaConfig().callbackUrl, "https://shop.example/api/mpesa/callback");
});

// ── phone normalisation (what Safaricom receives) ───────────────
check("0712 345 678", normalisePhone("0712 345 678"), "254712345678");
check("+254 712 345 678", normalisePhone("+254 712 345 678"), "254712345678");
check("254712345678", normalisePhone("254712345678"), "254712345678");
check("0112 345 678", normalisePhone("0112 345 678"), "254112345678");
check("712345678", normalisePhone("712345678"), "254712345678");

// ── the STK route prices from the catalogue, not the browser ────
const stk = read("app/api/mpesa/stk/route.js");
ok("the route still ignores a client-supplied amount", !/body\.(amount|total)/.test(stk));
ok("the route sums catalogue prices", /book\?\.price/.test(stk));
ok("the route applies the same delivery rule", /subtotal \+ DELIVERY_FEE/.test(stk));
ok("the route no longer calls quote_cart", !/rpc\(\s*["']quote_cart/.test(stk));
ok("AccountReference fits Daraja's 12 characters", /AccountReference: `BH-\$\{user\.id\.slice\(0, 8\)\}`/.test(stk));

if (failures.length) {
  console.error(`\n${failures.length} delivery/M-Pesa check(s) failed:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log("delivery test passed — free delivery everywhere, order writer agrees, M-Pesa gated on real configuration");
