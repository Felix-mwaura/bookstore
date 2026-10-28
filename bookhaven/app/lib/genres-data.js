import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config";
import { categories, categorySlug } from "./categories";

// ── the genre list, as the storefront sees it ─────────────────
//
// Genres live in `public.genres` (supabase/migrations/20261028120000_genres.sql)
// so an admin can add one without a deploy. This module is the only place
// that reads them on the server, and it has one rule above all others: it
// never throws and never returns an empty list.
//
// The reason is the same one that took the preview down in October: the
// storefront's navigation is not allowed to depend on a query succeeding.
// The static taxonomy in ./categories is the fallback, so a paused project, a
// table that has not been migrated yet, or a slow network costs the visitor
// nothing — they get the eight genres the shop launched with.
//
// Two layers of caching, for two different problems:
//   • React's cache() dedupes the call within a single render (the layout,
//     the page and any client component all ask in one request);
//   • the module-level TTL keeps a busy server from asking Supabase on every
//     request, and — when a read fails — stops it from retrying on every
//     request too. A paused database must not become a 1.5s tax per page.

const FALLBACK = categories
  .filter((name) => name !== "All")
  .map((name) => ({ name, slug: categorySlug(name) }));

const TTL_MS = 60_000;
const RETRY_AFTER_FAILURE_MS = 30_000;
const TIMEOUT_MS = 1_500;

let cached = { genres: null, at: 0 };
let lastFailureAt = 0;

function fallback() {
  return FALLBACK.map((genre) => ({ ...genre }));
}

/** Accepts whatever the table holds; drops rows that cannot be rendered. */
function toGenre(row) {
  const name = typeof row?.name === "string" ? row.name.trim() : "";
  if (!name) return null;
  const slug = typeof row?.slug === "string" && row.slug.trim() ? row.slug.trim() : categorySlug(name);
  return { name, slug };
}

async function readGenres() {
  const now = Date.now();
  if (cached.genres && now - cached.at < TTL_MS) return cached.genres;
  if (now - lastFailureAt < RETRY_AFTER_FAILURE_MS) return cached.genres || fallback();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from("genres")
      .select("name, slug")
      .order("name")
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));

    if (error) throw new Error(error.message);

    const rows = (data || []).map(toGenre).filter(Boolean);
    // An empty table means the migration has not been run, not that the shop
    // sells no genres. Fall back rather than render an empty shelf nav.
    if (rows.length === 0) throw new Error("genres table is empty");

    cached = { genres: rows, at: now };
    return rows;
  } catch (error) {
    lastFailureAt = Date.now();
    console.warn("genres: falling back to the built-in list —", error?.message || error);
    return cached.genres || fallback();
  }
}

/**
 * Every genre, alphabetically. Never empty, never throws.
 * Deduped per request by React, cached across requests for a minute.
 */
export const getGenres = cache(readGenres);

/** The genre a URL slug refers to, or null. */
export function findGenre(genres, slug) {
  const wanted = String(slug || "").trim().toLowerCase();
  if (!wanted) return null;
  return genres.find((genre) => genre.slug.toLowerCase() === wanted) || null;
}

export { FALLBACK as FALLBACK_GENRES };
