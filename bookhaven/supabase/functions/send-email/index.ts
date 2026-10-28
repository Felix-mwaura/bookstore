// Sends queued transactional email from public.email_outbox.
//
// Contract:
//   * Called by the Next.js server with the service-role key (never the
//     browser), or manually by an admin through /api/admin/emails.
//   * Rows are enqueued inside the same Postgres transaction as the order
//     change, so a notification cannot be lost if this function is down.
//   * Each row is claimed and completed independently. A failure is written
//     back as status='failed' + last_error and retried on the next sweep
//     until MAX_ATTEMPTS, so a Resend outage never blocks an order.
//   * dedupe_key is unique in the table: replaying an order transition cannot
//     send the same email twice.
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 5;
const BATCH = 20;
const APP_NAME = "Book Haven";
// No hard-coded production host. When SITE_URL is unset the call-to-action is
// omitted rather than pointing readers at a host this deployment may not own.
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
const FROM =
  Deno.env.get("EMAIL_FROM") ?? "Book Haven <onboarding@resend.dev>";

// CORS is opt-in per origin.
//
// This function is called server-to-server (the Next.js app and
// /api/admin/emails) and never needs to be readable from an arbitrary page.
// The wildcard that used to be here meant any site could call it with a
// service-role bearer token (if one leaked) and read the response — and it
// advertised the endpoint to scanners. Now a browser origin is echoed only if
// it is listed in ALLOWED_ORIGINS (comma-separated) or equals SITE_URL;
// everything else gets no CORS headers at all, which the browser treats as a
// refusal. Server-to-server calls send no Origin and are unaffected.
const ALLOWED_ORIGINS = [
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(","),
  Deno.env.get("SITE_URL") ?? "",
]
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function corsFor(req?: Request): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  const origin = req?.headers.get("Origin")?.replace(/\/+$/, "");
  if (!origin) return headers;
  if (!ALLOWED_ORIGINS.includes(origin)) return headers;
  headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] = "authorization, content-type";
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  return headers;
}

const json = (body: unknown, status = 200, req?: Request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), "Content-Type": "application/json" },
  });

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n: unknown) =>
  `KSh ${Number(n ?? 0).toLocaleString("en-KE")}`;

// Decoded WITHOUT verifying the signature — safe only because this function is
// deployed with verify_jwt = true, so the Supabase gateway has already rejected
// any token it did not sign. The claim is used for authorisation, not for
// identity: a customer JWT must not be able to trigger a mail run, and only
// the service role may. If verify_jwt is ever turned off, this check becomes
// worthless — keep the deployment setting paired with this comment.
function jwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return decoded?.role ?? null;
  } catch {
    return null;
  }
}

const SUBJECT_FALLBACK: Record<string, string> = {
  order_confirmed: "We received your Book Haven order",
  payment_received: "Payment received for your Book Haven order",
  order_dispatched: "Your Book Haven order is on its way",
  order_delivered: "Your Book Haven order was delivered",
  order_cancelled: "Your Book Haven order was cancelled",
  refund_refund_pending: "Your Book Haven refund is being processed",
  refund_refunded: "Your Book Haven refund was processed",
};

type EmailItem = {
  id?: string | number;
  title?: string;
  quantity?: number;
  price?: number;
};

type EmailPayload = {
  order_id?: string;
  status?: string;
  payment_status?: string;
  payment_method?: string;
  total?: number;
  items?: EmailItem[];
  delivery?: {
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    phone?: string;
    instructions?: string;
  };
  courier?: string;
  tracking_ref?: string;
};

function render(template: string, subject: string, payload: EmailPayload) {
  const items: EmailItem[] = Array.isArray(payload?.items) ? payload.items : [];
  const delivery = payload?.delivery ?? {};
  const name = [delivery.firstName, delivery.lastName].filter(Boolean).join(" ");

  const heading: Record<string, string> = {
    order_confirmed: "Order received",
    payment_received: "Payment confirmed",
    order_dispatched: "Your order is on its way",
    order_delivered: "Delivered — enjoy your books",
    order_cancelled: "Your order was cancelled",
    refund_refund_pending: "Refund in progress",
    refund_refunded: "Refund completed",
  };

  const intro: Record<string, string> = {
    order_confirmed:
      "Thanks for your order. We are preparing it now and will email you again when it ships.",
    payment_received:
      "We have confirmed your payment. Your order is now with our fulfilment team.",
    order_dispatched:
      "Your books have left our store. Please keep your phone nearby for the delivery call.",
    order_delivered:
      "Your order was delivered. We hope you enjoy it — reply to this email if anything is wrong.",
    order_cancelled:
      "Your order was cancelled and the books have been returned to stock. If you paid online, a refund will follow.",
    refund_refund_pending:
      "We have started your refund. It usually reaches M-Pesa within a few working days.",
    refund_refunded: "Your refund has been processed. Thank you for your patience.",
  };

  const lines = items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0">${esc(it.title)} × ${esc(it.quantity)}</td><td style="padding:6px 0;text-align:right">${money(
          (it.price ?? 0) * (it.quantity ?? 1)
        )}</td></tr>`
    )
    .join("");

  const tracking =
    payload?.courier || payload?.tracking_ref
      ? `<p style="margin:16px 0 0"><strong>Courier:</strong> ${esc(
          payload?.courier ?? "—"
        )}<br/><strong>Tracking:</strong> ${esc(payload?.tracking_ref ?? "—")}</p>`
      : "";

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:auto;color:#1C1917">
  <h2 style="margin:0 0 4px">${esc(heading[template] ?? subject)}</h2>
  <p style="color:#57534e;margin:0 0 16px">${esc(intro[template] ?? "")}</p>
  ${name ? `<p style="margin:0 0 12px">Hello ${esc(name)},</p>` : ""}
  <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4">
    ${lines}
    <tr><td style="padding:10px 0 6px;font-weight:700">Total</td><td style="padding:10px 0 6px;text-align:right;font-weight:700">${money(
      payload?.total
    )}</td></tr>
  </table>
  ${tracking}
  <p style="margin:16px 0 0;color:#57534e;font-size:13px">
    Order reference: <strong>${esc(String(payload?.order_id ?? "").slice(0, 8).toUpperCase())}</strong><br/>
    Delivering to: ${esc(delivery.address ?? "")}, ${esc(delivery.city ?? "")}<br/>
    Payment: ${esc(payload?.payment_method ?? "")} (${esc(payload?.payment_status ?? "")})
  </p>
  ${SITE_URL ? `<p style="margin:20px 0 0"><a href="${esc(SITE_URL)}" style="display:inline-block;padding:10px 18px;background:#1C1917;color:#fff;border-radius:8px;text-decoration:none">Visit the store</a></p>` : ""}
  <p style="margin:20px 0 0;color:#a8a29e;font-size:12px">${esc(APP_NAME)} — Nairobi, Kenya</p>
</div>`;

  return html;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, req);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing authorization" }, 401, req);
  // The gateway already verified the signature; this only checks what the
  // token is allowed to do, so a customer JWT cannot trigger a mail run.
  if (jwtRole(token) !== "service_role") {
    return json({ error: "Forbidden" }, 403, req);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const apiKey = Deno.env.get("RESEND_API_KEY");

  const { data: pending, error } = await admin
    .from("email_outbox")
    .select("*")
    .in("status", ["queued", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) return json({ error: error.message }, 500, req);

  if (!pending || pending.length === 0) {
    return json({ checked: 0, sent: 0, failed: 0, skipped: 0 }, 200, req);
  }

  // Without a provider key, be explicit: mark rows so the admin can see why
  // nothing is being delivered, instead of retrying forever in silence.
  if (!apiKey) {
    await admin
      .from("email_outbox")
      .update({
        status: "skipped",
        last_error: "RESEND_API_KEY is not set on the send-email function",
      })
      .in("id", pending.map((r) => r.id));
    return json({
      checked: pending.length,
      sent: 0,
      failed: 0,
      skipped: pending.length,
      reason: "RESEND_API_KEY is not configured",
    }, 200, req);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of pending) {
    if (!row.to_email) {
      await admin
        .from("email_outbox")
        .update({ status: "skipped", last_error: "No recipient address" })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    const subject = row.subject || SUBJECT_FALLBACK[row.template] || "Book Haven update";
    const html = render(row.template, subject, row.payload);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [row.to_email],
          subject,
          html,
        }),
      });

      if (res.ok) {
        await admin
          .from("email_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: row.attempts + 1,
            last_error: null,
          })
          .eq("id", row.id);
        sent++;
      } else {
        const detail = (await res.text()).slice(0, 400);
        await admin
          .from("email_outbox")
          .update({
            status: "failed",
            attempts: row.attempts + 1,
            last_error: `Resend ${res.status}: ${detail}`,
          })
          .eq("id", row.id);
        failed++;
      }
    } catch (err) {
      await admin
        .from("email_outbox")
        .update({
          status: "failed",
          attempts: row.attempts + 1,
          last_error: String(err).slice(0, 400),
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return json({ checked: pending.length, sent, failed, skipped }, 200, req);
});
