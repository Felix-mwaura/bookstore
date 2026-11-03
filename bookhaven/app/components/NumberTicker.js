"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";

/**
 * A number that counts up to its value the first time it scrolls into view —
 * adapted from Magic UI's `number-ticker`
 * (https://github.com/magicuidesign/magicui, MIT).
 *
 * Two deliberate differences from the original:
 *
 * 1. It animates with one `requestAnimationFrame` loop and React state rather
 *    than a Motion spring writing `textContent` directly. The shop's house
 *    curve is a decelerate, not a spring, and letting React own the text means
 *    a re-render can never desynchronise the number from the DOM.
 * 2. Anyone whose system asks for less motion gets the final figure on first
 *    paint. A count-up is decoration; the figure is the content, and content
 *    must never depend on an animation having run.
 *
 * It renders the `<dd>` half of a description pair; the caller supplies the
 * `<dt>`. Digits are tabular, so the number does not reflow while it counts.
 */
export default function NumberTicker({ value, label, duration = 900, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const target = Number.isFinite(Number(value)) ? Number(value) : 0;
  const [counted, setCounted] = useState(0);

  // No state is set before the first frame: the first tick runs inside a
  // rAF callback, which is what the reduced-motion path relies on too. When
  // motion is off the figure renders at full value straight away.
  const shown = reduce ? target : counted;

  useEffect(() => {
    if (reduce || !inView) return;

    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic: settle, don't stop dead
      setCounted(Math.round(eased * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduce, target, duration]);

  return (
    <dd ref={ref} className={className}>
      {/* Whatever frame the animation is on, the figure a screen reader
          announces is the real one. */}
      <span aria-hidden="true">{shown.toLocaleString("en-KE")}</span>
      <span className="sr-only">{target.toLocaleString("en-KE")}</span>
      {label ? <span className="sr-only"> {label}</span> : null}
    </dd>
  );
}
