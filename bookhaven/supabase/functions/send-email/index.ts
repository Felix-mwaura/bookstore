// Sends queued transactional email from public.email_outbox.
//
// SECURITY: this function must be deployed WITH JWT verification (the Supabase
// default). Every legitimate caller is a server — the Next.js API with the
// service-role key, or /api/admin/emails — so `verify_jwt` is what actually
// proves the token came from this project. `jwtRole()` below only decodes the
// payload to check what the verified token is allowed to do; it does NOT
// verify a signature and must never be the only check.
//
//   supabase functions deploy send-email            # correct
//   supabase functions deploy send-email --no-verify-jwt   # NEVER
//
// A browser never calls this function, so it returns no CORS headers: a page
// on another origin can send the request but cannot read the reply, and it
// cannot send one at all without a token it does not have.
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
const SITE_URL =
  Deno.env.get("SITE_URL") ?? "https://bookstore-puce-sigma.vercel.app";

// The fallback exists so a missing secret degrades to (correct) links rather
// than an exception inside the render loop. It is worth a log line, because a
// stale value sends customers to the wrong domain.
if (!Deno.env.get("SITE_URL")) {
  console.warn(
    "send-email: SITE_URL is not set on this function; links will use the hard-coded fallback. Set it to the public site address.",
  );
}
const FROM =
  Deno.env.get("EMAIL_FROM") ?? "Book Haven <onboarding@resend.dev>";

// No CORS headers. This endpoint is called server-to-server only, so it does
// not need to be readable by any browser origin — and "Access-Control-
// Allow-Origin: *" told every page on the internet that it could try. The
// Supabase gateway, not CORS, is what protects it (see the header comment).
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n: unknown) =>
  `KSh ${Number(n ?? 0).toLocaleString("en-KE")}`;

// Decodes the CLAIM SET of a token the gateway has already verified.
//
// This is deliberately not a signature check: verifying an HS256/RS256 token
// here would duplicate the gateway with a second copy of the signing secret,
// and a bug in the duplicate would be a new way in. The contract is the
// deployment flag at the top of this file.
//
// The expiry check is cheap and local, so it is done here as well: a token
// that has expired is refused even if the gateway let it through.
function jwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (typeof decoded?.exp === "number" && decoded.exp * 1000 < Date.now()) {
      return null;
    }
    return typeof decoded?.role === "string" ? decoded.role : null;
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
  <p style="margin:20px 0 0"><a href="${esc(SITE_URL)}" style="display:inline-block;padding:10px 18px;background:#1C1917;color:#fff;border-radius:8px;text-decoration:none">Visit the store</a></p>
  <p style="margin:20px 0 0;color:#a8a29e;font-size:12px">${esc(APP_NAME)} — Nairobi, Kenya</p>
</div>`;

  return html;
}

Deno.serve(async (req) => {
  // A CORS preflight now gets the same answer as any other non-POST: this is
  // not a browser endpoint.
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing authorization" }, 401);
  // The gateway already verified the signature; this only checks what the
  // token is allowed to do, so a customer JWT cannot trigger a mail run.
  if (jwtRole(token) !== "service_role") {
    return json({ error: "Forbidden" }, 403);
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

  if (error) return json({ error: error.message }, 500);

  if (!pending || pending.length === 0) {
    return json({ checked: 0, sent: 0, failed: 0, skipped: 0 });
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
    });
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

  return json({ checked: pending.length, sent, failed, skipped });
});
