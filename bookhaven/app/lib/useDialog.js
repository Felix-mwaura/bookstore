"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog behaviour shared by every overlay: Escape closes, Tab stays inside,
 * the page behind stops scrolling, focus starts inside and returns to the
 * control that opened it.
 *
 * Returns the ref to put on the panel element.
 */
export function useDialog(open, onClose) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = typeof document !== "undefined" ? document.activeElement : null;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () => Array.from(panel?.querySelectorAll(FOCUSABLE) ?? []);
    // Prefer an element marked autofocus, otherwise the first control.
    const initial = panel?.querySelector("[data-autofocus]") || focusables()[0] || panel;
    initial?.focus?.({ preventScroll: true });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const restore = restoreRef.current;
      if (restore && typeof restore.focus === "function") restore.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  return panelRef;
}
