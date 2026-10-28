import { NextResponse } from "next/server";

import { requireAdmin } from "../../../lib/admin-auth";
import { readJsonObject, ORDER_BODY } from "../../../lib/request-guard";
import { planGenreName, planGenreImage, genreImagePath } from "../../../lib/genre-admin.js";
import { coverPrefix } from "../../../lib/book-admin.js";
import { dbErrorResponse } from "../../../lib/api-error";

// ── /api/admin/genres ───────────────────────────────────────
//
// Genres are readable by everyone (the storefront lists them) and writable by
// exactly one thing: this route, after requireAdmin has confirmed the caller
// is an administrator. The table has no insert/update/delete policy, so a
// browser holding the anon key can read the list and nothing else — hiding
// the buttons in the dashboard is not the security boundary.
//
// Deletion is guarded in the database as well (genres_refuse_delete_when_used
// raises if any book still names the genre), so two admins clicking at the
// same moment cannot orphan a book between a count and a delete.

function logActivity(adminClient, user, action, details) {
  return adminClient
    .from("admin_activity_log")
    .insert({
      admin_id: user.id,
      admin_email: user.email,
      action,
      target_type: "genre",
      target_id: String(details.name || ""),
      details,
    })
    .then(({ error }) => {
      if (error) console.error("activity log failed:", error.message);
    });
}

/** How many books each genre name currently has, by name. */
async function bookCounts(adminClient) {
  const { data, error } = await adminClient.from("books").select("category");
  if (error) throw error;
  const counts = new Map();
  for (const row of data || []) {
    const name = typeof row.category === "string" ? row.category.trim().toLowerCase() : "";
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
}

// GET /api/admin/genres — every genre, with the number of books on it.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient } = auth;

  const [genresResult, counts] = await Promise.all([
    adminClient.from("genres").select("id, name, slug, image_url, created_at").order("name"),
    bookCounts(adminClient).catch((error) => {
      // The list is still worth showing without the counts; the delete guard
      // in the database is what actually protects the books.
      console.error("GET /api/admin/genres: book counts failed:", error.message);
      return new Map();
    }),
  ]);

  if (genresResult.error) {
    return dbErrorResponse({
      route: "GET /api/admin/genres",
      error: genresResult.error,
      fallback: "Could not load the genres.",
    });
  }

  const genres = (genresResult.data || []).map((genre) => ({
    ...genre,
    books: counts.get(String(genre.name).trim().toLowerCase()) || 0,
  }));

  return NextResponse.json({ genres }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/admin/genres — create one.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient, user } = auth;

  const parsed = await readJsonObject(request, { maxBytes: ORDER_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const plan = planGenreName(parsed.body.name);
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 400 });

  const image = planGenreImage(parsed.body.image_url, coverPrefix());
  if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

  const { data, error } = await adminClient
    .from("genres")
    .insert({ name: plan.name, slug: plan.slug, image_url: image.imageUrl, created_by: user.id })
    .select("id, name, slug, image_url, created_at")
    .single();

  if (error) {
    // 23505 from either unique index: same name in a different case, or a
    // different name that slugifies the same way ("Self Help" / "Self-Help").
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `“${plan.name}” already exists, or would share an address with one that does.` },
        { status: 409 }
      );
    }
    return dbErrorResponse({
      route: "POST /api/admin/genres",
      error,
      fallback: "Could not save that genre.",
      context: { name: plan.name },
    });
  }

  await logActivity(adminClient, user, "genre.create", {
    name: data.name,
    slug: data.slug,
    image: Boolean(data.image_url),
  });
  return NextResponse.json({ genre: { ...data, books: 0 } }, { status: 201 });
}

// PATCH /api/admin/genres — replace or clear one genre's card art.
//
// Separate from POST because the picture is chosen after the genre exists, in
// the row it belongs to. The old file is deleted only once the database has
// accepted the new URL, so a failed update can never leave a row pointing at
// an image that is already gone.
export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient, user } = auth;

  const parsed = await readJsonObject(request, { maxBytes: ORDER_BODY });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const id = Number(parsed.body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Which genre should change?" }, { status: 400 });
  }

  const image = planGenreImage(parsed.body.image_url, coverPrefix());
  if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

  const { data: before, error: readError } = await adminClient
    .from("genres")
    .select("id, name, slug, image_url")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return dbErrorResponse({
      route: "PATCH /api/admin/genres",
      error: readError,
      fallback: "Could not reach that genre.",
    });
  }
  if (!before) return NextResponse.json({ error: "That genre no longer exists." }, { status: 404 });

  const { data, error } = await adminClient
    .from("genres")
    .update({ image_url: image.imageUrl })
    .eq("id", id)
    .select("id, name, slug, image_url, created_at")
    .single();

  if (error) {
    return dbErrorResponse({
      route: "PATCH /api/admin/genres",
      error,
      fallback: "Could not save that image.",
      context: { genre: before.slug },
    });
  }

  const oldPath = genreImagePath(before.image_url, coverPrefix());
  if (oldPath && oldPath !== genreImagePath(data.image_url, coverPrefix())) {
    const { error: rmError } = await adminClient.storage.from("book-covers").remove([oldPath]);
    if (rmError) console.error("old genre image cleanup failed:", rmError.message);
  }

  await logActivity(adminClient, user, "genre.image", {
    name: data.name,
    slug: data.slug,
    removed: !data.image_url,
  });

  return NextResponse.json({ genre: { ...data, books: 0 } });
}

// DELETE /api/admin/genres?id=12 — remove one that has no books on it.
export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { adminClient, user } = auth;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Which genre should be removed?" }, { status: 400 });
  }

  const { data: genre, error: readError } = await adminClient
    .from("genres")
    .select("id, name, slug, image_url")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return dbErrorResponse({
      route: "DELETE /api/admin/genres",
      error: readError,
      fallback: "Could not reach that genre.",
    });
  }
  if (!genre) return NextResponse.json({ error: "That genre no longer exists." }, { status: 404 });

  // Counted so the message can name the number; the trigger is what enforces
  // it. If a book is assigned in the same instant, the trigger still refuses.
  const counts = await bookCounts(adminClient).catch(() => new Map());
  const used = counts.get(String(genre.name).trim().toLowerCase()) || 0;
  if (used > 0) {
    return NextResponse.json(
      {
        error: `“${genre.name}” still has ${used} ${used === 1 ? "book" : "books"}. Move them to another genre first.`,
        books: used,
      },
      { status: 409 }
    );
  }

  const { error: deleteError } = await adminClient.from("genres").delete().eq("id", id);
  if (deleteError) {
    // The trigger fires if a book was assigned between the count above and
    // this delete. Its own sentence is written for a database operator, so
    // the admin gets ours — the numbers in it may be one behind, which is
    // the honest thing to say when the count moved under us.
    if (deleteError.code === "23503") {
      return NextResponse.json(
        { error: `“${genre.name}” still has books on it. Move them to another genre first.` },
        { status: 409 }
      );
    }
    return dbErrorResponse({
      route: "DELETE /api/admin/genres",
      error: deleteError,
      fallback: "Could not remove that genre.",
      context: { name: genre.name },
    });
  }

  // The row is gone; the picture it pointed at is not doing anything useful.
  // Best effort: a leftover file in the bucket is untidy, not broken, and
  // must never make a successful delete look like a failure.
  const removedPath = genreImagePath(genre.image_url, coverPrefix());
  if (removedPath) {
    const { error: rmError } = await adminClient.storage.from("book-covers").remove([removedPath]);
    if (rmError) console.error("genre image cleanup failed:", rmError.message);
  }

  await logActivity(adminClient, user, "genre.delete", { name: genre.name, slug: genre.slug });
  return NextResponse.json({ ok: true, removed: genre });
}
