#!/usr/bin/env node
// "Fail loudly" configuration test.
//
//   node scripts/security-config-smoke.mjs
//
// app/lib/supabase-config.js used to carry the real project URL and a real
// anon JWT as fallbacks, and app/lib/site.js carried the production hostname.
// A checkout built from a laptop without .env.local therefore talked to the
// live project instead of erroring — the kind of mistake that only surfaces
// when somebody wonders why a "test" order is in the real admin dashboard.
//
// Production now throws when configuration is missing; development still loads
// so pure unit tests can import modules that mention Supabase without making a
// request.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

function run(source, env) {
  try {
    const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", source], {
      cwd: root,
      env: { PATH: process.env.PATH, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout };
  } catch (error) {
    return { ok: false, stderr: String(error.stderr || error.message) };
  }
}

console.log("No production credentials are hard-coded any more");
const config = readFileSync(join(root, "app", "lib", "supabase-config.js"), "utf8");
const site = readFileSync(join(root, "app", "lib", "site.js"), "utf8");
const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");
const edge = readFileSync(join(root, "supabase", "functions", "send-email", "index.ts"), "utf8");

check("no JWT literal in supabase-config", !/eyJhbGciOi/.test(config));
check("no project URL literal in supabase-config", !/luniopceavtkljywukyi/.test(config));
check("no production host in site.js", !/bookstore-puce-sigma\.vercel\.app/.test(site));
check("no project URL literal in next.config.ts", !/luniopceavtkljywukyi/.test(nextConfig));
check("no production host in send-email", !/bookstore-puce-sigma\.vercel\.app/.test(edge));

console.log("\nProduction without configuration fails loudly");
const prod = run(
  'await import("./app/lib/supabase-config.js"); console.log("loaded");',
  { NODE_ENV: "production" }
);
check("supabase-config throws in production", !prod.ok && /NEXT_PUBLIC_SUPABASE_URL/.test(prod.stderr));

const prodConfigured = run(
  'await import("./app/lib/supabase-config.js"); const m = await import("./app/lib/supabase-config.js"); console.log(m.SUPABASE_URL);',
  {
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  }
);
check("configured production loads", prodConfigured.ok, prodConfigured.stderr);
check("trailing slash trimmed", prodConfigured.ok && prodConfigured.stdout.trim() === "https://example.supabase.co");

const prodSite = run('await import("./app/lib/site.js"); console.log("loaded");', { NODE_ENV: "production" });
check("site.js throws in production without a host", !prodSite.ok && /NEXT_PUBLIC_SITE_URL/.test(prodSite.stderr));

const dev = run('await import("./app/lib/supabase-config.js"); console.log("loaded");', { NODE_ENV: "development" });
check("development still loads for unit tests", dev.ok, dev.stderr);

console.log("\nThe error names the fix");
check("message points at .env.example", /\.env\.example/.test(config));
check("message names both variables", /NEXT_PUBLIC_SUPABASE_URL/.test(config) && /NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(config));

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll configuration cases passed");
