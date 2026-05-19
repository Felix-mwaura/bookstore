"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  // Load from localStorage once on mount
  useEffect(() => {
    try {
      const c = localStorage.getItem("bh_cart");
      const w = localStorage.getItem("bh_wishlist");
      if (c) setCart(JSON.parse(c));
      if (w) setWishlist(JSON.parse(w));
    } catch {}
  }, []);

  // Persist cart
  useEffect(() => { localStorage.setItem("bh_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("bh_wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  // Escape to close book detail
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setSelectedBook(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const addToCart = useCallback((book) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === book.id);
      if (exists) return prev.map((i) => i.id === book.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...book, quantity: 1 }];
    });
    showToast(`"${book.title}" added to basket`);
  }, [showToast]);

  const removeFromCart = useCallback((id) => setCart((prev) => prev.filter((i) => i.id !== id)), []);
  
  const updateQty = useCallback((id, delta) => setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)), []);

  const toggleWishlist = useCallback((book) => {
    setWishlist((prev) => {
      const exists = prev.some((b) => b.id === book.id);
      showToast(exists ? "Removed from wishlist" : "Added to wishlist ♡");
      return exists ? prev.filter((b) => b.id !== book.id) : [...prev, book];
    });
  }, [showToast]);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const value = {
    cart, wishlist, isCartOpen, isWishlistOpen, toast, selectedBook,
    setIsCartOpen, setIsWishlistOpen, setSelectedBook,
    addToCart, removeFromCart, updateQty, toggleWishlist, cartTotal, cartCount,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}