import Link from "next/link";

/**
 * The storefront's one heading pattern.
 *
 * Before this, every band on the homepage invented its own arrangement:
 * heading left with a link right, heading with a sentence, heading alone.
 * Six sections in a row that all look slightly different read as six
 * different pages. This keeps one arrangement, one scale and at most one
 * action on the right, so there is never a second place for the eye to go.
 *
 * There used to be a small uppercase kicker above each title — "Just in" over
 * "New arrivals", "Browse" over "Explore Books…". Most of them repeated the
 * heading in different words, and a label that says what the heading says is
 * there for the designer, not the reader. The heading now carries the
 * section on its own.
 */
export function SectionHeading({
  title,
  description,
  action,
  tone = "light",
  id,
  className = "",
}) {
  const dark = tone === "dark";

  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="min-w-0">
        <h2
          id={id}
          className={`text-heading font-bold ${dark ? "text-cream" : "text-navy"}`}
        >
          {title}
        </h2>
        {description && (
          <p
            className={`mt-2 max-w-2xl text-small leading-relaxed sm:text-base ${
              dark ? "text-cream/80" : "text-muted"
            }`}
          >
            {description}
          </p>
        )}
      </div>

      {action?.href && (
        <Link
          href={action.href}
          className={`group -my-1.5 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap py-1.5 text-sm font-semibold underline-offset-4 hover:underline ${
            dark ? "text-sienna-soft hover:text-white" : "text-sienna hover:text-sienna-hover"
          }`}
        >
          {action.label}
          <svg
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      )}
    </div>
  );
}

export default SectionHeading;
