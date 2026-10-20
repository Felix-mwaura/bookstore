"use client";

import { useEffect } from "react";
import { supabase } from "./supabase";

// Keeps a catalogue view in step with the books table.
//
// Deliberate choices:
//  * The event payload is ignored and the caller re-queries. Row payloads
//    under RLS can be partial, and a refetch guarantees the grid matches the
//    database (including the derived `stock` label).
//  * Bursts are coalesced: one price edit can emit several row events.
//  * A reconnect refetches once, because changes made while the socket was
//    down are never replayed.
//  * A slow poll is the fallback for networks that silently drop websockets.
export function useLiveBooks(onChange, { pollMs = 60000 } = {}) {
  useEffect(() => {
    if (typeof onChange !== "function") return;

    let timer = null;
    let disposed = false;

    const refresh = () => {
      if (disposed) return;
      clearTimeout(timer);
      timer = setTimeout(onChange, 350);
    };

    const channel = supabase
      .channel(`books-live-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "books" },
        refresh
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });

    const poll = pollMs ? setInterval(refresh, pollMs) : null;

    return () => {
      disposed = true;
      clearTimeout(timer);
      if (poll) clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [onChange, pollMs]);
}
