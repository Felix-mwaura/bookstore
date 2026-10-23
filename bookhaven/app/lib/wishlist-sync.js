// Wishlist reconciliation rules, kept pure so they can be tested without a
// browser (scripts/wishlist-sync-test.mjs).
//
// The saved-books list lives in localStorage, which means it belongs to a
// *device*, not to a person. The moment an account is involved that stops
// being true, and a naive sync gets it wrong in a way that leaks data:
//
//   Alice saves five books on the shop's shared laptop and signs out.
//   Bob signs in. If Bob's sync simply merged "what is on this device" into
//   "what is in my account", Alice's five books would appear in Bob's
//   account, and Bob's list would show things he never saved.
//
// So the device remembers whose list it is holding (`bh_wishlist_owner`) and
// the three cases are handled differently:
//
//   same owner      keep both, push the device's extras up
//   no owner yet    these are guest saves; adopt them into the account,
//                   because a visitor who saved books then signed in expects
//                   to still have them
//   another owner   the device list belongs to somebody else: drop it and
//                   use the account's list, never merging

/**
 * What to do when a user signs in.
 *
 * @param {object} input
 * @param {string|null} input.localOwner   user id the device list belongs to
 * @param {string} input.userId            the user who just signed in
 * @param {number[]} input.localIds        book ids saved on this device
 * @param {number[]} input.accountIds      book ids saved in the account
 * @returns {{ mode: "same"|"adopt"|"replace", push: number[], fetchIds: number[] }}
 *   `push` are account ids to add, `fetchIds` are account ids the device
 *   needs full book rows for.
 */
export function planSignIn({ localOwner, userId, localIds, accountIds }) {
  const local = uniqueIds(localIds);
  const account = uniqueIds(accountIds);
  const accountSet = new Set(account);
  const localSet = new Set(local);

  if (localOwner && localOwner !== userId) {
    // Somebody else's device list. Adopt the account wholesale.
    return { mode: "replace", push: [], fetchIds: account };
  }

  const push = local.filter((id) => !accountSet.has(id));
  const fetchIds = account.filter((id) => !localSet.has(id));

  // No owner recorded and nothing saved: nothing to adopt, but it is still
  // not a "replace" — the device is simply taking on this account.
  return { mode: localOwner ? "same" : "adopt", push, fetchIds };
}

/**
 * What to do on a wishlist toggle while signed in.
 *
 * @param {{ id: number }[]} current  the wishlist before the toggle
 * @param {{ id: number }} book       the book being toggled
 * @returns {{ next: object[], action: "add"|"remove" }}
 */
export function planToggle(current, book) {
  const list = Array.isArray(current) ? current : [];
  const exists = list.some((item) => Number(item.id) === Number(book.id));
  return exists
    ? { next: list.filter((item) => Number(item.id) !== Number(book.id)), action: "remove" }
    : { next: [...list, book], action: "add" };
}

/** Positive book ids, deduplicated, order preserved. */
export function uniqueIds(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
