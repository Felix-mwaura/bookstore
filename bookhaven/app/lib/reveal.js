// Fade a block up the first time it scrolls into view.
//
// The rules that make this safe rather than decorative:
//
//   • Nothing is hidden in the HTML. The markup ships without the
//     attribute, so a crawler, a browser with JavaScript off and a reader
//     whose script failed all get the section at full opacity. Only this
//     module can add `data-reveal="armed"`, and the stylesheet only hides
//     that state.
//   • Anything already on screen is left alone. Arming the hero would delay
//     the largest paint and, on a slow connection, show a flash of
//     half-faded text. Elements are armed only if they start below the
//     viewport, so a reveal can never be the thing someone waits for.
//   • One shot. Once a block has arrived it is unobserved and the attribute
//     is removed, which also releases anything the stylesheet was holding.
//   • `prefers-reduced-motion` is checked before anything is armed, so the
//     page is simply static for anyone who asked for that.
//
// Every collaborator is passed in rather than reached for, so the behaviour
// above can be tested without a browser (see scripts/motion-smoke.mjs).

/** How much of the viewport an element must start below to be armed. */
const FOLD = 0.92;

/**
 * @param {object} [options]
 * @param {Document} [options.doc]
 * @param {Window} [options.win]
 * @returns {() => void} cleanup
 */
export function armRevealOnScroll({ doc, win } = {}) {
  const document_ = doc || globalThis.document;
  const window_ = win || globalThis.window;
  const noop = () => {};

  if (!document_ || !window_) return noop;

  const Observer = window_.IntersectionObserver;
  if (typeof Observer !== "function") return noop;

  const reduced = window_.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (reduced?.matches) return noop;

  const targets = Array.from(document_.querySelectorAll?.("[data-reveal]") || []);
  if (targets.length === 0) return noop;

  const timers = new Set();

  const observer = new Observer(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const node = entry.target;

        observer.unobserve(node);
        node.setAttribute("data-reveal", "in");

        // Back to the plain, unstyled state once it has landed: the element
        // never changes again, so the attribute stops meaning anything.
        const settle = () => node.removeAttribute("data-reveal");
        node.addEventListener?.("transitionend", settle, { once: true });

        // `transitionend` never fires if no value actually changed (a
        // re-render mid-animation, a tab restored from the back/forward
        // cache), and a stuck `armed` attribute would leave the block
        // invisible. The timer is the guarantee that it cannot.
        const timer = window_.setTimeout
          ? window_.setTimeout(() => {
              timers.delete(timer);
              settle();
            }, 1400)
          : null;
        if (timer) {
          if (typeof timer === "object" && typeof timer.unref === "function") timer.unref();
          timers.add(timer);
        }
      }
    },
    // Start a little before the block is fully in view, and finish well
    // inside the viewport, so the motion is over before anyone reads it.
    { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
  );

  for (const node of targets) {
    const { top } = node.getBoundingClientRect();
    if (top < window_.innerHeight * FOLD) continue;
    node.setAttribute("data-reveal", "armed");
    observer.observe(node);
  }

  return () => {
    observer.disconnect?.();
    for (const timer of timers) window_.clearTimeout?.(timer);
    timers.clear();
    // Leave nothing armed behind for the next mount to inherit.
    for (const node of targets) {
      if (node.getAttribute("data-reveal") === "armed") node.removeAttribute("data-reveal");
    }
  };
}
