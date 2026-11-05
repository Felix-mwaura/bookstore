import { createClient } from "@supabase/supabase-js";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config";
import { TESTIMONIAL_LIMIT_DEFAULT } from "./testimonial-limits";

// Reader testimonials.
//
// Read side runs on the public (anon) connection, so Row Level Security is
// doing the filtering: only `is_published` rows come back. There is nothing
// here that needs the service role, and the column list is explicit so a
// future column cannot leak into the page by accident.

function testimonialsClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// How many quotes the homepage asks for. The deck shows five at a time and
// the arrows wrap, so a handful is a full carousel — a hundred would be a
// page of scrolling for the same five faces.
export const TESTIMONIAL_LIMIT = TESTIMONIAL_LIMIT_DEFAULT;

/** The only columns a browser is allowed to see on a testimonial. */
export const PUBLIC_TESTIMONIAL_COLUMNS =
  "id, author_name, body, rating, book_id, book_title, created_at";

/**
 * Published testimonials, newest first. Returns `[]` on any failure: the
 * homepage section is an enhancement, and a quote wall that empties the
 * page because a table is missing would be worse than no quote wall.
 *
 * @returns {Promise<Array<{id:string, author_name:string, body:string, rating:number|null, book_id:number|null, book_title:string|null, created_at:string}>>}
 */
export async function listTestimonials({ limit = TESTIMONIAL_LIMIT } = {}) {
  try {
    const supabase = testimonialsClient();
    const { data, error } = await supabase
      .from("testimonials")
      .select(PUBLIC_TESTIMONIAL_COLUMNS)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit) || TESTIMONIAL_LIMIT, 50)));

    if (error) {
      // Missing table (migration not applied yet) is expected on a fresh
      // environment. `42P01` is undefined_table.
      if (error.code !== "42P01") {
        console.error("[testimonials] could not read testimonials", error.message);
      }
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("[testimonials] unexpected read failure", error?.message || error);
    return [];
  }
}

// The limits and the validator live in ./testimonial-limits so client code and
// the test can import them without the Supabase client. Re-exported here so a
// caller only ever needs one import.
export {
  TESTIMONIAL_MIN_CHARS,
  TESTIMONIAL_MAX_CHARS,
  TESTIMONIAL_NAME_MAX,
  validateTestimonial,
} from "./testimonial-limits";
