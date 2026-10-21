#!/usr/bin/env node
// M-Pesa configuration test.
//
//   node scripts/mpesa-smoke.mjs
//
// The failures this guards against are configuration failures, not payment
// logic: credentials half-copied out of the Daraja portal, a secret pasted
// with its quotes still on, or live credentials pointed at the sandbox host.
// All three used to surface as the same sentence ("M-Pesa is temporarily
// unavailable"), which tells nobody anything. This pins the behaviour that
// makes them distinguishable.

import {
  mpesaConfig,
  probeDaraja,
  resolveAccessToken,
  normalisePhone,
  mpesaTimestamp,
  mpesaPassword,
} from "../app/lib/mpesa.js";

const failures = [];
const check = (label, actual, expected) => {
  if (String(actual) !== String(expected)) {
    failures.push(`${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
};
const ok = (label, condition) => {
  if (!condition) failures.push(label);
};

const ENV_KEYS = [
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_SHORTCODE",
  "MPESA_PASSKEY",
  "MPESA_ENV",
  "MPESA_CALLBACK_URL",
  "MPESA_TRANSACTION_TYPE",
];

const withEnv = (env, fn) => {
  const saved = {};
  for (const k of ENV_KEYS) {
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

// ── missing configuration ───────────────────────────────────────
withEnv({}, () => {
  const config = mpesaConfig();
  ok("nothing set → refused", Boolean(config.error));
  ok("the error names what is missing", config.error.includes("MPESA_CONSUMER_KEY"));
  ok("the error names every missing value", config.error.includes("MPESA_PASSKEY"));
  ok("the error never contains a secret", !config.error.includes("passkey"));
});

// ── environment detection: the actual cause of "temporarily unavailable" ──
const creds = {
  MPESA_CONSUMER_KEY: "key",
  MPESA_CONSUMER_SECRET: "secret",
  MPESA_SHORTCODE: "174379",
  MPESA_PASSKEY: "passkey",
};

withEnv(creds, () => {
  const config = mpesaConfig();
  ok("credentials alone are enough to configure", !config.error);
  check("unset MPESA_ENV defaults to sandbox", config.environment, "sandbox");
  check("…and says so", config.environmentAssumed, true);
  check("sandbox host", config.base, "https://sandbox.safaricom.co.ke");
  check("paybill is the default type", config.transactionType, "CustomerPayBillOnline");
  check("callback falls back to this site", config.callbackUrl.endsWith("/api/mpesa/callback"), true);
});

withEnv({ ...creds, MPESA_ENV: "production" }, () => {
  const config = mpesaConfig();
  check("production is honoured", config.environment, "production");
  check("production host", config.base, "https://api.safaricom.co.ke");
  check("assumption flag clears", config.environmentAssumed, false);
});

withEnv({ ...creds, MPESA_ENV: "PRODUCTION" }, () => {
  check("case does not matter", mpesaConfig().environment, "production");
});

// ── values pasted out of a dashboard text box ───────────────────
withEnv({
  MPESA_CONSUMER_KEY: '  "abc123"\n',
  MPESA_CONSUMER_SECRET: " 'shh' ",
  MPESA_SHORTCODE: " 174379 ",
  MPESA_PASSKEY: "\tpasskey\n",
}, () => {
  const config = mpesaConfig();
  check("stray quotes and whitespace are stripped from the key", config.key, "abc123");
  check("…from the secret", config.secret, "shh");
  check("…from the shortcode", config.shortcode, "174379");
  check("…from the passkey", config.passkey, "passkey");
});

withEnv({ ...creds, MPESA_CALLBACK_URL: " http://insecure.example/cb " }, () => {
  ok("a non-HTTPS callback is refused", Boolean(mpesaConfig().error));
});

withEnv({ ...creds, MPESA_CALLBACK_URL: "https://shop.example/api/mpesa/callback" }, () => {
  check("an explicit callback is kept", mpesaConfig().callbackUrl, "https://shop.example/api/mpesa/callback");
});

withEnv({ ...creds, MPESA_TRANSACTION_TYPE: " CustomerBuyGoodsOnline " }, () => {
  check("till numbers are supported", mpesaConfig().transactionType, "CustomerBuyGoodsOnline");
});

// ── probe reports a network failure without throwing ────────────
// Port 9 is discard; nothing listens there, so the request fails fast. The
// point is that an unreachable host is reported, not thrown.
{
  const result = await probeDaraja("http://127.0.0.1:9", { key: "k", secret: "s" });
  ok("an unreachable host is reported, not thrown", result.ok === false);
  check("…as a network failure", result.code, "network");
  ok("…with a message", typeof result.message === "string" && result.message.length > 0);
}

// ── host resolution: when it may and may not guess ──────────────
// A dead host makes both attempts fail fast, so these exercise the decision
// logic without ever contacting Safaricom.
{
  const dead = { key: "k", secret: "s", base: "http://127.0.0.1:9", environment: "sandbox", environmentAssumed: true };
  const result = await resolveAccessToken(dead);
  ok("an unreachable host is reported, not thrown", Boolean(result.error));
  check("…as a network failure", result.code, "network");
  ok("…and is never answered by guessing the other environment", result.alsoTried === undefined);

  const declared = { ...dead, environmentAssumed: false };
  const declaredResult = await resolveAccessToken(declared);
  ok("a declared MPESA_ENV is never second-guessed", declaredResult.alsoTried === undefined);
}

// ── request signing ─────────────────────────────────────────────
check(
  "the STK password is base64(shortcode + passkey + timestamp)",
  mpesaPassword("174379", "passkey", "20261022120000"),
  Buffer.from("174379passkey20261022120000").toString("base64")
);
check(
  "the timestamp is YYYYMMDDHHmmss",
  mpesaTimestamp(new Date(2026, 9, 22, 12, 0, 0)),
  "20261022120000"
);

// ── phone normalisation (what Safaricom receives) ───────────────
check("0712 345 678", normalisePhone("0712 345 678"), "254712345678");
check("+254 712 345 678", normalisePhone("+254 712 345 678"), "254712345678");
check("0112 345 678", normalisePhone("0112 345 678"), "254112345678");
check("712345678", normalisePhone("712345678"), "254712345678");
check("rubbish stays rubbish", normalisePhone("abc"), "");

if (failures.length) {
  console.error(`\n${failures.length} M-Pesa configuration check(s) failed:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log("mpesa test passed — environment detection, value cleaning, probe reporting, host resolution and request signing");
