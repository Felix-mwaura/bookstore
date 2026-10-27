#!/usr/bin/env node
// Newsletter endpoint test, against a running server.
//
//   npm run build && npm start -- -p 3125
//   node scripts/security-newsletter-smoke.mjs http://127.0.0.1:3125
//
// This one *writes*: a sign-up is the only way to see what a duplicate does.
// It therefore refuses any host that is not local unless SMOKE_ALLOW_WRITES=1,
// because pointing it at production would add rows to the real list.
//
// What it pins down:
//   • an invalid address is refused with a sentence, not a database message;
//   • the honeypot answers like success, so a bot learns nothing;
//   • a throwaway domain is refused;
//   • a repeat sign-up is a success, so the endpoint never reveals whether an
//     address is already on the list;
//   • no response body quotes a table, a constraint or a Postgres error.

const base = (process.argv[2] || process.env.SMOKE_BASE || "http://127.0.0.1:3000").replace(/\/+$/, "");
const local = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(base);

if (!local && process.env.SMOKE_ALLOW_WRITES !== "1") {
  console.error(`Refusing to write to ${base}. Pass SMOKE_ALLOW_WRITES=1 if that is really intended.`);
  process.exit(2);
}

let failures = 0;
let skipped = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}
function skip(label, why) {
  skipped += 1;
  console.log(`skip ${label} (${why})`);
}

const LEAKY = /duplicate key|violates|constraint|row-level security|relation "|newsletter_subscribers|SQL|postgres|supabase/i;

async function signUp(body, headers = {}) {
  const res = await fetch(`${base}/api/newsletter`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Left null; the assertions below will point at the raw body.
  }
  return { status: res.status, json, text };
}

const marker = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

console.log("Validation");
const invalid = await signUp({ email: "not-an-address" });
check("invalid address is 400", invalid.status === 400);
check("invalid address gets a sentence", invalid.json?.error === "Please enter a valid email address.");
check("no database detail in the reply", !LEAKY.test(invalid.text), invalid.text);

const tooLong = await signUp({ email: `${"a".repeat(250)}@example.com` });
check("over-long address is 400", tooLong.status === 400);
check("over-long address gets a sentence", typeof tooLong.json?.error === "string");
check("no database detail", !LEAKY.test(tooLong.text), tooLong.text);

console.log("\nHoneypot and throwaway inboxes");
const trapped = await signUp({ email: `bot-${marker}@example.com`, company: "Spam Ltd" });
check("filled trap answers 200", trapped.status === 200);
check("filled trap answers like success", trapped.json?.ok === true && !trapped.json?.error);
check("filled trap says nothing else", !LEAKY.test(trapped.text), trapped.text);

const disposable = await signUp({ email: `${marker}@mailinator.com` });
check("throwaway domain is 400", disposable.status === 400);
check("throwaway domain is named plainly", /temporary inbox/i.test(disposable.json?.error || ""));
check("no database detail", !LEAKY.test(disposable.text), disposable.text);

console.log("\nA real address, twice");
const address = `${marker}@example.com`;
const first = await signUp({ email: address });
if (first.status === 503) {
  skip("sign-up is stored", "the server has no service-role key");
} else {
  check("first sign-up is 200", first.status === 200);
  check("first sign-up reports success", first.json?.ok === true);
  check("first sign-up keeps the address quiet", !first.text.includes(address), first.text);

  // Uppercase and padding must resolve to the same row, so this is the
  // duplicate path too.
  const duplicate = await signUp({ email: `  ${address.toUpperCase()}  ` });
  check("repeat sign-up is 200, not an error", duplicate.status === 200);
  check("repeat sign-up reports success", duplicate.json?.ok === true);
  check("repeat sign-up reveals nothing", !duplicate.text.includes(address) && !LEAKY.test(duplicate.text), duplicate.text);
}

console.log("\nBodies are capped");
const huge = await fetch(`${base}/api/newsletter`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: address, padding: "x".repeat(9 * 1024) }),
});
const hugeBody = await huge.text();
check("9 KB body is 413", huge.status === 413, `got ${huge.status}`);
check("413 is a sentence", JSON.parse(hugeBody).error === "That request is too large.");
check("no database detail", !LEAKY.test(hugeBody), hugeBody);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nAll newsletter cases passed${skipped ? ` (${skipped} skipped)` : ""}`);
