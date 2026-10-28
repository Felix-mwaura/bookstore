// ── naming rules for a genre ────────────────────────────────
//
// Pure and dependency-free so `node scripts/genres-smoke.mjs` can exercise it
// without a bundler, the same way book-admin.js is tested.
//
// Everything the admin form can get wrong is decided here, once, and the
// answer is either a clean { name, slug } pair or a sentence the admin can
// act on. The database has the final say (a unique index on lower(name)), but
// a request that is obviously wrong should never reach it.

export const MAX_GENRE_NAME = 40;

// "All" is not a genre: it is the sentinel the catalogue filters use for
// "no genre selected". A real genre called All would make the filter read
// "All genres" twice and filter to a shelf nobody can see.
const RESERVED = new Set(["all"]);

/** Lowercase, one hyphen per run of anything that is not a letter or digit. */
export function genreSlug(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * @param {unknown} raw whatever arrived in the request body
 * @returns {{ ok: true, name: string, slug: string } | { ok: false, error: string }}
 */
export function planGenreName(raw) {
  if (typeof raw !== "string") {
    return { ok: false, error: "A genre name is required." };
  }

  // Tabs, newlines and runs of spaces collapse to one space: "Self   Help "
  // and "Self Help" are the same shelf, and the admin should not be able to
  // create both.
  const name = raw.replace(/\s+/g, " ").trim();

  if (!name) return { ok: false, error: "Enter a genre name." };

  if (name.length > MAX_GENRE_NAME) {
    return { ok: false, error: `Keep the name under ${MAX_GENRE_NAME} characters.` };
  }

  if (RESERVED.has(name.toLowerCase())) {
    return { ok: false, error: "“All” is reserved for the unfiltered view. Pick another name." };
  }

  // Letters in any script, digits, spaces, and the punctuation a shelf name
  // plausibly uses. Anything else (angle brackets, quotes, slashes) has no
  // business being a genre and would be a slug nobody can read.
  if (!/^[\p{L}\p{N}][\p{L}\p{N} &'’.\-]*$/u.test(name)) {
    return {
      ok: false,
      error: "Use letters, numbers, spaces, and & ' . - only.",
    };
  }

  // The address is ASCII (genreSlug strips everything else), so a name with
  // no Latin letter or digit in it would produce an empty slug and a category
  // page nobody can link to. Say that now rather than failing at the index.
  if (!/[a-z0-9]/i.test(name)) {
    return { ok: false, error: "Include at least one Latin letter or number so the genre gets an address." };
  }

  const slug = genreSlug(name);
  if (!slug) return { ok: false, error: "That name does not make a usable address. Add a letter." };

  return { ok: true, name, slug };
}

/**
 * A genre's card art has to be an image this shop is hosting, under
 * `genres/` in the public covers bucket.
 *
 * Not an arbitrary URL: the homepage would then be pulling a picture from
 * someone else's server — their tracking, their uptime, their ability to
 * swap the image later — and next/image would refuse it anyway, because the
 * optimiser only trusts this project's storage host.
 *
 * @param {unknown} raw          the field from the request body
 * @param {string}  publicPrefix `${SUPABASE_URL}/storage/v1/object/public/book-covers/`
 */
export function planGenreImage(raw, publicPrefix) {
  if (raw === null || raw === undefined || raw === "") return { ok: true, imageUrl: null };

  if (typeof raw !== "string") {
    return { ok: false, error: "The image must be a URL." };
  }

  const url = raw.trim();
  if (!url) return { ok: true, imageUrl: null };

  if (!publicPrefix || !url.startsWith(publicPrefix)) {
    return { ok: false, error: "Upload the image here; it has to live in this store's storage." };
  }

  const path = url.slice(publicPrefix.length);
  // One flat folder, one file: no ../, no query strings, no second folder.
  if (!/^genres\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(path)) {
    return { ok: false, error: "That is not a genre image path." };
  }

  return { ok: true, imageUrl: url };
}

/** The storage path inside the covers bucket, or null if the URL is not ours. */
export function genreImagePath(url, publicPrefix) {
  if (typeof url !== "string" || !publicPrefix || !url.startsWith(publicPrefix)) return null;
  const path = url.slice(publicPrefix.length);
  return /^genres\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(path) ? path : null;
}
