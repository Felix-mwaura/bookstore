import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream">
      <header className="shell py-5">
        <Link href="/" className="font-playfair text-xl font-bold tracking-[-0.01em] text-navy">Book Haven</Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
        <div className="w-full max-w-[34rem] text-center">
          <h1 className="font-playfair text-title font-bold text-navy">We couldn’t find that page</h1>
          <p className="mt-4 text-body text-muted">
            The link may be old, or the book may have been taken off the shelf.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/books" className="btn-primary">Browse books</Link>
            <Link href="/" className="btn-quiet">Go home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
