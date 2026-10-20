import Link from "next/link";
import { buildCatalogueHref } from "../lib/catalogue-url";

function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const withGaps = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) withGaps.push("gap");
    withGaps.push(page);
    previous = page;
  }
  return withGaps;
}

const baseLink = "inline-flex items-center justify-center min-w-11 min-h-11 px-3 rounded-control border text-sm font-semibold transition-colors";

export default function Pagination({ basePath, params, page, pages }) {
  if (pages <= 1) return null;

  return (
    <nav aria-label="Catalogue pages" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={buildCatalogueHref(basePath, params, { page: page - 1 })} className={`${baseLink} border-line bg-white text-navy hover:border-navy`} rel="prev">
          <span aria-hidden="true">←</span>
          <span className="ml-1.5">Previous</span>
        </Link>
      ) : (
        <span aria-disabled="true" className={`${baseLink} border-line bg-white text-muted/50`}>
          <span aria-hidden="true">←</span>
          <span className="ml-1.5">Previous</span>
        </span>
      )}

      {pageNumbers(page, pages).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-muted" aria-hidden="true">…</span>
        ) : (
          <Link
            key={entry}
            href={buildCatalogueHref(basePath, params, { page: entry })}
            aria-current={entry === page ? "page" : undefined}
            aria-label={`Page ${entry}`}
            className={`${baseLink} ${
              entry === page ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"
            }`}
          >
            {entry}
          </Link>
        )
      )}

      {page < pages ? (
        <Link href={buildCatalogueHref(basePath, params, { page: page + 1 })} className={`${baseLink} border-line bg-white text-navy hover:border-navy`} rel="next">
          <span className="mr-1.5">Next</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span aria-disabled="true" className={`${baseLink} border-line bg-white text-muted/50`}>
          <span className="mr-1.5">Next</span>
          <span aria-hidden="true">→</span>
        </span>
      )}
    </nav>
  );
}
