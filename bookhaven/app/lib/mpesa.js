// Server-only helpers for the Safaricom Daraja (M-Pesa) API.
// Credentials are read from process.env and are never sent to the browser.

import { SITE_URL } from "./site.js";

const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const PRODUCTION_BASE = "https://api.safaricom.co.ke";

/**
 * Environment values arrive from a dashboard text box, so they can carry a
 * trailing newline, a leading space, or the quotes someone copied along with
 * the key. Daraja answers all three with "Invalid Credentials", which is
 * indistinguishable from a wrong key — so clean them once, here.
 */
function clean(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^["']|["']$/g, "").trim();
}

export function mpesaConfig() {
  const key = clean(process.env.MPESA_CONSUMER_KEY);
  const secret = clean(process.env.MPESA_CONSUMER_SECRET);
  const shortcode = clean(process.env.MPESA_SHORTCODE);
  // Two names for the same thing: MPESA_TILL_NUMBER is what a merchant calls
  // it and what the M-Pesa Business app prints; MPESA_STORE_NUMBER is the
  // Daraja word. Either works, and one value cannot be set twice.
  const storeNumber =
    clean(process.env.MPESA_TILL_NUMBER) || clean(process.env.MPESA_STORE_NUMBER);
  const passkey = clean(process.env.MPESA_PASSKEY);

  // The callback is optional: it defaults to this site's own HTTPS address,
  // which is what it has to be anyway. Keeping it overridable matters when a
  // preview deployment must report to a stable domain, and it removes a
  // setting that is easy to get wrong (a trailing slash or http:// makes
  // Safaricom reject the whole push).
  const callbackUrl =
    clean(process.env.MPESA_CALLBACK_URL) || `${SITE_URL}/api/mpesa/callback`;

  const missing = [
    !key && "MPESA_CONSUMER_KEY",
    !secret && "MPESA_CONSUMER_SECRET",
    !shortcode && "MPESA_SHORTCODE",
    !passkey && "MPESA_PASSKEY",
  ].filter(Boolean);

  if (missing.length) {
    return { error: `M-Pesa is not configured. Missing: ${missing.join(", ")}` };
  }

  if (!/^https:\/\//.test(callbackUrl)) {
    return { error: "MPESA_CALLBACK_URL must be a public HTTPS address." };
  }

  // Which Daraja host to talk to. This must match the app the credentials
  // were issued for: sandbox keys are rejected by api.safaricom.co.ke and
  // live keys are rejected by sandbox.safaricom.co.ke, with the same
  // "Invalid Credentials" answer either way.
  const env = (clean(process.env.MPESA_ENV) || "sandbox").toLowerCase();
  const base = env === "production" ? PRODUCTION_BASE : SANDBOX_BASE;

  // Paybill numbers use CustomerPayBillOnline; a Buy Goods (till) number must
  // use CustomerBuyGoodsOnline or Daraja rejects the request.
  const transactionType =
    clean(process.env.MPESA_TRANSACTION_TYPE) || "CustomerPayBillOnline";

  // A Buy Goods merchant has TWO numbers, and they are not interchangeable:
  //
  //   Till / store number  what the customer keys in to pay you, and what the
  //                        money is settled into (e.g. 7 digits);
  //   Short code           the merchant number the Daraja app was created
  //                        against (e.g. 6 digits), which is what the passkey
  //                        belongs to.
  //
  // Both are 7 digits on many live tills, so the digits cannot tell you which
  // is which — only the M-Pesa Business account screen can.
  //
  // An STK push is addressed to the STORE, so for Buy Goods the till number
  // is what belongs in BusinessShortCode / PartyB / the password. When the
  // two differ, MPESA_TILL_NUMBER carries the till; when they do not (the
  // common case, and every paybill) it stays unset and the short code is used
  // for both. Nothing is inferred from the digits — that only warns.
  const businessShortCode = storeNumber || shortcode;

  // Which kind of number this is, read off its shape. Safaricom issues
  // 6-digit paybill numbers and 7-digit till numbers, and 174379 is the
  // sandbox test paybill. This only feeds a warning — the transaction type
  // stays something the owner declares, never something guessed.
  const digits = /^\d+$/.test(businessShortCode) ? businessShortCode.length : 0;
  const shortcodeKind =
    businessShortCode === "174379" ? "sandbox-test"
    : digits === 7 ? "till"
    : digits === 6 ? "paybill"
    : "unknown";

  return {
    key,
    secret,
    shortcode,
    storeNumber: storeNumber || null,
    businessShortCode,
    passkey,
    callbackUrl,
    base,
    transactionType,
    shortcodeKind,
    environment: env === "production" ? "production" : "sandbox",
    // True when nobody has said which environment these credentials belong
    // to, so the default is being used and may be the wrong one.
    environmentAssumed: !clean(process.env.MPESA_ENV),
  };
}

/**
 * Ask one Daraja host for a token, and report exactly what came back.
 *
 * Returns { ok, status, code, message } with no credential or token in it, so
 * it is safe to log, safe to return to an authenticated admin, and still
 * specific enough to tell "wrong environment" from "wrong key".
 */
export async function probeDaraja(base, { key, secret }) {
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");

  let res;
  try {
    res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 0, code: "network", message: err?.message || "Could not reach Safaricom" };
  }

  const data = await res.json().catch(() => ({}));

  if (res.ok && data.access_token) {
    return { ok: true, status: res.status, code: null, message: "Authentication succeeded", expiresIn: data.expires_in ?? null };
  }

  return {
    ok: false,
    status: res.status,
    code: data.errorCode || data.error || null,
    message: data.errorMessage || data.error_description || "Safaricom rejected the request",
  };
}

/**
 * Full picture for the admin: is M-Pesa configured, which Daraja host is in
 * use, and — the part that actually solves a failure — do the credentials
 * work on the host we chose, or on the other one?
 *
 * Two OAuth calls, only ever made on an explicit admin request.
 */
export async function mpesaDiagnostics() {
  const config = mpesaConfig();
  if (config.error) {
    return {
      configured: false,
      problem: "missing-configuration",
      detail: config.error,
    };
  }

  const primary = await probeDaraja(config.base, config);
  const otherEnv = config.environment === "production" ? "sandbox" : "production";
  const otherBase = otherEnv === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
  const secondary = await probeDaraja(otherBase, config);

  let problem = null;
  let advice = null;

  if (!primary.ok && secondary.ok) {
    problem = "wrong-environment";
    advice = config.environmentAssumed
      ? `These credentials are valid on ${otherEnv}, but MPESA_ENV is unset so the app was using ${config.environment}. Each payment now retries the working host automatically, so checkout is not blocked — set MPESA_ENV=${otherEnv} and redeploy to make that permanent.`
      : `These credentials are valid on ${otherEnv}, but MPESA_ENV says ${config.environment}. Change MPESA_ENV to ${otherEnv} and redeploy — payments are not retried automatically while MPESA_ENV is set.`;
  } else if (!primary.ok && !secondary.ok) {
    problem = "invalid-credentials";
    advice =
      secondary.code === "network"
        ? "Safaricom could not be reached from the server. Check the deployment's outbound access and try again."
        : "The consumer key and secret were rejected by both Daraja hosts. Re-copy them from the Safaricom developer portal for this app — a regenerated secret invalidates the old one.";
  } else if (!/^https:\/\//.test(config.callbackUrl)) {
    problem = "callback-url";
    advice = "The callback URL must be public HTTPS.";
  } else {
    // The login is fine, so anything left fails later, at the push. The one
    // that is silent until a customer tries to pay is a wrong transaction
    // type: a till presented as a paybill (or the reverse) is refused by
    // Daraja with "Invalid TransactionType" and no prompt is ever sent.
    const wrongType =
      (config.shortcodeKind === "till" && config.transactionType === "CustomerPayBillOnline") ||
      (config.shortcodeKind === "paybill" && config.transactionType === "CustomerBuyGoodsOnline");

    if (wrongType) {
      problem = "transaction-type";
      advice =
        config.shortcodeKind === "till"
          ? `Short code ••••${config.businessShortCode.slice(-4)} is 7 digits, which is a Buy Goods (till) number, but the app is sending it as a paybill. Set MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline and redeploy — until then Daraja refuses the push and no prompt reaches the phone.`
          : `Short code ••••${config.businessShortCode.slice(-4)} is 6 digits, which is a paybill, but the app is sending it as Buy Goods. Remove MPESA_TRANSACTION_TYPE (the default is CustomerPayBillOnline) and redeploy.`;
    }
  }

  return {
    configured: true,
    problem,
    advice,
    environment: config.environment,
    environmentAssumed: config.environmentAssumed,
    shortcode: config.shortcode ? `••••${config.shortcode.slice(-4)}` : null,
    storeNumber: config.storeNumber ? `••••${config.storeNumber.slice(-4)}` : null,
    businessShortCode: `••••${config.businessShortCode.slice(-4)}`,
    shortcodeKind: config.shortcodeKind,
    shortcodeLooksLikeSandboxTest: config.businessShortCode === "174379",
    transactionType: config.transactionType,
    callbackHost: (() => {
      try {
        const url = new URL(config.callbackUrl);
        return `${url.host}${url.pathname}`;
      } catch {
        return config.callbackUrl;
      }
    })(),
    checks: [
      { environment: config.environment, base: config.base, ...primary },
      { environment: otherEnv, base: otherBase, ...secondary },
    ],
  };
}

/**
 * Get a token, healing the one misconfiguration the app can detect by itself.
 *
 * `mpesaConfig()` assumes sandbox when MPESA_ENV is unset. For a shop holding
 * live credentials that assumption is wrong, and the only symptom is an
 * authentication failure that looks exactly like a bad key — the failure this
 * codebase could not explain, and the one a customer sees as "we couldn't
 * reach M-Pesa".
 *
 * So: when the environment was *assumed* rather than declared, and Safaricom
 * actually answered (it rejected the credentials — a network error says
 * nothing about environments), retry once against the other host. If the same
 * key and secret are accepted there, that is where this shop belongs.
 *
 * An explicit MPESA_ENV is never second-guessed: if the owner said production,
 * production is what we use, and a failure is reported as a failure.
 */
export async function resolveAccessToken(config) {
  const primary = await mpesaAccessToken(config);
  if (!primary.error) {
    return { ...primary, base: config.base, environment: config.environment, switched: false };
  }

  if (!config.environmentAssumed || primary.code === "network") return primary;

  const otherEnv = config.environment === "production" ? "sandbox" : "production";
  const otherBase = otherEnv === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
  const secondary = await mpesaAccessToken({ ...config, base: otherBase });

  if (secondary.error) {
    return {
      ...primary,
      alsoTried: {
        environment: otherEnv,
        status: secondary.status ?? null,
        code: secondary.code ?? null,
        message: secondary.message ?? null,
      },
    };
  }

  // Correct, but only because we guessed. Say so loudly enough to be fixed.
  console.warn(
    `mpesa: MPESA_ENV is unset, so ${config.environment} was assumed, but these credentials belong to ${otherEnv}. ` +
      `They were accepted there and payment will proceed. Set MPESA_ENV=${otherEnv} in the deployment to remove the guess.`
  );

  return { ...secondary, base: otherBase, environment: otherEnv, switched: true };
}

export function mpesaTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

export function mpesaPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

/** 07XXXXXXXX / 01XXXXXXXX / 2547XXXXXXXX → 2547XXXXXXXX */
export function normalisePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("7") && digits.length === 9) return "254" + digits;
  if (digits.startsWith("1") && digits.length === 9) return "254" + digits;
  return digits;
}

export async function mpesaAccessToken({ key, secret, base }) {
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");

  let res;
  try {
    res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    });
  } catch (err) {
    return { error: "Could not reach M-Pesa", code: "network", message: err?.message || "" };
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    // The code and message are Daraja's own words ("Invalid Credentials",
    // "Bad Request"), never a credential. Callers log them; no customer sees
    // them.
    return {
      error: "Could not authenticate with M-Pesa",
      status: res.status,
      code: data.errorCode || data.error || null,
      message: data.errorMessage || data.error_description || "",
    };
  }

  return { token: data.access_token, expiresIn: data.expires_in };
}
