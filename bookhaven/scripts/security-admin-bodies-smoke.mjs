#!/usr/bin/env node
// Admin request-body test.
//
//   node scripts/security-admin-bodies-smoke.mjs
//
// Two failures this pins down:
//
//   1. `await request.json()` on a body of "null" resolves to null, and the
//      next line (`body.title`) throws a TypeError — a 500 for what is plainly
//      a 400. Every admin mutating route now goes through readJsonObject().
//
//   2. Nothing capped the size or the shape of the strings an admin could
//      write. A 2 MB title lands in the storefront, in JSON-LD, in the admin
//      table and in every confirmation email. sanitize() now enforces per
//      column ceilings and rejects non-strings.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { readJsonObject, SMALL_BODY } from "../app/lib/request-guard.js";
import { sanitize, MAX_TEXT_LENGTH } from "../app/lib/book-admin.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..", "app");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

function jsonRequest(bodyText, { headers = {} } = {}) {
  return new Request("http://localhost/api/admin/test", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: bodyText,
  });
}

console.log("readJsonObject: malformed bodies are 400, not crashes");
const cases = [
  ["null literal", "null", 400],
  ["empty array", "[]", 400],
  ["bare string", '"hello"', 400],
  ["number", "42", 400],
  ["empty body", "", 400],
  ["truncated JSON", '{"title":', 400],
];
for (const [label, body, expected] of cases) {
  const result = await readJsonObject(jsonRequest(body));
  check(`${label} -> ${expected}`, !result.ok && result.status === expected, JSON.stringify(result));
}

console.log("\nreadJsonObject: valid payloads survive");
const good = await readJsonObject(jsonRequest('{"id":"abc","status":"Packed"}'));
check("object accepted", good.ok && good.body.status === "Packed");
check("unknown date fields not added", good.ok && !("created_at" in good.body));

console.log("\nreadJsonObject: size ceilings");
const actual = await readJsonObject(
  jsonRequest(JSON.stringify({ note: "x".repeat(SMALL_BODY) })),
  { maxBytes: SMALL_BODY }
);
check("body over cap -> 413", !actual.ok && actual.status === 413);
const under = await readJsonObject(jsonRequest('{"note":"short"}'), { maxBytes: SMALL_BODY });
check("body under cap accepted", under.ok && under.body.note === "short");

console.log("\nsanitize: mass assignment is dropped");
const assignment = sanitize(
  {
    title: "Deep Work",
    author: "Cal Newport",
    price: 1520,
    category: "Productivity",
    stock_quantity: 3,
    rating: 5,
    reviews: 999,
    stock: "In Stock",
    created_at: "2020-01-01",
  },
  { partial: false }
);
check("accepted", Boolean(assignment.data));
check("rating dropped", assignment.data && !("rating" in assignment.data));
check("reviews dropped", assignment.data && !("reviews" in assignment.data));
check("stock label dropped", assignment.data && !("stock" in assignment.data));
check("created_at dropped", assignment.data && !("created_at" in assignment.data));

console.log("\nsanitize: string ceilings");
for (const [field, max] of Object.entries(MAX_TEXT_LENGTH)) {
  const base = { title: "T", author: "A", price: 1, category: "C", stock_quantity: 1 };
  const payload = { ...base, [field]: "x".repeat(max + 1) };
  const result = sanitize(payload, { partial: true });
  check(`${field} > ${max} rejected`, Boolean(result.error), JSON.stringify(result));
}

console.log("\nsanitize: types and values");
check("numeric title rejected", Boolean(sanitize({ title: 123 }, { partial: true }).error));
check("description must be text", Boolean(sanitize({ description: { a: 1 } }, { partial: true }).error));
check("isbn must be text", Boolean(sanitize({ isbn: 978 }, { partial: true }).error));
check("negative price rejected", Boolean(sanitize({ price: -1 }, { partial: true }).error));
check("fractional stock rejected", Boolean(sanitize({ stock_quantity: 1.5 }, { partial: true }).error));
check(
  "external cover_url rejected",
  Boolean(sanitize({ cover_url: "https://evil.example/x.jpg" }, { partial: true }).error)
);
check(
  "empty title rejected",
  Boolean(sanitize({ title: "   " }, { partial: true }).error)
);
check("missing required field rejected", Boolean(sanitize({ title: "T" }, { partial: false }).error));

console.log("\nNo admin route parses a body by hand any more");
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith("route.js")) out.push(full);
  }
  return out;
}
const adminRoutes = walk(join(app, "api", "admin"));
check("found the admin routes", adminRoutes.length >= 13, `${adminRoutes.length} files`);
for (const file of adminRoutes) {
  const source = readFileSync(file, "utf8");
  const name = file.slice(app.length + 1);
  check(`${name}: no request.json()`, !source.includes("request.json("));
  check(`${name}: requireAdmin still first`, source.includes("requireAdmin(request)"));
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll admin body cases passed");
