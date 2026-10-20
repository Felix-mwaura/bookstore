import { after } from "next/server";
import { SUPABASE_URL } from "./supabase-config";

// Server-only bridge to the send-email edge function.
//
// Notifications are queued in Postgres by the same transaction that changed
// the order, so this is only a *delivery attempt* — losing it delays an email
// but never loses it. That is why the call is fire-and-forget: a slow mail
// provider must not slow down checkout or an admin action.
export function queueEmailDispatch() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    // after() keeps the function alive past the response on Vercel.
    after(async () => {
      await dispatchQueuedEmails();
    });
  } catch {
    // Outside a request scope (e.g. a script) — just do it inline.
    void dispatchQueuedEmails();
  }
}

/** Runs one delivery sweep. Never throws. */
export async function dispatchQueuedEmails() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return { skipped: true, reason: "no service key" };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("send-email returned", res.status, text.slice(0, 300));
      return { ok: false, status: res.status };
    }
    try {
      return JSON.parse(text);
    } catch {
      return { ok: true };
    }
  } catch (err) {
    console.error("send-email dispatch failed:", err?.message || err);
    return { ok: false };
  }
}
