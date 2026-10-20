import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col">
      <header className="px-4 sm:px-6 py-4">
        <Link href="/" className="font-playfair text-lg font-bold text-navy">Book Haven</Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sienna">404</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-navy">We couldn’t find that page</h1>
          <p className="mt-2 text-sm text-muted">
            The link may be old, or the book may have been taken off the shelf.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/books" className="btn-primary text-sm">Browse books</Link>
            <Link href="/" className="btn-secondary text-sm">Go home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
