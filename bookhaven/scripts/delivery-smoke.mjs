#!/usr/bin/env node
// Delivery rule + M-Pesa configuration test.
//
//   node scripts/delivery-smoke.mjs
//
// Delivery is 20% of the book total. That figure is computed in four places
// — the checkout, the basket drawer, the STK route and place_order() — and if
// any two disagree the shop either charges a total the customer never saw or
// takes an M-Pesa payment the database then refuses to turn into an order.
//
// The arithmetic is integer-only in both languages so the two can be compared
// exactly. This test pins the JS side, checks the SQL carries the same
// formula, and greps out any stale copy from the old flat-fee rule.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { DELIVERY_PERCENT, deliveryFeeFor, SITE_DESCRIPTION } from "../app/lib/site.js";
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

// ── the rate ────────────────────────────────────────────────────
check("delivery is 20%", DELIVERY_PERCENT, 20);
ok("the site description mentions delivery", /delivery/i.test(SITE_DESCRIPTION));

// ── the arithmetic, including the halves ────────────────────────
check("KSh 1,000 → 200", deliveryFeeFor(1000), 200);
check("KSh 1,345 → 269", deliveryFeeFor(1345), 269);
check("KSh 1,250 → 250", deliveryFeeFor(1250), 250);
check("KSh 1,299 → 260 (259.8 rounds up)", deliveryFeeFor(1299), 260);
check("KSh 1,099 → 220 (219.8 rounds up)", deliveryFeeFor(1099), 220);
check("KSh 2,071 → 414 (414.2 rounds down)", deliveryFeeFor(2071), 414);
check("KSh 2,500 → 500", deliveryFeeFor(2500), 500);
check("an empty basket costs nothing", deliveryFeeFor(0), 0);
check("junk is treated as zero", deliveryFeeFor(undefined), 0);

// Same formula, evaluated the way Postgres evaluates it: integer division.
// If these ever differ, the M-Pesa amount will not match place_order()'s total.
for (const subtotal of [0, 1, 3, 7, 999, 1000, 1099, 1299, 1345, 2071, 2500, 12345, 99999]) {
  check(
    `SQL and JS agree on KSh ${subtotal}`,
    deliveryFeeFor(subtotal),
    Math.trunc((subtotal * DELIVERY_PERCENT + 50) / 100)
  );
}

// ── the database carries the same rule ──────────────────────────
const migration = read("supabase/migrations/20261021110000_delivery_rate.sql");
ok("place_order charges the same formula", /v_delivery := \(v_subtotal \* 20 \+ 50\) \/ 100;/.test(migration));
ok("place_order no longer branches on 3000", !/v_subtotal >= 3000/.test(migration));
ok("place_order no longer writes zero delivery", !/v_delivery := 0;/.test(migration));
ok("the rate is readable by the app", /create or replace function public\.delivery_rate\(\)/.test(migration));
ok("the readable rate is 20", /select 20;/.test(migration));

const freeDelivery = join(root, "supabase/migrations/20261021090000_free_delivery.sql");
let freeDeliveryGone = false;
try {
  readFileSync(freeDelivery);
} catch {
  freeDeliveryGone = true;
}
ok("the superseded free-delivery migration is gone", freeDeliveryGone);

// ── no stale copy of the old rules ──────────────────────────────
for (const file of [
  "app/checkout/page.js",
  "app/components/StoreShell.js",
  "app/components/HomeClient.js",
  "app/components/StoreHeader.js",
  "app/books/[slug]/page.js",
  "app/lib/site.js",
  "app/api/mpesa/stk/route.js",
  "app/api/orders/route.js",
]) {
  const source = read(file);
  ok(`${file} does not import the old flat fee`, !source.includes("DELIVERY_FEE"));
  ok(`${file} does not import the old threshold`, !source.includes("FREE_DELIVERY_THRESHOLD"));
  ok(`${file} does not say "free delivery"`, !/free delivery/i.test(source));
  ok(`${file} does not say "flat KSh 300"`, !/flat KSh 300/i.test(source));
}

// ── M-Pesa configuration ────────────────────────────────────────
const creds = {
  MPESA_CONSUMER_KEY: "key",
  MPESA_CONSUMER_SECRET: "secret",
  MPESA_SHORTCODE: "174379",
  MPESA_PASSKEY: "passkey",
};
const withEnv = (env, fn) => {
  const keys = ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY", "MPESA_ENV", "MPESA_CALLBACK_URL", "MPESA_TRANSACTION_TYPE"];
  const saved = {};
  for (const k of keys) {
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
ok("the route adds the same delivery rule", /subtotal \+ deliveryFeeFor\(subtotal\)/.test(stk));
ok("the route no longer calls quote_cart", !/rpc\(\s*["']quote_cart/.test(stk));
ok("AccountReference fits Daraja's 12 characters", /AccountReference: `BH-\$\{user\.id\.slice\(0, 8\)\}`/.test(stk));

// ── checkout shows the delivery line, not a surprise ────────────
const checkout = read("app/checkout/page.js");
ok("checkout computes delivery from the subtotal", /deliveryFeeFor\(total\)/.test(checkout));
ok("checkout labels the percentage", /Delivery \(\{DELIVERY_PERCENT\}%\)/.test(checkout));

if (failures.length) {
  console.error(`\n${failures.length} delivery/M-Pesa check(s) failed:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log("delivery test passed — 20% on every order, identical arithmetic in SQL, M-Pesa gated on real configuration");
