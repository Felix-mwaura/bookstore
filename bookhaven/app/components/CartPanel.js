"use client";

export default function CartPanel({ cart, isOpen, onClose, onUpdateQuantity, onRemove, total }) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-fade-up"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-[70] shadow-2xl animate-slide-in flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-[#111827]">Your Cart</h2>
            <p className="text-sm text-gray-500 mt-1">{cart.length} items</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📖</div>
              <p className="text-gray-500">Your cart is empty</p>
              <button 
                onClick={onClose}
                className="mt-4 text-[#c56a3d] font-semibold hover:underline"
              >
                Start browsing
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex gap-4">
                <img 
                  src={item.image} 
                  alt={item.title}
                  className="w-20 h-28 object-cover rounded-xl book-shadow"
                />
                <div className="flex-1">
                  <h4 className="font-bold text-[#111827] line-clamp-1">{item.title}</h4>
                  <p className="text-sm text-gray-500">{item.author}</p>
                  <p className="text-[#c56a3d] font-bold mt-1">KSh {(item.price * item.quantity).toLocaleString()}</p>
                  
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center bg-gray-100 rounded-full">
                      <button 
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-full transition text-sm font-bold"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button 
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-full transition text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                    <button 
                      onClick={() => onRemove(item.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t border-gray-100 p-6 space-y-4 bg-gray-50/50">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold">KSh {total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Shipping</span>
              <span className="font-semibold text-green-600">Free</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>KSh {total.toLocaleString()}</span>
            </div>
            <button className="w-full bg-[#111827] hover:bg-[#c56a3d] text-white py-4 rounded-full font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}