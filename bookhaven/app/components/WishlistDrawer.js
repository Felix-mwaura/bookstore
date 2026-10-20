"use client";

import Link from "next/link";
import { useCallback } from "react";

import { BookCover } from "./BookCover";
import { useDialog } from "../lib/useDialog";
import { bookPath } from "../lib/book-url";
import { formatKsh } from "../lib/site";

export default function WishlistDrawer({ wishlist, isOpen, onClose, onRemove, onAddToCart }) {
  const close = useCallback(() => onClose(), [onClose]);
  const panelRef = useDialog(isOpen, close);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-navy/50" onClick={close} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wishlist-title"
        tabIndex={-1}
        className="absolute left-0 top-0 h-[100dvh] w-full max-w-md bg-cream shadow-pop flex flex-col animate-slide-in-left"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line">
          <div>
            <h2 id="wishlist-title" className="text-lg font-bold text-navy">Saved books</h2>
            <p className="text-xs text-muted mt-0.5">
              {wishlist.length === 0 ? "Nothing saved yet" : `${wishlist.length} saved`}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close saved books"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg hover:bg-subtle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {wishlist.length === 0 ? (
            <div className="px-2 py-16 text-center">
              <svg className="mx-auto h-12 w-12 text-line" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <h3 className="mt-4 text-base font-semibold text-navy">Nothing saved yet</h3>
              <p className="mt-1 text-sm text-muted">
                Open a book and choose Save to keep it here for later. Saved books stay on this device.
              </p>
              <Link href="/books" onClick={close} className="btn-primary mt-5 text-sm">Browse books</Link>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-line">
              {wishlist.map((book) => (
                <li key={book.id} className="flex gap-3 py-3">
                  <Link href={bookPath(book)} onClick={close} className="w-14 shrink-0 rounded-r-sm overflow-hidden book-shadow">
                    <BookCover book={book} className="w-full" sizes="56px" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={bookPath(book)} onClick={close} className="block text-sm font-semibold text-navy line-clamp-2 hover:text-sienna">
                      {book.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted truncate">{book.author}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-navy">{formatKsh(book.price)}</p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onAddToCart(book)}
                          className="min-h-11 rounded-control bg-navy px-3 text-xs font-semibold text-white hover:bg-sienna"
                        >
                          Add to basket
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(book.id)}
                          aria-label={`Remove ${book.title} from saved books`}
                          className="w-11 h-11 flex items-center justify-center rounded-control text-muted hover:text-error hover:bg-error/5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {wishlist.length > 0 && (
          <div className="border-t border-line p-4">
            <button
              type="button"
              onClick={() => {
                wishlist.forEach((book) => onAddToCart(book));
                close();
              }}
              className="btn-primary w-full text-sm"
            >
              Add all {wishlist.length} to basket
            </button>
            <p className="mt-2 text-center text-xs text-muted">Saved on this device.</p>
          </div>
        )}
      </div>
    </div>
  );
}
