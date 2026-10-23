// Single source of truth for the public site identity.
//
// The canonical URL is used for metadataBase, canonicals, Open Graph URLs,
// the sitemap and robots.txt. Set NEXT_PUBLIC_SITE_URL when a custom domain
// exists; until then the production Vercel hostname is the real address, so
// links in search results and structured data point somewhere that works.

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://bookstore-puce-sigma.vercel.app"
).replace(/\/+$/, "");

export const SITE_NAME = "Book Haven";

export const SITE_TAGLINE = "Kenya's online bookstore";

export const SITE_DESCRIPTION =
  "Buy books online in Kenya. Paperbacks and hardcovers across fiction, finance, self-help and biography — 20% delivery on every order.";

// Delivery is 20% of the book total, on every order.
//
// One rule, written once here and once in place_order(), which is what
// actually bills the customer. The arithmetic is deliberately integer-only --
// floor((subtotal * 20 + 50) / 100) in both languages -- because a Javascript
// Math.round and a Postgres round() can disagree on a half-shilling, and the
// M-Pesa amount is checked against the database's total before an order is
// accepted.
export const DELIVERY_PERCENT = 20;

/** Delivery charged on a book subtotal of `subtotal` shillings. */
export function deliveryFeeFor(subtotal) {
  const amount = Math.max(0, Math.round(Number(subtotal) || 0));
  return Math.floor((amount * DELIVERY_PERCENT + 50) / 100);
}

// ── Store contact details ─────────────────────────────────────────────────
//
// OWNER ACTION REQUIRED. The four fallbacks below are PLACEHOLDERS that have
// been on the site since it was built. They are not real: the phone number
// belongs to nobody, and the shop address and opening hours have never been
// confirmed. Publishing an address that a customer then travels to is worse
// than publishing none, so they are flagged here rather than guessed at.
//
// To correct them without touching code, set these in the deployment:
//
//     NEXT_PUBLIC_STORE_EMAIL     e.g. orders@<your-domain>
//     NEXT_PUBLIC_STORE_PHONE     display text, e.g. +254 7XX XXX XXX
//     NEXT_PUBLIC_STORE_PHONE_E164  dialable, e.g. +2547XXXXXXXX
//     NEXT_PUBLIC_STORE_LOCATION  a real collection point, or blank
//     NEXT_PUBLIC_STORE_HOURS     real opening hours, or blank
//
// Unset values fall back to the current placeholders so nothing visually
// regresses; `usingPlaceholders` is what tells the owner they are still fake.
// Everything that displays contact details reads this object, so one change
// updates the footer, the contact section and the structured data.
const contactValue = (value) => (typeof value === "string" ? value.trim() : "");

const PLACEHOLDER_EMAIL = "hello@bookhaven.co.ke";
const PLACEHOLDER_PHONE = "+254 712 345 678";
const PLACEHOLDER_PHONE_E164 = "+254712345678";
const PLACEHOLDER_LOCATION = "The Junction Mall, Nairobi";
const PLACEHOLDER_HOURS = "Mon\u2013Sat: 9am\u20137pm";

const CONTACT_EMAIL = contactValue(process.env.NEXT_PUBLIC_STORE_EMAIL);
const CONTACT_PHONE = contactValue(process.env.NEXT_PUBLIC_STORE_PHONE);
const CONTACT_PHONE_E164 = contactValue(process.env.NEXT_PUBLIC_STORE_PHONE_E164);
const CONTACT_LOCATION = contactValue(process.env.NEXT_PUBLIC_STORE_LOCATION);
const CONTACT_HOURS = contactValue(process.env.NEXT_PUBLIC_STORE_HOURS);

export const STORE_CONTACT = {
  email: CONTACT_EMAIL || PLACEHOLDER_EMAIL,
  phone: CONTACT_PHONE || PLACEHOLDER_PHONE,
  phoneHref: `tel:${(CONTACT_PHONE_E164 || PLACEHOLDER_PHONE_E164).replace(/\s+/g, "")}`,
  location: CONTACT_LOCATION || PLACEHOLDER_LOCATION,
  hours: CONTACT_HOURS || PLACEHOLDER_HOURS,
  // True while the shop is still publishing details nobody confirmed. Shown
  // as a reminder in the admin dashboard; see the report's P7 section.
  usingPlaceholders: !CONTACT_EMAIL || !CONTACT_PHONE || !CONTACT_LOCATION,
};

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** KSh formatting used everywhere prices are shown. */
export function formatKsh(value) {
  return `KSh ${Number(value || 0).toLocaleString("en-KE")}`;
}

/**
 * The number alone, shortened once a price gets long.
 *
 * Product cards at 320px are about 140px wide and also carry a stock badge
 * and an add button, so five-digit prices used to wrap or squeeze the layout.
 * Under 10,000 the grouped number is short enough and is shown in full
 * ("1,500"). Above that it becomes "12.5K" or "1.2M", but only when that form
 * is exact: a rounding that changed the price on screen would be a lie, so an
 * awkward amount such as 12,345 stays grouped. The card draws "KSh" as a
 * small label beside this, and the full value is the price's accessible name.
 */
export function compactKshNumber(value) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  const trim = (num) => num.toFixed(1).replace(/\.0$/, "");

  const shorten = (unit, suffix) => {
    const scaled = Math.round((n / unit) * 10) / 10;
    return scaled * unit === n ? `${trim(scaled)}${suffix}` : null;
  };

  if (n >= 1_000_000) return shorten(1_000_000, "M") || n.toLocaleString("en-KE");
  if (n >= 10_000) return shorten(1000, "K") || n.toLocaleString("en-KE");
  return n.toLocaleString("en-KE");
}

/** Compact price for tight spaces; still a complete sentence for assistive tech. */
export function formatKshCompact(value) {
  return `KSh ${compactKshNumber(value)}`;
}
