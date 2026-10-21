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

// Store contact details. These are the values the site has always shown;
// they are centralised here so they can be corrected in one place rather
// than drifting between the footer, the about section and the emails.
export const STORE_CONTACT = {
  email: "hello@bookhaven.co.ke",
  phone: "+254 712 345 678",
  phoneHref: "tel:+254712345678",
  location: "The Junction Mall, Nairobi",
  hours: "Mon–Sat: 9am–7pm",
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
