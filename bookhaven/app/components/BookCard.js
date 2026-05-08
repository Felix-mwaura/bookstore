"use client";

export default function BookCard({ book, isWishlisted, onToggleWishlist, onAddToCart }) {
  return (
    <div className="group relative">
      <div className="rounded-[2rem] overflow-hidden bg-white book-shadow group-hover:book-shadow-hover transition-all duration-500">
        
        {/* Image Container */}
        <div className="relative overflow-hidden bg-gray-100">
          <img
            src={book.image}
            alt={book.title}
            className="h-[340px] w-full object-cover group-hover:scale-110 transition duration-700 ease-out"
          />
          
          {/* Overlay Actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition duration-500" />
          
          <button
            onClick={() => onToggleWishlist(book)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/90 backdrop-blur-sm shadow-lg translate-y-[-60px] group-hover:translate-y-0 transition duration-500 hover:scale-110"
          >
            <svg 
              className={`w-5 h-5 ${isWishlisted ? "text-red-500 fill-red-500" : "text-gray-600"}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          {book.badge && (
            <span className="absolute top-4 left-4 px-3 py-1 bg-[#111827] text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
              {book.badge}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#c56a3d] uppercase tracking-wider">
              {book.category}
            </span>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-medium text-gray-600">{book.rating}</span>
            </div>
          </div>

          <h3 className="text-lg font-bold text-[#111827] leading-tight line-clamp-2 group-hover:text-[#c56a3d] transition">
            {book.title}
          </h3>
          
          <p className="text-sm text-gray-500 mt-1">{book.author}</p>
          
          <p className="text-sm text-gray-400 mt-3 line-clamp-2 leading-relaxed">
            {book.description}
          </p>

          <div className="flex items-center justify-between mt-5 pt-5 border-t border-gray-100">
            <p className="text-xl font-bold text-[#111827]">KSh {book.price.toLocaleString()}</p>
            <button
              onClick={() => onAddToCart(book)}
              className="bg-[#111827] hover:bg-[#c56a3d] text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}