// Shown while a book page renders.
//
// The detail page is the slowest route in the shop — it needs the book, the
// related shelf, the rating summary and the reviews — so it is the one that
// most needs to say "arriving" rather than appear to have ignored the click.
// The boxes sit where the cover, the buy panel and the description will be,
// so the page does not jump when the real one replaces it.
export default function LoadingBook() {
  return (
    <div className="shell py-8 sm:py-12" aria-busy="true">
      <p className="sr-only">Loading this book…</p>

      <div className="mb-6 h-3 w-40 rounded bg-subtle animate-pulse" aria-hidden="true" />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        <div
          className="mx-auto aspect-[2/3] w-full max-w-[22rem] rounded-card bg-subtle animate-pulse"
          aria-hidden="true"
        />

        <div className="min-w-0 space-y-4" aria-hidden="true">
          <div className="h-3 w-28 rounded bg-subtle animate-pulse" />
          <div className="h-10 w-3/4 rounded bg-subtle animate-pulse" />
          <div className="h-4 w-40 rounded bg-subtle animate-pulse" />
          <div className="h-8 w-32 rounded bg-subtle animate-pulse" />
          <div className="pt-2 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 w-full rounded bg-subtle/80 animate-pulse" />
            ))}
          </div>
          <div className="h-12 w-full max-w-xs rounded-control bg-subtle animate-pulse" />
        </div>
      </div>
    </div>
  );
}
