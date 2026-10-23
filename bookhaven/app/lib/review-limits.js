// Shared review limits.
//
// A plain module with no imports, so the client bundle can use the same
// numbers as the server without pulling the Supabase client in with them.
// These MUST match the CHECK constraints in
// supabase/migrations/20261023162927_book_reviews.sql — the database is the
// enforcement, this is only what the form says before a request is sent.

export const REVIEW_MIN_CHARS = 10;
export const REVIEW_MAX_CHARS = 2000;
export const REVIEW_TITLE_MAX = 100;
export const REVIEWS_PER_PAGE = 5;

export const REVIEW_SORTS = [
  { value: "recent", label: "Most recent" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export function isReviewSort(value) {
  return REVIEW_SORTS.some((option) => option.value === value);
}

/** Clamp anything that came from a URL into a valid star filter (0 = all). */
export function parseStars(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0;
}

export function parsePage(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** "4.6" — one decimal place, or null when there are no reviews. */
export function formatAverage(average) {
  if (average === null || average === undefined) return null;
  return Number(average).toFixed(1);
}

/** Percentage of reviews at one star level, for the distribution bars. */
export function starPercent(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}
