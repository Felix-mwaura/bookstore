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
