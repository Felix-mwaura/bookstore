// Server-only helpers for the Safaricom Daraja (M-Pesa) API.
// Credentials are read from process.env and are never sent to the browser.

const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const PRODUCTION_BASE = "https://api.safaricom.co.ke";

export function mpesaConfig() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  const missing = [
    !key && "MPESA_CONSUMER_KEY",
    !secret && "MPESA_CONSUMER_SECRET",
    !shortcode && "MPESA_SHORTCODE",
    !passkey && "MPESA_PASSKEY",
    !callbackUrl && "MPESA_CALLBACK_URL",
  ].filter(Boolean);

  if (missing.length) {
    return { error: `M-Pesa is not configured. Missing: ${missing.join(", ")}` };
  }

  const base =
    (process.env.MPESA_ENV || "sandbox").toLowerCase() === "production"
      ? PRODUCTION_BASE
      : SANDBOX_BASE;

  return { key, secret, shortcode, passkey, callbackUrl, base };
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
