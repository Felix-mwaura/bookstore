import Link from "next/link";

// Shared shell for the pages a shop has to have: help, privacy, terms, about.
//
// They share one layout so they read as one place rather than four unrelated
// documents, and so a change to the header or the "last updated" line happens
// once. Nothing in here is decorative: a customer who wants to know how
// delivery is priced, what happens to their address, or how to reach a person
// should find a straight answer, not a wall of legal padding.

const UPDATED = "23 October 2026";

export function PolicyPage({ eyebrow, title, intro, children, updated = true }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-xs text-muted">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="underline-offset-2 hover:text-navy hover:underline">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink" aria-current="page">{title}</li>
        </ol>
      </nav>

      <header className="border-b border-line pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sienna">{eyebrow}</p>
        <h1 className="mt-2 font-playfair text-3xl font-bold text-navy sm:text-4xl">{title}</h1>
        {intro && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{intro}</p>}
        {updated && <p className="mt-3 text-xs text-muted">Last updated {UPDATED}</p>}
      </header>

      <div className="mt-8 space-y-8">{children}</div>
    </div>
  );
}

export function Section({ id, title, children }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-heading` : undefined} className="scroll-mt-24">
      <h2 id={id ? `${id}-heading` : undefined} className="text-lg font-bold text-navy">
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export function Bullets({ children }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-sienna">{children}</ul>;
}

/**
 * "Talk to a person", but only with details that are real.
 *
 * lib/site.js still carries placeholder contact details — an email, a phone
 * number and a shop address that nobody has confirmed. They are shown in the
 * footer because that predates this work, but repeating them across four new
 * public pages would turn a known placeholder into what looks like a real
 * address a customer might travel to. So when the details are still
 * placeholders this says so plainly instead, and stops saying it the moment
 * the store env vars are set.
 */
export function ContactBlock({ contact }) {
  if (contact.usingPlaceholders) {
    return (
      <div className="rounded-card border border-line bg-subtle/60 p-5">
        <p className="text-sm font-semibold text-navy">Contact details are not published yet</p>
        <p className="mt-1 text-sm text-muted">
          The shop&apos;s email address, phone number and location are being confirmed. They are
          deliberately left off this page rather than filled in with a placeholder that could send
          you somewhere that does not exist.
        </p>
        <p className="mt-2 text-xs text-muted">
          If you have an order in progress, keep the order reference from your confirmation — it is
          what you will be asked for.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-white p-5">
      <p className="text-sm font-semibold text-navy">Talk to a person</p>
      <p className="mt-1 text-sm text-muted">
        Email <a className="font-medium text-sienna underline-offset-2 hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a>
        {" "}or call <a className="font-medium text-sienna underline-offset-2 hover:underline" href={contact.phoneHref}>{contact.phone}</a>.
      </p>
      {contact.location && <p className="mt-1 text-sm text-muted">{contact.location}</p>}
      {contact.hours && <p className="text-sm text-muted">{contact.hours}</p>}
    </div>
  );
}
