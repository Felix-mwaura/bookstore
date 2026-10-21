import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { BookCover } from "../../components/BookCover";
import BookDescription from "../../components/BookDescription";
import BuyBar from "../../components/BuyBar";
import ProductCard from "../../components/ProductCard";
import StoreLayout from "../../components/StoreLayout";
import { getBookById, getRelatedBooks, bookPath, bookSlug, parseBookSlug } from "../../lib/catalogue";
import { categorySlug } from "../../lib/categories";
import { stockState } from "../../lib/stock";
import { SITE_NAME, SITE_URL, formatKsh, absoluteUrl } from "../../lib/site";

// Rendered per request rather than cached.
//
// These pages change whenever an admin edits a price or sells a copy, and an
// ISR-cached product page served from a previous deployment kept showing a
// stale heading and, worse, could show a stale price. Thirteen product pages
// are cheap to render; being wrong about the price is not.
export const dynamic = "force-dynamic";

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

export default async function BookPage({ params }) {
  const { slug } = await params;
  const id = parseBookSlug(slug);
  const book = id ? await getBookById(id) : null;

  if (!book) notFound();

  // Keep one canonical URL per book even if the title later changes.
  const canonicalSlug = bookSlug(book);
  if (canonicalSlug !== slug) permanentRedirect(`/books/${canonicalSlug}`);

  const related = await getRelatedBooks(book);
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
    <StoreLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 pb-28 lg:pb-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:text-navy underline-offset-2 hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/books" className="hover:text-navy underline-offset-2 hover:underline">Books</Link></li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/category/${categorySlug(book.category)}`} className="hover:text-navy underline-offset-2 hover:underline">
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
            <div className="scene mx-auto md:mx-0 w-full max-w-[240px] sm:max-w-[300px]">
              <div className="book-3d hover-3d overflow-hidden rounded-r-md book-shadow">
                <BookCover book={book} className="w-full" sizes="(min-width: 768px) 300px, 60vw" priority />
              </div>
            </div>
            <p className="mt-3 text-center md:text-left text-xs text-muted">
              {book.format || "Paperback"}
              {book.pages ? ` · ${book.pages} pages` : ""}
            </p>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/category/${categorySlug(book.category)}`}
                className="text-[11px] font-bold uppercase tracking-widest text-sienna hover:underline underline-offset-2"
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

            <h1 className="mt-2 text-2xl font-bold leading-tight text-navy sm:text-3xl lg:text-4xl">{book.title}</h1>
            <p className="mt-1.5 text-base text-muted">by {book.author}</p>

            {/* One panel for everything that decides the purchase: price,
                stock, quantity, the action. Reading and reference material
                sits below it, so the buy controls are never split by prose. */}
            <div className="mt-5 rounded-card border border-line bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold text-navy">{formatKsh(book.price)}</span>
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
                Delivery is 20% of the book total. It is added on the checkout page, before you pay,
                so the amount owed is on screen before you confirm.
              </p>
            </div>

            <BookDescription text={book.description} />

            {(details.length > 0 || book.isbn) && (
              <dl className="mt-8 border-t border-line">
                {details.map((item) => (
                  <div key={item.label} className="flex items-baseline justify-between gap-6 border-b border-line py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{item.label}</dt>
                    <dd className="max-w-[65%] text-right text-sm font-semibold text-navy break-words">{item.value}</dd>
                  </div>
                ))}
                {book.isbn && (
                  <div className="flex items-baseline justify-between gap-6 border-b border-line py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">ISBN</dt>
                    <dd className="max-w-[65%] text-right font-mono text-xs text-ink break-words">{book.isbn}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-14 border-t border-line pt-8">
            {/* The fallback tops the list up with popular titles from other
                categories, so only claim "More in X" when every book is in X. */}
            <div className="flex items-end justify-between gap-4 mb-5">
              <h2 className="text-xl font-bold text-navy">
                {related.every((item) => item.category === book.category)
                  ? `More in ${book.category}`
                  : "You might also like"}
              </h2>
              <Link href="/books" className="text-sm font-semibold text-sienna underline-offset-2 hover:underline whitespace-nowrap">
                All books →
              </Link>
            </div>

            <ul role="list" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {related.map((item) => (
                <li key={item.id} className="min-w-0">
                  <ProductCard book={item} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </StoreLayout>
  );
}
