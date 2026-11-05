// What each genre looks like in the storefront: the artwork behind its card
// and one honest line of copy.
//
// The genre *names* live in ./categories (that is the taxonomy the catalogue
// and the URL filtering both use), so this file only decorates them. A genre
// with no entry here still renders — the card falls back to a plain navy
// panel — so adding a category in Supabase can never break the homepage.
//
// The artwork is generated for this shop (cream/navy/terracotta editorial
// still lifes) and stored in /public/genres at 1200x1200. next/image picks
// the rendition: a phone asks for 256px, a desktop for 640px, so the file in
// the repository is the largest version and nobody downloads it whole.

const ARTWORK = {
  "self-help": "Self-Help",
  finance: "Finance",
  productivity: "Productivity",
  psychology: "Psychology",
  history: "History",
  philosophy: "Philosophy",
  fiction: "Fiction",
  biography: "Biography",
};

const BLURBS = {
  "Self-Help": "Habits, discipline, and the work of changing your mind.",
  Finance: "Money, investing, and the habits behind both.",
  Productivity: "Doing fewer things, better.",
  Psychology: "How the mind actually works.",
  History: "Where the present came from.",
  Philosophy: "Big questions, argued carefully.",
  Fiction: "Novels and manga worth losing an evening to.",
  Biography: "Lives told properly.",
};

/**
 * How many books a genre holds.
 *
 * The two sides of this lookup come from different places: the deck's cards
 * are rows in public.genres, the counts are the `category` strings on books.
 * They are supposed to be the same words, but a stored "Self Help" against a
 * genre named "Self-Help" matched nothing, and every card on the homepage
 * said "0 titles" while the shelf was full. Comparing the words with case,
 * spacing and punctuation ignored makes the count survive that drift; a
 * genuinely empty genre still counts zero.
 *
 * @param {Record<string, number>} counts  category string → count
 * @param {string} name
 * @returns {number}
 */
export function genreCount(counts, name) {
  if (!counts || !name) return 0;

  const exact = Number(counts[name]);
  if (Number.isFinite(exact)) return exact;

  const key = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const wanted = key(name);
  if (!wanted) return 0;

  for (const [category, count] of Object.entries(counts)) {
    if (key(category) === wanted) return Number(count) || 0;
  }
  return 0;
}

/**
 * Artwork for a genre slug, or null when this shop has none for it.
 *
 * `alt` is empty on purpose: the image is decoration behind a card that
 * already names the genre, so announcing it again would only be noise for
 * someone using a screen reader.
 */
export function genreArtwork(slug) {
  if (!ARTWORK[slug]) return null;
  return {
    src: `/genres/${slug}-1200.webp`,
    width: 1200,
    height: 1200,
  };
}

export function genreBlurb(name) {
  return BLURBS[name] || "";
}
