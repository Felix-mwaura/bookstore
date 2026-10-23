// Stars, drawn once and used everywhere.
//
// Two shapes:
//   <StarRating value={4.6} />      a read-only rating (cards, headers)
//   <StarPicker value={n} onSelect> the interactive input (review form)
//
// The read-only one fills fractionally, so 4.6 really looks like 4.6 rather
// than being rounded up to five and flattering the book. Both expose the
// number to assistive technology — colour alone is never the only signal.

const STAR_PATH =
  "M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95L12 2.6z";

const SIZES = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5 sm:h-6 sm:w-6",
};

function Star({ className, filled }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      aria-hidden="true"
      focusable="false"
    >
      <path strokeLinejoin="round" d={STAR_PATH} />
    </svg>
  );
}

/**
 * A read-only star rating, accurate to one decimal.
 *
 * `value` is 0–5. Values inside 0.05 of a whole star snap to it, so a 4.98
 * average does not render a sliver of empty star next to a perfect score.
 */
export function StarRating({
  value = 0,
  size = "sm",
  className = "",
  label,
  showValue = false,
  count = null,
}) {
  const raw = Math.max(0, Math.min(5, Number(value) || 0));
  const snapped = Math.round(raw * 10) / 10;
  const percent = (snapped / 5) * 100;
  const sizeClass = SIZES[size] || SIZES.sm;

  const spoken =
    label ||
    `${snapped.toFixed(1)} out of 5 stars${count === null ? "" : `, from ${count} ${count === 1 ? "review" : "reviews"}`}`;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span role="img" aria-label={spoken} className="relative inline-flex shrink-0">
        {/* Empty row underneath, filled row clipped on top. Both rows are
            identical in geometry, so the fill lands exactly on a star. */}
        <span className="flex gap-0.5 text-[#CBBFA8]">
          {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={sizeClass} filled={false} />)}
        </span>
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-warning"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        >
          {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`${sizeClass} shrink-0`} filled />)}
        </span>
      </span>
      {showValue && (
        <span aria-hidden="true" className="text-xs font-semibold tabular-nums text-navy">
          {snapped.toFixed(1)}
          {count !== null && <span className="ml-1 font-normal text-muted">({count})</span>}
        </span>
      )}
    </span>
  );
}

/**
 * The rating input.
 *
 * Native radio buttons under invisible-but-focusable stars: arrow keys move
 * between stars the way they do in any radio group, the browser handles the
 * keyboard and the form semantics, and each option announces its meaning
 * ("4 stars — Very good") rather than just a number.
 */
export function StarPicker({ name = "rating", value, onChange, disabled = false, describedBy }) {
  return (
    <div role="radiogroup" aria-describedby={describedBy} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value === n;
        return (
          <label
            key={n}
            className={`group cursor-pointer rounded p-0.5 ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span
              className={`block rounded transition-transform group-hover:scale-110 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sienna ${
                selected || (value && n <= value) ? "text-warning" : "text-[#CBBFA8]"
              }`}
            >
              <Star className="h-8 w-8" filled={Boolean(selected || (value && n <= value))} />
            </span>
            <span className="sr-only">
              {n} {n === 1 ? "star" : "stars"} — {STAR_LABELS[n]}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export const STAR_LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};
