import "./globals.css";
import { Playfair_Display, Inter } from "next/font/google";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, STORE_CONTACT } from "./lib/site";
import { StoreProvider } from "./components/StoreShell";
import { GenreProvider } from "./components/GenreProvider";
import MotionRoot from "./components/MotionRoot";
import NavProgress from "./components/NavProgress";
import { Suspense } from "react";
import { getGenres } from "./lib/genres-data";
import { jsonLdProps } from "./lib/json-ld";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  // metadataBase makes every relative canonical/OG path absolute, which is
  // what search engines and social previews require.
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} — Kenya's Online Bookstore`,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Books delivered across Kenya`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_KE",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Books delivered across Kenya`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

// Organisation + WebSite structured data, emitted once for the whole app.
// Contact points are added only when the shop has actually published them —
// search engines treat a `telephone` here as a verified fact, and inventing
// one is exactly the mistake lib/site.js exists to prevent.
const organisationJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  areaServed: "KE",
  currenciesAccepted: "KES",
  paymentAccepted: "M-Pesa, Cash on Delivery",
  ...(() => {
    const points = [];
    for (const number of [STORE_CONTACT.phone, STORE_CONTACT.phoneAlt]) {
      if (!number) continue;
      const digits = number.replace(/[^\d+]/g, "");
      if (!digits) continue;
      points.push({
        "@type": "ContactPoint",
        contactType: "customer service",
        areaServed: "KE",
        availableLanguage: "en",
        // Schema.org wants the international form; a shop that publishes
        // "0768…" still has the number, so the leading zero is rewritten
        // rather than dropped.
        telephone: digits.startsWith("0") ? `+254${digits.slice(1)}` : digits,
      });
    }
    if (STORE_CONTACT.email) {
      const emailPoint = points[0] || {
        "@type": "ContactPoint",
        contactType: "customer service",
        areaServed: "KE",
        availableLanguage: "en",
      };
      points[0] = { ...emailPoint, email: STORE_CONTACT.email };
    }
    if (points.length === 0) return {};
    return { contactPoint: points.length === 1 ? points[0] : points };
  })(),
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/books?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

// The genre list is read once here rather than by each nav that needs it.
// getGenres() falls back to the built-in taxonomy and never throws, so this
// await cannot take the page down — it can only make the nav older than the
// database for up to a minute.
export const revalidate = 60;

export default async function RootLayout({ children }) {
  const genres = await getGenres();

  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <body className={`${playfair.variable} ${inter.variable}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-bold"
        >
          Skip to content
        </a>
        <StoreProvider>
          <GenreProvider genres={genres}>
            <MotionRoot>
              {/* Suspense is required: NavProgress reads useSearchParams, and
                  without a boundary above it that read would opt every page
                  out of static rendering. It renders nothing until a
                  navigation starts. */}
              <Suspense fallback={null}>
                <NavProgress />
              </Suspense>
              <div id="main-content">{children}</div>
            </MotionRoot>
          </GenreProvider>
        </StoreProvider>
        <script {...jsonLdProps(organisationJsonLd)} />
        <script {...jsonLdProps(websiteJsonLd)} />
      </body>
    </html>
  );
}
