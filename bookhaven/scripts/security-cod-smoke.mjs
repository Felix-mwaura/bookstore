#!/usr/bin/env node
// Cash-on-delivery hoarding test.
//
//   node scripts/security-cod-smoke.mjs
//
// COD is the only payment method that takes stock without money. Every other
// path either settles at the time of ordering (M-Pesa) or is checked by the
// payment record. So the only defence against "order the last 20 copies of a
// book, never collect, repeat" is a volume ceiling.
//
// 3 open COD orders per account, 5 copies of one title, 15 books per order.
// All three are counted from the database, so restarting a serverless function
// does not reset them.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  COD_MAX_LINE_QTY,
  COD_MAX_OPEN,
  COD_MAX_TOTAL_QTY,
  codLimitMessage,
  codVerdict,
} from "../app/lib/request-limits.js";

const here = dirname(fileURLToPath(import.meta.url));
const route = readFileSync(join(here, "..", "app", "api", "orders", "route.js"), "utf8");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? `\n  ${detail}` : ""}`);
  }
}

console.log("Policy");
check("3 open COD orders", COD_MAX_OPEN === 3);
check("5 copies per title", COD_MAX_LINE_QTY === 5);
check("15 books per order", COD_MAX_TOTAL_QTY === 15);

const lines = (...quantities) => quantities.map((quantity) => ({ quantity }));

console.log("\nVerdicts");
check("normal order allowed", codVerdict({ openCodOrders: 0, lines: lines(1, 2) }) === null);
check("two open orders allowed", codVerdict({ openCodOrders: 2, lines: lines(1) }) === null);
check("third open order blocked", codVerdict({ openCodOrders: 3, lines: lines(1) }) === "open");
check("six copies of one title blocked", codVerdict({ openCodOrders: 0, lines: lines(6) }) === "line");
check("five copies allowed", codVerdict({ openCodOrders: 0, lines: lines(5) }) === null);
check("sixteen books blocked", codVerdict({ openCodOrders: 0, lines: lines(5, 5, 5, 1) }) === "total");
check("fifteen books allowed", codVerdict({ openCodOrders: 0, lines: lines(5, 5, 5) }) === null);
check("open-order limit wins over basket size", codVerdict({ openCodOrders: 9, lines: lines(50) }) === "open");
check("missing lines treated as empty", codVerdict({ openCodOrders: 0 }) === null);
check("missing count treated as zero", codVerdict({ lines: lines(1) }) === null);
check("junk quantities do not throw", codVerdict({ openCodOrders: 0, lines: [{ quantity: "x" }, {}] }) === null);

console.log("\nMessages are actionable");
check("open-order message names the cap", codLimitMessage("open").includes(String(COD_MAX_OPEN)));
check("open-order message offers M-Pesa", /M-Pesa/.test(codLimitMessage("open")));
check("line message names the cap", codLimitMessage("line").includes(String(COD_MAX_LINE_QTY)));
check("total message names the cap", codLimitMessage("total").includes(String(COD_MAX_TOTAL_QTY)));

console.log("\nRoute wiring");
check("counts open COD orders", /payment_method",\s*"cod"/.test(route));
check("excludes finished orders", /\.not\("status",\s*"in",\s*"\(Delivered,Cancelled\)"\)/.test(route));
check("scoped to the verified user", /\.eq\("user_id",\s*user\.id\)/.test(route));
check("only for COD", /method === "cod"/.test(route));
check("returns 429", /status:\s*429/.test(route));
check("uses the shared helper", route.includes("codVerdict(") && route.includes("codLimitMessage("));
check("still throttles overall orders", /recentOrders/.test(route));
check("M-Pesa path untouched", route.includes("clientForToken"));

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll COD cases passed");
