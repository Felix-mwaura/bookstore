import { NextResponse } from "next/server";
import { serviceClient } from "../../lib/server";
import { readJsonBody, SMALL_BODY } from "../../lib/request-guard";
import { checkRateLimit } from "../../lib/rate-limit";
import { logRouteError } from "../../lib/api-error";

// POST /api/newsletter — add an address to the announcement list.
//
// Why this is a server route instead of a browser insert:
//   • the anon key is public, so a direct insert lets anyone script thousands
//     of rows with no validation and no ceiling;
//   • the address is normalised and length-checked in one place;
//   • a duplicate is a success for the reader, not an error.
//
// The counter lives in a shared store (app/lib/rate-limit.js), not in this
// process: 5 sign-ups per connection per 10 minutes.

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// Throwaway inboxes are the fastest way to fill the list with addresses that
// will never read anything. This is a speed bump, not a gate: the list is
// short on purpose, because rejecting a real corporate domain costs more than
// accepting a disposable one.
const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "trashmail.com",
  "yopmail.com",
]);

function isDisposable(email) {
  const domain = email.split("@")[1] || "";
  return DISPOSABLE.has(domain);
}

export async function POST(request) {
  const parsed = await readJsonBody(request, { maxBytes: SMALL_BODY });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.body;

  // A hidden field only a bot fills in. Treat a filled trap as success so the
  // bot does not learn to avoid it.
  if (typeof body?.company === "string" && body.company.trim()) {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const limit = await checkRateLimit({ scope: "newsletter", identifier: ip });
  if (limit.limited) {
    return NextResponse.json(
      { error: "Too many sign-ups from this connection. Please try later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds || 60) } }
    );
  }
  // A store that is down must not block a sign-up: the worst case is a few
  // unthrottled addresses, and `checkRateLimit` has already logged why.

  if (isDisposable(email)) {
    return NextResponse.json(
      { error: "Please use an address you will keep — that one is a temporary inbox." },
      { status: 400 }
    );
  }

  let db;
  try {
    db = serviceClient();
  } catch {
    return NextResponse.json({ error: "Sign-ups are unavailable right now." }, { status: 503 });
  }

  const { error } = await db
    .from("newsletter_subscribers")
    .insert({ email, source: "homepage" });

  // 23505 = unique violation, i.e. already on the list. That is a success
  // from the reader's point of view and should not reveal who is subscribed.
  if (error && error.code !== "23505") {
    logRouteError("POST /api/newsletter", error, { source: "homepage" });
    return NextResponse.json({ error: "We could not save your address. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
