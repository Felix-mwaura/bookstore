"use client";

import { useEffect } from "react";
import Link from "next/link";

// Anything thrown while rendering the dashboard lands here instead of the
// generic "Application error" screen. The digest is the id that appears in
// the Vercel function logs, so a support request can be traced precisely.
export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error("Admin dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-cream px-5 py-16">
      <div className="surface w-full max-w-lg p-6 text-center sm:p-8">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-error/10">
          <svg className="h-6 w-6 text-error" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="mb-2 font-playfair text-heading font-bold text-navy">The dashboard could not load</h1>
        <p className="mb-6 text-small text-muted">
          You are signed in, but the server could not read the dashboard data.
          This is usually a configuration problem, not something a retry fixes.
        </p>

        {error?.message && (
          <p className="mb-4 break-words rounded-control border border-line bg-subtle p-4 text-left text-small text-ink">
            {error.message}
          </p>
        )}

        {error?.digest && (
          <p className="mb-6 text-small text-muted">
            Reference: <span className="font-mono">{error.digest}</span> — quote this when asking for help.
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="btn-primary flex-1"
          >
            Try again
          </button>
          <Link
            href="/"
            className="btn-secondary flex-1"
          >
            Back to store
          </Link>
        </div>
      </div>
    </div>
  );
}
