import Link from "next/link";
import { Suspense } from "react";

import StoreLayout from "../components/StoreLayout";
import BookGrid, { BookGridSkeleton, CatalogueEmpty } from "../components/BookGrid";
import Pagination from "../components/Pagination";
import { ActiveFilterChips, CatalogueSidebar, MobileFilterButton, SortSelect } from "../components/CatalogueControls";
import { getCategoryCounts, isSort, priceBand, queryCatalogue } from "../lib/catalogue";
import { categories } from "../lib/categories";
import { SITE_NAME } from "../lib/site";

export const dynamic = "force-dynamic";

const one = (value) => (Array.isArray(value) ? value[0] : value) || "";

const BASE_METADATA = {
  title: `All books · ${SITE_NAME}`,
  description:
    "Browse every title on the Book Haven shelf — fiction, finance, self-help, history and more, priced in Kenyan shillings with delivery across Kenya.",
  alternates: { canonical: "/books" },
  openGraph: {
    title: `All books — ${SITE_NAME}`,
    description: "Browse the full Book Haven catalogue.",
    url: "/books",
  },
};

// A filtered or searched view is not a separate page to index: it points
// back at the canonical catalogue instead of competing with it.
export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  const category = categories.includes(one(sp.category)) ? one(sp.category) : "";
  const q = one(sp.q).slice(0, 80);

  if (!category && !q) return BASE_METADATA;

  return {
    ...BASE_METADATA,
    title: q ? `Search: ${q} · ${SITE_NAME}` : `${category} books · ${SITE_NAME}`,
    robots: { index: false, follow: true },
  };
}

export default async function BooksPage({ searchParams }) {
  const sp = await searchParams;
  const requestedCategory = one(sp.category);
  const category = categories.includes(requestedCategory) ? requestedCategory : "";
  const sort = isSort(one(sp.sort)) ? one(sp.sort) : "newest";
  const price = priceBand(one(sp.price)) ? one(sp.price) : "";
  const availability = one(sp.availability) === "in-stock" ? "in-stock" : "";
  const q = one(sp.q).slice(0, 80);
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const params = { q, category, sort, price, availability, page };

  const [result, counts] = await Promise.all([
    queryCatalogue({ q, category, sort, price, availability, page }),
    getCategoryCounts(),
  ]);

  const { books, total, pages } = result;
  const hasFilters = Boolean(q || category || price || availability);
  const heading = q ? `Results for “${q}”` : category || "All books";

  return (
    <StoreLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="text-xs text-muted mb-4">
          <ol className="flex items-center gap-2">
            <li><Link href="/" className="hover:text-navy underline-offset-2 hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-ink font-medium" aria-current="page">{category || "All books"}</li>
          </ol>
        </nav>

        <div className="mb-6 border-b border-line pb-5">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-sienna">
            <span aria-hidden="true" className="h-px w-6 bg-sienna" />
            {hasFilters ? "Filtered shelf" : "The whole shelf"}
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-navy sm:text-3xl">{heading}</h1>
              <p className="mt-1 text-sm text-muted">
                {total === 0
                  ? "No titles match this selection."
                  : hasFilters
                    ? `${total} ${total === 1 ? "title matches" : "titles match"} your filters`
                    : `${total} ${total === 1 ? "title" : "titles"} on the shelf`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <MobileFilterButton basePath="/books" params={params} counts={counts} resultCount={total} />
              <SortSelect basePath="/books" params={params} />
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-8">
          <aside aria-label="Catalogue filters">
            <CatalogueSidebar basePath="/books" params={params} counts={counts} />
          </aside>

          <div className="min-w-0">
            {hasFilters && (
              <div className="mb-5">
                <ActiveFilterChips basePath="/books" params={params} />
              </div>
            )}

            {result.error ? (
              <div className="rounded-card border border-line bg-white p-8 text-center" role="alert">
                <h2 className="text-lg font-bold text-navy">The catalogue didn’t load</h2>
                <p className="mt-1 text-sm text-muted">This is on our side, not yours. Please try again.</p>
                <Link href="/books" className="btn-primary mt-5 text-sm">Try again</Link>
              </div>
            ) : books.length === 0 ? (
              <CatalogueEmpty query={q} onClearHref="/books" />
            ) : (
              <Suspense fallback={<BookGridSkeleton />}>
                <BookGrid books={books} label="Catalogue results" />
              </Suspense>
            )}

            <Pagination basePath="/books" params={params} page={page} pages={pages} />
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
