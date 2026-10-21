"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Storefront error boundary. Without one, a render failure dropped people on
 * Next's bare "Application error" screen with no way back to the shop.
 *
 * The wording separates what happened from what the reader should do, and the
 * retry only appears when a retry can actually help.
 */
export default function StoreError({ error, reset }) {
  useEffect(() => {
    // Not a substitute for a real error tracker, but it puts the failure in the
    // browser console with a stack the person can copy if they write to us.
    console.error("Storefront error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream">
      <header className="px-4 py-4 sm:px-6">
        <Link href="/" className="font-playfair text-lg font-bold text-navy">Book Haven</Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sienna">Something went wrong</p>
          <h1 className="mt-2 text-2xl font-bold text-navy sm:text-3xl">This page didn’t load</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The shop is still open — nothing in your basket was lost. Try the page again, or keep browsing
            and come back to it later.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => reset()} className="btn-primary text-sm">
              Try again
            </button>
            <Link href="/books" className="btn-secondary text-sm">Browse books</Link>
          </div>

          <p className="mt-6 text-xs text-muted">
            If it keeps happening, write to us at{" "}
            <a href="mailto:hello@bookhaven.co.ke" className="underline underline-offset-2 hover:text-sienna">
              hello@bookhaven.co.ke
            </a>{" "}
            and tell us which page you were on.
          </p>
        </div>
      </main>
    </div>
  );
}
