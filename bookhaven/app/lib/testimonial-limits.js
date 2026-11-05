// The testimonial rules, free of the Supabase client.
//
// Split out for the same reason review-limits.js exists: the form imports the
// limits and the validator, and dragging the SDK into that bundle to read two
// numbers would be silly. It also means the test can run the real validator
// against the real limits without a network.

export const TESTIMONIAL_MIN_CHARS = 20;
export const TESTIMONIAL_MAX_CHARS = 200;
export const TESTIMONIAL_NAME_MAX = 60;

// How many quotes the homepage asks for. See app/lib/testimonials.js — it is
// here with the other numbers so the two cannot drift.
export const TESTIMONIAL_LIMIT_DEFAULT = 12;

// How many quotes the homepage asks for. The deck shows five at a time and
// the arrows wrap, so a handful is a full carousel — a hundred would be a
// page of scrolling for the same five faces.
export const TESTIMONIAL_LIMIT = 12;

/** The only columns a browser is allowed to see on a testimonial. */
export const PUBLIC_TESTIMONIAL_COLUMNS =
  "id, author_name, body, rating, book_id, book_title, created_at";

/**
 * Trim and validate a submitted testimonial. Pure, so the client can run the
 * same rules and show the message before a round trip.
 *
 * @returns {{ ok: true, value: {author_name: string, body: string, rating: number|null} } | { ok: false, error: string }}
 */
export function validateTestimonial({ authorName, body, rating } = {}) {
  const name = typeof authorName === "string" ? authorName.trim().replace(/\s+/g, " ") : "";
  const text = typeof body === "string" ? body.trim() : "";

  if (!name) return { ok: false, error: "Please add the name you would like shown." };
  if (name.length > TESTIMONIAL_NAME_MAX) {
    return { ok: false, error: `Please keep your name to ${TESTIMONIAL_NAME_MAX} characters or fewer.` };
  }
  if (text.length < TESTIMONIAL_MIN_CHARS) {
    return { ok: false, error: `Please write at least ${TESTIMONIAL_MIN_CHARS} characters.` };
  }
  if (text.length > TESTIMONIAL_MAX_CHARS) {
    return { ok: false, error: `Please keep it to ${TESTIMONIAL_MAX_CHARS} characters or fewer.` };
  }

  let stars = null;
  if (rating !== undefined && rating !== null && rating !== "") {
    const parsed = Number(rating);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      return { ok: false, error: "A rating has to be between 1 and 5 stars." };
    }
    stars = parsed;
  }

  return { ok: true, value: { author_name: name, body: text, rating: stars } };
}
