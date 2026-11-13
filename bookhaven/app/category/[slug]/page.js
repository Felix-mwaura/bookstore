import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PageHeader from "../../components/PageHeader";
import BookGrid, { CatalogueEmpty } from "../../components/BookGrid";
import Pagination from "../../components/Pagination";
import { ActiveFilterChips, CatalogueSidebar, MobileFilterButton, SortSelect } from "../../components/CatalogueControls";
import { getCategoryCounts, isSort, priceBand, queryCatalogue } from "../../lib/catalogue";
import { findGenre, getGenres } from "../../lib/genres-data";
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
  const genre = findGenre(await getGenres(), slug);
  if (!genre) return { title: "Category not found" };

  const title = `${genre.name} books · ${SITE_NAME}`;
  return {
    title,
    description: descriptions[genre.name] ?? `Browse ${genre.name} books at ${SITE_NAME}.`,
    alternates: { canonical: `/category/${genre.slug}` },
    openGraph: { title, url: `/category/${genre.slug}` },
  };
}

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


export default async function CategoryPage({ params, searchParams }) {
  const { slug } = await params;
  // Genres are data now (see app/lib/genres-data.js). The old slug lookup
  // could only ever know the eight hard-coded names; this one knows whatever
  // the admin has added, and a slug that matches nothing is still a 404.
  const genres = await getGenres();
  const genre = findGenre(genres, slug);
  if (!genre) notFound();
  const category = genre.name;

  const sp = await searchParams;
  const sort = isSort(one(sp.sort)) ? one(sp.sort) : "newest";
  const price = priceBand(one(sp.price)) ? one(sp.price) : "";
  const availability = one(sp.availability) === "in-stock" ? "in-stock" : "";
  const q = one(sp.q).slice(0, 80);
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const basePath = `/category/${genre.slug}`;
  const queryParams = { q, category: "", sort, price, availability, page };
  // Category pages are already scoped, so the sidebar only offers the other
  // shelves as cross-links instead of a competing "category" filter.
  const sidebarParams = { ...queryParams, category: "" };

  const [result, counts] = await Promise.all([
    queryCatalogue({ q, category, sort, price, availability, page }),
    getCategoryCounts(),
  ]);

  const { books, total, pages } = result;
  if (books.length === 0 && page > pages) redirect(lastPageHref(basePath, sp, pages));

  const hasFilters = Boolean(q || price || availability);

  return (
    <>
      <div className="shell py-8 sm:py-12">
        <PageHeader
          className="mb-8 sm:mb-10"
          breadcrumb={[
            { label: "Home", href: "/" },
            { label: "Books", href: "/books" },
            { label: category },
          ]}
          title={category}
          description={descriptions[category] ?? `Everything we have on the ${category} shelf.`}
          meta={`${total} ${total === 1 ? "title" : "titles"} in this genre`}
          actions={
            <>
              <MobileFilterButton basePath={basePath} params={queryParams} counts={counts} resultCount={total} />
              <SortSelect basePath={basePath} params={queryParams} />
            </>
          }
        />

        <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
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
          <h2 className="mb-3 text-lg font-bold text-navy">Other genres</h2>
          <ul role="list" className="flex flex-wrap gap-2">
            {genres.filter((other) => other.slug !== genre.slug).map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/category/${other.slug}`}
                  className="inline-flex items-center rounded-full border border-line bg-white px-3 py-2 text-sm text-ink hover:border-navy"
                >
                  {other.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
