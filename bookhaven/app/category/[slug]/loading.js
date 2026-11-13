import { BookGridSkeleton } from "../../components/BookGrid";

// Same shape as app/books/loading.js: the genre page is the catalogue
// filtered to one shelf, so the skeleton is the same body.
export default function LoadingGenre() {
  return (
    <div className="shell py-8 sm:py-12" aria-busy="true">
      <p className="sr-only">Loading this genre…</p>

      <div className="mb-8 space-y-3 sm:mb-10" aria-hidden="true">
        <div className="h-3 w-40 rounded bg-subtle animate-pulse" />
        <div className="h-9 w-44 rounded bg-subtle animate-pulse" />
        <div className="h-3 w-full max-w-sm rounded bg-subtle animate-pulse" />
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
