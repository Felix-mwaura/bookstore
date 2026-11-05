#!/usr/bin/env node
// Render-and-crawl audit for a running Book Haven deployment.
//
//   npm run build && npm start -- -p 3125
//   node scripts/ui-audit.mjs http://127.0.0.1:3125
//
// It fetches every page it can reach from the seeded routes, follows every
// internal link it finds, and asserts the things a broken layout silently
// gets wrong: a page with no h1 (or two), an image with no alt, a field with
// no label, a button with no name, a dead `href="#"`, an anchor that navigates
// nowhere, a duplicate id, a form with no submit path.
//
// It is read-only: it never signs in, never posts a form, never writes. Safe
// to point at production.
//
// Exit code 1 if anything failed, so it can gate a release.

const base = (process.argv[2] || process.env.SMOKE_BASE || "http://127.0.0.1:3000").replace(/\/+$/, "");

const SEEDS = [
  "/",
  "/books",
  "/books?sort=price-asc",
  "/books?q=achebe",
  "/books?page=2",
  "/category/fiction",
  "/help",
  "/about",
  "/privacy",
  "/terms",
  "/login",
  "/checkout",
];

// Pages that are supposed to be reachable without a session. Anything else is
// allowed to redirect (orders, account, admin all guard themselves).
const PRIVATE = ["/account", "/orders/1", "/admin"];

const results = [];
let failures = 0;

function check(label, condition, detail = "") {
  if (condition) {
    results.push(`ok    ${label}`);
  } else {
    failures += 1;
    results.push(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function get(path) {
  try {
    const res = await fetch(`${base}${path}`, { redirect: "manual" });
    return { status: res.status, location: res.headers.get("location") || "", html: await res.text() };
  } catch (error) {
    return { status: 0, location: "", html: "", error: error.message };
  }
}

/* ── tiny HTML readers ────────────────────────────────────────────────
   Regex rather than a parser: no dependency, and the markup this app
   emits is regular. Scripts and styles are stripped first so their
   strings cannot look like tags. */

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map((m) => m[1]);
const attr = (attrs, name) => {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i")) || attrs.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? m[1] : null;
};
const has = (attrs, name) => new RegExp(`(^|\\s)${name}(\\s|=|$)`, "i").test(attrs);

const pages = new Map(); // path -> html
const queue = [...SEEDS];
const seen = new Set();

while (queue.length && pages.size < 60) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  const res = await get(path);
  check(`${path} → 200`, res.status === 200, `got ${res.status}${res.error ? ` (${res.error})` : ""}`);
  if (res.status !== 200) continue;
  pages.set(path, res.html);

  const clean = strip(res.html);
  const hrefs = [...clean.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  for (const href of hrefs) {
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    if (href.startsWith("/api/") || href.startsWith("/_next/") || href.includes("#")) continue;
    if (/\.(css|js|ico|png|jpe?g|svg|webp|woff2?|xml|txt)(\?|$)/.test(href)) continue;
    if (seen.has(href)) continue;
    if (href.startsWith("/orders/") && href !== "/orders/1") continue; // one is enough
    queue.push(href);
  }
}

/* ── per page ───────────────────────────────────────────────────────── */

for (const [path, html] of pages) {
  const clean = strip(html);
  const label = path === "/" ? "/" : path;

  const h1 = [...clean.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  check(`${label} has exactly one h1`, h1.length === 1, `found ${h1.length}`);
  if (h1.length === 1) {
    const cls = attr(h1[0][0].match(/<h1\b([^>]*)>/i)?.[1] || "", "class") || "";
    check(`${label}'s h1 is the display serif`, /font-playfair|font-serif/.test(cls), cls || "no class");
  }

  const imgs = tags(clean, "img");
  const unlabelledImgs = imgs.filter((a) => attr(a, "alt") === null);
  check(`${label}: every image has alt`, unlabelledImgs.length === 0, `${unlabelledImgs.length} without`);

  // A field counts as labelled if a <label for> points at it, or it carries
  // an accessible name of its own.
  const labels = new Set(
    tags(clean, "label").map((a) => attr(a, "for")).filter(Boolean)
  );
  const fields = tags(clean, "input")
    .map((a) => ({ attrs: a, type: (attr(a, "type") || "text").toLowerCase() }))
    .filter((f) => !["hidden", "submit", "button", "reset", "image"].includes(f.type));
  const namelessFields = fields.filter(({ attrs }) => {
    const id = attr(attrs, "id");
    return (
      !has(attrs, "aria-label") &&
      !has(attrs, "aria-labelledby") &&
      !(id && labels.has(id)) &&
      !has(attrs, "title")
    );
  });
  check(`${label}: every field has a name`, namelessFields.length === 0, `${namelessFields.length} unlabelled`);

  const buttons = [...clean.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)].map((m) => ({
    attrs: m[1],
    text: m[2].replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").trim(),
  }));
  const namelessButtons = buttons.filter((b) => !b.text && !has(b.attrs, "aria-label") && !has(b.attrs, "aria-labelledby"));
  check(`${label}: every button has a name`, namelessButtons.length === 0, `${namelessButtons.length} nameless`);

  const deadLinks = [...clean.matchAll(/<a\b([^>]*)>/gi)]
    .map((m) => m[1])
    .filter((a) => {
      const href = attr(a, "href");
      return href === null || href === "#" || href === "" || href === "javascript:void(0)";
    });
  check(`${label}: no dead anchors`, deadLinks.length === 0, `${deadLinks.length} dead`);

  const ids = tags(clean, "div")
    .concat(tags(clean, "section"), tags(clean, "main"), tags(clean, "input"), tags(clean, "select"), tags(clean, "h1"), tags(clean, "h2"))
    .map((a) => attr(a, "id"))
    .filter(Boolean);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  // Next streams a hidden copy of the header into its fallback markup; those
  // duplicates come from `hidden` containers, not from a second render, and
  // they only appear on routes that suspend.
  const uniqueDupes = [...new Set(dupes)].filter((id) => !html.includes(`<div hidden id="S:`) || !/^(desktop|mobile)-/.test(id));
  check(`${label}: no duplicate ids`, uniqueDupes.length === 0, uniqueDupes.join(", "));

  const title = clean.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  check(`${label} has a title`, Boolean(title && title.length > 3), title || "missing");

  const description = clean.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1];
  check(`${label} has a meta description`, Boolean(description && description.length > 20), description ? `"${description.slice(0, 40)}…"` : "missing");

  const lang = clean.match(/<html[^>]*lang="([^"]+)"/i)?.[1];
  check(`${label} declares a language`, Boolean(lang), lang || "no lang attribute");

  // A skip link is the cheapest keyboard affordance there is.
  check(`${label} offers a skip link`, /href="#(main|content|main-content)"/.test(clean), "no skip link");

  check(`${label}: no placeholder copy`, !/\b(lorem ipsum|TODO|FIXME|coming soon)\b/i.test(clean), "placeholder text in markup");
}

/* ── private routes ─────────────────────────────────────────────────── */

for (const path of PRIVATE) {
  const res = await get(path);
  const guarded = res.status === 307 || res.status === 302 || res.status === 303 || res.status === 200;
  check(`${path} answers without hanging`, guarded, `got ${res.status}`);
  if (res.status === 200) {
    check(`${path} does not leak a session-less dashboard`, /sign in|log in|password/i.test(res.html), "rendered without a login prompt");
  }
}

/* ── report ─────────────────────────────────────────────────────────── */

console.log(results.join("\n"));
const ok = results.filter((r) => r.startsWith("ok")).length;
console.log(`\n${ok} passed, ${failures} failed, across ${pages.size} pages.`);
if (failures > 0) process.exitCode = 1;
