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
  "Buy books online in Kenya. Paperbacks and hardcovers across fiction, finance, self-help and biography — free delivery in Nairobi on orders over KSh 3,000.";

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
