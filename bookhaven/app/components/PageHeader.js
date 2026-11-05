import Link from "next/link";

/**
 * The opening of a page: breadcrumb, title, one sentence, and at most one
 * action. Every page that is not the homepage uses it, so a reader learns
 * the shape once — where the title sits, what size it is, how far the
 * content below it begins.
 *
 * Before this, /books, /category, /account and the policy pages each
 * assembled their own header. They disagreed on the title size (2xl, 3xl,
 * 4xl), on whether there was a rule under it, and on how much air came
 * before the content. None of those were decisions; they were accidents of
 * which page was written first.
 */
export default function PageHeader({
  breadcrumb = [],
  title,
  description,
  actions,
  meta,
  className = "",
}) {
  return (
    <header className={`border-b border-line pb-7 sm:pb-9 ${className}`}>
      {breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
            {breadcrumb.map((crumb, index) => {
              const last = index === breadcrumb.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="-my-1 inline-block py-1 underline-offset-4 hover:text-navy hover:underline"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-ink">
                      {crumb.label}
                    </span>
                  )}
                  {!last && (
                    <span aria-hidden="true" className="text-line-strong">
                      /
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="font-playfair text-title font-bold text-navy">{title}</h1>
          {description && <p className="lead mt-3">{description}</p>}
          {meta && <p className="mt-2 text-small text-muted">{meta}</p>}
        </div>

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
