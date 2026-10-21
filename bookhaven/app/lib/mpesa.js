// Server-only helpers for the Safaricom Daraja (M-Pesa) API.
// Credentials are read from process.env and are never sent to the browser.

import { SITE_URL } from "./site.js";

const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const PRODUCTION_BASE = "https://api.safaricom.co.ke";

export function mpesaConfig() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  // The callback is optional: it defaults to this site's own HTTPS address,
  // which is what it has to be anyway. Keeping it overridable matters when a
  // preview deployment must report to a stable domain, and it removes a
  // setting that is easy to get wrong (a trailing slash or http:// makes
  // Safaricom reject the whole push).
  const callbackUrl = (
    process.env.MPESA_CALLBACK_URL || `${SITE_URL}/api/mpesa/callback`
  ).trim();

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

  const base =
    (process.env.MPESA_ENV || "sandbox").toLowerCase() === "production"
      ? PRODUCTION_BASE
      : SANDBOX_BASE;

  // Paybill numbers use CustomerPayBillOnline; a Buy Goods (till) number must
  // use CustomerBuyGoodsOnline or Daraja rejects the request.
  const transactionType =
    (process.env.MPESA_TRANSACTION_TYPE || "").trim() || "CustomerPayBillOnline";

  return { key, secret, shortcode, passkey, callbackUrl, base, transactionType };
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
  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    return { error: "Could not authenticate with M-Pesa", details: data };
  }
  return { token: data.access_token, expiresIn: data.expires_in };
}
