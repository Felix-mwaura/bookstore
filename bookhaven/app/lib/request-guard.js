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

/** True when a request declares (or obviously carries) more than `maxBytes`. */
export function exceedsBodyLimit(request, maxBytes) {
  const declared = Number(request.headers.get("content-length"));
  return Number.isFinite(declared) && declared > maxBytes;
}
