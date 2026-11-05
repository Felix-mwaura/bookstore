"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useGenres } from "./GenreProvider";
import { DELIVERY_PERCENT } from "../lib/site";

/* ── icons ────────────────────────────────────────────── */
const SearchIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const HeartIcon = ({ filled }) => (
  <svg className={`w-5 h-5 ${filled ? "text-sienna fill-sienna" : "text-navy"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const CartIcon = () => (
  <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

/* ── account menu ─────────────────────────────────────── */
function AccountMenu({ onNavigate, user, onSignOut, signingOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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
          <span className="w-8 h-8 rounded-full bg-sienna text-white font-bold text-sm flex items-center justify-center">{user.initial}</span>
        ) : (
          <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
        <span className="hidden xl:block text-sm font-medium text-navy">{user ? user.name : "Account"}</span>
      </button>

      {/* Exit animations are the one thing CSS cannot do: the element is
          gone before a transition can run. AnimatePresence keeps it mounted
          for the length of the exit, so the menu closes as deliberately as it
          opens. */}
      <AnimatePresence>
        {open && (
        <motion.div
          role="menu"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.99 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-0 top-full mt-2 w-64 origin-top-right bg-white rounded-card shadow-pop border border-line z-[60] overflow-hidden"
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
                <button type="button" onClick={() => { setOpen(false); onSignOut?.(); }} disabled={signingOut} role="menuitem"
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
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── header ───────────────────────────────────────────── */

// One session subscription for the whole header. The account menu and the
// mobile drawer are two presentations of the same state, so a signed-in
// customer can always reach Sign out — including on a phone, where the menu
// is the only place it fits.
function useSessionUser() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const describe = (session) => {
      if (!session?.user) return null;
      const meta = session.user.user_metadata || {};
      const name = `${meta.first_name || ""}`.trim() || session.user.email?.split("@")[0] || "Reader";
      return { name, email: session.user.email, initial: name.charAt(0).toUpperCase() };
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setUser(describe(data.session));
        setReady(true);
      })
      .catch(() => setReady(true));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(describe(session));
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { user, ready };
}

// The two ways into the catalogue that are not a genre. Every genre follows
// these, read from the genre list the rest of the shop uses — this used to be
// three hard-coded names (Fiction, Finance, Self-help), so a genre added in the
// admin had no way into the shop from the header, and one renamed or removed
// left a dead link behind.
const NAV_LINKS = [
  { label: "All books", href: "/books", match: "/books" },
  { label: "New arrivals", href: "/books?sort=newest" },
];

export default function StoreHeader({ cartCount = 0, wishlistCount = 0, onCartClick, onWishlistClick }) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  // Elevation only once the page has moved: a sticky bar that starts with a
  // shadow looks like it is floating over nothing. The listener is passive
  // and only writes state on the transition, not on every scroll frame.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 8;
      setStuck((current) => (current === next ? current : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // The genres the shop currently sells, from the database via the root
  // layout, with the built-in list as the value before that resolves.
  const genres = useGenres();
  const { user, ready: sessionReady } = useSessionUser();
  const [signingOut, setSigningOut] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const drawerRef = useRef(null);
  const drawerCloseRef = useRef(null);

  // Picking a genre navigates straight away. The value used to be read only on
  // submit, so choosing "Fiction" and stepping away did nothing at all — a
  // select in a search bar reads as a filter, and a filter that needs a second,
  // unannounced action looks broken.
  //
  // It also never kept its selection. Holding the last choice meant that
  // choosing the same genre twice changed nothing and fired no change event,
  // so the control went dead after the first use. It now behaves as a command:
  // every selection navigates, and the control always reads "All categories".
  const chooseCategory = (value) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (value !== "All") params.set("category", value);
    router.push(`/books${params.toString() ? `?${params}` : ""}`);
    setSearchOpen(false);
    setMenuOpen(false);
  };

  const submitSearch = (e) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/books${params.toString() ? `?${params}` : ""}`);
    setSearchOpen(false);
    setMenuOpen(false);
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      // The basket belongs to whoever was signed in; do not leave it on a
      // shared device.
      localStorage.removeItem("bh_user");
      localStorage.removeItem("bh_cart");
      localStorage.removeItem("bh_wishlist");
      window.dispatchEvent(new CustomEvent("bh:cart-changed", { detail: { source: "sign-out" } }));
    } catch {}
    setSigningOut(false);
    setMenuOpen(false);
    router.push("/");
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
    <form
      onSubmit={submitSearch}
      role="search"
      className="flex w-full items-center gap-1 rounded-full border border-line bg-surface p-1 transition-colors focus-within:border-navy"
    >
      <label htmlFor={`${idPrefix}-category`} className="sr-only">Search category</label>
      {/* Always reading "All": this control issues a command rather than
          holding a state, so every pick fires — including a repeat of the
          last one, which used to change nothing. */}
      <select
        id={`${idPrefix}-category`}
        value="All"
        onChange={(e) => chooseCategory(e.target.value)}
        className="hidden max-w-[10rem] rounded-full bg-transparent py-2 pl-4 pr-1 text-small text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sienna sm:block"
      >
        {["All", ...genres.map((g) => g.name)].map((c) => (
          <option key={c} value={c}>{c === "All" ? "All categories" : c}</option>
        ))}
      </select>
      <label htmlFor={`${idPrefix}-query`} className="sr-only">Search books by title, author or genre</label>
      <input
        id={`${idPrefix}-query`}
        ref={idPrefix === "desktop" ? inputRef : undefined}
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search books, authors, genres…"
        className="min-w-0 flex-1 rounded-full bg-transparent px-3 py-2 text-small text-ink placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sienna"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white transition-colors hover:bg-sienna"
      >
        <SearchIcon className="h-4 w-4" />
      </button>
    </form>
  );

  return (
    <>
      <div className="bg-navy-deep px-4 py-2 text-center text-micro font-medium uppercase tracking-[0.08em] text-cream/85">
        <span>Delivery is {DELIVERY_PERCENT}% of the book total</span>
        <span aria-hidden="true" className="mx-2 text-cream/40">·</span>
        <span className="text-cream/70">Every order has a reference</span>
      </div>

      <header
        data-stuck={stuck ? "true" : undefined}
        className="site-header sticky top-0 z-40 border-b border-line bg-cream"
      >
        <div className="shell">
          <div className="flex h-16 items-center gap-2 sm:gap-4 sm:h-20">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-subtle lg:hidden"
            >
              <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/" className="-my-2 flex flex-shrink-0 items-center gap-2 py-2" aria-label="Book Haven home">
              <span className="font-playfair text-xl font-bold leading-none tracking-[-0.01em] text-navy sm:text-2xl">Book Haven</span>
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
                className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-subtle md:hidden"
              >
                <SearchIcon />
              </button>

              <div className="hidden sm:block">
                <AccountMenu
                  user={user}
                  onSignOut={signOut}
                  signingOut={signingOut}
                />
              </div>

              <button
                type="button"
                onClick={onWishlistClick}
                aria-label={`Wishlist, ${wishlistCount} ${wishlistCount === 1 ? "book" : "books"}`}
                className="relative hidden h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-subtle sm:flex"
              >
                <HeartIcon filled={wishlistCount > 0} />
                {wishlistCount > 0 && (
                  <span className="absolute top-1.5 right-1 bg-sienna text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onCartClick}
                aria-label={`Basket, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
                className="relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-subtle"
              >
                <CartIcon />
                <AnimatePresence initial={false}>
                  {cartCount > 0 && (
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 520, damping: 26 }}
                      className="absolute right-1 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sienna px-1 text-[10px] font-bold text-white"
                    >
                      {/* Keyed on the count, so a change re-mounts only the
                          numeral and gives it one short spring — the badge
                          itself keeps its place. */}
                      <motion.span
                        key={cartCount}
                        initial={{ scale: 1.35 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 600, damping: 24 }}
                        className="tabular-nums"
                      >
                        {cartCount}
                      </motion.span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>

          {/* Navigation desktop: the header used to offer a shopper no way
              to move through the shop except the footer or the home page.
              One slim row of the things people actually browse. */}
          <nav aria-label="Browse" className="hidden border-t border-line/70 lg:block">
            <div className="flex h-11 items-center gap-6">
              {/* The genre row scrolls sideways when it does not fit — nine
                  genres plus two destinations do not fit at 1024px. Every
                  genre comes from the same list the rest of the shop reads, so
                  a genre added in the admin appears here without a deploy. */}
              <ul className="scrollbar-none flex h-11 min-w-0 flex-1 items-center gap-5 overflow-x-auto text-small xl:gap-6">
                {NAV_LINKS.map((item) => {
                  const active = pathname === item.href || (item.match && pathname.startsWith(item.match));
                  return (
                    <li key={item.href} className="shrink-0">
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`inline-flex h-11 items-center whitespace-nowrap underline-offset-[6px] transition-colors hover:text-navy hover:underline ${
                          active ? "text-navy underline decoration-sienna decoration-2" : "text-muted"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                {genres.map((genre) => {
                  const href = `/category/${genre.slug}`;
                  const active = pathname === href;
                  return (
                    <li key={genre.slug} className="shrink-0">
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`inline-flex h-11 items-center whitespace-nowrap underline-offset-[6px] transition-colors hover:text-navy hover:underline ${
                          active ? "text-navy underline decoration-sienna decoration-2" : "text-muted"
                        }`}
                      >
                        {genre.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Outside the scrolling list on purpose: a pinned destination
                  that slides away when the genre strip overflows is worse
                  than no pinned destination. */}
              <Link
                href="/help"
                aria-current={pathname === "/help" ? "page" : undefined}
                className="inline-flex h-11 shrink-0 items-center text-muted underline-offset-[6px] transition-colors hover:text-navy hover:underline"
              >
                Delivery &amp; help
              </Link>
            </div>
          </nav>

          <AnimatePresence initial={false}>
            {searchOpen && (
              <motion.div
                key="mobile-search"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="md:hidden overflow-hidden"
              >
                <div className="pb-3">{searchForm("mobile")}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <AnimatePresence>
      {menuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <motion.div
            className="absolute inset-0 bg-navy/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36, mass: 0.9 }}
            className="absolute left-0 top-0 h-full w-[85%] max-w-xs bg-cream shadow-pop flex flex-col"
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
              <p className="px-5 pb-2 pt-3 text-micro font-semibold uppercase text-muted">Browse</p>
              <Link href="/books" onClick={() => setMenuOpen(false)}
                className="block px-5 py-3 text-sm text-ink hover:bg-subtle transition">
                All books
              </Link>
              {genres.map((genre) => (
                <Link key={genre.slug} href={`/category/${genre.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="block px-5 py-3 text-sm text-ink hover:bg-subtle transition">
                  {genre.name}
                </Link>
              ))}

              <div className="mt-3 pt-3 border-t border-line">
                <p className="px-5 pb-2 pt-3 text-micro font-semibold uppercase text-muted">
                  Account
                </p>

                {user ? (
                  <>
                    <div className="flex items-center gap-3 px-5 pb-2 pt-1">
                      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sienna text-sm font-bold text-white">
                        {user.initial}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">{user.name}</p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onWishlistClick?.(); }}
                      className="flex w-full min-h-11 items-center justify-between px-5 py-3 text-left text-sm text-ink hover:bg-subtle transition"
                    >
                      Saved books
                      <span className="text-xs text-muted">{wishlistCount}</span>
                    </button>
                    <Link href="/account" onClick={() => setMenuOpen(false)} className="block min-h-11 px-5 py-3 text-sm text-ink hover:bg-subtle transition">My orders</Link>
                    <button
                      type="button"
                      onClick={signOut}
                      disabled={signingOut}
                      className="flex w-full min-h-11 items-center gap-2 px-5 py-3 text-left text-sm font-semibold text-error hover:bg-error/5 transition disabled:opacity-60"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onWishlistClick?.(); }}
                      className="flex w-full min-h-11 items-center justify-between px-5 py-3 text-left text-sm text-ink hover:bg-subtle transition"
                    >
                      Saved books
                      <span className="text-xs text-muted">{wishlistCount}</span>
                    </button>
                    {sessionReady && (
                      <>
                        <Link href="/login" onClick={() => setMenuOpen(false)} className="block min-h-11 px-5 py-3 text-sm text-ink hover:bg-subtle transition">Sign in</Link>
                        <Link href="/login?tab=register" onClick={() => setMenuOpen(false)} className="block min-h-11 px-5 py-3 text-sm text-ink hover:bg-subtle transition">Create an account</Link>
                      </>
                    )}
                  </>
                )}

                <Link href="/#contact" onClick={() => setMenuOpen(false)} className="block min-h-11 px-5 py-3 text-sm text-ink hover:bg-subtle transition">Contact</Link>
              </div>
            </nav>

            <div className="p-4 border-t border-line">
              <Link href="/books" onClick={() => setMenuOpen(false)} className="btn-primary w-full text-sm">Browse all books</Link>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </>
  );
}
