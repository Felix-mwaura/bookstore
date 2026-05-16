"use client";

// ─────────────────────────────────────────────
// BookCover — pure CSS, no images needed
// ─────────────────────────────────────────────
export function BookCover({ book, className = "", style = {} }) {
  const { bg, accent, pattern } = book.cover ?? { bg: "#1C1917", accent: "#991B1B", pattern: "dots" };

  const patternSvg = {
    dots: `radial-gradient(circle, ${accent}22 1.5px, transparent 1.5px)`,
    lines: `repeating-linear-gradient(45deg, ${accent}18 0px, ${accent}18 1px, transparent 1px, transparent 12px)`,
    diagonal: `repeating-linear-gradient(-45deg, ${accent}15 0px, ${accent}15 1px, transparent 1px, transparent 14px)`,
    grid: `linear-gradient(${accent}18 1px, transparent 1px), linear-gradient(90deg, ${accent}18 1px, transparent 1px)`,
    circles: `radial-gradient(ellipse at 30% 20%, ${accent}30 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, ${accent}20 0%, transparent 50%)`,
  };

  const patternSize = {
    dots: "12px 12px",
    lines: "16px 16px",
    diagonal: "18px 18px",
    grid: "18px 18px",
    circles: "100% 100%",
  };

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        backgroundColor: bg,
        backgroundImage: patternSvg[pattern],
        backgroundSize: patternSize[pattern],
        ...style,
      }}
    >
      {/* Spine shadow */}
      <div
        className="absolute left-0 top-0 bottom-0 w-3 z-10"
        style={{
          background: "linear-gradient(to right, rgba(0,0,0,0.35), rgba(0,0,0,0.08) 60%, transparent)",
        }}
      />

      {/* Top accent stripe */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: accent }}
      />

      {/* Content */}
      <div className="relative z-20 h-full flex flex-col justify-between p-4">
        {/* Category tag */}
        <span
          className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm self-start"
          style={{ backgroundColor: `${accent}30`, color: accent }}
        >
          {book.category}
        </span>

        {/* Title + Author */}
        <div>
          <h3
            className="font-black leading-tight mb-1"
            style={{
              color: "#ffffff",
              fontSize: "clamp(0.65rem, 2.5vw, 0.9rem)",
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            {book.title}
          </h3>
          <p
            className="text-[9px] font-medium tracking-wide"
            style={{ color: `${accent}cc` }}
          >
            {book.author}
          </p>
        </div>
      </div>

      {/* Shine overlay */}
      <div
        className="absolute inset-0 z-30 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%, rgba(0,0,0,0.12) 100%)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// BookDetailPage — full-screen modal overlay
// ─────────────────────────────────────────────
export default function BookDetailPage({ book, isWishlisted, onToggleWishlist, onAddToCart, onClose }) {
  if (!book) return null;

  const discount = book.originalPrice
    ? Math.round((1 - book.price / book.originalPrice) * 100)
    : null;

  const stars = (rating) =>
    [...Array(5)].map((_, i) => (
      <svg
        key={i}
        className="w-5 h-5"
        viewBox="0 0 20 20"
        fill={i < Math.floor(rating) ? "#f59e0b" : i < rating ? "url(#half)" : "#d1d5db"}
      >
        <defs>
          <linearGradient id="half">
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#d1d5db" />
          </linearGradient>
        </defs>
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-slide-up flex flex-col"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white/90 backdrop-blur rounded-full shadow-md hover:bg-stone-100 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="overflow-y-auto flex-1">
            <div className="flex flex-col md:flex-row">

              {/* Left — cover panel */}
              <div
                className="md:w-72 lg:w-80 flex-shrink-0 flex flex-col items-center justify-center p-10 relative"
                style={{ backgroundColor: `${book.cover.bg}18` }}
              >
                {/* Decorative blobs */}
                <div
                  className="absolute top-0 left-0 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none"
                  style={{ backgroundColor: book.cover.accent, transform: "translate(-30%, -30%)" }}
                />
                <div
                  className="absolute bottom-0 right-0 w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: book.cover.bg, transform: "translate(30%, 30%)" }}
                />

                {/* Book */}
                <div
                  className="relative w-44 rounded-r-md overflow-hidden"
                  style={{
                    aspectRatio: "2/3",
                    boxShadow: "-3px 0 6px rgba(0,0,0,0.15), 8px 16px 40px rgba(0,0,0,0.3)",
                  }}
                >
                  <BookCover book={book} className="w-full h-full" />
                </div>

                {/* Format + stock */}
                <div className="mt-6 text-center space-y-1">
                  <span className="inline-block px-3 py-1 bg-white border border-stone-200 rounded-full text-xs font-semibold text-stone-600">
                    {book.format}
                  </span>
                  {book.stock !== "In Stock" ? (
                    <p className="text-xs text-amber-600 font-semibold">{book.stock}</p>
                  ) : (
                    <p className="text-xs text-green-600 font-semibold">✓ In Stock</p>
                  )}
                </div>
              </div>

              {/* Right — details */}
              <div className="flex-1 p-8 md:p-10">
                {/* Category + badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-[#991B1B] uppercase tracking-wider">
                    {book.category}
                  </span>
                  {book.badge && (
                    <span className="px-2.5 py-0.5 bg-[#991B1B] text-white text-[10px] font-bold uppercase tracking-wider rounded-md">
                      {book.badge}
                    </span>
                  )}
                  {discount && (
                    <span className="px-2.5 py-0.5 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-md">
                      {discount}% OFF
                    </span>
                  )}
                </div>

                <h1 className="text-3xl lg:text-4xl font-bold text-[#1C1917] leading-tight">
                  {book.title}
                </h1>
                <p className="text-lg text-stone-500 mt-1">{book.author}</p>

                {/* Rating row */}
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex items-center gap-0.5">{stars(book.rating)}</div>
                  <span className="font-bold text-[#1C1917]">{book.rating}</span>
                  <span className="text-sm text-stone-400">
                    ({book.reviews.toLocaleString()} reviews)
                  </span>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-3 mt-5">
                  <span className="text-4xl font-black text-[#1C1917]">
                    KSh {book.price.toLocaleString()}
                  </span>
                  {book.originalPrice && (
                    <span className="text-xl text-stone-400 line-through">
                      KSh {book.originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="mt-5 text-stone-600 leading-relaxed text-[15px]">
                  {book.description}
                </p>

                {/* Book meta */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Pages", value: book.pages },
                    { label: "Publisher", value: book.publisher },
                    { label: "Year", value: book.year },
                    { label: "Format", value: book.format },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-stone-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-semibold text-[#1C1917] mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-5">
                  {book.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-stone-100 text-stone-600 text-xs font-medium rounded-full hover:bg-[#991B1B]/10 hover:text-[#991B1B] transition cursor-default"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <button
                    onClick={() => {
                      onAddToCart(book);
                      onClose();
                    }}
                    className="flex-1 bg-[#1C1917] hover:bg-[#991B1B] text-white py-4 rounded-xl font-bold text-base transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Add to Basket
                  </button>

                  <button
                    onClick={() => onToggleWishlist(book)}
                    className={`sm:w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all duration-200 active:scale-95 ${
                      isWishlisted
                        ? "bg-red-50 border-red-200 text-red-500"
                        : "border-stone-200 text-stone-400 hover:border-[#991B1B] hover:text-[#991B1B]"
                    }`}
                  >
                    <svg
                      className="w-6 h-6"
                      fill={isWishlisted ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  </button>
                </div>

                {/* Delivery note */}
                <div className="mt-4 flex items-center gap-2 text-sm text-stone-500">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Free delivery within Nairobi on orders over KSh 3,000
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}