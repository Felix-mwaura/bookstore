"use client";

import { useEffect } from "react";
import Link from "next/link";
import { STORE_CONTACT } from "./lib/site";

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
      <header className="shell py-5">
        <Link href="/" className="font-playfair text-xl font-bold tracking-[-0.01em] text-navy">Book Haven</Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
        <div className="w-full max-w-[34rem] text-center">
          <h1 className="font-playfair text-title font-bold text-navy">This page didn’t load</h1>
          <p className="mt-4 text-body leading-relaxed text-muted">
            The shop is still open — nothing in your basket was lost. Try the page again, or keep browsing
            and come back to it later.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => reset()} className="btn-primary">
              Try again
            </button>
            <Link href="/books" className="btn-quiet">Browse books</Link>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-muted">
            {STORE_CONTACT.email ? (
              <>
                If it keeps happening, write to us at{" "}
                <a href={`mailto:${STORE_CONTACT.email}`} className="underline underline-offset-2 hover:text-sienna">
                  {STORE_CONTACT.email}
                </a>{" "}
                and tell us which page you were on.
              </>
            ) : (
              <>If it keeps happening, note which page you were on and try again later.</>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
