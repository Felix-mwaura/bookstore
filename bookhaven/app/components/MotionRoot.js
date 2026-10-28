"use client";

import { MotionConfig } from "motion/react";

// One place where Motion is told what this shop's motion is.
//
// `reducedMotion="user"` is the important part: every transform and opacity
// animation below this provider is skipped for anyone whose system asks for
// less motion, without each component having to remember to check. The CSS
// animations already honour the same preference (see the reduced-motion block
// in globals.css); this is the same promise, made to the JavaScript layer.
//
// The default transition is the house curve, not a bounce: decelerate in,
// ~220ms, which is the slow end of the scale the storefront already uses.
export default function MotionRoot({ children }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionConfig>
  );
}
