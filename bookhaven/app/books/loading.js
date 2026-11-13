import { BookGridSkeleton } from "../components/BookGrid";

// Shown while /books renders.
//
// Two jobs, and only the second is cosmetic: it tells the visitor their click
// landed, and — because Next prefetches the closest loading boundary for a
// dynamic route — it means a link to /books now prefetches this small shell
// instead of triggering a full server render of the catalogue. The prefetch
// traffic that used to compete with the real navigation is mostly gone.
//
// It sits inside app/books/layout.js, so the header and footer are already on
// screen; this only fills the body, in the same shape as the real page.
export default function LoadingCatalogue() {
  return (
    <div className="shell py-8 sm:py-12" aria-busy="true">
      <p className="sr-only">Loading the catalogue…</p>

      <div className="mb-8 space-y-3 sm:mb-10" aria-hidden="true">
        <div className="h-3 w-36 rounded bg-subtle animate-pulse" />
        <div className="h-9 w-52 rounded bg-subtle animate-pulse" />
        <div className="h-3 w-full max-w-md rounded bg-subtle animate-pulse" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <div className="hidden space-y-3 lg:block" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-control bg-subtle/70 animate-pulse" />
          ))}
        </div>
        <div className="min-w-0">
          <BookGridSkeleton count={8} />
        </div>
      </div>
    </div>
  );
}
