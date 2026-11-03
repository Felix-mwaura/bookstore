"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";

/**
 * A two-pixel sienna rail showing how far through a long document you are —
 * adapted from Magic UI's `scroll-progress`
 * (https://github.com/magicuidesign/magicui, MIT).
 *
 * Differences from the original that matter here:
 *
 * - It is sienna, single-colour. The original ships a three-stop pastel
 *   gradient, and a gradient is the one thing this design language refuses.
 * - It is installed only on pages that are actually long-form (the policy
 *   pages and a book's detail page). A progress rail over a shop grid tells
 *   you nothing you cannot see.
 * - Under `prefers-reduced-motion` it renders nothing at all. A spring-driven
 *   bar is motion; a static bar would just be a second scrollbar.
 *
 * It is aria-hidden: it duplicates information the scrollbar already exposes,
 * and it must never be a tab stop.
 */
export default function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-sienna"
    />
  );
}
