"use client";

import { BookCover } from "./BookCard";

export default function WishlistDrawer({ wishlist, isOpen, onClose, onRemove, onAddToCart, onViewDetail }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel — slides in from LEFT to distinguish from cart */}
      <div className="absolute left-0 top-0 h-full w-full max-w-md bg-white shadow-2xl animate-slide-in-left flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="text-2xl font-bold text-[#1C1917]">My Wishlist</h2>
            <p className="text-sm text-stone-500 mt-1">
              {wishlist.length === 0
                ? "No saved books yet"
                : `${wishlist.length} book${wishlist.length > 1 ? "s" : ""} saved`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {wishlist.length === 0 ? (
            <div className="text-center py-20">
              {/* Animated empty heart */}
              <div className="flex justify-center mb-5">
                <svg
                  className="w-20 h-20 text-stone-200"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#1C1917] mb-2">Nothing saved yet</h3>
              <p className="text-stone-500 text-sm max-w-xs mx-auto leading-relaxed">
                Tap the ♡ on any book to save it here for later.
              </p>
              <button
                onClick={onClose}
                className="mt-6 text-[#991B1B] font-semibold hover:underline text-sm"
              >
                Browse books →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {wishlist.map((book) => (
                <div
                  key={book.id}
                  className="group flex gap-4 p-3 rounded-xl hover:bg-stone-50 transition-colors duration-200"
                >
                  {/* Mini CSS cover — clickable */}
                  <button
                    onClick={() => { onViewDetail(book); onClose(); }}
                    className="flex-shrink-0 w-16 rounded-r-sm overflow-hidden transition-transform duration-300 group-hover:scale-105"
                    style={{
                      aspectRatio: "2/3",
                      boxShadow: "-1px 0 3px rgba(0,0,0,0.1), 3px 6px 14px rgba(0,0,0,0.14)",
                    }}
                  >
                    <BookCover book={book} className="w-full h-full" />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <p className="text-[10px] font-bold text-[#991B1B] uppercase tracking-wider mb-0.5">
                        {book.category}
                      </p>
                      <h4
                        className="font-bold text-[#1C1917] text-sm leading-snug line-clamp-2 cursor-pointer hover:text-[#991B1B] transition"
                        onClick={() => { onViewDetail(book); onClose(); }}
                      >
                        {book.title}
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">{book.author}</p>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <p className="text-base font-bold text-[#1C1917]">
                          KSh {book.price.toLocaleString()}
                        </p>
                        {book.originalPrice && (
                          <p className="text-xs text-stone-400 line-through">
                            KSh {book.originalPrice.toLocaleString()}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onRemove(book.id)}
                          className="p-1.5 text-stone-300 hover:text-red-500 transition rounded-lg hover:bg-red-50"
                          title="Remove from wishlist"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onAddToCart(book)}
                          className="flex items-center gap-1.5 bg-[#1C1917] hover:bg-[#991B1B] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                          Add to Basket
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — only shown when there are items */}
        {wishlist.length > 0 && (
          <div className="border-t border-stone-200 p-6 bg-stone-50/80">
            {/* Add all to cart */}
            <button
              onClick={() => {
                wishlist.forEach((book) => onAddToCart(book));
                onClose();
              }}
              className="w-full bg-[#1C1917] hover:bg-[#991B1B] text-white py-3.5 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Add All to Basket ({wishlist.length})
            </button>
            <p className="text-center text-xs text-stone-400 mt-3">
              Your wishlist is saved across sessions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}