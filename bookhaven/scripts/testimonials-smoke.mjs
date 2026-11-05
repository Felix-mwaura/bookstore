#!/usr/bin/env node
// Testimonials test.
//
//   node scripts/testimonials-smoke.mjs            (needs no server)
//
// The testimonials section is the one part of the shop that puts words in a
// customer's mouth and the shop's name underneath them. That makes two lies
// possible, and both are checked here:
//
//   • a quote nobody wrote, or a book nobody recommended, invented to fill an
//     empty deck;
//   • a submission that appears on the homepage without anyone reading it.
//
// What a clean run does NOT mean: that the deck looks right, that the form is
// pleasant to use, or that a real reader's submission reaches a real database.
// None of those can be seen from here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  TESTIMONIAL_MAX_CHARS,
  TESTIMONIAL_MIN_CHARS,
  TESTIMONIAL_NAME_MAX,
  validateTestimonial,
} from "../app/lib/testimonial-limits.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (path) => readFileSync(join(root, path), "utf8");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const section = read("app/components/TestimonialsSection.js");
const lib = read("app/lib/testimonials.js");
const route = read("app/api/testimonials/route.js");
const adminRoute = read("app/api/admin/testimonials/route.js");
const home = read("app/components/HomeClient.js");
const page = read("app/page.js");
const sql = read("supabase/migrations/20261105120000_testimonials.sql");

/* ── the section exists, and is fed by the server ────────────────────── */

console.log("\nThe section is on the homepage, and its quotes come from the server");

check("the homepage renders the testimonials section", /<TestimonialsSection[\s/>]/.test(home));
check("it is given the testimonial list", /testimonials=\{testimonials\}/.test(home));
check("the page reads that list on the server", /listTestimonials\(\)/.test(page));
check("the read is awaited with the rest of the page data", /testimonials\] = await Promise\.all\(/.test(page));

/* ── nothing is invented ─────────────────────────────────────────────── */

console.log("\nNothing on the deck is invented");

check(
  "an empty list renders an invitation, never placeholder quotes",
  /testimonials\.length > 0 \?/.test(section) && /No testimonials are published yet/.test(section)
);
check("the read asks only for published rows", /\.eq\("is_published", true\)/.test(lib));
check("the read asks only for public columns", /PUBLIC_TESTIMONIAL_COLUMNS/.test(lib) && !/select\("\*"\)/.test(lib));
check(
  "a failed read is an empty section, not an error page",
  /return \[\]/.test(lib) && /42P01/.test(lib)
);
check(
  "a card shows no rating the shop has not measured",
  !/average|review_count|★|\bstars?\b/.test(section.replace(/\/\*[\s\S]*?\*\//g, "").split("return (")[1] || "")
);
check("the section claims no bestseller", !/bestsell/i.test(section + lib));

/* ── the recommended book is real ────────────────────────────────────── */

console.log("\nA recommended book is a real book");

check(
  "the route reads the title from the catalogue, not from the request",
  /\.from\("books"\)/.test(route) && /bookTitle = book\.title;/.test(route)
);
check("an archived book cannot be recommended", /!book \|\| book\.is_archived/.test(route));
check(
  "the picker offers only the titles the page already has",
  /books\.map\(\(book\) => \(/.test(section) && /<option key=\{book\.id\} value=\{book\.id\}>/.test(section)
);
check("a card without a book shows no book line", /if \(!testimonial\.book_title\) return null;/.test(section));

/* ── submissions are read before they appear ─────────────────────────── */

console.log("\nNothing reaches the homepage unread");

check("a submission is written unpublished", /is_published: false/.test(route));
check("publishing is an admin action", /requireAdmin\(request\)/.test(adminRoute) && /is_published: body\.is_published/.test(adminRoute));
check("every moderation write is logged", /admin_activity_log/.test(adminRoute) && /target_type: "testimonial"/.test(adminRoute));
check("the dashboard has a Testimonials tab", /id:"testimonials", label:"Testimonials"/.test(read("app/admin/admin-client.js")));
check("the tab is rendered", /activeTab==="testimonials"&&<TestimonialsTab/.test(read("app/admin/admin-client.js")));
check("the queue defaults to the unread ones", /useState\("pending"\)/.test(read("app/admin/admin-client.js")));
check(
  "the dashboard cannot rewrite a reader's words",
  !/testimonial\.body\s*=/.test(read("app/admin/admin-client.js")) && !/"body:/.test(adminRoute)
);

/* ── who may write ───────────────────────────────────────────────────── */

console.log("\nWho may write one");

check("a signed-out request is refused before anything is read", /if \(!token\) \{/.test(route) && /status: 401/.test(route));
check("the token is verified with the auth server", /client\.auth\.getUser\(token\)/.test(route));
check("the row's owner is the verified user, not the request", /user_id: user\.id/.test(route));
check("the browser cannot send its own user id", !/user_id: body|body\.user_id/.test(route));
check("the browser cannot publish its own row", !/is_published: body\.is_published/.test(route));
check("a repeated submission is explained, not crashed", /23505/.test(route) && /status: 409/.test(route));
check("an unrun migration answers honestly", /42P01/.test(route) && /status: 503/.test(route));
check("there is a rate limit on submissions", /checkRateLimit\(\{ scope: "testimonial"/.test(route));
check("that scope exists in the policy table", /testimonial: \{ limit:/.test(read("app/lib/rate-limit.js")));
check("a bot trap is answered as success", /body\.company/.test(route) && /if \(typeof body\.company === "string" && body\.company\.trim\(\)\)/.test(route));

/* ── the validation rules, run for real ──────────────────────────────── */

console.log("\nThe rules a testimonial has to meet");

check("a short quote is refused", validateTestimonial({ authorName: "A", body: "too short" }).ok === false);
check(
  "a quote at the minimum passes",
  validateTestimonial({ authorName: "A reader", body: "x".repeat(TESTIMONIAL_MIN_CHARS) }).ok === true
);
check(
  "a quote at the maximum passes",
  validateTestimonial({ authorName: "A reader", body: "x".repeat(TESTIMONIAL_MAX_CHARS) }).ok === true
);
check(
  "a quote past the maximum is refused",
  validateTestimonial({ authorName: "A reader", body: "x".repeat(TESTIMONIAL_MAX_CHARS + 1) }).ok === false
);
check("a nameless quote is refused", validateTestimonial({ authorName: "  ", body: "x".repeat(40) }).ok === false);
check(
  "a name past its limit is refused",
  validateTestimonial({ authorName: "n".repeat(TESTIMONIAL_NAME_MAX + 1), body: "x".repeat(40) }).ok === false
);
check(
  "the name is tidied, and the words are only trimmed",
  validateTestimonial({ authorName: "  A   Reader ", body: "  x".repeat(20) }).value?.author_name === "A Reader"
);
check("a rating outside 1–5 is refused", validateTestimonial({ authorName: "A", body: "x".repeat(40), rating: 6 }).ok === false);
check("no rating is allowed", validateTestimonial({ authorName: "A", body: "x".repeat(40) }).value?.rating === null);
check(
  "the client and the route share one validator",
  /validateTestimonial\(\{/.test(section) && /validateTestimonial\(\{/.test(route)
);

/* ── the database agrees with the route ──────────────────────────────── */

console.log("\nThe database enforces the same rules");

check("the migration is idempotent (table)", /create table if not exists public\.testimonials/.test(sql));
check("RLS is on", /alter table public\.testimonials enable row level security/.test(sql));
check("the public may read only published rows", /using \(is_published = true\)/.test(sql));
check(
  "a reader may write only their own, unpublished row",
  /with check \(user_id = auth\.uid\(\) and is_published = false\)/.test(sql)
);
check("one testimonial per account", /create unique index if not exists testimonials_one_per_user/.test(sql));
check(
  "no update or delete grant for either browser role",
  /grant select on public\.testimonials to anon;/.test(sql) &&
    /grant select, insert on public\.testimonials to authenticated;/.test(sql) &&
    !/grant (update|delete|all)/i.test(sql)
);
check("the body length is a constraint, not a comment", /char_length\(btrim\(body\)\) between 20 and 200/.test(sql));
check("a removed book does not delete the quote", /book_id\s+bigint references public\.books \(id\) on delete set null/.test(sql));

/* ── the deck is the same deck ───────────────────────────────────────── */

console.log("\nThe testimonials use the same fanned deck as the categories");

check(
  "the quote cards reuse the shared deck classes",
  /className="genre-region/.test(section) && /className="genre-stage"/.test(section) && /className="genre-card/.test(section)
);
check("distance drives the same scale and rotation", /--s": scale/.test(section) && /--r": `\$\{distance \* 4\}deg`/.test(section));
check("the arrows are labelled buttons", /aria-label="Previous testimonial"/.test(section) && /aria-label="Next testimonial"/.test(section));
check("the dots say which one is showing", /aria-current=\{index === activeIndex \? "true"/.test(section));
check("the change is announced, not just moved", /aria-live="polite"/.test(section));
check("no auto-advance timer", !/setInterval/.test(section));
check("the section has its own heading id", /id="testimonials-title"/.test(section));

/* ── the search bar's two faults stay fixed ──────────────────────────── */

console.log("\nThe header search keeps its two fixes");

const header = read("app/components/StoreHeader.js");

check("no ring or border lights up the whole pill on focus", !/focus-within:ring/.test(header) && !/focus-within:border-sienna/.test(header));
check("a quiet focus cue is kept", /focus-within:border-navy/.test(header));
check("the field itself still shows focus", /focus:ring|focus:border/.test(header) || /focus-visible:/.test(header));
check("the browser's own suggestion list is off", /autoComplete="off"/.test(header));
check(
  "no search pill anywhere on the homepage rings itself",
  !/focus-within:ring/.test(header + read("app/components/HomeBands.js"))
);
check(
  "the category control is an action, so a repeat pick still fires",
  /value="All"/.test(header) && /onChange=\{\(e\) => chooseCategory\(e\.target\.value\)\}/.test(header)
);
check("no dead state is left holding the last category", !/const \[category, setCategory\]/.test(header));

if (failures > 0) {
  console.log(`\n${failures} ${failures === 1 ? "check" : "checks"} failed.`);
  process.exit(1);
}
console.log("\nAll testimonials checks passed.");
