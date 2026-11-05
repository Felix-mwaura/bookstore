// Optional shared secret for the M-Pesa callback URL.
//
// Daraja does not sign callbacks. The body is a claim, and the route already
// refuses to trust it: a success has to match a stored intent, the merchant
// request id, the exact amount, a well-formed receipt, and Safaricom's own
// STK Query verdict. A shared secret is defence in depth — it stops the
// endpoint being used as a free oracle for "does this CheckoutRequestID
// exist" and cuts the noise from scanners.
//
// It is opt-in on purpose. MPESA_CALLBACK_TOKEN unset keeps today's behaviour
// exactly (the URL Safaricom already holds keeps working). When it is set, the
// caller must present it either as ?k=<token> (append it to
// MPESA_CALLBACK_URL) or as an x-callback-token header.
//
// Comparison is constant-time and length-safe: timingSafeEqual throws when the
// buffers differ in length, which would itself leak the length, so both sides
// are hashed to a fixed 32 bytes first.

import { createHash, timingSafeEqual } from "node:crypto";

const HEADER = "x-callback-token";

function digest(value) {
  return createHash("sha256").update(String(value), "utf8").digest();
}

/** Constant-time comparison of two arbitrary-length strings. */
export function secretMatches(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  if (!provided || !expected) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

/** Pull the presented token out of a URL and/or headers, without throwing on junk. */
export function presentedToken({ url, headers } = {}) {
  let fromQuery = null;
  if (typeof url === "string" && url) {
    try {
      const parsed = new URL(url, "http://localhost");
      fromQuery = parsed.searchParams.get("k") ?? parsed.searchParams.get("token");
    } catch {
      fromQuery = null;
    }
  }
  if (fromQuery) return fromQuery;

  if (headers && typeof headers.get === "function") {
    const header = headers.get(HEADER);
    if (header) return header;
  }
  return null;
}

/**
 * @returns {{ ok: true, skipped?: true } | { ok: false, reason: "missing"|"mismatch" }}
 */
export function verifyCallbackToken(request, expected) {
  if (!expected) return { ok: true, skipped: true };
  const provided = presentedToken(request);
  if (!provided) return { ok: false, reason: "missing" };
  if (!secretMatches(provided, expected)) return { ok: false, reason: "mismatch" };
  return { ok: true };
}
