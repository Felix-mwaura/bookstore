"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { bookPath } from "../lib/book-url";
import { supabase } from "../lib/supabase";
import { useStore } from "./StoreShell";

// The two things a customer wants from a past order: the same books again,
// and the chance to say what they thought of them.
//
// Both act on *live* catalogue rows, not on the price frozen into the order.
// An order is a historical record; a reorder is a new purchase at today's
// price and today's stock, so the books are re-read before anything is added.

export function BuyAgainButton({ items = [], className = "" }) {
  const store = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const run = async () => {
    const ids = [...new Set(items.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (ids.length === 0) {
      setMessage("This order has no items to reorder.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase
        .from("books")
        .select("id,title,author,price,original_price,category,format,isbn,badge,stock,stock_quantity,cover,cover_url,description,pages,publisher,year,tags")
        .in("id", ids)
        .eq("is_archived", false);

      if (error) throw error;

      const byId = new Map((data || []).map((row) => [Number(row.id), row]));
      let added = 0;
      const missing = [];

      for (const item of items) {
        const live = byId.get(Number(item.id));
        const wanted = Math.max(1, Number(item.quantity) || 1);
        if (!live || Number(live.stock_quantity) <= 0) {
          missing.push(item.title);
          continue;
        }
        const result = store.addToCart(live, wanted, { silent: true });
        added += result.added || 0;
      }

      if (added === 0) {
        setMessage(
          missing.length > 0
            ? "Those books are out of stock or no longer listed."
            : "Nothing could be added to your basket."
        );
        return;
      }

      // One message for the whole action, instead of one per book.
      store.showToast?.(
        missing.length > 0
          ? `${added} ${added === 1 ? "copy" : "copies"} added — ${missing.length} unavailable`
          : "Added to your basket"
      );
      router.push("/checkout");
    } catch {
      setMessage("We could not check stock just now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="min-h-11 rounded-control border border-navy px-4 text-sm font-semibold text-navy transition hover:bg-navy hover:text-white disabled:opacity-60"
      >
        {busy ? "Checking stock…" : "Buy these again"}
      </button>
      {message && <p role="status" className="mt-2 text-xs text-muted">{message}</p>}
    </div>
  );
}

/**
 * Per-item "rate this book" link, shown only once the order was delivered.
 *
 * The review form already refuses a second review, so this is a prompt, not a
 * promise: if the customer already reviewed the book, the book page shows
 * their review and its edit controls instead of a blank form.
 */
export function ReviewPrompt({ item }) {
  if (!item?.id || !item?.title) return null;
  return (
    <Link
      href={`${bookPath(item)}#reviews`}
      className="text-xs font-semibold text-sienna underline-offset-2 hover:underline"
    >
      Rate this book
    </Link>
  );
}
