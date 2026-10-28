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
