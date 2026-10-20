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
  "Buy books online in Kenya. Paperbacks and hardcovers across fiction, finance, self-help and biography — free delivery on orders of KSh 3,000 and above.";

export const FREE_DELIVERY_THRESHOLD = 3000;
export const STANDARD_DELIVERY_FEE = 300;

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
 * Product cards at 320px are about 145px wide and also carry a sold-out
 * badge and an add button, so five-digit prices used to wrap or squeeze the
 * layout. Under 10,000 the grouped number is short enough and is shown in
 * full ("1,500"); above that one decimal keeps it honest and compact
 * ("12.5K", "1.2M"). The card renders "KSh" as a small label beside this, and
 * the full value goes in the price's accessible name.
 */
export function compactKshNumber(value) {
  const n = Math.max(0, Number(value) || 0);
  const trim = (num) => num.toFixed(1).replace(/\.0$/, "");
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (n >= 10_000) return `${trim(n / 1000)}K`;
  return n.toLocaleString("en-KE");
}

/** Compact price for tight spaces; still a complete sentence for assistive tech. */
export function formatKshCompact(value) {
  return `KSh ${compactKshNumber(value)}`;
}
