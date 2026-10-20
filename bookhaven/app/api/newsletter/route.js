import { NextResponse } from "next/server";
import { serviceClient } from "../../lib/server";

// POST /api/newsletter — add an address to the announcement list.
//
// Why this is a server route instead of a browser insert:
//   • the anon key is public, so a direct insert lets anyone script thousands
//     of rows with no validation and no ceiling;
//   • the address is normalised and length-checked in one place;
//   • a duplicate is a success for the reader, not an error.
//
// The limiter below is per server instance. On Vercel that means a determined
// attacker can exceed it by landing on fresh instances, so it raises the cost
// of casual abuse rather than acting as a hard quota. A durable limiter
// (Upstash/Redis) is the recommended follow-up — noted in the audit report.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function tooMany(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    // Keep the map from growing without bound on a long-lived instance.
    for (const [k, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

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

  if (tooMany(ip)) {
    return NextResponse.json(
      { error: "Too many sign-ups from this connection. Please try later." },
      { status: 429 }
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
    console.error("/api/newsletter insert failed:", error.message);
    return NextResponse.json({ error: "We could not save your address. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
