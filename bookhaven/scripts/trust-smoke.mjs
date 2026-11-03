#!/usr/bin/env node
// Trust test — no invented business facts, and no two pages disagreeing.
//
//   node scripts/trust-smoke.mjs
//
// Three failures this pass was written for:
//
//   1. The site published four contact details nobody had confirmed —
//      hello@bookhaven.co.ke, +254 712 345 678, "The Junction Mall, Nairobi",
//      "Mon–Sat: 9am–7pm". They were exported as defaults from
//      app/lib/site.js, so the footer, the homepage and the error page all
//      stated them as fact. A customer could travel to an address that does
//      not exist. The defaults are gone; an unset value is `null` and every
//      consumer says the details are not published yet.
//
//   2. /terms and /privacy promised an email that cannot arrive: the
//      send-email function has no verified sending domain, so the provider
//      only accepts the account owner's own address. The copy is now driven
//      by ORDER_EMAILS_ENABLED, and "we email you" is only printed when it is
//      on.
//
//   3. The sitemap listed eight category slugs from a literal array while the
//      nav, the filters and the admin read the `genres` table. A genre an
//      admin created was invisible to crawlers; one they deleted was
//      advertised as a 404. Both now come from getGenres().
//
// The checks below are split the same way the risk is: source-level checks
// that need no server, and HTTP checks that only run when SMOKE_BASE is set
// (they are skipped, loudly, otherwise).

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

let failures = 0;
let skipped = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
function skip(label) {
  skipped += 1;
  console.log(`skip ${label}`);
}

// The exact strings that used to be published. Kept in one place: any of them
// reappearing anywhere in app/ is the regression.
const PLACEHOLDERS = [
  "hello@bookhaven.co.ke",
  "254712345678",
  "Junction Mall",
  "Mon–Sat: 9am–7pm",
];

// `0712 345 678` is different: inside a form it is visibly a format hint
// ("Enter a Kenyan mobile number, e.g. …"), not a claim about the shop. It is
// allowed only in that role, which is what the check below enforces.
const FORMAT_HINT = "0712 345 678";

/* ── 1. the source no longer holds a fake value ─────────── */

function sourceFiles(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(entry)) found.push(path);
  }
  return found;
}

const appFiles = sourceFiles(join(root, "app"));
const offenders = [];
for (const file of appFiles) {
  const text = readFileSync(file, "utf8")
    // Comments are allowed to name the old values — that is how the next
    // reader learns why they are gone.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const value of PLACEHOLDERS) {
    if (text.includes(value)) offenders.push(`${file.replace(root + "/", "")} → ${value}`);
  }
}
check(
  "no placeholder contact value is code (comments may name them)",
  offenders.length === 0,
  offenders.join(", ")
);

const hintOffenders = [];
for (const file of appFiles) {
  const text = readFileSync(file, "utf8");
  if (!text.includes(FORMAT_HINT)) continue;
  const looksLikeAnExample =
    text.includes(`placeholder=\"${FORMAT_HINT}\"`) ||
    text.includes(`e.g. ${FORMAT_HINT}`) ||
    text.includes(`for example ${FORMAT_HINT}`);
  if (!looksLikeAnExample) hintOffenders.push(file.replace(root + "/", ""));
}
check(
  `every ${FORMAT_HINT} is a form hint, never a fact`,
  hintOffenders.length === 0,
  hintOffenders.join(", ")
);

const siteSource = readFileSync(join(root, "app/lib/site.js"), "utf8");
check("site.js still reads the contact values from environment", /NEXT_PUBLIC_STORE_EMAIL/.test(siteSource));
check("site.js has no fallback string for the email", !/EMAIL\s*\|\|\s*"/.test(siteSource));

/* ── 2. an unconfigured shop renders nulls, not guesses ── */

const probe = `
  const m = await import(${JSON.stringify(join(root, "app/lib/site.js"))});
  const c = m.STORE_CONTACT;
  console.log(JSON.stringify({
    email: c.email, phone: c.phone, phoneHref: c.phoneHref,
    location: c.location, hours: c.hours,
    reachable: c.reachable, usingPlaceholders: c.usingPlaceholders,
  }));
`;
const probeEnv = { ...process.env };
for (const key of Object.keys(probeEnv)) {
  if (key.startsWith("NEXT_PUBLIC_STORE_")) delete probeEnv[key];
}
probeEnv.NEXT_PUBLIC_SITE_URL = "https://trust-test.example";

let unconfigured = null;
try {
  const out = execFileSync(process.execPath, ["--input-type=module", "--no-warnings", "-e", probe], {
    env: probeEnv,
    encoding: "utf8",
  });
  unconfigured = JSON.parse(out.trim().split("\n").pop());
} catch (error) {
  check("site.js can be imported with no contact configured", false, String(error?.message || error));
}

if (unconfigured) {
  check("unconfigured email is null", unconfigured.email === null);
  check("unconfigured phone is null", unconfigured.phone === null);
  check("unconfigured phoneHref is null", unconfigured.phoneHref === null);
  check("unconfigured location is null", unconfigured.location === null);
  check("unconfigured hours is null", unconfigured.hours === null);
  check("unconfigured shop is not reachable", unconfigured.reachable === false);
  check("usingPlaceholders stays true while nothing is set", unconfigured.usingPlaceholders === true);
}

// And the opposite: configured values come through, so the feature is not
// simply switched off for everyone.
try {
  const out = execFileSync(process.execPath, ["--input-type=module", "--no-warnings", "-e", probe], {
    env: {
      ...probeEnv,
      NEXT_PUBLIC_STORE_EMAIL: "orders@example.test",
      NEXT_PUBLIC_STORE_PHONE: "+254 700 000 000",
      NEXT_PUBLIC_STORE_PHONE_E164: "+254700000000",
    },
    encoding: "utf8",
  });
  const configured = JSON.parse(out.trim().split("\n").pop());
  check("a configured email is published", configured.email === "orders@example.test");
  check("a configured phone becomes a tel: link", configured.phoneHref === "tel:+254700000000");
  check("configured contact counts as reachable", configured.reachable === true);
  check("usingPlaceholders clears once contact is set", configured.usingPlaceholders === false);
} catch (error) {
  check("site.js can be imported with contact configured", false, String(error?.message || error));
}

/* ── 3. the rendered pages agree with each other ────────── */

const base = (process.env.SMOKE_BASE || "").replace(/\/+$/, "");
if (!base) {
  skip("rendered-page checks (set SMOKE_BASE=http://127.0.0.1:3100 to run them)");
} else {
  async function body(path) {
    const response = await fetch(`${base}${path}`, { redirect: "follow" });
    return { status: response.status, text: await response.text() };
  }

  const pages = ["/", "/about", "/help", "/privacy", "/terms"];
  for (const path of pages) {
    const { status, text } = await body(path);
    check(`${path} answers 200`, status === 200, String(status));
    const leaked = PLACEHOLDERS.filter((value) => text.includes(value));
    check(`${path} publishes no unverified contact value`, leaked.length === 0, leaked.join(", "));
  }

  const home = await body("/");
  check(
    "the homepage says the contact details are not published",
    home.text.includes("Contact details are not published yet")
  );
  check(
    "the homepage does not promise nationwide delivery in the repo's own words",
    !/delivered nationwide|deliver countrywide|anywhere in Kenya/i.test(home.text)
  );
  check(
    "the announcement list does not take addresses without a way off it",
    !/id="newsletter-email"/.test(home.text) || Boolean(process.env.NEXT_PUBLIC_STORE_EMAIL)
  );

  // Order email: the claim and the capability must agree. The environment
  // that serves these pages decides which branch is true, and the check reads
  // the same flag the pages read.
  const emailsOn = /^(1|true|on|yes)$/i.test((process.env.NEXT_PUBLIC_ORDER_EMAILS || "").trim());
  const terms = await body("/terms");
  const privacy = await body("/privacy");
  if (emailsOn) {
    check("/terms promises the email the shop can actually send", /receive it by email|send it to the email address/.test(terms.text));
    check("/privacy describes order emails as sent", /You get an email when an order is placed/.test(privacy.text));
  } else {
    check("/terms does not promise an order email", !/receive it by email/.test(terms.text));
    check("/terms says no email copy is sent", /We do not send email copies yet/.test(terms.text));
    check("/privacy does not promise an order email", !/You get an email when an order is placed/.test(privacy.text));
    check("/privacy says no email copy is sent", /does not send email copies of an order yet/.test(privacy.text));
  }
  check("a password reset is never described as dependent on an order email", /password-reset link is sent by the account system/.test(privacy.text));

  const sitemap = await body("/sitemap.xml");
  check("the sitemap answers 200", sitemap.status === 200, String(sitemap.status));
  const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const sitemapCategories = new Set(
    locs.map((loc) => (loc.match(/\/category\/([^/]+)$/) || [])[1]).filter(Boolean)
  );
  check("the sitemap lists at least one category", sitemapCategories.size > 0, String(sitemapCategories.size));
  check("the sitemap has no duplicate URL", new Set(locs).size === locs.length, `${locs.length} locs`);

  // Every category the shop links to must be in the sitemap. This is the
  // exact shape of the old bug: the homepage served a genre the sitemap's
  // literal array had never heard of.
  const linkedCategories = new Set(
    [...home.text.matchAll(/href="\/category\/([^"/?#]+)"/g)].map((match) => match[1])
  );
  const missing = [...linkedCategories].filter((slug) => !sitemapCategories.has(slug));
  check(
    "every category the homepage links to is in the sitemap",
    missing.length === 0,
    missing.join(", ")
  );
  // A page cannot be hidden from search by robots.txt alone: a disallowed URL
  // can still be listed, and a URL pasted into a browser is fetched without
  // reading robots.txt at all. The header is what actually keeps a basket or
  // an account out of an index.
  for (const path of ["/checkout", "/account", "/admin", "/login", "/orders/1"]) {
    const response = await fetch(`${base}${path}`, { redirect: "manual" });
    const tag = response.headers.get("x-robots-tag") || "";
    check(`${path} is served noindex`, /noindex/.test(tag), tag || "no header");
  }

  check(
    "the sitemap's category URLs all answer",
    (await Promise.all(
      [...sitemapCategories].map(async (slug) => (await body(`/category/${slug}`)).status)
    )).every((status) => status === 200)
  );
}

/* ── result ─────────────────────────────────────────────── */

if (failures) {
  console.error(`\ntrust test FAILED — ${failures} problem(s)${skipped ? `, ${skipped} skipped` : ""}`);
  process.exit(1);
}
console.log(`\ntrust test passed — no invented contact details, one genre list${skipped ? ` (${skipped} skipped)` : ""}`);
