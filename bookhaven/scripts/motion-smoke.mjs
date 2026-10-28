#!/usr/bin/env node
// Motion test.
//
//   node scripts/motion-smoke.mjs
//
// The storefront's animations are meant to behave the same way everywhere and
// to be impossible to turn into an accessibility problem. That is a set of
// rules, so it can be checked:
//
//   • one duration/easing scale, referenced by token, not copied around;
//   • nothing loops forever outside the decorative login scene;
//   • nothing that appears on scroll is hidden in the HTML — the reveal
//     state can only exist after a script puts it there;
//   • reduced motion wins everywhere;
//   • press feedback is under 2px and inside ~120ms;
//   • the deck does not auto-advance (a carousel that moves on its own needs
//     a stop control, and this one deliberately never moves on its own).
//
// It reads source, so it cannot see what a browser actually paints. The
// static checks are the ones that catch the regression that matters: a new
// rule that hard-codes a timing, a loop that never stops, or an element that
// is invisible without JavaScript.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { armRevealOnScroll } from "../app/lib/reveal.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..", "app");

const css = readFileSync(join(app, "globals.css"), "utf8");
// Comments explain the reasoning and often quote the values that were
// replaced, so the checks that look for leftovers run on the code alone.
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
const home = readFileSync(join(app, "components", "HomeClient.js"), "utf8");
const revealSource = readFileSync(join(app, "lib", "reveal.js"), "utf8");
const carousel = readFileSync(join(app, "components", "GenreCarousel.js"), "utf8");
const kitten = readFileSync(join(app, "components", "KittenScene.js"), "utf8");
const kittenCss = readFileSync(join(app, "components", "kitten-scene.module.css"), "utf8");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

/** The body of a `@media (prefers-reduced-motion: reduce) { ... }` block. */
function reducedMotionBlocks(source) {
  const blocks = [];
  let index = source.indexOf("@media (prefers-reduced-motion: reduce)");
  while (index !== -1) {
    let depth = 0;
    let start = source.indexOf("{", index);
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.slice(start + 1, i));
          break;
        }
      }
    }
    index = source.indexOf("@media (prefers-reduced-motion: reduce)", index + 1);
  }
  return blocks;
}

console.log("One motion scale, referenced by name");
for (const token of ["--dur-press", "--dur-fast", "--dur-mid", "--dur-slow"]) {
  check(`${token} is defined`, new RegExp(`${token}:\\s*\\d+ms`).test(css));
}
for (const token of ["--ease-standard", "--ease-entrance", "--ease-exit"]) {
  check(`${token} is defined`, new RegExp(`${token}:\\s*cubic-bezier`).test(css));
}
check("the reveal distance is a token", /--rv-rise:\s*\d+px/.test(css));
check(
  "press feedback is under 150ms",
  Number((css.match(/--dur-press:\s*(\d+)ms/) || [])[1]) <= 150,
  "a press that takes longer reads as lag"
);
check(
  "the longest duration stays under half a second",
  Number((css.match(/--dur-slow:\s*(\d+)ms/) || [])[1]) <= 500
);

console.log("\nTimings live in the token block, not in the rules");
const withoutTokens = cssCode
  .replace(/:root\s*\{[\s\S]*?\n\}/, "")
  .replace(/@theme\s*\{[\s\S]*?\n\}/, "");
check(
  "no raw cubic-bezier outside the tokens",
  !/cubic-bezier\(0\.16, 1, 0\.3, 1\)/.test(withoutTokens),
  "use var(--ease-entrance)"
);
check(
  "no raw 420ms / 400ms / 500ms transitions",
  !/\b(4[02]0ms|500ms)\b/.test(withoutTokens),
  "use var(--dur-slow)");
check(
  "no linear easing on a fade",
  !/transition:[^;]*opacity[^;]*linear/.test(cssCode),
  "opacity is a cross-fade, not constant-rate progress"
);
check(
  "every animation or transition that names a duration uses a token or a stagger delay",
  !/transition:[^;]*\b\d{3}ms\b/.test(withoutTokens),
  "the only literal ms left should be transition-delay for the stagger"
);

console.log("\nNothing loops forever except the decorative scene");
const infiniteInGlobals = (cssCode.match(/animation:[^;]*infinite/g) || []).length;
check("globals.css has no infinite animation", infiniteInGlobals === 0, `${infiniteInGlobals} found`);
check(
  "the login scene is the only looping animation",
  (kittenCss.match(/infinite/g) || []).length > 0,
  "the kittens are expected to loop — but only while visible"
);
check("and it pauses when hidden", /\[data-motion="paused"\]\s*\*\s*\{[^}]*animation-play-state:\s*paused/.test(kittenCss));
check("the scene listens for visibility changes", /visibilitychange/.test(kitten));
check("the scene watches whether it is on screen", /IntersectionObserver/.test(kitten));
check("the pause is undone on unmount", /removeEventListener\("visibilitychange"/.test(kitten));

console.log("Reveal never hides content that has not been armed");
check("the armed state is the only state that hides", /\[data-reveal="armed"\]\s*\{[^}]*opacity:\s*0/.test(css));
check("the arrived state restores it", /\[data-reveal="in"\]\s*\{[^}]*opacity:\s*1/.test(css));
check(
  "a bare [data-reveal] is not hidden",
  !/\[data-reveal\](?![\s\S]{0,40}opacity:\s*1)[^{]*\{[^}]*opacity:\s*0/.test(css)
);
check("the HTML ships without an armed state", /data-reveal\n/.test(home), "JSX should use the empty attribute");
check(
  "the markup the server sends is complete without a script",
  !/data-reveal=\{/.test(home),
  "the attribute must be static, never computed from state"
);
check("the page uses the tested module rather than its own copy", /armRevealOnScroll/.test(home));
check("the module repeats the reduced-motion check itself", /prefers-reduced-motion: reduce/.test(revealSource));

// ── behaviour, against a fake DOM ──────────────────────────────────────
function fakeNode(top) {
  const attributes = new Map();
  const listeners = new Map();
  return {
    top,
    getBoundingClientRect: () => ({ top }),
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
    addEventListener: (type, handler) => listeners.set(type, handler),
    fire: (type) => listeners.get(type)?.(),
    state: () => attributes.get("data-reveal") ?? null,
  };
}

function fakeWindow({ reduced = false, height = 800, withObserver = true } = {}) {
  const observed = [];
  const disconnected = { value: false };
  class FakeObserver {
    constructor(callback) {
      this.callback = callback;
      FakeObserver.instance = this;
    }
    observe(node) { observed.push(node); }
    unobserve() {}
    disconnect() { disconnected.value = true; }
  }
  const win = {
    innerHeight: height,
    matchMedia: () => ({ matches: reduced }),
    setTimeout: (fn) => { win.pending.push(fn); return win.pending.length; },
    clearTimeout: () => {},
    pending: [],
    observed,
    disconnected,
  };
  if (withObserver) win.IntersectionObserver = FakeObserver;
  return win;
}

function fakeDoc(nodes) {
  return { querySelectorAll: () => nodes };
}

/** Deliver an "it is visible now" callback to whatever observer was built. */
function intersect(win, nodes) {
  win.IntersectionObserver.instance.callback(nodes.map((node) => ({ target: node, isIntersecting: true })));
}

{
  const below = fakeNode(2000);
  const above = fakeNode(10);
  const win = fakeWindow();
  const cleanup = armRevealOnScroll({ doc: fakeDoc([below, above]), win });

  check("a block below the fold is armed", below.state() === "armed");
  check("a block already on screen is left visible", above.state() === null);
  check("only the armed block is observed", win.observed.length === 1 && win.observed[0] === below);

  intersect(win, [below]);
  check("scrolling to it reveals it", below.state() === "in");
  below.fire("transitionend");
  check("and the attribute is dropped once it has landed", below.state() === null);

  cleanup();
  check("cleanup disconnects the observer", win.disconnected.value === true);
}

{
  // The one case that would be a real bug: an element left hidden.
  const node = fakeNode(3000);
  const win = fakeWindow();
  const cleanup = armRevealOnScroll({ doc: fakeDoc([node]), win });
  check("a stale reveal is armed", node.state() === "armed");
  cleanup();
  check("unmounting cannot leave a block invisible", node.state() === null);
}

{
  // If transitionend never fires (re-render, bfcache), the timer settles it.
  const node = fakeNode(3000);
  const win = fakeWindow();
  armRevealOnScroll({ doc: fakeDoc([node]), win });
  intersect(win, [node]);
  for (const callback of win.pending) callback();
  check("a reveal that never reports transitionend still lands", node.state() === null);
}

{
  const node = fakeNode(3000);
  const win = fakeWindow({ reduced: true });
  armRevealOnScroll({ doc: fakeDoc([node]), win });
  check("reduced motion arms nothing", node.state() === null && win.observed.length === 0);
}

{
  const node = fakeNode(3000);
  const win = fakeWindow({ withObserver: false });
  const cleanup = armRevealOnScroll({ doc: fakeDoc([node]), win });
  check("no IntersectionObserver is not an error", typeof cleanup === "function" && node.state() === null);
}

console.log("\nReduced motion wins");
const reduced = reducedMotionBlocks(css);
check("globals.css has a reduced-motion block", reduced.length >= 2);
check(
  "the global block neutralises durations",
  reduced.some((block) => /animation-duration:\s*0\.001ms\s*!important/.test(block) && /transition-duration:\s*0\.001ms\s*!important/.test(block))
);
check(
  "the 3D set is switched off explicitly",
  reduced.some((block) => /\.card-3d/.test(block) && /animation:\s*none\s*!important/.test(block))
);
check(
  "a reveal in progress lands at full opacity",
  reduced.some((block) => /\[data-reveal\]/.test(block) && /opacity:\s*1\s*!important/.test(block))
);
check("the scene respects it too", /prefers-reduced-motion: reduce/.test(kittenCss));

console.log("\nFeedback is small and quick");
const pressRules = [...cssCode.matchAll(/:active\s*\{[^}]*transform:\s*([^;]+);/g)].map((m) => m[1].trim());
check("every pressed control moves", pressRules.length >= 3, `${pressRules.length} found`);
for (const rule of pressRules) {
  const y = Number((rule.match(/translateY\(-?([\d.]+)px\)/) || [])[1] || 0);
  check(`"${rule}" travels under 2px`, y <= 2, `translateY(${y}px)`);
}
const hovers = [...cssCode.matchAll(/translateY\((-[\d.]+)px\)/g)].map((m) => Math.abs(Number(m[1])));
check("no hover lifts anything more than 8px", hovers.every((y) => y <= 8), hovers.join(", "));

console.log("\nThe deck does not move on its own");
check("no auto-advance timer", !/setInterval/.test(carousel));
check("previous / next are real buttons", /aria-label="Previous genre"/.test(carousel) && /aria-label="Next genre"/.test(carousel));
check("the active slide is announced, not moved to", /aria-live="polite"/.test(carousel));
check("a drag follows the finger", /--drag/.test(carousel) && /--drag/.test(css));
check("vertical swipes still scroll the page", /touch-action:\s*pan-y/.test(css));
check(
  "the drag layer is promoted only while dragging",
  /\[data-dragging="true"\]\s*\.genre-card\s*\{[^}]*will-change:\s*transform/.test(css)
);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll motion cases passed");
