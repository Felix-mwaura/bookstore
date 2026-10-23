import Link from "next/link";

import ReviewForm from "./ReviewForm";
import { StarRating } from "./StarRating";
import { REVIEW_SORTS, formatAverage, starPercent } from "../lib/review-limits";

// "Customer Reviews" on the book page.
//
// A server component: the list, the average, the distribution and the
// paging links are all in the HTML the first time it loads — visible to a
// crawler, and readable before any JavaScript runs. The only client-side
// piece is the form, which needs a session.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Fixed-format date (no locale/ICU differences between server renders). */
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function wasEdited(review) {
  if (!review.updated_at || !review.created_at) return false;
  const created = new Date(review.created_at).getTime();
  const updated = new Date(review.updated_at).getTime();
  // The database only moves updated_at when the rating, the headline or the
  // text actually changes — a moderation touch does not count. So any gap
  // beyond clock noise is a real edit. This used to be 60 seconds, which
  // hid edits made within a minute of posting (found by editing a review
  // 45 seconds after posting it and watching the marker fail to appear).
  return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 1_000;
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BH";
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function hrefFor(slug, { sort, stars, page }) {
  const params = new URLSearchParams();
  if (sort && sort !== "recent") params.set("rv_sort", sort);
  if (stars) params.set("rv_stars", String(stars));
  if (Number(page) > 1) params.set("rv_page", String(page));
  const query = params.toString();
  return `/books/${slug}${query ? `?${query}` : ""}#reviews`;
}

const chip =
  "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition-colors";
const chipOn = "border-navy bg-navy text-white";
const chipOff = "border-line bg-white text-navy hover:border-navy";

export default function ReviewsSection({
  book,
  summary,
  result,
  sort = "recent",
  stars = 0,
  viewerReviewId = null,
}) {
  const { average, count, distribution } = summary;
  const shown = formatAverage(average);
  const slug = book.slug;
  const hasReviews = count > 0;
  const filtered = stars > 0;

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="mt-14 border-t border-line pt-8 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-sienna">
            <span aria-hidden="true" className="h-px w-6 bg-sienna" />
            What readers say
          </p>
          <h2 id="reviews-heading" className="mt-2 text-2xl font-bold text-navy">
            Customer Reviews
          </h2>
        </div>
        {hasReviews && (
          <p className="text-sm text-muted">
            {count} {count === 1 ? "review" : "reviews"}
          </p>
        )}
      </div>

      {!hasReviews ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-card border border-line bg-white p-6">
            <h3 className="text-lg font-bold text-navy">No reviews yet</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Be the first to review {book.title}. A few honest lines help the next reader decide.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted">
              <StarRating value={0} size="sm" label="Not yet rated" />
              <span>Not yet rated</span>
            </div>
          </div>
          <ReviewForm bookId={book.id} bookSlug={slug} bookTitle={book.title} />
        </div>
      ) : (
        <>
          {/* Summary + distribution */}
          <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:gap-6">
            <div className="rounded-card border border-line bg-white p-5">
              <p className="text-4xl font-bold leading-none text-navy">{shown}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">out of 5</p>
              <div className="mt-2">
                <StarRating
                  value={average}
                  size="md"
                  label={`${shown} out of 5 stars, based on ${count} ${count === 1 ? "review" : "reviews"}`}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                Based on {count} {count === 1 ? "review" : "reviews"}
              </p>
            </div>

            <div className="rounded-card border border-line bg-white p-5">
              <h3 className="sr-only">Rating distribution</h3>
              <ul role="list" className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = distribution[star] || 0;
                  const percent = starPercent(n, count);
                  const active = stars === star;
                  return (
                    <li key={star}>
                      <Link
                        href={hrefFor(slug, { sort, stars: active ? 0 : star, page: 1 })}
                        aria-label={`${star} ${star === 1 ? "star" : "stars"}: ${percent}% — ${n} ${n === 1 ? "review" : "reviews"}${active ? " (filtering by this now)" : ""}`}
                        className={`flex items-center gap-2 rounded px-1 py-1 text-xs transition-colors hover:bg-subtle ${active ? "font-semibold" : ""}`}
                      >
                        <span aria-hidden="true" className="w-10 shrink-0 text-muted">{star} ★</span>
                        <span aria-hidden="true" className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-subtle">
                          <span
                            className={`block h-full rounded-full ${active ? "bg-sienna" : "bg-warning"}`}
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                        <span aria-hidden="true" className="w-9 shrink-0 text-right tabular-nums text-muted">{percent}%</span>
                        <span aria-hidden="true" className="w-8 shrink-0 text-right tabular-nums font-semibold text-navy">({n})</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-6 flex flex-col gap-3 rounded-card border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter reviews by rating">
              <Link href={hrefFor(slug, { sort, stars: 0, page: 1 })} aria-current={!filtered ? "true" : undefined} className={`${chip} ${!filtered ? chipOn : chipOff}`}>
                All ratings
              </Link>
              {[5, 4, 3, 2, 1].map((star) => (
                <Link
                  key={star}
                  href={hrefFor(slug, { sort, stars: star, page: 1 })}
                  aria-current={stars === star ? "true" : undefined}
                  className={`${chip} ${stars === star ? chipOn : chipOff}`}
                >
                  {star} <span aria-hidden="true" className="ml-1">★</span>
                  <span className="sr-only"> stars</span>
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort reviews">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Sort</span>
              {REVIEW_SORTS.map((option) => (
                <Link
                  key={option.value}
                  href={hrefFor(slug, { sort: option.value, stars, page: 1 })}
                  aria-current={sort === option.value ? "true" : undefined}
                  className={`${chip} ${sort === option.value ? chipOn : chipOff}`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Your review / the form */}
          <div className="mt-6">
            <ReviewForm bookId={book.id} bookSlug={slug} bookTitle={book.title} />
          </div>

          {/* The list */}
          {result.error ? (
            <div role="alert" className="mt-6 rounded-card border border-line bg-white p-6 text-center">
              <p className="font-semibold text-navy">Reviews couldn’t load</p>
              <p className="mt-1 text-sm text-muted">This is on our side. Please try again in a moment.</p>
            </div>
          ) : result.reviews.length === 0 ? (
            <div className="mt-6 rounded-card border border-line bg-white p-8 text-center">
              <p className="font-semibold text-navy">
                {filtered ? `No ${stars}-star reviews yet` : "No reviews on this page"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {filtered ? "Try another rating, or see what everyone said." : "Try the first page of reviews."}
              </p>
              <Link href={hrefFor(slug, { sort, stars: 0, page: 1 })} className="btn-primary mt-4 inline-flex text-sm">
                Show all reviews
              </Link>
            </div>
          ) : (
            <ul role="list" className="mt-6 space-y-4">
              {result.reviews.map((review) => (
                <li
                  key={review.id}
                  id={`review-${review.id}`}
                  className={`rounded-card border bg-white p-5 ${
                    viewerReviewId && review.id === viewerReviewId
                      ? "border-navy/40 ring-1 ring-navy/15"
                      : "border-line"
                  }`}
                >
                  <article aria-label={`Review by ${review.reviewer_name}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-bold text-navy"
                        >
                          {initials(review.reviewer_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
                            <span className="truncate">{review.reviewer_name}</span>
                            {viewerReviewId && review.id === viewerReviewId && (
                              <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Your review
                              </span>
                            )}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <StarRating value={review.rating} size="sm" label={`${review.rating} out of 5 stars`} />
                            {review.verified_purchase && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Verified purchase
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted">
                        <time dateTime={review.created_at}>{formatDate(review.created_at)}</time>
                        {wasEdited(review) && <span className="ml-2 italic">edited</span>}
                      </p>
                    </div>

                    {review.title && <h3 className="mt-3 text-base font-semibold text-navy">{review.title}</h3>}
                    {/* Rendered as text, never as HTML: React escapes it, and
                        nothing here uses dangerouslySetInnerHTML. */}
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">{review.review_text}</p>
                  </article>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination — real links, so each page is its own crawlable URL */}
          {result.pages > 1 && (
            <nav aria-label="Review pages" className="mt-6 flex items-center justify-between gap-3">
              {result.page > 1 ? (
                <Link
                  rel="prev"
                  href={hrefFor(slug, { sort, stars, page: result.page - 1 })}
                  className="inline-flex min-h-11 items-center rounded-control border border-line bg-white px-4 text-sm font-semibold text-navy transition hover:border-navy"
                >
                  <span aria-hidden="true" className="mr-1.5">←</span> Newer
                </Link>
              ) : (
                <span aria-hidden="true" className="inline-flex min-h-11 items-center rounded-control border border-line bg-white px-4 text-sm font-semibold text-muted/50">
                  <span className="mr-1.5">←</span> Newer
                </span>
              )}

              <p className="text-xs text-muted" aria-live="polite">
                Page {result.page} of {result.pages}
              </p>

              {result.page < result.pages ? (
                <Link
                  rel="next"
                  href={hrefFor(slug, { sort, stars, page: result.page + 1 })}
                  className="inline-flex min-h-11 items-center rounded-control border border-line bg-white px-4 text-sm font-semibold text-navy transition hover:border-navy"
                >
                  Older <span aria-hidden="true" className="ml-1.5">→</span>
                </Link>
              ) : (
                <span aria-hidden="true" className="inline-flex min-h-11 items-center rounded-control border border-line bg-white px-4 text-sm font-semibold text-muted/50">
                  Older <span className="ml-1.5">→</span>
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
