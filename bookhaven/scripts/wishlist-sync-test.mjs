// Tests for the wishlist reconciliation rules.
//
//   node scripts/wishlist-sync-test.mjs
//
// Pure functions only — no browser, no database. The behaviour that matters
// is what happens on a shared device, and that is decided entirely by
// planSignIn().

import { planSignIn, planToggle, uniqueIds } from "../app/lib/wishlist-sync.js";

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function equal(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `expected ${e}, got ${a}`);
}

console.log("Wishlist reconciliation");

// ── uniqueIds ────────────────────────────────────────────────────────────
console.log("\n1. Id hygiene");
equal("deduplicates, keeps order", uniqueIds([3, 1, 3, 2]), [3, 1, 2]);
equal("drops zero, negative, fractions and junk", uniqueIds([0, -1, 1.5, "x", null, 7]), [7]);
equal("empty in, empty out", uniqueIds(null), []);

// ── planToggle ───────────────────────────────────────────────────────────
console.log("\n2. Toggling");
const list = [{ id: 1, title: "A" }, { id: 2, title: "B" }];
const removed = planToggle(list, { id: 2, title: "B" });
equal("removing takes the right book out", removed.next.map((b) => b.id), [1]);
check("removing reports 'remove'", removed.action === "remove");
const added = planToggle(list, { id: 9, title: "C" });
equal("adding appends", added.next.map((b) => b.id), [1, 2, 9]);
check("adding reports 'add'", added.action === "add");
check("the input list is not mutated", list.length === 2);
equal("string ids still match", planToggle([{ id: 5 }], { id: "5" }).next, []);
equal("toggling an empty list works", planToggle(undefined, { id: 4 }).next.map((b) => b.id), [4]);

// ── planSignIn ───────────────────────────────────────────────────────────
console.log("\n3. Signing in on a device that already has saved books");

const adopt = planSignIn({ localOwner: null, userId: "alice", localIds: [1, 2], accountIds: [3] });
equal("guest saves are adopted", adopt.mode, "adopt");
equal("account books nobody has locally are fetched", adopt.fetchIds, [3]);
equal("local books the account lacks are pushed", adopt.push, [1, 2]);

const same = planSignIn({ localOwner: "alice", userId: "alice", localIds: [1], accountIds: [2] });
equal("same owner keeps the local list", same.mode, "same");
equal("and fills in the gap", same.fetchIds, [2]);
equal("and pushes the local extra", same.push, [1]);

const replace = planSignIn({ localOwner: "alice", userId: "bob", localIds: [1, 2], accountIds: [7] });
equal("a different person's list is replaced, not merged", replace.mode, "replace");
equal("nothing of Alice's is pushed into Bob's account", replace.push, []);
equal("Bob's books are fetched", replace.fetchIds, [7]);

const emptyLocal = planSignIn({ localOwner: null, userId: "carol", localIds: [], accountIds: [4, 5] });
equal("a fresh device pulls the whole account", emptyLocal.fetchIds, [4, 5]);
equal("a fresh device pushes nothing", emptyLocal.push, []);

const nothing = planSignIn({ localOwner: "dave", userId: "dave", localIds: [], accountIds: [] });
equal("an empty account and empty device is a no-op", [nothing.push, nothing.fetchIds], [[], []]);

const alreadyInSync = planSignIn({ localOwner: null, userId: "erin", localIds: [1, 2], accountIds: [2, 1] });
equal("no writes when both sides already agree", [alreadyInSync.push, alreadyInSync.fetchIds], [[], []]);

const dupes = planSignIn({ localOwner: null, userId: "frank", localIds: [1, 1, 2], accountIds: [2, 2] });
equal("duplicates do not become duplicate writes", [dupes.push, dupes.fetchIds], [[1], []]);

console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
