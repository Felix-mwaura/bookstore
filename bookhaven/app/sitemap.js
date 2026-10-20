import { SITE_URL } from "./lib/site";
import { getStorefrontBooks, bookPath } from "./lib/catalogue";

// Regenerated hourly. A database hiccup must not break the sitemap — a
// partial sitemap is far better than a 500 for every crawler.
export const revalidate = 3600;

const CATEGORIES = [
  "self-help", "finance", "productivity", "psychology",
  "history", "philosophy", "fiction", "biography",
];

export default async function sitemap() {
  const now = new Date();

  const staticRoutes = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/books`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryRoutes = CATEGORIES.map((slug) => ({
    url: `${SITE_URL}/category/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  let bookRoutes = [];
  try {
    const books = await getStorefrontBooks(500);
    bookRoutes = books.map((book) => ({
      url: `${SITE_URL}${bookPath(book)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch {
    bookRoutes = [];
  }

  return [...staticRoutes, ...categoryRoutes, ...bookRoutes];
}
