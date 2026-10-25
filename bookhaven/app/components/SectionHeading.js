import Link from "next/link";

/**
 * The storefront's one heading pattern.
 *
 * Before this, every band on the homepage invented its own arrangement:
 * heading left with a link right, heading with a sentence, heading alone.
 * Six sections in a row that all look slightly different read as six
 * different pages. This puts the same small sienna eyebrow, hairline rule and
 * Playfair title above every band, and allows at most one action on the right
 * so there is never a second place for the eye to go.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  tone = "light",
  id,
  className = "",
}) {
  const dark = tone === "dark";
  const rule = dark ? "bg-[#E9B79F]" : "bg-sienna";

  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p
            className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] ${
              dark ? "text-[#E9B79F]" : "text-sienna"
            }`}
          >
            <span aria-hidden="true" className={`h-px w-6 ${rule}`} />
            {eyebrow}
          </p>
        )}
        <h2
          id={id}
          className={`mt-2 text-xl font-bold sm:text-2xl ${dark ? "text-white" : "text-navy"}`}
        >
          {title}
        </h2>
        {description && (
          <p
            className={`mt-1.5 max-w-2xl text-sm leading-relaxed ${
              dark ? "text-white/75" : "text-muted"
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
            dark ? "text-[#E9B79F] hover:text-white" : "text-sienna hover:text-sienna-hover"
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
