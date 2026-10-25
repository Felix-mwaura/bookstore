// Reading a JSON body with a ceiling.
//
// Next.js does not cap request bodies for Route Handlers. `await
// request.json()` on a 50 MB body parses 50 MB before any of the validation
// below it runs, so a public endpoint is a free memory amplifier. Every
// POST route that accepts JSON from a browser (or from Safaricom) uses this
// instead.
//
// The declared Content-Length is checked first so an oversized upload is
// refused before it is read; the length is then checked again after reading,
// because Content-Length is a claim too (a chunked request need not send one).

export const SMALL_BODY = 8 * 1024; // 8 KB — newsletter, query, status pings
export const ORDER_BODY = 32 * 1024; // 32 KB — a 50-line cart plus an address
export const CALLBACK_BODY = 64 * 1024; // 64 KB — Safaricom's envelope
export const ADMIN_BODY = 32 * 1024; // 32 KB — one admin form or one AI turn

/**
 * @returns {{ ok: true, body: unknown } | { ok: false, status: number, error: string }}
 */
export async function readJsonBody(request, { maxBytes = ORDER_BODY } = {}) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, error: "That request is too large." };
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, error: "Could not read the request body." };
  }

  if (text.length > maxBytes) {
    return { ok: false, status: 413, error: "That request is too large." };
  }
  if (!text.trim()) {
    return { ok: false, status: 400, error: "A JSON body is required." };
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body" };
  }
}

/**
 * True for a JSON object — not null, not an array, not a bare string.
 *
 * `await request.json()` happily returns null for the body "null", and every
 * handler that then destructures it (`const { id } = body`) throws a
 * TypeError and answers 500. A null body is a bad request (400), never a
 * server error, so routes check this before touching a field.
 */
export function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True for a UUID string.
 *
 * Ids that reach PostgREST as a filter (`.eq("id", id)`) or as an RPC argument
 * typed uuid are cast by Postgres: a non-uuid value raises 22P02, which
 * surfaces as a 500. A malformed id is a bad request.
 */
export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/** True when a request declares (or obviously carries) more than `maxBytes`. */
export function exceedsBodyLimit(request, maxBytes) {
  const declared = Number(request.headers.get("content-length"));
  return Number.isFinite(declared) && declared > maxBytes;
}
