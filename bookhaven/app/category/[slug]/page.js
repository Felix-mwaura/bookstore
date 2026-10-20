import Link from "next/link";
import { notFound } from "next/navigation";

import StoreLayout from "../../components/StoreLayout";
import BookGrid, { CatalogueEmpty } from "../../components/BookGrid";
import Pagination from "../../components/Pagination";
import { ActiveFilterChips, CatalogueSidebar, MobileFilterButton, SortSelect } from "../../components/CatalogueControls";
import { getCategoryCounts, isSort, priceBand, queryCatalogue } from "../../lib/catalogue";
import { categories, categoryFromSlug, categoryIcons, categorySlug } from "../../lib/categories";
import { SITE_NAME } from "../../lib/site";

export const dynamic = "force-dynamic";

const descriptions = {
  "Self-Help":
    "Practical books on habits, mindset and personal change — the titles readers ask for most often.",
  Finance:
    "Personal finance and investing titles, from first savings to long-term wealth building.",
  Productivity:
    "Books on focus, time management and getting meaningful work done.",
  Psychology:
    "How people think, decide and behave — written for general readers.",
  History:
    "Narrative history and big-picture accounts of the events that shaped the modern world.",
  Philosophy:
    "Classic and modern philosophy on ethics, meaning and how to live.",
  Fiction:
    "Novels and short-story collections, from contemporary bestsellers to modern classics.",
  Biography:
    "Memoirs and biographies of people whose lives are worth reading about.",
};

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) return { title: "Category not found" };

  const title = `${category} books · ${SITE_NAME}`;
  return {
    title,
    description: descriptions[category] ?? `Browse ${category} books at ${SITE_NAME}.`,
    alternates: { canonical: `/category/${categorySlug(category)}` },
    openGraph: { title, url: `/category/${categorySlug(category)}` },
  };
}

const one = (value) => (Array.isArray(value) ? value[0] : value) || "";

export default async function CategoryPage({ params, searchParams }) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const sp = await searchParams;
  const sort = isSort(one(sp.sort)) ? one(sp.sort) : "newest";
  const price = priceBand(one(sp.price)) ? one(sp.price) : "";
  const availability = one(sp.availability) === "in-stock" ? "in-stock" : "";
  const q = one(sp.q).slice(0, 80);
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const basePath = `/category/${categorySlug(category)}`;
  const queryParams = { q, category: "", sort, price, availability, page };
  // Category pages are already scoped, so the sidebar only offers the other
  // shelves as cross-links instead of a competing "category" filter.
  const sidebarParams = { ...queryParams, category: "" };

  const [result, counts] = await Promise.all([
    queryCatalogue({ q, category, sort, price, availability, page }),
    getCategoryCounts(),
  ]);

  const { books, total, pages } = result;
  const hasFilters = Boolean(q || price || availability);

  return (
    <StoreLayout>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="text-xs text-muted mb-4">
          <ol className="flex items-center gap-2 flex-wrap">
            <li><Link href="/" className="hover:text-navy underline-offset-2 hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/books" className="hover:text-navy underline-offset-2 hover:underline">Books</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-ink font-medium" aria-current="page">{category}</li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold text-navy">
              <span className="mr-2" aria-hidden="true">{categoryIcons[category]}</span>
              {category} books
            </h1>
            <p className="mt-1.5 text-sm text-muted leading-relaxed">{descriptions[category]}</p>
            <p className="mt-1 text-xs text-muted">
              {total} {total === 1 ? "title" : "titles"} in this genre
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MobileFilterButton basePath={basePath} params={queryParams} counts={counts} resultCount={total} />
            <SortSelect basePath={basePath} params={queryParams} />
          </div>
        </div>

        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-8">
          <aside aria-label="Catalogue filters">
            <CatalogueSidebar basePath={basePath} params={sidebarParams} counts={counts} />
          </aside>

          <div className="min-w-0">
            {hasFilters && (
              <div className="mb-5">
                <ActiveFilterChips basePath={basePath} params={queryParams} />
              </div>
            )}

            {result.error ? (
              <div className="rounded-card border border-line bg-white p-8 text-center" role="alert">
                <h2 className="text-lg font-bold text-navy">The catalogue didn’t load</h2>
                <p className="mt-1 text-sm text-muted">This is on our side, not yours. Please try again.</p>
                <Link href={basePath} className="btn-primary mt-5 text-sm">Try again</Link>
              </div>
            ) : books.length === 0 ? (
              <CatalogueEmpty query={q} onClearHref={basePath} />
            ) : (
              <BookGrid books={books} label={`${category} books`} />
            )}

            <Pagination basePath={basePath} params={queryParams} page={page} pages={pages} />
          </div>
        </div>

        <nav aria-label="Other genres" className="mt-12 border-t border-line pt-6">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Other genres</h2>
          <ul role="list" className="flex flex-wrap gap-2">
            {categories.filter((c) => c !== "All" && c !== category).map((c) => (
              <li key={c}>
                <Link
                  href={`/category/${categorySlug(c)}`}
                  className="inline-flex items-center rounded-full border border-line bg-white px-3 py-2 text-sm text-ink hover:border-navy"
                >
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </StoreLayout>
  );
}
