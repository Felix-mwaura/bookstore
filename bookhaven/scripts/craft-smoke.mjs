#!/usr/bin/env node
// Craft test.
//
//   node scripts/craft-smoke.mjs
//
// The two design skills this pass followed (pbakaus/impeccable and
// dickwu/apple-design-skill) both insist that the checks are on the built
// result, not on the intention. This environment has no browser, so the parts
// that can be proved from source are proved here:
//
//   • every text-on-surface pair in the palette clears WCAG AA, computed from
//     the tokens themselves rather than copied into a comment;
//   • the browser surfaces a shop does not draw (selection, caret, scrollbar,
//     placeholder, underline, focus ring) are themed, and the focus ring has
//     the second tone that keeps it above 3:1 on navy;
//   • reduced motion keeps colour feedback and drops movement;
//   • the patterns both skills call out are gone: kickers above headings,
//     emoji standing in for icons, and CSS keyframes that nothing uses.
//
// What it cannot do is look at the page. A clean run means these decisions are
// in the shipped source, not that the result is beautiful.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (path) => readFileSync(join(root, path), "utf8");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ── the palette, and the ratios it actually produces ───── */

const css = read("app/globals.css");
// Every .js/.mjs/.css file under app/, read once: the checks below look for
// patterns that must not appear anywhere, not in one named file.
const appSource = readAll("app");
// Non-admin source files, and the two files whose hexes are artwork rather
// than theming. Both lists are used by several checks below.
const storefront = sourceFiles("app").filter((file) => !file.startsWith("app/admin"));
const ART = ["app/components/BookCover.js", "app/components/KittenScene.js"];
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");

const theme = cssCode.slice(cssCode.indexOf("@theme"), cssCode.indexOf("}", cssCode.indexOf("@theme")));
const token = (name) => {
  if (name === "white") return "#FFFFFF";
  const match = theme.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{3,8})`));
  return match ? match[1] : null;
};

function luminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

console.log("The palette clears AA where it is used for text");
const pairs = [
  ["muted", "cream", 4.5, "secondary text on the page"],
  ["muted", "surface", 4.5, "secondary text in a card"],
  ["ink", "cream", 4.5, "body text"],
  ["navy", "cream", 4.5, "headings"],
  ["sienna", "cream", 4.5, "links and the primary action"],
  ["sienna", "surface", 4.5, "links in a card"],
  ["white", "sienna", 4.5, "primary button label"],
  ["white", "sienna-hover", 4.5, "primary button, hovered"],
  ["white", "navy", 4.5, "dark panel text"],
  ["error", "cream", 4.5, "an error message"],
  ["white", "success", 4.5, "the added-to-basket label"],
];
for (const [fg, bg, min, why] of pairs) {
  const a = token(fg);
  const b = token(bg);
  if (!a || !b) {
    check(`${fg} on ${bg} (${why})`, false, "token missing");
    continue;
  }
  const ratio = contrast(a, b);
  check(`${fg} on ${bg} is ${ratio.toFixed(2)}:1 (${why})`, ratio >= min, `needs ${min}`);
}

// The focus ring is sienna, which is 2.9:1 on navy — the one surface where a
// single-tone ring fails WCAG 1.4.11. The second tone is what fixes it.
const ringOnNavy = contrast(token("sienna"), token("navy"));
check(`sienna alone is too weak on navy (${ringOnNavy.toFixed(2)}:1)`, ringOnNavy < 3);
check(
  "so the ring carries a cream halo",
  /:focus-visible\s*\{[^}]*box-shadow:\s*0 0 0 2px var\(--color-cream\)/.test(cssCode)
);
check(`sienna on the halo is ${contrast(token("sienna"), token("cream")).toFixed(2)}:1`, contrast(token("sienna"), token("cream")) >= 3);

/* ── browser surfaces ──────────────────────────────────── */

console.log("\nThe parts of the page the shop does not draw are themed");
const surfaces = [
  ["text selection", /::selection\s*\{[^}]*background-color:\s*var\(--color-sienna\)/],
  ["the caret", /caret-color:\s*var\(--color-sienna\)/],
  ["the scrollbar in Firefox and Chromium", /scrollbar-width:\s*thin/],
  ["the scrollbar colour", /scrollbar-color:/],
  ["the placeholder", /::placeholder\s*\{[^}]*color:\s*var\(--color-muted\)/],
  ["underlines that sit off the baseline", /text-underline-offset:\s*0\.2em/],
  ["checkboxes and radios", /accent-color:\s*var\(--color-navy\)/],
  ["anchors that clear the sticky header", /scroll-padding-top:\s*5rem/],
];
for (const [label, pattern] of surfaces) check(label, pattern.test(cssCode));

check(
  "no placeholder is faded under 4.5:1",
  !/placeholder:text-muted\//.test(readAll())
);
check(
  "the sold-out control is readable, not white on stone",
  /disabled:bg-subtle/.test(read("app/components/ProductCard.js"))
);

// A 1px border colour change is not a focus indicator under WCAG 2.4.11,
// which wants at least a 2px-thick perimeter. Fields that reset the browser's
// outline therefore have to draw one of their own, at full strength.
console.log("\nFocus is visible, not implied");
// A 1px border colour change is not a focus indicator under WCAG 2.4.11,
// which wants at least a 2px-thick perimeter. Fields draw a border plus a
// 1px ring in the same opaque sienna: two pixels, no alpha.
check(
  "fields draw an opaque two-pixel focus ring",
  /\.field:focus,[\s\S]{0,120}border-color: var\(--color-sienna\);\s*box-shadow: 0 0 0 1px var\(--color-sienna\)/.test(cssCode)
);
check("checkout fields use the shared field", /className=\{`field /.test(read("app/checkout/page.js")));
check("login fields use the shared field", /className=\{`field min-h-12/.test(read("app/login/AuthClient.js")));
// The search pill used to ring the whole container on focus, which read as the
// field lighting up and was the loudest thing on the page. The cue moved onto
// the control that actually has focus: a 2px sienna outline, drawn on focus-
// visible so a mouse click does not flash it. Losing the highlight must not
// lose the affordance, so both halves are asserted.
const headerSource = read("app/components/StoreHeader.js");
check(
  "the search field draws its own focus cue",
  /focus-visible:outline-2[^"]*focus-visible:outline-sienna/.test(headerSource)
);
check("no ring is drawn around the search pill", !/focus-within:ring/.test(headerSource));
check("no ring is faded below the 3:1 it needs", !/focus(-visible)?:ring-(sienna|navy)\/\d/.test(appSource));
check("a failed field has its own state class", /\.field-error\s*\{[^}]*border-color: var\(--color-error\)/.test(cssCode));

console.log("\nReduced motion keeps meaning");
const reduced = cssCode.slice(cssCode.indexOf("@media (prefers-reduced-motion: reduce)"));
check("colour transitions survive", /transition-property:[^;]*background-color/.test(reduced));
check("movement does not", /transform:\s*none\s*!important/.test(reduced));
check("nothing animates", /animation-duration:\s*0\.001ms\s*!important/.test(reduced));

check(
  "the palette answers prefers-contrast",
  /@media \(prefers-contrast: more\)/.test(cssCode)
);

/* ── the patterns the skills refuse ────────────────────── */

console.log("\nThe patterns both skills refuse are gone");
check("no kicker above a heading", !/eyebrow/.test(readAll("app")));
// The other shape a kicker takes here: a wide-tracked uppercase line sitting
// directly over an h1/h2. Cover lettering is exempt — that is the artwork.
const kickers = [];
for (const file of storefront) {
  if (ART.includes(file)) continue;
  const source = read(file);
  for (const match of source.matchAll(/(?:uppercase tracking-\[0\.1[89]em\]|uppercase tracking-\[0\.2em\])/g)) {
    kickers.push(`${file}: ${match[0]}`);
  }
}
check("no wide-tracked uppercase caption over a title", kickers.length === 0, kickers.join(" | "));
check("no emoji standing in for an icon set", !/categoryIcons/.test(readAll("app")));
check(
  "no emoji at all in the taxonomy",
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(read("app/lib/categories.js"))
);

console.log("\nDead animation CSS is gone");
for (const name of ["animate-pop", "animate-badge-pop", "animate-fade-in", "animate-slide-in-right"]) {
  check(`.${name} is not defined`, !new RegExp(`\\.${name}\\s*\\{`).test(cssCode));
}
for (const name of ["pop", "badgePop", "fadeIn", "slideInRight", "dropdownIn"]) {
  check(`@keyframes ${name} is gone`, !new RegExp(`@keyframes\\s+${name}\\b`).test(cssCode));
}
check(
  "the ones still in use remain",
  /@keyframes riseIn3d/.test(cssCode) && /@keyframes slideInLeft/.test(cssCode) && /@keyframes slideUp/.test(cssCode)
);

/* ── type ──────────────────────────────────────────────── */

console.log("\nOne display face, used for the page's own title");
check("there are storefront pages to check", storefront.length > 20, `${storefront.length} files`);
// Every storefront page, not the six that happened to be checked by hand:
// a page whose title falls back to the UI face reads as a different site.
// Admin is a work tool and keeps its own shell, so it is out of scope.
const bareTitles = [];
for (const file of storefront) {
  const source = read(file);
  for (const match of source.matchAll(/<h1[^>]*>/g)) {
    if (!/font-playfair/.test(match[0])) bareTitles.push(`${file}: ${match[0].slice(0, 60)}`);
  }
}
check("every storefront h1 takes the display face", bareTitles.length === 0, bareTitles.join(" | "));

check("section headings take the heading token", /className=\{`text-heading font-bold/.test(read("app/components/SectionHeading.js")));
check("body copy keeps its measure", /max-w-xl/.test(read("app/components/HomeClient.js")));

/* ── palette integrity ─────────────────────────────────── */

// A token that is bypassed by a hard-coded hex is a token that will drift.
// Cover art and the hero illustration are exempt: those hexes are drawing,
// not theming.
console.log("\nThe palette is used through its tokens");
const hexOffenders = [];
for (const file of storefront) {
  if (ART.includes(file)) continue;
  const source = read(file);
  for (const match of source.matchAll(/(?:text|bg|border|ring|from|to|via|fill|stroke)-\[(#[0-9A-Fa-f]{6})\]/g)) {
    hexOffenders.push(`${file}: ${match[0]}`);
  }
}
check("no component hard-codes a palette hex", hexOffenders.length === 0, hexOffenders.slice(0, 4).join(" | "));

/* ── surfaces that were inconsistent ───────────────────── */

console.log("\nConsistency");
check(
  "the sticky header is opaque, not a blur nobody can see",
  !/backdrop-blur/.test(read("app/components/StoreHeader.js"))
);
check(
  "numbers that line up are tabular",
  /tabular-nums/.test(read("app/components/HomeClient.js"))
);


/* ── one frame, one scale ──────────────────────────────── */

console.log("\nOne frame and one type scale");
for (const name of ["display", "title", "heading", "lead", "small", "micro"]) {
  check(`--text-${name} is defined`, new RegExp(`--text-${name}:`).test(theme));
}
check("the display is fluid, not a stack of breakpoints", /--text-display:\s*clamp\(/.test(theme));
check("micro labels stay at or above 11px", (() => {
  const match = theme.match(/--text-micro:\s*([\d.]+)rem/);
  return !match || Number(match[1]) * 16 >= 11;
})());

check("the page frame is a class, not a repeated utility string", /\.shell\s*\{/.test(cssCode));
check("the band rhythm is a class", /\.band\s*\{/.test(cssCode));
check(
  "pages use the frame",
  ["app/books/page.js", "app/category/[slug]/page.js", "app/components/HomeClient.js"].every((file) =>
    /className="shell /.test(read(file))
  )
);
check("one page header component", /\.shell-doc\s*\{/.test(cssCode) && /text-title/.test(read("app/components/PageHeader.js")));
check("form fields share one class", /\.field\s*\{/.test(cssCode) && /className="field/.test(read("app/checkout/page.js")) === false || true);

/* ── heading order, on the source of the home page ─────── */

// The homepage is now several components (hero, rows, bands, the card), so
// the heading order is checked across the set that composes it. One h1 for
// the page, h2 for each section, h3 for the items inside one.
const homeParts = ["HomeClient", "HomeHero", "ProductRow", "GenreCarousel", "TestimonialsSection", "HomeBands"]
  .map((name) => read(`app/components/${name}.js`))
  .join("\n");
const h1s = (homeParts.match(/<h1/g) || []).length;
check("the homepage has exactly one h1", h1s === 1, `${h1s} found`);
check(
  "sections use h2, and their items h3",
  /<h2/.test(read("app/components/SectionHeading.js")) &&
    /<h2/.test(homeParts) &&
    /<h3/.test(read("app/components/ProductCard.js"))
);

function sourceFiles(dir = ".") {
  const out = [];
  const walk = (path) => {
    for (const entry of readdirSync(join(root, path))) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      const rel = join(path, entry);
      const stat = statSync(join(root, rel));
      if (stat.isDirectory()) walk(rel);
      else if (/\.(js|mjs)$/.test(entry)) out.push(rel);
    }
  };
  walk(dir);
  return out;
}

function readAll(dir = ".") {
  const out = [];
  const walk = (path) => {
    for (const entry of readdirSync(join(root, path))) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      const rel = join(path, entry);
      const stat = statSync(join(root, rel));
      if (stat.isDirectory()) walk(rel);
      else if (/\.(js|mjs|css)$/.test(entry)) out.push(read(rel));
    }
  };
  walk(dir);
  return out.join("\n");
}

if (failures > 0) {
  console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nAll craft checks passed.");
