// Optional shared secret on the M-Pesa callback URL.
//
// WHY
//   Daraja does not sign callbacks. The endpoint is public by design and the
//   only thing standing between it and a forged "payment succeeded" is the
//   five checks in app/lib/mpesa-verify.js — which is strong, but every one of
//   them costs a database read and, for a success, a call to Safaricom.
//   A URL secret is not authentication either (it travels in a query string,
//   and Safaricom does not guarantee it is encrypted at their end), but it is
//   a cheap first filter: a request that does not know it is dropped before it
//   can make us do any work at all.
//
//   It is OPTIONAL. When MPESA_CALLBACK_TOKEN is unset the callback behaves
//   exactly as it did before, so applying this change cannot break a shop that
//   has not opted in. When it is set, the app appends it to the CallBackURL it
//   sends with every STK push, so there is nothing to edit by hand.
//
// COMPARISON
//   Constant time over SHA-256 digests, so neither the value nor its length
//   can be learned from response timing.

import { createHash, timingSafeEqual } from "node:crypto";

export const CALLBACK_TOKEN_PARAM = "token";

/** Shorter than this is not worth calling a secret. */
export const MIN_CALLBACK_TOKEN_LENGTH = 16;

/**
 * Does `provided` match `expected`? False when either side is missing, so a
 * route that forgets to check for configuration fails closed.
 */
export function callbackTokenMatches(provided, expected) {
  if (typeof expected !== "string" || expected.length === 0) return false;
  if (typeof provided !== "string" || provided.length === 0) return false;

  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * The URL to send to Daraja: the configured callback with `?token=…` appended.
 * An existing token parameter is left alone (never duplicated), and a value
 * that is not a URL is returned unchanged.
 */
export function appendCallbackToken(url, token) {
  if (!token) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has(CALLBACK_TOKEN_PARAM)) {
      parsed.searchParams.set(CALLBACK_TOKEN_PARAM, token);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** The same URL with any token value replaced, for logs and error messages. */
export function redactCallbackUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has(CALLBACK_TOKEN_PARAM)) {
      parsed.searchParams.set(CALLBACK_TOKEN_PARAM, "[redacted]");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
