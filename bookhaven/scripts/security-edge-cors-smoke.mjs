#!/usr/bin/env node
// Edge-function CORS / JWT-role test.
//
//   node scripts/security-edge-cors-smoke.mjs
//
// supabase/functions/send-email authenticates with the service-role key and
// refuses to run for any other role. It is called server-to-server, so it has
// no reason to be readable from a random web page — but it answered with
// `Access-Control-Allow-Origin: *`, which let any origin call it and read the
// response. The wildcard is gone; an origin is echoed only when it is listed
// in ALLOWED_ORIGINS or equals SITE_URL.
//
// The function runs on Deno, which this repository's test runner cannot boot,
// so this file asserts the source contract and the deployment setting instead
// of pretending to exercise the runtime. The live verify_jwt value is checked
// separately in the audit report.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, "..", "supabase", "functions", "send-email", "index.ts"),
  "utf8"
);

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

console.log("No wildcard CORS");
check("no ACAO wildcard", !/Access-Control-Allow-Origin"\s*:\s*"\*"/.test(source));
check("no literal * origin anywhere", !/"Access-Control-Allow-Origin":\s*"\*"/.test(source));
check("no `cors` object left behind", !/const cors = \{/.test(source));

console.log("\nAllowlist");
check("reads ALLOWED_ORIGINS", source.includes("ALLOWED_ORIGINS"));
check("falls back to SITE_URL", /SITE_URL/.test(source));
check("normalises trailing slashes", source.includes('replace(/\\/+$/, "")'));
check("echoes the request origin only on a match", /includes\(origin\)/.test(source));
check("sends Vary: Origin", /Vary: "Origin"/.test(source));
check("no Origin -> no CORS headers", /if \(!origin\) return headers;/.test(source));
check("OPTIONS uses the same policy", /corsFor\(req\)/.test(source));

console.log("\nJWT role check is documented as gateway-dependent");
check("jwtRole still present", source.includes("function jwtRole"));
check("comment ties it to verify_jwt", /verify_jwt = true/.test(source));
check("comment warns against turning it off", /keep the deployment setting/.test(source));
check("service_role comparison intact", /jwtRole\(token\) !== "service_role"/.test(source));

console.log("\nResponse helper threads the request through");
check("json() takes a request", /const json = \(body: unknown, status = 200, req\?: Request\)/.test(source));
const unthreaded = source.match(/json\(\s*\{[\s\S]{0,220}?\},\s*\d{3}\s*\)/g) || [];
check("no response forgets the request", unthreaded.length === 0, unthreaded.join("\n"));

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll edge CORS cases passed");
