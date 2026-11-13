import Link from "next/link";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";

import { BookCover } from "../../components/BookCover";
import BookDescription from "../../components/BookDescription";
import BuyBar from "../../components/BuyBar";
import ProductCard from "../../components/ProductCard";
import ReviewsSection from "../../components/ReviewsSection";
import { StarRating } from "../../components/StarRating";
import ScrollProgress from "../../components/ScrollProgress";
import { jsonLdProps } from "../../lib/json-ld";
import { getBookById, getRelatedBooks, bookPath, bookSlug, parseBookSlug } from "../../lib/catalogue";
import { getServerUser, supabaseServer } from "../../lib/supabase-server";
import { categorySlug } from "../../lib/categories";
import { stockState } from "../../lib/stock";
import { getBookRating, getBookReviews, getViewerReviewId } from "../../lib/reviews";
import { REVIEWS_PER_PAGE, isReviewSort, parsePage, parseStars } from "../../lib/review-limits";
import { DELIVERY_PERCENT, SITE_NAME, SITE_URL, deliveryFeeFor, formatKsh, absoluteUrl } from "../../lib/site";

// Rendered per request rather than cached.
//
// These pages change whenever an admin edits a price or sells a copy, and an
// ISR-cached product page served from a previous deployment kept showing a
// stale heading and, worse, could show a stale price. Thirteen product pages
// are cheap to render; being wrong about the price is not.
//
// This page reads the session cookie (to know whether the reader may review
// the book), which already makes it dynamic. `force-dynamic` was belt *and*
// braces — and it also forced Next to flush the response before the render
// could call `notFound()`, so a missing book answered 200 with a 404 page.
export const dynamic = "auto";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const id = parseBookSlug(slug);
  const book = id ? await getBookById(id) : null;

  if (!book) {
    return { title: `Book not found · ${SITE_NAME}`, robots: { index: false, follow: true } };
  }

  const canonical = bookPath(book);
  const description = book.description
    ? book.description.slice(0, 300)
    : `${book.title} by ${book.author}. ${book.format || "Paperback"} available at ${SITE_NAME} in Kenya.`;

  return {
    title: `${book.title} — ${book.author} · ${SITE_NAME}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: `${book.title} — ${book.author} · ${SITE_NAME}`,
      description,
      url: absoluteUrl(canonical),
      siteName: SITE_NAME,
      images: book.cover_url ? [book.cover_url] : undefined,
    },
  };
}

export default async function BookPage({ params, searchParams }) {
  const { slug } = await params;
  const query = (await searchParams) ?? {};
  // The book and the viewer's session do not depend on each other, so they
  // are fetched in the same wave. They used to be sequential, which put a
  // second round trip on the critical path of every book page for a value
  // that only decides whether one row is labelled "Your review".
  const id = parseBookSlug(slug);
  const [book, auth] = await Promise.all([
    id ? getBookById(id) : null,
    getServerUser(),
  ]);

  if (!book) notFound();

  // Keep one canonical URL per book even if the title later changes.
  const canonicalSlug = bookSlug(book);
  if (canonicalSlug !== slug) permanentRedirect(`/books/${canonicalSlug}`);

  // Review state comes from the URL so every page — a rating filter, a sort
  // order, page 2 — is its own shareable, crawlable address, and the list
  // stays a server render rather than a client fetch.
  const reviewSort = isReviewSort(query.rv_sort) ? query.rv_sort : "recent";
  const reviewStars = parseStars(query.rv_stars);
  const reviewPage = parsePage(query.rv_page);

  // Who is reading? Only used to label their own review in the list. The
  // customer-scoped client is needed because my_book_review() reads auth.uid(),
  // and the public client has no session.
  const viewerClient = auth.user ? await supabaseServer() : null;

  // The related shelf is deliberately absent from this wave. It is the last
  // thing on the page and nobody came for it, so it streams in below (see
  // RelatedShelf) instead of holding the title, the price and the buy button
  // behind two more round trips.
  const [rating, reviewResult, viewerReviewId] = await Promise.all([
    getBookRating(book.id),
    getBookReviews({ bookId: book.id, sort: reviewSort, stars: reviewStars, page: reviewPage, pageSize: REVIEWS_PER_PAGE }),
    getViewerReviewId(book.id, viewerClient),
  ]);

  const state = stockState(book);
  const inStock = state.canBuy;
  const discount = book.original_price && book.original_price > book.price
    ? Math.round((1 - book.price / book.original_price) * 100)
    : null;

  // Structured data built only from real fields — no invented ratings,
  // review counts or availability.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: { "@type": "Person", name: book.author },
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.publisher ? { publisher: { "@type": "Organization", name: book.publisher } } : {}),
    ...(book.pages ? { numberOfPages: book.pages } : {}),
    ...(book.description ? { description: book.description } : {}),
    ...(book.cover_url ? { image: book.cover_url } : {}),
    ...(book.category ? { genre: book.category } : {}),
    url: absoluteUrl(bookPath(book)),
    // Only ever from real, visible, published reviews. A book nobody has
    // reviewed carries no rating in structured data — which is why the
    // invented `books.rating` column is not consulted here.
    ...(rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.average.toFixed(1),
            reviewCount: rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      price: book.price,
      priceCurrency: "KES",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(bookPath(book)),
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Books", item: `${SITE_URL}/books` },
      { "@type": "ListItem", position: 3, name: book.title, item: absoluteUrl(bookPath(book)) },
    ],
  };

  const details = [
    { label: "Format", value: book.format },
    { label: "Pages", value: book.pages },
    { label: "Publisher", value: book.publisher },
    { label: "Year", value: book.year },
  ].filter((item) => item.value);

  return (
    <>
      <script {...jsonLdProps(productJsonLd)} />
      <script {...jsonLdProps(breadcrumbJsonLd)} />

      <div className="shell max-w-[76rem] py-6 pb-28 sm:py-10 lg:pb-14">
        <ScrollProgress />
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="-my-1.5 inline-block py-1.5 hover:text-navy underline-offset-2 hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/books" className="-my-1.5 inline-block py-1.5 hover:text-navy underline-offset-2 hover:underline">Books</Link></li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/category/${categorySlug(book.category)}`} className="-my-1.5 inline-block py-1.5 hover:text-navy underline-offset-2 hover:underline">
                {book.category}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink font-medium truncate max-w-[16rem]" aria-current="page">{book.title}</li>
          </ol>
        </nav>

        <div className="grid gap-8 md:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
          {/* Cover — pinned on desktop so it stays beside the details. */}
          <div className="md:sticky md:top-24 md:self-start">
            <div className="scene mx-auto w-full max-w-[15rem] sm:max-w-[19rem] md:mx-0">
              <div className="book-3d hover-3d overflow-hidden rounded-r-md book-shadow">
                <BookCover book={book} className="w-full" sizes="(min-width: 768px) 300px, 60vw" priority />
              </div>
            </div>
            <p className="mt-4 text-center text-small text-muted md:text-left">
              {book.format || "Paperback"}
              {book.pages ? ` · ${book.pages} pages` : ""}
            </p>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/category/${categorySlug(book.category)}`}
                className="text-xs font-semibold text-sienna underline-offset-2 hover:underline"
              >
                {book.category}
              </Link>
              {book.badge && (
                <span className="rounded-full bg-navy px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {book.badge}
                </span>
              )}
              {discount && (
                <span className="rounded-full bg-sienna px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  −{discount}%
                </span>
              )}
            </div>

            <h1 className="mt-3 font-playfair text-title font-bold text-navy">{book.title}</h1>
            <p className="mt-2 text-base text-muted">by {book.author}</p>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {rating.count > 0 ? (
                <>
                  <StarRating value={rating.average} size="md" showValue count={rating.count} />
                  <a href="#reviews" className="text-xs font-semibold text-sienna underline-offset-2 hover:underline">
                    Read {rating.count === 1 ? "the review" : `${rating.count} reviews`}
                  </a>
                </>
              ) : (
                <a href="#reviews" className="text-xs font-semibold text-muted underline-offset-2 hover:text-sienna hover:underline">
                  Be the first to review this book
                </a>
              )}
            </div>

            {/* One panel for everything that decides the purchase: price,
                stock, quantity, the action. Reading and reference material
                sits below it, so the buy controls are never split by prose. */}
            <div className="surface mt-6 p-5 sm:p-7">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold tabular-nums text-navy sm:text-4xl">{formatKsh(book.price)}</span>
                {book.original_price && book.original_price > book.price && (
                  <span className="text-base text-muted line-through">{formatKsh(book.original_price)}</span>
                )}
              </div>

              <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${state.className}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {state.key === "in" ? "In stock — ready to ship" : state.key === "low" ? `Only ${book.stock_quantity} left` : "Out of stock"}
              </p>

              <div className="mt-5">
                <BuyBar book={book} />
              </div>

              <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                Delivery is {DELIVERY_PERCENT}% of the book total — {formatKsh(deliveryFeeFor(book.price))} on this
                title. It is added on the checkout page, before you pay, so the amount owed is on
                screen before you confirm.
              </p>
            </div>

            <BookDescription text={book.description} />

            {(details.length > 0 || book.isbn) && (
              <dl className="mt-8 border-t border-line">
                {details.map((item) => (
                  <div key={item.label} className="flex items-baseline justify-between gap-6 border-b border-line py-2.5">
                    <dt className="text-micro font-semibold uppercase text-muted">{item.label}</dt>
                    <dd className="max-w-[65%] text-right text-sm font-semibold text-navy break-words">{item.value}</dd>
                  </div>
                ))}
                {book.isbn && (
                  <div className="flex items-baseline justify-between gap-6 border-b border-line py-2.5">
                    <dt className="text-micro font-semibold uppercase text-muted">ISBN</dt>
                    <dd className="max-w-[65%] text-right font-mono text-xs text-ink break-words">{book.isbn}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>

        <ReviewsSection
          book={{ id: book.id, slug: canonicalSlug, title: book.title }}
          summary={rating}
          result={reviewResult}
          sort={reviewSort}
          stars={reviewStars}
          viewerReviewId={viewerReviewId}
        />

        <Suspense fallback={<RelatedSkeleton />}>
          <RelatedShelf book={book} />
        </Suspense>
      </div>
    </>
  );
}

/**
 * "More in X" — fetched after the page has already been sent.
 *
 * Suspense here is not decoration: the reader gets the book, the price and the
 * buy button while this is still one or two round trips away, and the shelf
 * fills in underneath. If the lookup fails, the section renders nothing and
 * the rest of the page is untouched.
 */
async function RelatedShelf({ book }) {
  const related = await getRelatedBooks(book);
  if (related.length === 0) return null;

  return (
    <section className="mt-14 border-t border-line pt-8">
      {/* The fallback tops the list up with popular titles from other
          categories, so only claim "More in X" when every book is in X. */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-heading font-bold text-navy">
          {related.every((item) => item.category === book.category)
            ? `More in ${book.category}`
            : "You might also like"}
        </h2>
        <Link href="/books" className="text-sm font-semibold text-sienna underline-offset-2 hover:underline whitespace-nowrap">
          All books →
        </Link>
      </div>

      <ul role="list" className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
        {related.map((item) => (
          <li key={item.id} className="min-w-0">
            <ProductCard book={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The same four-card footprint, so the shelf does not shove the page down. */
function RelatedSkeleton() {
  return (
    <section className="mt-14 border-t border-line pt-8" aria-busy="true">
      <p className="sr-only">Loading more books…</p>
      <div className="mb-6 h-7 w-48 rounded bg-subtle animate-pulse" aria-hidden="true" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-card border border-line bg-white p-4">
            <div className="mx-auto aspect-[2/3] w-full max-w-[9.5rem] rounded-r-md bg-subtle animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}
