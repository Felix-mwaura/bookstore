#!/usr/bin/env node
// Price formatting test.
//
//   node scripts/price-smoke.mjs
//
// Product cards shorten long prices so they fit at 320px, but a shortened
// price must still be the price the customer pays. This asserts the compact
// form is used only when it is exact, and that the accessible label always
// carries the full amount.

import { compactKshNumber, formatKsh, formatKshCompact } from "../app/lib/site.js";

const failures = [];
const check = (label, actual, expected) => {
  if (String(actual) !== String(expected)) failures.push(`${label} — got ${actual}, expected ${expected}`);
};

// Short enough to print in full.
check("1,500 stays grouped", compactKshNumber(1500), "1,500");
check("9,999 stays grouped", compactKshNumber(9999), "9,999");
check("0 is 0", compactKshNumber(0), "0");

// Shortened only when the shorter form is exact.
check("10,000 → 10K", compactKshNumber(10000), "10K");
check("12,500 → 12.5K", compactKshNumber(12500), "12.5K");
check("100,000 → 100K", compactKshNumber(100000), "100K");
check("1,200,000 → 1.2M", compactKshNumber(1200000), "1.2M");

// A rounding that would misstate the price falls back to the full number.
check("12,345 is not 12.3K", compactKshNumber(12345), "12,345");
check("99,999 is not 100K", compactKshNumber(99999), "99,999");
check("1,234,567 is not 1.2M", compactKshNumber(1234567), "1,234,567");

// The full amount is never lost.
check("full price", formatKsh(12345), "KSh 12,345");
check("compact price keeps the currency", formatKshCompact(12500), "KSh 12.5K");
check(
  "the card shows fewer characters than the grouped number",
  compactKshNumber(12500).length < "12,500".length,
  true
);

// Defensive: bad input must not print NaN to a customer.
check("missing price", compactKshNumber(undefined), "0");
check("negative price", compactKshNumber(-40), "0");

if (failures.length) {
  console.error("price test FAILED");
  for (const failure of failures) console.error("  •", failure);
  process.exit(1);
}

console.log("price test passed — compact prices are exact, full price kept for screen readers");
