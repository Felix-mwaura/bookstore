#!/usr/bin/env node
// M-Pesa callback verification tests — mocked provider, no network, no database.
//
//   node scripts/mpesa-callback-smoke.mjs
//
// These cover the cases that must never be wrong, because each one is either
// money or a forged claim about money:
//
//   forged success · wrong amount · wrong checkout id · missing record ·
//   duplicate callback · concurrent duplicate · timeout · DB write failure ·
//   repeated query · verified success · reused receipt · foreign merchant id
//
// The real route is only a wrapper around handleMpesaCallback(); everything
// asserted here is the code that runs in production.

import { handleMpesaCallback } from "../app/lib/mpesa-callback-handler.js";
import {
  parseCallback,
  evaluateCallback,
  evaluateQuery,
} from "../app/lib/mpesa-verify.js";

const failures = [];
const check = (label, actual, expected) => {
  if (String(actual) !== String(expected)) {
    failures.push(`${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
};
const ok = (label, condition) => {
  if (!condition) failures.push(label);
};
const section = (name) => console.log(`\n${name}`);

// ── fakes ────────────────────────────────────────────────────────────────
const CHECKOUT = "ws_CO_23102026090000001";
const MERCHANT = "29115-34620561-1";
const EXPECTED = 113; // test product: 20 books + 4 delivery, +20% => 24… kept simple here
const RECEIPT = "SGR7XYZ1AB";

function intent(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    status: "pending",
    user_id: "22222222-2222-4222-8222-222222222222",
    order_id: null,
    expected_amount: EXPECTED,
    merchant_request_id: MERCHANT,
    checkout_request_id: CHECKOUT,
    mpesa_receipt: null,
    amount: null,
    result_code: null,
    result_desc: null,
    ...overrides,
  };
}

function body(overrides = {}) {
  const stk = {
    MerchantRequestID: MERCHANT,
    CheckoutRequestID: CHECKOUT,
    ResultCode: 0,
    ResultDesc: "The service request is processed successfully.",
    CallbackMetadata: {
      Item: [
        { Name: "Amount", Value: EXPECTED },
        { Name: "MpesaReceiptNumber", Value: RECEIPT },
        { Name: "TransactionDate", Value: 20261023101530 },
        { Name: "PhoneNumber", Value: 254720241844 },
      ],
    },
    ...overrides,
  };
  return { Body: { stkCallback: stk } };
}

/**
 * In-memory stand-in for supabaseStore(). Mirrors the semantics that matter:
 * updates are conditional on status='pending', and a receipt is unique.
 */
function makeStore(seed = [], { failOn = {} } = {}) {
  const payments = seed.map((row) => ({ ...row }));
  const callbacks = [];
  let completeDelay = 0;

  const find = (id) => payments.find((p) => p.id === id);

  return {
    payments,
    callbacks,
    setCompleteDelay(ms) {
      completeDelay = ms;
    },
    async findIntent(checkoutRequestId) {
      if (failOn.findIntent) return { intent: null, error: { message: "db down" } };
      const hit = payments.find((p) => p.checkout_request_id === checkoutRequestId);
      return { intent: hit ? { ...hit } : null, error: null };
    },
    async findReceiptOwner(receipt, exceptId) {
      if (failOn.findReceiptOwner) return { paymentId: null, error: { message: "db down" } };
      const hit = payments.find((p) => p.mpesa_receipt === receipt && p.id !== exceptId);
      return { paymentId: hit ? hit.id : null, error: null };
    },
    async completePending(id, fields) {
      if (failOn.completePending) return { won: false, error: { message: "write failed" } };
      if (completeDelay) await new Promise((r) => setTimeout(r, completeDelay));
      const row = find(id);
      // Conditional on status='pending', like the real UPDATE ... WHERE.
      if (!row || row.status !== "pending") return { won: false, error: null };
      Object.assign(row, fields);
      return { won: true, error: null };
    },
    async failPending(id, fields) {
      const row = find(id);
      if (!row || row.status !== "pending") return { error: null };
      Object.assign(row, fields);
      return { error: null };
    },
    async holdPending(id, fields) {
      if (failOn.holdPending) return { error: { message: "write failed" } };
      const row = find(id);
      if (row && row.status === "pending") Object.assign(row, fields);
      return { error: null };
    },
    async recordCallback(row) {
      callbacks.push(row);
      if (failOn.recordCallback) {
        return { error: { code: "42P01", message: "relation does not exist" }, missingTable: true };
      }
      return { error: null, missingTable: false };
    },
  };
}

const darajaSays = (resultCode, extra = {}) => ({
  async query() {
    return { ok: true, resultCode, resultDesc: "from Daraja", checkoutRequestId: CHECKOUT, ...extra };
  },
});

const darajaDown = {
  async query() {
    return { ok: false, reason: "network" };
  },
};

const row = (store, id = "11111111-1111-4111-8111-111111111111") =>
  store.payments.find((p) => p.id === id);

// ── 1. body alone is never enough ────────────────────────────────────────
section("1. forged success");
{
  const store = makeStore([intent()]);
  const result = await handleMpesaCallback({
    body: body(),
    store,
    daraja: darajaSays(1032),
  });
  check("Daraja disputes success → HTTP 200", result.status, 200);
  check("Daraja disputes success → status stays pending", row(store).status, "pending");
  ok("Daraja disputes success → reason recorded", /DARAJA_DISPUTES_SUCCESS/.test(row(store).result_desc));
  ok("Daraja disputes success → receipt not stored", row(store).mpesa_receipt == null);
  ok("callback preserved", store.callbacks.length === 1);
}

{
  const store = makeStore([intent()]);
  const result = await handleMpesaCallback({ body: body(), store, daraja: darajaDown });
  check("Daraja unreachable → HTTP 500 so Safaricom retries", result.status, 500);
  check("Daraja unreachable → status stays pending", row(store).status, "pending");
  ok("Daraja unreachable → reason recorded", /DARAJA_UNAVAILABLE/.test(row(store).result_desc));
}

{
  const store = makeStore([intent()]);
  const result = await handleMpesaCallback({ body: body(), store, daraja: null });
  check("no Daraja client → HTTP 500", result.status, 500);
  check("no Daraja client → stays pending", row(store).status, "pending");
}

// ── 2. exact amount ──────────────────────────────────────────────────────
section("2. wrong amount");
for (const [label, amount] of [
  ["underpaid", EXPECTED - 1],
  ["overpaid", EXPECTED + 1],
  ["stringly amount", "113.00"], // parses to 113 → accepted, see below
  ["missing amount", undefined],
  ["zero", 0],
]) {
  const store = makeStore([intent()]);
  const payload = body();
  if (amount === undefined) {
    payload.Body.stkCallback.CallbackMetadata.Item = payload.Body.stkCallback.CallbackMetadata.Item.filter(
      (i) => i.Name !== "Amount"
    );
  } else {
    payload.Body.stkCallback.CallbackMetadata.Item[0].Value = amount;
  }
  const result = await handleMpesaCallback({ body: payload, store, daraja: darajaSays(0) });

  if (label === "stringly amount") {
    // "113.00" is exactly 113; Safaricom sends integers, so accept it.
    check(`${label} → completed`, row(store).status, "completed");
  } else {
    check(`${label} → HTTP 200`, result.status, 200);
    check(`${label} → stays pending`, row(store).status, "pending");
    ok(`${label} → not completed`, row(store).status !== "completed");
    ok(`${label} → no receipt stored`, row(store).mpesa_receipt == null);
  }
}

// ── 3/4. identity of the payment ─────────────────────────────────────────
section("3. wrong checkout id / missing record");
{
  const store = makeStore([intent()]);
  const payload = body({ CheckoutRequestID: "ws_CO_SOMETHING_ELSE" });
  const result = await handleMpesaCallback({ body: payload, store, daraja: darajaSays(0) });
  check("unknown checkout id → HTTP 200", result.status, 200);
  check("unknown checkout id → no payment created", store.payments.length, 1);
  check("unknown checkout id → original untouched", row(store).status, "pending");
  check("unknown checkout id → preserved as unmatched", store.callbacks[0].outcome, "unmatched");
}

{
  const store = makeStore([]);
  const result = await handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) });
  check("no intent at all → HTTP 200", result.status, 200);
  check("no intent at all → no rows created", store.payments.length, 0);
  check("no intent at all → unmatched recorded", store.callbacks[0].outcome, "unmatched");
}

{
  // Callback arrives for a row whose CheckoutRequestID was never attached
  // (the push/attach race). It must not match some other payment.
  const store = makeStore([intent({ checkout_request_id: null })]);
  const result = await handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) });
  check("unattached intent → HTTP 200", result.status, 200);
  check("unattached intent → stays pending", row(store).status, "pending");
  check("unattached intent → preserved for reconciliation", store.callbacks[0].outcome, "unmatched");
}

{
  const store = makeStore([intent({ merchant_request_id: "99999-00000000-9" })]);
  const result = await handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) });
  check("foreign merchant id → HTTP 200", result.status, 200);
  check("foreign merchant id → row untouched", row(store).status, "pending");
  ok("foreign merchant id → no receipt written", row(store).mpesa_receipt == null);
  check("foreign merchant id → logged as ignored", store.callbacks[0].outcome, "ignored");
}

{
  const store = makeStore([intent()]);
  const payload = body();
  payload.Body.stkCallback.CallbackMetadata.Item = payload.Body.stkCallback.CallbackMetadata.Item.filter(
    (i) => i.Name !== "MpesaReceiptNumber"
  );
  await handleMpesaCallback({ body: payload, store, daraja: darajaSays(0) });
  check("missing receipt → stays pending", row(store).status, "pending");
  ok("missing receipt → reason recorded", /MISSING_RECEIPT/.test(row(store).result_desc));
}

// ── 5/6. duplicates and races ────────────────────────────────────────────
section("5. duplicate and concurrent callbacks");
{
  const store = makeStore([intent()]);
  const first = await handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) });
  check("first delivery → 200", first.status, 200);
  check("first delivery → completed", row(store).status, "completed");
  check("first delivery → amount stored", Number(row(store).amount), EXPECTED);
  check("first delivery → receipt stored", row(store).mpesa_receipt, RECEIPT);

  const second = await handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) });
  check("duplicate → 200", second.status, 200);
  check("duplicate → still one completed row", store.payments.filter((p) => p.status === "completed").length, 1);
  check("duplicate → receipt unchanged", row(store).mpesa_receipt, RECEIPT);
  check("duplicate → recorded as duplicate", store.callbacks.at(-1).outcome, "ignored");
}

{
  const store = makeStore([intent()]);
  store.setCompleteDelay(5); // force both handlers into the write at once
  const [a, b] = await Promise.all([
    handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) }),
    handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) }),
  ]);
  check("race → both deliveries answered", `${a.status}/${b.status}`, "200/200");
  check("race → exactly one completion", store.payments.filter((p) => p.status === "completed").length, 1);
  check(
    "race → exactly one winner recorded",
    store.callbacks.filter((c) => c.outcome === "completed").length,
    1
  );
  ok(
    "race → the loser is recorded as duplicate",
    store.callbacks.some((c) => c.outcome === "duplicate")
  );
}

// ── 7. non-zero result ───────────────────────────────────────────────────
section("7. cancelled / timed out");
for (const [code, label] of [
  [1032, "cancelled by user"],
  [1037, "timeout"],
  [2002, "wrong PIN"],
]) {
  const store = makeStore([intent()]);
  const payload = body({ ResultCode: code, ResultDesc: label, CallbackMetadata: undefined });
  const result = await handleMpesaCallback({ body: payload, store, daraja: darajaSays(code) });
  check(`${label} → 200`, result.status, 200);
  check(`${label} → failed`, row(store).status, "failed");
  check(`${label} → result code stored`, Number(row(store).result_code), code);
  ok(`${label} → never completed`, row(store).status !== "completed");
}

// ── 8. database failures ─────────────────────────────────────────────────
section("8. database failures");
{
  const store = makeStore([intent()], { failOn: { completePending: true } });
  const result = await handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) });
  check("write failure → HTTP 500 (Safaricom retries)", result.status, 500);
  check("write failure → stays pending", row(store).status, "pending");
  ok("write failure → recorded as error", store.callbacks.some((c) => c.outcome === "error"));
}
{
  const store = makeStore([intent()], { failOn: { findIntent: true } });
  const result = await handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) });
  check("lookup failure → HTTP 500", result.status, 500);
}
{
  // The callback table not existing yet must not break payments.
  const store = makeStore([intent()], { failOn: { recordCallback: true } });
  const result = await handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) });
  check("missing mpesa_callbacks → payment still completes", result.status, 200);
  check("missing mpesa_callbacks → row completed", row(store).status, "completed");
}

// ── 9. receipt replay across intents ─────────────────────────────────────
section("9. reused receipt");
{
  const settled = intent({ status: "completed", mpesa_receipt: RECEIPT, amount: EXPECTED });
  const fresh = intent({
    id: "33333333-3333-4333-8333-333333333333",
    checkout_request_id: "ws_CO_OTHER",
  });
  const store = makeStore([settled, fresh]);
  const payload = body({ CheckoutRequestID: "ws_CO_OTHER" });
  const result = await handleMpesaCallback({ body: payload, store, daraja: darajaSays(0) });
  check("reused receipt → 200", result.status, 200);
  check("reused receipt → new payment not completed", row(store, fresh.id).status, "pending");
  ok(
    "reused receipt → original untouched",
    row(store, settled.id).status === "completed" && row(store, settled.id).mpesa_receipt === RECEIPT
  );
  check("reused receipt → recorded as rejected", store.callbacks[0].outcome, "rejected");
}

// ── 10. verified success ─────────────────────────────────────────────────
section("10. verified success");
{
  const store = makeStore([intent()]);
  const result = await handleMpesaCallback({ body: body(), store, daraja: darajaSays(0) });
  const saved = row(store);
  check("verified → 200", result.status, 200);
  check("verified → completed", saved.status, "completed");
  check("verified → receipt", saved.mpesa_receipt, RECEIPT);
  check("verified → amount", Number(saved.amount), EXPECTED);
  check("verified → merchant request id", saved.merchant_request_id, MERCHANT);
  check("verified → result code", Number(saved.result_code), 0);
  check("verified → transaction date", saved.transaction_date, "20261023101530");
  check("verified → phone", saved.phone, "254720241844");
}

// ── 11. the query path can never settle a payment ────────────────────────
section("11. /api/mpesa/query semantics");
{
  check("query 0 → 'paid'", evaluateQuery({ resultCode: "0" }).action, "paid");
  check("query 0 repeated → still 'paid'", evaluateQuery({ resultCode: "0" }).action, "paid");
  check("query 1032 → 'failed'", evaluateQuery({ resultCode: "1032" }).action, "failed");
  check("query 1037 → 'failed'", evaluateQuery({ resultCode: "1037" }).action, "failed");
  check("query 1031 → 'failed'", evaluateQuery({ resultCode: "1031" }).action, "failed");
  check("query 500.001.1001 → 'pending'", evaluateQuery({ resultCode: "500.001.1001" }).action, "pending");
  check("query nonsense → 'pending'", evaluateQuery({ resultCode: "wat" }).action, "pending");

  // 'paid' is not 'complete': only the callback carries amount + receipt.
  const paid = evaluateQuery({ resultCode: "0" });
  ok("query 'paid' carries no completion fields", paid.fields === undefined);
}

// ── 12. parser hardening ─────────────────────────────────────────────────
section("12. malformed bodies");
{
  check("no body", parseCallback(null).ok, false);
  check("no Body", parseCallback({}).ok, false);
  check("no stkCallback", parseCallback({ Body: {} }).ok, false);
  check("no checkout id", parseCallback({ Body: { stkCallback: { ResultCode: 0 } } }).ok, false);

  const parsed = parseCallback(body());
  check("parsed checkout id", parsed.checkoutRequestId, CHECKOUT);
  check("parsed amount", parsed.amount, EXPECTED);
  check("parsed receipt", parsed.receipt, RECEIPT);

  const store = makeStore([intent()]);
  const result = await handleMpesaCallback({ body: { garbage: true }, store, daraja: darajaSays(0) });
  check("garbage body → 200 (not retryable)", result.status, 200);
  check("garbage body → nothing written", store.payments[0].status, "pending");
}

{
  // An absurdly long ResultDesc must not be able to bloat the row.
  const store = makeStore([intent()]);
  await handleMpesaCallback({
    body: body({ ResultCode: 1032, ResultDesc: "x".repeat(5000), CallbackMetadata: undefined }),
    store,
    daraja: darajaSays(1032),
  });
  ok("long ResultDesc is truncated", String(row(store).result_desc).length <= 500);
}

// ── 13. direct rule checks ───────────────────────────────────────────────
section("13. evaluateCallback guard rails");
{
  const cb = parseCallback(body());
  check(
    "already completed → ignore",
    evaluateCallback({ callback: cb, intent: intent({ status: "completed" }), query: { ok: true, resultCode: 0 } }).action,
    "ignore"
  );
  check(
    "already ordered → ignore",
    evaluateCallback({ callback: cb, intent: intent({ order_id: "o" }), query: { ok: true, resultCode: 0 } }).action,
    "ignore"
  );
  check(
    "failed intent → ignore",
    evaluateCallback({ callback: cb, intent: intent({ status: "failed" }), query: { ok: true, resultCode: 0 } }).action,
    "ignore"
  );
  check(
    "no expected amount → hold",
    evaluateCallback({ callback: cb, intent: intent({ expected_amount: null }), query: { ok: true, resultCode: 0 } }).action,
    "hold"
  );
  check(
    "missing checkout id in query is fine",
    evaluateCallback({ callback: cb, intent: intent(), query: { ok: true, resultCode: 0 } }).action,
    "complete"
  );
  check(
    "query checkout id mismatch → hold",
    evaluateCallback({
      callback: cb,
      intent: intent(),
      query: { ok: true, resultCode: 0, checkoutRequestId: "nope" },
    }).action,
    "hold"
  );
}

// ── report ───────────────────────────────────────────────────────────────
console.log("");
if (failures.length) {
  console.error(`FAIL — ${failures.length} problem(s):`);
  for (const message of failures) console.error(`  • ${message}`);
  process.exit(1);
}
console.log("PASS — M-Pesa callback verification (mocked provider, no network)");
