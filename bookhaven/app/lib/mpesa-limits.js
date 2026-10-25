// Limits on how often one account (or one phone) can be sent an STK prompt.
//
// WHY
//   /api/mpesa/stk asks Safaricom to display a payment prompt on a phone. It
//   is authenticated, so an anonymous script cannot do it — but any customer
//   account can, and before this the only ceiling was five pushes per account
//   per ten minutes. That still allows 30 prompts an hour at any number the
//   caller types, which is a harassment tool (and an expensive one: the shop
//   pays the Daraja fees for prompts nobody completes).
//
//   Two ceilings now:
//     • per account — stops one account doing it at scale;
//     • per phone   — stops several accounts targeting the same number.
//   The phone is stored on the payment intent when it is created, so the
//   per-phone count is possible at all and an administrator can see which
//   numbers were tried on the Payments tab.
//
//   These numbers are deliberately generous enough for real life: a customer
//   who mistypes their PIN twice, or has no float and retries once, is not
//   limited.

/** Prompts one account may trigger in ten minutes. */
export const MAX_STK_PER_ACCOUNT_10MIN = 5;

/** Prompts one phone number may receive, across all accounts, in ten minutes. */
export const MAX_STK_PER_PHONE_10MIN = 3;

/**
 * Null when another prompt may be sent, else the message to return.
 *
 * @param {{ accountAttempts: number, phoneAttempts: number }} args
 * @returns {null | string}
 */
export function stkLimitProblem({ accountAttempts, phoneAttempts }) {
  if (Number(phoneAttempts) >= MAX_STK_PER_PHONE_10MIN) {
    return "Too many M-Pesa prompts have been sent to this number. Please wait a few minutes, or pay on delivery.";
  }
  if (Number(accountAttempts) >= MAX_STK_PER_ACCOUNT_10MIN) {
    return "Too many M-Pesa attempts. Please wait a few minutes and try again.";
  }
  return null;
}

/**
 * Normalise the phone numbers a customer already has on file, for the optional
 * strict mode (MPESA_RESTRICT_TO_KNOWN_PHONE=1). Left as a plain helper so it
 * can be tested without a database.
 *
 * @param {string[]} numbers
 * @param {(raw: string) => string} normalise
 * @returns {Set<string>}
 */
export function knownPhoneSet(numbers, normalise) {
  const set = new Set();
  for (const raw of numbers || []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const normalised = normalise(raw);
    if (normalised) set.add(normalised);
  }
  return set;
}
