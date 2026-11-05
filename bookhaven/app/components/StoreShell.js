"use client";

import { useCallback } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

import { BookCover } from "./BookCover";
import { bookPath } from "../lib/book-url";
import { DELIVERY_COVERAGE, DELIVERY_PERCENT, deliveryFeeFor, formatKsh } from "../lib/site";
import { useDialog } from "../lib/useDialog";
import { STORE_CONTACT } from "../lib/site";
import { StoreContext, useStore, useStoreState } from "../lib/store-state";

// The header and the category list live in their own modules now. These
// re-exports keep the existing page imports working unchanged.
export { default as StoreHeader } from "./StoreHeader";
export { categories } from "../lib/categories";

// ── Cart Drawer ─────────────────────────────────────────
export function CartDrawer({ cart, isOpen, onClose, onUpdateQty, onRemove, total }) {
  const close = useCallback(() => onClose(), [onClose]);
  const panelRef = useDialog(isOpen, close);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);


  return (
    // AnimatePresence keeps the panel mounted for the exit, which is the only
    // way a drawer can close as smoothly as it opens. useDialog's focus trap
    // still runs off `isOpen`, so Escape, Tab and the focus restore are
    // unchanged - they simply finish while the panel slides away.
    <AnimatePresence>
      {isOpen && (
    <div className="fixed inset-0 z-[60]">
      <motion.div
        className="absolute inset-0 bg-navy/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={close}
        aria-hidden="true"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="basket-title"
        tabIndex={-1}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 36, mass: 0.9 }}
        className="absolute right-0 top-0 h-[100dvh] w-full max-w-md bg-cream shadow-pop flex flex-col"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line">
          <div>
            <h2 id="basket-title" className="text-lg font-bold text-navy">Your basket</h2>
            <p className="mt-0.5 text-small text-muted">
              {itemCount === 0 ? "No items yet" : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close basket"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-subtle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {cart.length === 0 ? (
            <div className="px-2 py-16 text-center">
              <svg className="mx-auto h-12 w-12 text-line" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <h3 className="mt-4 text-base font-semibold text-navy">Your basket is empty</h3>
              <p className="mt-1 text-small text-muted">Add a book and it will wait here for you.</p>
              <div className="mt-5 flex flex-col items-center gap-2">
                <Link href="/books" onClick={close} className="btn-primary">Browse books</Link>
                <Link
                  href="/books?sort=newest"
                  onClick={close}
                  className="text-small font-semibold text-sienna underline-offset-2 hover:underline"
                >
                  See new arrivals
                </Link>
              </div>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-line">
              {cart.map((item) => (
                <li key={item.id} className="flex gap-3 py-3.5 first:pt-1">
                  <Link href={bookPath(item)} onClick={close} className="w-14 shrink-0 overflow-hidden rounded-r-sm book-shadow">
                    <BookCover book={item} className="w-full" sizes="56px" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={bookPath(item)} onClick={close} className="block text-small font-semibold leading-snug text-navy line-clamp-2 hover:text-sienna">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 truncate text-small text-muted">
                      {item.author}
                      {item.quantity > 1 ? ` · ${formatKsh(item.price)} each` : ""}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-control border border-line bg-surface">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, -1)}
                          aria-label={`Decrease quantity of ${item.title}`}
                          className="w-9 h-11 flex items-center justify-center text-navy hover:bg-subtle rounded-l-control"
                        >
                          <span aria-hidden="true">−</span>
                        </button>
                        <span className="w-8 text-center text-small font-semibold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 1)}
                          aria-label={`Increase quantity of ${item.title}`}
                          className="w-9 h-11 flex items-center justify-center text-navy hover:bg-subtle rounded-r-control"
                        >
                          <span aria-hidden="true">+</span>
                        </button>
                      </div>

                      <p className="text-small font-bold tabular-nums text-navy">{formatKsh(item.price * item.quantity)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="mt-2 text-small text-muted underline underline-offset-2 hover:text-error"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-line p-4">
            <div className="rounded-card border border-line bg-surface p-4">
              <div className="flex justify-between text-small">
                <span className="text-muted">Subtotal</span>
                <span className="font-semibold text-navy">{formatKsh(total)}</span>
              </div>
              <div className="mt-1.5 flex justify-between text-small">
                <span className="text-muted">Delivery ({DELIVERY_PERCENT}%)</span>
                <span className="font-semibold text-navy">{formatKsh(deliveryFeeFor(total))}</span>
              </div>

              <div className="mt-3 flex justify-between border-t border-line pt-3 text-base font-bold text-navy">
                <span>Total</span>
                <span>{formatKsh(total + deliveryFeeFor(total))}</span>
              </div>
            </div>

            <Link href="/checkout" onClick={close} className="btn-primary mt-3 w-full">
              Checkout
            </Link>
            <p className="mt-2 text-center text-micro text-muted">Delivery is {DELIVERY_PERCENT}% of the book total.</p>
          </div>
        )}
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
}

// ── Shared Footer ───────────────────────────────────────
export function StoreFooter() {
  const year = new Date().getFullYear();
  const link = "text-cream/75 transition-colors hover:text-white";

  const columns = [
    {
      title: "Shop",
      links: [
        ["All books", "/books"],
        ["New arrivals", "/books?sort=newest"],
        ["Fiction", "/category/fiction"],
        ["Finance", "/category/finance"],
        ["Self-help", "/category/self-help"],
      ],
    },
    {
      title: "Your account",
      links: [
        ["Orders & tracking", "/account"],
        ["Saved books", "/account"],
        ["Sign in", "/login"],
        ["Create an account", "/login?tab=register"],
      ],
    },
    {
      title: "Help",
      links: [
        ["Delivery", "/help#delivery"],
        ["Returns", "/help#returns"],
        ["Payment & M-Pesa", "/help#payment"],
        ["About Book Haven", "/about"],
        ["Privacy", "/privacy"],
        ["Terms of sale", "/terms"],
      ],
    },
  ];

  return (
    <footer className="mt-auto bg-navy-deep text-cream">
      <div className="shell border-t border-white/10 py-14 sm:py-16">
        {/* Six columns at desktop: the brand takes two, each of the four
            link groups takes one, and no group wraps onto a second row. */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-6">
          <div className="col-span-2 min-w-0">
            <Link href="/" className="inline-flex items-center">
              <span className="font-playfair text-2xl font-bold text-white">Book Haven</span>
            </Link>
            <p className="mt-4 max-w-sm text-small leading-relaxed text-cream/70">
              Books in Kenyan shillings. Delivery is {DELIVERY_PERCENT}% of the book total, shown
              before you pay. {DELIVERY_COVERAGE || "Every order appears in your account with its current stage."}
            </p>
            <p className="mt-4 text-micro uppercase tracking-[0.08em] text-cream/60">
              Pay on delivery · M-Pesa
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-micro font-semibold uppercase tracking-[0.1em] text-cream/60">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-2.5 text-small">
                {column.links.map(([label, href]) => (
                  <li key={`${column.title}-${label}`}>
                    <Link href={href} className={`-my-1 inline-block py-1 ${link}`}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="min-w-0">
            <h2 className="text-micro font-semibold uppercase tracking-[0.1em] text-cream/60">
              Contact
            </h2>
            {/* Only confirmed details are published. The four values this
                used to show were placeholders nobody had checked, and an
                address someone travels to is worse than no address.
                break-words: an email address is one unbreakable word, and
                half of one at 768px is wider than its column. */}
            <ul className="mt-4 space-y-2.5 text-small">
              {STORE_CONTACT.email && (
                <li>
                  <a href={`mailto:${STORE_CONTACT.email}`} className={`-my-1 inline-block max-w-full break-words py-1 ${link}`}>
                    {STORE_CONTACT.email}
                  </a>
                </li>
              )}
              {STORE_CONTACT.phone && STORE_CONTACT.phoneHref && (
                <li>
                  <a href={STORE_CONTACT.phoneHref} className={`-my-1 inline-block py-1 ${link}`}>
                    {STORE_CONTACT.phone}
                  </a>
                </li>
              )}
              {STORE_CONTACT.location && <li className="text-cream/70">{STORE_CONTACT.location}</li>}
              {STORE_CONTACT.hours && <li className="text-cream/60">{STORE_CONTACT.hours}</li>}
              {!STORE_CONTACT.reachable && (
                <li className="max-w-[24ch] text-cream/70">
                  Contact details are not published yet.{" "}
                  <Link href="/help#contact" className={link}>Delivery and returns</Link>{" "}
                  explains how an order is handled.
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-small text-cream/60">© {year} Book Haven Kenya</p>
          <p className="text-small text-cream/60">Prices in KES · Pay on delivery</p>
        </div>
      </div>
    </footer>
  );
}

// ── the basket, shared by every island on the page ─────
//
// The state itself lives in app/lib/store-state.js (no JSX, so it can be
// tested directly). This component is the one place it is mounted.
export function StoreProvider({ children }) {
  const store = useStoreState();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

// Re-exported so the existing `import { useStore } from "./StoreShell"`
// call sites keep working.
export { useStore };
