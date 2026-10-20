import { SITE_NAME, SITE_DESCRIPTION, absoluteUrl } from "../lib/site";

// `/books` itself is a client component (it needs the cart and filters), so
// route-level metadata lives here. Metadata exports are allowed in layouts,
// and the child `/books/[slug]` page overrides them with per-book values.
export const metadata = {
  title: `All Books · ${SITE_NAME}`,
  description:
    "Browse every title in the Book Haven catalogue — fiction, finance, self-help, biography and more. Prices in Kenyan shillings, delivery nationwide.",
  alternates: { canonical: "/books" },
  openGraph: {
    title: `All Books — ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/books"),
    siteName: SITE_NAME,
    type: "website",
  },
};

export default function BooksLayout({ children }) {
  return children;
}
