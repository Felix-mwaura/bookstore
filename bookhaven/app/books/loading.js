import StoreLayout from "../components/StoreLayout";
import { BookGridSkeleton } from "../components/BookGrid";

export default function Loading() {
  return (
    <StoreLayout>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6 space-y-2">
          <div className="h-3 w-40 rounded bg-subtle animate-pulse" />
          <div className="h-7 w-56 rounded bg-subtle animate-pulse" />
          <div className="h-4 w-36 rounded bg-subtle animate-pulse" />
        </div>
        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-8">
          <div className="hidden lg:block space-y-2" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="h-9 rounded-control bg-subtle/70 animate-pulse" />
            ))}
          </div>
          <div>
            <p className="sr-only" role="status">Loading books…</p>
            <BookGridSkeleton />
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
