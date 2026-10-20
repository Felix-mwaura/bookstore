"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { categories, categorySlug } from "../lib/categories";

/* ── icons ────────────────────────────────────────────── */
const SearchIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const HeartIcon = ({ filled }) => (
  <svg className={`w-5 h-5 ${filled ? "text-[#B5532F] fill-[#B5532F]" : "text-navy"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const CartIcon = () => (
  <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

/* ── account menu ─────────────────────────────────────── */
function AccountMenu({ onNavigate }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const describe = (session) => {
      if (!session?.user) return null;
      const meta = session.user.user_metadata || {};
      const name = `${meta.first_name || ""}`.trim() || session.user.email?.split("@")[0] || "Reader";
      return { name, email: session.user.email, initial: name.charAt(0).toUpperCase() };
    };

    supabase.auth.getSession().then(({ data }) => setUser(describe(data.session))).catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(describe(session));
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onPointer = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    localStorage.removeItem("bh_user");
    localStorage.removeItem("bh_cart");
    localStorage.removeItem("bh_wishlist");
    setUser(null);
    setOpen(false);
    setSigningOut(false);
    router.push("/");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={user ? `Account menu for ${user.name}` : "Account menu"}
        className="flex items-center gap-2 min-h-11 px-2 sm:px-3 rounded-lg hover:bg-subtle transition"
      >
        {user ? (
          <span className="w-8 h-8 rounded-full bg-[#B5532F] text-white font-bold text-sm flex items-center justify-center">{user.initial}</span>
        ) : (
          <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
        <span className="hidden xl:block text-sm font-medium text-navy">{user ? user.name : "Account"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 bg-white rounded-card shadow-pop border border-line z-[60] overflow-hidden animate-fade-in"
        >
          {user ? (
            <>
              <div className="px-4 py-3 border-b border-line">
                <p className="text-sm font-bold text-navy truncate">{user.name}</p>
                <p className="text-xs text-muted truncate">{user.email}</p>
              </div>
              <div className="py-1.5">
                {[
                  { label: "My orders", href: "/account" },
                  { label: "My profile", href: "/account" },
                  { label: "Help & contact", href: "/#contact" },
                ].map((item) => (
                  <Link key={item.label} href={item.href} role="menuitem" onClick={() => { setOpen(false); onNavigate?.(); }}
                    className="block px-4 py-2.5 text-sm text-ink hover:bg-subtle transition">
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="border-t border-line py-1.5">
                <button type="button" onClick={signOut} disabled={signingOut} role="menuitem"
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-muted hover:text-navy hover:bg-subtle transition">
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </>
          ) : (
            <div className="p-4">
              <p className="text-sm font-bold text-navy">Hello</p>
              <p className="text-xs text-muted mt-0.5">Sign in to track your orders.</p>
              <div className="mt-3 space-y-2">
                <Link href="/login" role="menuitem" onClick={() => { setOpen(false); onNavigate?.(); }}
                  className="btn-primary w-full text-sm py-2.5">Sign in</Link>
                <Link href="/login?tab=register" role="menuitem" onClick={() => { setOpen(false); onNavigate?.(); }}
                  className="btn-secondary w-full text-sm py-2.5">Create an account</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── header ───────────────────────────────────────────── */
export default function StoreHeader({ cartCount = 0, wishlistCount = 0, onCartClick, onWishlistClick }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const drawerRef = useRef(null);
  const drawerCloseRef = useRef(null);

  const submitSearch = (e) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "All") params.set("category", category);
    router.push(`/books${params.toString() ? `?${params}` : ""}`);
    setSearchOpen(false);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // Mobile drawer: Escape closes it, focus is held inside while open and
  // returned to the menu button on close.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.activeElement;
    drawerCloseRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") { setMenuOpen(false); return; }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (previous && previous.focus) previous.focus();
    };
  }, [menuOpen]);

  const searchForm = (idPrefix) => (
    <form onSubmit={submitSearch} role="search" className="flex w-full items-stretch rounded-control border border-line bg-white overflow-hidden focus-within:border-[#B5532F]">
      <label htmlFor={`${idPrefix}-category`} className="sr-only">Search category</label>
      <select
        id={`${idPrefix}-category`}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="hidden sm:block bg-transparent pl-3 pr-1 py-2.5 text-sm text-muted border-r border-line focus:outline-none max-w-[9.5rem]"
      >
        {categories.map((c) => (
          <option key={c} value={c}>{c === "All" ? "All categories" : c}</option>
        ))}
      </select>
      <label htmlFor={`${idPrefix}-query`} className="sr-only">Search books by title, author or genre</label>
      <input
        id={`${idPrefix}-query`}
        ref={idPrefix === "desktop" ? inputRef : undefined}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search books, authors, genres…"
        className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:outline-none"
      />
      <button type="submit" aria-label="Search" className="px-3.5 min-w-11 text-navy hover:bg-subtle transition flex items-center justify-center">
        <SearchIcon />
      </button>
    </form>
  );

  return (
    <>
      <div className="bg-navy text-cream/90 text-center py-1.5 text-xs sm:text-[13px] px-4">
        Free delivery on orders of KSh 3,000 and above · KSh 300 flat rate below that
      </div>

      <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-line">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4 h-14 sm:h-16">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="lg:hidden -ml-1 w-11 h-11 flex items-center justify-center rounded-lg hover:bg-subtle transition"
            >
              <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/" className="flex items-center gap-2 flex-shrink-0" aria-label="Book Haven home">
              <span className="font-playfair text-lg sm:text-xl font-bold text-navy leading-none">Book Haven</span>
            </Link>

            <div className="hidden md:block flex-1 max-w-2xl mx-auto">
              {searchForm("desktop")}
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1 ml-auto">
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search"
                aria-expanded={searchOpen}
                className="md:hidden w-11 h-11 flex items-center justify-center rounded-lg hover:bg-subtle transition"
              >
                <SearchIcon />
              </button>

              <div className="hidden sm:block"><AccountMenu /></div>

              <button
                type="button"
                onClick={onWishlistClick}
                aria-label={`Wishlist, ${wishlistCount} ${wishlistCount === 1 ? "book" : "books"}`}
                className="hidden sm:flex relative w-11 h-11 items-center justify-center rounded-lg hover:bg-subtle transition"
              >
                <HeartIcon filled={wishlistCount > 0} />
                {wishlistCount > 0 && (
                  <span className="absolute top-1.5 right-1 bg-[#B5532F] text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onCartClick}
                aria-label={`Basket, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
                className="relative w-11 h-11 flex items-center justify-center rounded-lg hover:bg-subtle transition"
              >
                <CartIcon />
                {cartCount > 0 && (
                  <span className="absolute top-1.5 right-1 bg-[#B5532F] text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="md:hidden pb-3">{searchForm("mobile")}</div>
          )}
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute left-0 top-0 h-full w-[85%] max-w-xs bg-cream shadow-pop flex flex-col animate-slide-in-left"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-line">
              <span className="font-playfair text-lg font-bold text-navy">Book Haven</span>
              <button
                ref={drawerCloseRef}
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-subtle"
              >
                <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-3" aria-label="Shop">
              <p className="px-5 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted">Browse</p>
              {categories.map((c) => (
                <Link key={c} href={c === "All" ? "/books" : `/category/${categorySlug(c)}`}
                  onClick={() => setMenuOpen(false)}
                  className="block px-5 py-3 text-sm text-ink hover:bg-subtle transition">
                  {c === "All" ? "All books" : c}
                </Link>
              ))}

              <div className="mt-3 pt-3 border-t border-line">
                <p className="px-5 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted">Account</p>
                <Link href="/account" onClick={() => setMenuOpen(false)} className="block px-5 py-3 text-sm text-ink hover:bg-subtle transition">My orders</Link>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="block px-5 py-3 text-sm text-ink hover:bg-subtle transition">Sign in</Link>
                <Link href="/#contact" onClick={() => setMenuOpen(false)} className="block px-5 py-3 text-sm text-ink hover:bg-subtle transition">Contact</Link>
              </div>
            </nav>

            <div className="p-4 border-t border-line">
              <Link href="/books" onClick={() => setMenuOpen(false)} className="btn-primary w-full text-sm">Browse all books</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
