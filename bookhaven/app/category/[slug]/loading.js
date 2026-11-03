import StoreLayout from "../../components/StoreLayout";
import { BookGridSkeleton } from "../../components/BookGrid";

export default function Loading() {
  return (
    <StoreLayout>
      <div className="shell py-8 sm:py-12">
        <div className="mb-6 border-b border-line pb-5">
          <div className="h-2.5 w-20 rounded bg-subtle animate-pulse" />
          <div className="mt-3 h-7 w-48 rounded bg-subtle animate-pulse" />
          <div className="mt-2 h-4 w-full max-w-md rounded bg-subtle animate-pulse" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
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
