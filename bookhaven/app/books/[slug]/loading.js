import StoreLayout from "../../components/StoreLayout";

/**
 * Book page skeleton, shaped like the real page: cover left, title, and the
 * buy panel on the right. The page is force-dynamic, so this is what a reader
 * sees between tapping a card and the book arriving.
 */
export default function Loading() {
  return (
    <StoreLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <p className="sr-only" role="status">Loading the book…</p>

        <div className="mb-6 h-3 w-52 rounded bg-subtle animate-pulse" aria-hidden="true" />

        <div className="grid gap-8 md:grid-cols-[300px_minmax(0,1fr)] lg:gap-14" aria-hidden="true">
          <div className="mx-auto w-full max-w-[240px] sm:max-w-[300px]">
            <div className="aspect-[2/3] w-full rounded-r-md bg-subtle animate-pulse" />
          </div>

          <div className="space-y-3">
            <div className="h-2.5 w-24 rounded bg-subtle animate-pulse" />
            <div className="h-8 w-4/5 rounded bg-subtle animate-pulse" />
            <div className="h-4 w-40 rounded bg-subtle animate-pulse" />
            <div className="mt-5 rounded-card border border-line bg-white p-5 sm:p-6">
              <div className="h-8 w-32 rounded bg-subtle animate-pulse" />
              <div className="mt-2 h-5 w-28 rounded-full bg-subtle/70 animate-pulse" />
              <div className="mt-5 h-12 w-full rounded-control bg-subtle animate-pulse" />
              <div className="mt-3 border-t border-line pt-3">
                <div className="h-3 w-3/4 rounded bg-subtle/70 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <div className="h-3 w-full rounded bg-subtle/70 animate-pulse" />
              <div className="h-3 w-11/12 rounded bg-subtle/70 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-subtle/70 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
