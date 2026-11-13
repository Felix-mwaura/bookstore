"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// A thin line at the top of the page while a navigation is in flight.
//
// Why a click listener rather than a router event: the App Router has no
// route-change event (that API died with the Pages Router, and wiring
// router.events here would throw). So this watches for the one thing a real
// navigation starts with — a plain left click on an internal link — and then
// waits for the URL to actually change.
//
// The rules matter more than the bar. A progress indicator that gets stuck is
// worse than none, so this one gives up in every case it cannot verify:
//   • modified clicks (Ctrl/Cmd/Shift/Alt), middle clicks, target=_blank,
//     download links and external origins are ignored entirely;
//   • a link to the URL you are already on is ignored;
//   • back/forward cancels it;
//   • any route change — including a search-param-only change such as
//     pagination — completes it;
//   • and a 10-second ceiling clears it no matter what, so a failed render or
//     a cancelled navigation cannot leave a line crawling at the top forever.
//
// It is also deliberately slow to appear: 120 ms. A navigation that finishes
// faster than that shows nothing at all, so the indicator only exists for
// waits a person would actually notice.

const APPEAR_AFTER_MS = 120;
const GIVE_UP_AFTER_MS = 10_000;
// How long the completed line stays before it fades out.
const FINISH_MS = 220;
// The bar never pretends to know how far along a request is. It walks towards
// 90% and stops there, the way every honest progress bar does: the last 10% is
// reserved for the moment the page actually arrives.
const TRICKLE_MS = 400;
const TRICKLE_CEILING = 0.9;

// A stepped bar is still motion. For a reader who asked the system for less of
// it, the line appears at full cosmetic width and simply waits.
function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

export default function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // idle | loading | done | fading
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);

  const trickleTimer = useRef(null);
  const appearTimer = useRef(null);
  const giveUpTimer = useRef(null);
  const finishTimer = useRef(null);
  const resetTimer = useRef(null);
  // The URL this component last saw. Comparing against it is what tells a real
  // navigation apart from the effect that runs on first mount.
  const lastUrl = useRef(null);

  const clearTimers = useCallback(() => {
    clearInterval(trickleTimer.current);
    clearTimeout(appearTimer.current);
    clearTimeout(giveUpTimer.current);
    clearTimeout(finishTimer.current);
    clearTimeout(resetTimer.current);
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setProgress(0);
    appearTimer.current = setTimeout(() => {
      setPhase("loading");
      if (prefersReducedMotion()) {
        setProgress(TRICKLE_CEILING);
        return;
      }
      setProgress(0.08);
      trickleTimer.current = setInterval(() => {
        setProgress((current) =>
          current >= TRICKLE_CEILING
            ? current
            : Math.min(TRICKLE_CEILING, current + (TRICKLE_CEILING - current) * 0.18)
        );
      }, TRICKLE_MS);
    }, APPEAR_AFTER_MS);
    giveUpTimer.current = setTimeout(() => {
      clearTimers();
      setPhase("idle");
    }, GIVE_UP_AFTER_MS);
  }, [clearTimers]);

  const finish = useCallback(() => {
    clearTimeout(appearTimer.current);
    clearTimeout(giveUpTimer.current);
    clearInterval(trickleTimer.current);

    setPhase((current) => {
      // Nothing was showing: a fast navigation, and the whole point of the
      // 120 ms delay is that it leaves no trace.
      if (current !== "loading") return current;

      setProgress(1);
      finishTimer.current = setTimeout(() => setPhase("fading"), FINISH_MS);
      resetTimer.current = setTimeout(() => setPhase("idle"), FINISH_MS + 260);
      return "done";
    });
  }, []);

  // ── the click that starts it ───────────────────────────────────────────
  useEffect(() => {
    const onClick = (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) return;

      const target = anchor.getAttribute("target");
      if (target && target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        // Same URL: an in-page anchor or a no-op link. Nothing will happen.
        return;
      }

      // An in-page fragment on the current page is a scroll, not a navigation.
      if (url.pathname === window.location.pathname && url.hash && url.search === window.location.search) {
        return;
      }

      start();
    };

    const onPopState = () => {
      clearTimers();
      setPhase("idle");
      setProgress(0);
      lastUrl.current = window.location.pathname + window.location.search;
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, [start, clearTimers]);

  // ── the route change that ends it ──────────────────────────────────────
  const url = `${pathname}?${searchParams.toString()}`;
  useEffect(() => {
    if (lastUrl.current === null) {
      // First render: record the URL, but do not treat it as a navigation.
      lastUrl.current = url;
      return;
    }
    if (lastUrl.current === url) return;
    lastUrl.current = url;
    finish();
  }, [url, finish]);

  return (
    <div className="nav-progress" data-state={phase} aria-hidden="true">
      <div className="nav-progress-bar" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}
