import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import StoreLayout from "../components/StoreLayout";
import PageHeader from "../components/PageHeader";
import BookGrid, { BookGridSkeleton, CatalogueEmpty } from "../components/BookGrid";
import Pagination from "../components/Pagination";
import { ActiveFilterChips, CatalogueSidebar, MobileFilterButton, SortSelect } from "../components/CatalogueControls";
import { getCategoryCounts, isSort, priceBand, queryCatalogue } from "../lib/catalogue";
import { getGenres, resolveGenre } from "../lib/genres-data";
import { SITE_NAME } from "../lib/site";

export const dynamic = "force-dynamic";

const one = (value) => (Array.isArray(value) ? value[0] : value) || "";

/**
 * A page number past the end is a dead end: the heading still describes the
 * shelf while the grid below it is empty. Send the reader to the last page
 * that exists, keeping every filter they had chosen.
 */
function lastPageHref(basePath, sp, pages) {
  const params = new URLSearchParams();
  for (const key of ["q", "category", "sort", "price", "availability"]) {
    const value = Array.isArray(sp[key]) ? sp[key][0] : sp[key];
    if (value) params.set(key, value);
  }
  if (pages > 1) params.set("page", String(pages));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}


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
  // Resolved against the same genre list the sidebar and the header picker
  // render (see lib/genres-data.js), not the built-in taxonomy: a genre an
  // admin adds must filter, not silently show the whole shelf.
  const genre = resolveGenre(await getGenres(), one(sp.category));
  const category = genre ? genre.name : "";
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
  const genre = resolveGenre(await getGenres(), requestedCategory);
  const category = genre ? genre.name : "";
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
  if (books.length === 0 && page > pages) redirect(lastPageHref("/books", sp, pages));

  const hasFilters = Boolean(q || category || price || availability);
  const heading = q ? `Results for “${q}”` : category || "All books";

  return (
    <StoreLayout>
      <div className="shell py-8 sm:py-12">
        <PageHeader
          className="mb-8 sm:mb-10"
          breadcrumb={[{ label: "Home", href: "/" }, { label: category || "All books" }]}
          title={heading}
          description={
            total === 0
              ? "No titles match this selection."
              : hasFilters
                ? `${total} ${total === 1 ? "title matches" : "titles match"} your filters`
                : `${total} ${total === 1 ? "title" : "titles"} on the shelf, priced in Kenyan shillings with delivery across the country.`
          }
          actions={
            <>
              <MobileFilterButton basePath="/books" params={params} counts={counts} resultCount={total} />
              <SortSelect basePath="/books" params={params} />
            </>
          }
        />

        <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
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
