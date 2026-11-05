import { NextResponse } from "next/server";

import { requireAdmin } from "../../../lib/admin-auth";
import { readJsonObject, isUuid, SMALL_BODY } from "../../../lib/request-guard";

// Testimonial moderation.
//
// The same gate as review moderation: requireAdmin() verifies the bearer
// token with the Auth server and re-reads profiles.role with the service
// client. Nothing here trusts a role that arrived from the browser.
//
// The service role is used deliberately — publishing somebody else's row is
// exactly what the customer-facing policies forbid. Every write lands in
// admin_activity_log, so a published quote has a name against the decision.

const PAGE_SIZE = 25;

function logActivity(adminClient, user, action, testimonialId, details) {
  return adminClient
    .from("admin_activity_log")
    .insert({
      admin_id: user.id,
      admin_email: user.email,
      action,
      target_type: "testimonial",
      target_id: String(testimonialId),
      details,
    })
    .then(({ error }) => {
      if (error) console.error("testimonial activity log failed:", error.message);
    });
}

/** A missing table is an empty queue, not a 500: this ships before the migration runs. */
function missingTable(error) {
  return error?.code === "42P01" || /does not exist/.test(error?.message || "");
}

// GET /api/admin/testimonials?status=pending|published|all&page=
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient } = auth;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = adminClient
    .from("testimonials")
    .select("id, user_id, author_name, body, rating, book_id, book_title, is_published, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status === "pending") query = query.eq("is_published", false);
  else if (status === "published") query = query.eq("is_published", true);

  const { data, error, count } = await query;
  if (error) {
    if (missingTable(error)) {
      return NextResponse.json({
        testimonials: [],
        counts: { pending: 0, published: 0 },
        page,
        pages: 1,
        ready: false,
      });
    }
    console.error("admin testimonials read failed:", error.message);
    return NextResponse.json({ error: "Could not load testimonials" }, { status: 500 });
  }

  return NextResponse.json({
    testimonials: data || [],
    counts: {},
    page,
    pages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)),
    ready: true,
  });
}

// PATCH /api/admin/testimonials — publish or hide one.
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient, user } = auth;

  const parsed = await readJsonObject(request, { maxBytes: SMALL_BODY });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.body || {};

  const id = typeof body.id === "string" ? body.id : "";
  if (!isUuid(id)) {
    return NextResponse.json({ error: "That testimonial id is not valid" }, { status: 400 });
  }
  if (typeof body.is_published !== "boolean") {
    return NextResponse.json({ error: "is_published must be true or false" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("testimonials")
    .update({ is_published: body.is_published })
    .eq("id", id)
    .select("id, is_published")
    .maybeSingle();

  if (error) {
    console.error("admin testimonial update failed:", error.message);
    return NextResponse.json({ error: "Could not update that testimonial" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "That testimonial no longer exists" }, { status: 404 });
  }

  await logActivity(adminClient, user, body.is_published ? "testimonial.publish" : "testimonial.hide", id, {
    is_published: body.is_published,
  });

  return NextResponse.json({ ok: true, testimonial: data });
}

// DELETE /api/admin/testimonials?id= — remove one for good.
export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient, user } = auth;

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!isUuid(id)) {
    return NextResponse.json({ error: "That testimonial id is not valid" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("testimonials")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("admin testimonial delete failed:", error.message);
    return NextResponse.json({ error: "Could not remove that testimonial" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "That testimonial no longer exists" }, { status: 404 });
  }

  await logActivity(adminClient, user, "testimonial.delete", id, {});
  return NextResponse.json({ ok: true });
}
