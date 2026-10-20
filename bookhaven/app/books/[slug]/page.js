import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BookCover } from "../../components/BookCard";
import BuyBar from "../../components/BuyBar";
import StoreLayout from "../../components/StoreLayout";
import { getBookById, getRelatedBooks, bookPath, bookSlug, parseBookSlug } from "../../lib/catalogue";
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

function Stars({ rating }) {
  const value = Number(rating) || 0;
  return (
    <div className="flex items-center gap-1" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className="w-4 h-4" viewBox="0 0 20 20" fill={n <= Math.round(value) ? "#f59e0b" : "#d6d3d1"} aria-hidden="true">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
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
  const inStock = Number(book.stock_quantity) > 0;
  const lowStock = inStock && Number(book.stock_quantity) <= 3;
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
      {
        "@type": "ListItem",
        position: 3,
        name: book.title,
        item: absoluteUrl(bookPath(book)),
      },
    ],
  };

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="text-sm text-stone-500 mb-6 flex flex-wrap items-center gap-1.5">
          <Link href="/" className="hover:text-[#991B1B]">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/books" className="hover:text-[#991B1B]">Books</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/category/${book.category.toLowerCase().replace(/\s+/g, "-")}`} className="hover:text-[#991B1B]">
            {book.category}
          </Link>
        </nav>

        <div className="grid md:grid-cols-[280px_1fr] gap-8 lg:gap-12">
          <div>
            <div
              className="rounded-r-lg overflow-hidden mx-auto md:mx-0 w-full max-w-[260px]"
              style={{ aspectRatio: "2/3", boxShadow: "-4px 0 8px rgba(0,0,0,0.12), 10px 20px 40px rgba(0,0,0,0.18)" }}
            >
              <BookCover book={book} className="w-full h-full" />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-bold text-[#991B1B] uppercase tracking-wider">{book.category}</span>
              {book.badge && (
                <span className="px-2.5 py-0.5 bg-[#991B1B] text-white text-[10px] font-bold uppercase rounded-md">{book.badge}</span>
              )}
              {discount && (
                <span className="px-2.5 py-0.5 bg-green-600 text-white text-[10px] font-bold uppercase rounded-md">{discount}% off</span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-[#1C1917] leading-tight">{book.title}</h1>
            <p className="text-lg text-stone-500 mt-1">by {book.author}</p>

            {book.rating ? (
              <div className="flex items-center gap-2 mt-4">
                <Stars rating={book.rating} />
                <span className="font-bold text-[#1C1917]">{book.rating}</span>
                {book.reviews > 0 && <span className="text-sm text-stone-400">({book.reviews.toLocaleString()} reviews)</span>}
              </div>
            ) : null}

            <div className="flex items-baseline gap-3 mt-5">
              <span className="text-4xl font-black text-[#1C1917]">{formatKsh(book.price)}</span>
              {book.original_price && book.original_price > book.price && (
                <span className="text-xl text-stone-400 line-through">{formatKsh(book.original_price)}</span>
              )}
            </div>

            <p className={`mt-3 inline-flex items-center gap-1.5 text-sm font-semibold ${inStock ? (lowStock ? "text-amber-600" : "text-green-700") : "text-red-600"}`}>
              <span className={`w-2 h-2 rounded-full ${inStock ? (lowStock ? "bg-amber-500" : "bg-green-600") : "bg-red-500"}`} aria-hidden="true" />
              {inStock
                ? lowStock ? `Only ${book.stock_quantity} left in stock` : "In stock — ready to ship"
                : "Out of stock"}
            </p>

            <div className="mt-6">
              <BuyBar book={book} />
            </div>

            <p className="text-xs text-stone-500 mt-2">
              Free delivery on orders over KSh 3,000 · KSh 300 flat rate below that, nationwide
            </p>

            {book.description ? (
              <p className="mt-7 text-stone-600 leading-relaxed">{book.description}</p>
            ) : (
              <p className="mt-7 text-stone-400 text-sm italic">
                A full description for this title has not been added yet.
              </p>
            )}

            <dl className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Format", value: book.format },
                { label: "Pages", value: book.pages },
                { label: "Publisher", value: book.publisher },
                { label: "Year", value: book.year },
              ].filter((item) => item.value).map((item) => (
                <div key={item.label} className="bg-white border border-stone-200 rounded-xl p-3">
                  <dt className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{item.label}</dt>
                  <dd className="text-sm font-semibold text-[#1C1917] mt-0.5">{item.value}</dd>
                </div>
              ))}
            </dl>

            {book.isbn && (
              <p className="text-xs text-stone-400 mt-4">ISBN {book.isbn}</p>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-14 border-t border-stone-200 pt-8">
            {/* The fallback tops the list up with popular titles from other
                categories, so only claim "More in X" when every book is in X. */}
            <h2 className="text-xl font-bold text-[#1C1917] mb-5">
              {related.every((item) => item.category === book.category)
                ? `More in ${book.category}`
                : "You might also like"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((item) => (
                <Link key={item.id} href={bookPath(item)} className="group bg-white border border-stone-200 rounded-xl p-4 hover:shadow-lg transition">
                  <div className="w-24 mx-auto rounded-r-md overflow-hidden" style={{ aspectRatio: "2/3" }}>
                    <BookCover book={item} className="w-full h-full" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-[#1C1917] line-clamp-2 group-hover:text-[#991B1B]">{item.title}</p>
                  <p className="text-xs text-stone-500">{item.author}</p>
                  <p className="text-sm font-bold mt-1">{formatKsh(item.price)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </StoreLayout>
  );
}
