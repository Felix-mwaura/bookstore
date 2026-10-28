"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { categorySlug } from "../lib/categories";
import { useGenres } from "./GenreProvider";
import { PRICE_BANDS, SORT_OPTIONS } from "../lib/catalogue";
import { buildCatalogueHref } from "../lib/catalogue-url";

/* ── shared bits ──────────────────────────────────────── */

function FilterLink({ href, active, children, count }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex items-center justify-between gap-2 rounded-control px-3 py-2 text-sm min-h-11 transition-colors ${
        active
          ? "bg-navy text-white font-semibold"
          : "text-ink hover:bg-subtle"
      }`}
    >
      <span className="truncate">{children}</span>
      {typeof count === "number" && (
        <span className={`text-xs tabular-nums ${active ? "text-white/70" : "text-muted"}`}>{count}</span>
      )}
    </Link>
  );
}

/** Desktop sidebar. Plain links, so filtering works without JavaScript. */
export function CatalogueSidebar({ basePath, params, counts }) {
  const genres = useGenres();
  return (
    <div className="hidden lg:block">
      <div className="sticky top-24 space-y-6">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">Genre</h2>
          <nav aria-label="Filter by genre" className="space-y-0.5">
            <FilterLink
              href={buildCatalogueHref(basePath, params, { category: "", page: 1 })}
              active={!params.category}
            >
              All genres
            </FilterLink>
            {genres.map((genre) => (
              <FilterLink
                key={genre.slug}
                href={buildCatalogueHref(basePath, params, { category: genre.name, page: 1 })}
                active={params.category === genre.name}
                count={counts?.get ? counts.get(genre.name) ?? 0 : counts?.[genre.name]}
              >
                {genre.name}
              </FilterLink>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">Price</h2>
          <nav aria-label="Filter by price" className="space-y-0.5">
            <FilterLink
              href={buildCatalogueHref(basePath, params, { price: "", page: 1 })}
              active={!params.price}
            >
              Any price
            </FilterLink>
            {PRICE_BANDS.map((band) => (
              <FilterLink
                key={band.value}
                href={buildCatalogueHref(basePath, params, { price: band.value, page: 1 })}
                active={params.price === band.value}
              >
                {band.label}
              </FilterLink>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">Availability</h2>
          <nav aria-label="Filter by availability" className="space-y-0.5">
            <FilterLink
              href={buildCatalogueHref(basePath, params, { availability: "", page: 1 })}
              active={!params.availability}
            >
              All titles
            </FilterLink>
            <FilterLink
              href={buildCatalogueHref(basePath, params, { availability: "in-stock", page: 1 })}
              active={params.availability === "in-stock"}
            >
              In stock only
            </FilterLink>
          </nav>
        </div>
      </div>
    </div>
  );
}

/* ── sort ─────────────────────────────────────────────── */

export function SortSelect({ basePath, params }) {
  const router = useRouter();

  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={params.sort || "newest"}
        onChange={(event) => {
          const patch = { sort: event.target.value, page: 1 };
          router.push(buildCatalogueHref(basePath, params, patch), { scroll: false });
        }}
        aria-label="Sort books"
        className="min-h-11 rounded-control border border-line bg-white px-3 pr-8 text-sm text-ink"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

/* ── mobile filter sheet ──────────────────────────────── */

export function MobileFilterButton({ basePath, params, counts, resultCount }) {
  const genres = useGenres();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ category: params.category || "", price: params.price || "", availability: params.availability || "" });
  const router = useRouter();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const triggerRef = useRef(null);

  // The draft starts from the URL every time the sheet is opened, so a
  // cancelled edit never leaks into the next visit.
  const openSheet = () => {
    setDraft({ category: params.category || "", price: params.price || "", availability: params.availability || "" });
    setOpen(true);
  };

  // Escape closes, focus moves into the sheet, and focus returns to the
  // trigger on close — the three things a modal has to get right.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      trigger?.focus();
    };
  }, [open]);

  const activeCount = [params.category, params.price, params.availability].filter(Boolean).length;

  const apply = () => {
    router.push(buildCatalogueHref(basePath, params, { ...draft, page: 1 }), { scroll: false });
    setOpen(false);
  };

  const clear = () => {
    setDraft({ category: "", price: "", availability: "" });
    router.push(buildCatalogueHref(basePath, params, { category: "", price: "", availability: "", page: 1 }), { scroll: false });
    setOpen(false);
  };

  const toggle = (key, value) => {
    setDraft((current) => ({ ...current, [key]: current[key] === value ? "" : value }));
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openSheet}
        className="lg:hidden inline-flex items-center gap-2 min-h-11 rounded-control border border-line bg-white px-3 text-sm font-semibold text-navy"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="ml-1 rounded-full bg-sienna text-white text-[11px] px-1.5 py-0.5 leading-none">{activeCount}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-sheet-title"
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] bg-cream rounded-t-2xl shadow-pop flex flex-col animate-slide-up"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h2 id="filter-sheet-title" className="text-lg font-bold text-navy">Filter books</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg hover:bg-subtle"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              <fieldset>
                <legend className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">Genre</legend>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <button
                      key={genre.slug}
                      type="button"
                      onClick={() => toggle("category", genre.name)}
                      aria-pressed={draft.category === genre.name}
                      className={`rounded-full border px-3 py-2 text-sm min-h-11 ${
                        draft.category === genre.name
                          ? "border-navy bg-navy text-white"
                          : "border-line bg-white text-ink"
                      }`}
                    >
                      {genre.name}
                      {counts?.get ? ` (${counts.get(genre.name) ?? 0})` : ""}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">Price</legend>
                <div className="flex flex-wrap gap-2">
                  {PRICE_BANDS.map((band) => (
                    <button
                      key={band.value}
                      type="button"
                      onClick={() => toggle("price", band.value)}
                      aria-pressed={draft.price === band.value}
                      className={`rounded-full border px-3 py-2 text-sm min-h-11 ${
                        draft.price === band.value
                          ? "border-navy bg-navy text-white"
                          : "border-line bg-white text-ink"
                      }`}
                    >
                      {band.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">Availability</legend>
                <button
                  type="button"
                  onClick={() => toggle("availability", "in-stock")}
                  aria-pressed={draft.availability === "in-stock"}
                  className={`rounded-full border px-3 py-2 text-sm min-h-11 ${
                    draft.availability === "in-stock"
                      ? "border-navy bg-navy text-white"
                      : "border-line bg-white text-ink"
                  }`}
                >
                  In stock only
                </button>
              </fieldset>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-line">
              <button type="button" onClick={clear} className="btn-secondary flex-1 text-sm">Clear all</button>
              <button type="button" onClick={apply} className="btn-primary flex-1 text-sm">
                Show {resultCount} {resultCount === 1 ? "book" : "books"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── removable chips ──────────────────────────────────── */

export function ActiveFilterChips({ basePath, params }) {
  const chips = [];
  if (params.q) chips.push({ key: "q", label: `“${params.q}”` });
  if (params.category) chips.push({ key: "category", label: params.category });
  if (params.price) {
    const band = PRICE_BANDS.find((b) => b.value === params.price);
    chips.push({ key: "price", label: band ? band.label : params.price });
  }
  if (params.availability === "in-stock") chips.push({ key: "availability", label: "In stock" });

  if (!chips.length) return null;

  return (
    <ul role="list" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={buildCatalogueHref(basePath, params, { [chip.key]: "", page: 1 })}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white pl-3 pr-2 py-1.5 text-xs font-medium text-ink hover:border-navy"
          >
            {chip.label}
            <span className="sr-only">Remove filter</span>
            <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Link>
        </li>
      ))}
      <li>
        <Link href={basePath} className="text-xs font-semibold text-sienna underline underline-offset-2 px-1 py-1.5">
          Clear all
        </Link>
      </li>
    </ul>
  );
}

export { categorySlug };
