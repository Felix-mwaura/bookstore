#!/usr/bin/env node
// JSON-LD escaping test.
//
//   node scripts/security-jsonld-smoke.mjs
//
// Structured data is the one place this app writes raw HTML: the object is
// serialised and injected with dangerouslySetInnerHTML. If a book title (which
// an admin can type, and which is otherwise rendered safely by React) contains
// "</script>", the HTML parser ends the JSON-LD block early and everything
// after it becomes markup. serializeJsonLd() escapes the characters that can
// do that, inside JSON string syntax, so the parsed value is unchanged.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { serializeJsonLd, jsonLdProps } from "../app/lib/json-ld.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..", "app");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`ok   ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

console.log("Script-breaking payloads are neutralised");
const attacks = [
  "</script><script>alert(1)</script>",
  "</SCRIPT ><img src=x onerror=alert(1)>",
  "</script",
  "<!--<script>",
  "a & b < c > d",
  "line\u2028separator\u2029here",
];

for (const title of attacks) {
  const html = serializeJsonLd({ "@type": "Book", name: title });
  check(`${JSON.stringify(title).slice(0, 40)}: no raw "<"`, !html.includes("<"), html.slice(0, 120));
  check(`${JSON.stringify(title).slice(0, 40)}: no raw ">"`, !html.includes(">"));
  check(`${JSON.stringify(title).slice(0, 40)}: no raw U+2028/2029`, !/[\u2028\u2029]/.test(html));
  // Escaping happens inside JSON string syntax, so the value must survive a
  // parse intact.
  let parsed;
  try {
    parsed = JSON.parse(html);
  } catch (error) {
    check(`${JSON.stringify(title).slice(0, 40)}: still valid JSON`, false, error.message);
    continue;
  }
  check(`${JSON.stringify(title).slice(0, 40)}: round-trips unchanged`, parsed.name === title);
}

console.log("\nNormal data is untouched");
const book = {
  "@context": "https://schema.org",
  "@type": "Book",
  name: "Deep Work",
  author: { "@type": "Person", name: "Cal Newport" },
  offers: { "@type": "Offer", price: 1520, priceCurrency: "KES" },
};
const normal = serializeJsonLd(book);
check("valid JSON", JSON.parse(normal)["@type"] === "Book");
check("quotes/numbers intact", normal.includes('"price":1520'));
check("no escapes added to plain text", normal.includes('"name":"Deep Work"'));
check("jsonLdProps type", jsonLdProps(book).type === "application/ld+json");
check("jsonLdProps shape", typeof jsonLdProps(book).dangerouslySetInnerHTML.__html === "string");

console.log("\nEvery JSON-LD script goes through the helper");
for (const file of ["layout.js", join("books", "[slug]", "page.js")]) {
  const source = readFileSync(join(app, file), "utf8");
  check(`${file}: uses jsonLdProps`, source.includes("jsonLdProps("));
  check(
    `${file}: no raw JSON.stringify inside dangerouslySetInnerHTML`,
    !/dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/.test(source)
  );
  check(`${file}: no literal application/ld+json script`, !source.includes('type="application/ld+json"'));
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll JSON-LD cases passed");
