import { NextResponse } from "next/server";
import { serviceClient } from "../../../lib/server";
import { mpesaConfig, resolveAccessToken, stkQuery } from "../../../lib/mpesa";
import { handleMpesaCallback, supabaseStore, ACCEPTED, RETRY } from "../../../lib/mpesa-callback-handler";
import { exceedsBodyLimit, CALLBACK_BODY } from "../../../lib/request-guard";
import { verifyCallbackToken } from "../../../lib/callback-secret.js";

// POST /api/mpesa/callback — Safaricom's asynchronous result notification.
//
// Public and unauthenticated: Daraja does not sign callbacks, so the body is
// a claim, never proof. The five checks a success must pass live in
// app/lib/mpesa-verify.js and the decision lives in
// app/lib/mpesa-callback-handler.js; this file only wires them to the real
// database and the real Daraja API.
//
// Response codes, deliberately:
//   200 — handled, or nothing to do (unknown id, duplicate, ambiguous state)
//   500 — OUR failure (database write, Daraja unreachable) so Safaricom
//         retries. Returning 200 there would silently lose the only
//         notification of a real payment.
//
// MPESA_CALLBACK_TOKEN is optional: when set, MPESA_CALLBACK_URL must carry
// the same value as ?k=<token> (or the caller may send x-callback-token).
// See docs/security-audit-2026-10-25.md for the exact rotation steps.
export const dynamic = "force-dynamic";

export async function POST(request) {
  // Optional shared secret (MPESA_CALLBACK_TOKEN). Unset -> no behaviour
  // change, so the URL already registered with Safaricom keeps working. When
  // set, a request that cannot present it is refused before the body is read.
  const tokenCheck = verifyCallbackToken(request, process.env.MPESA_CALLBACK_TOKEN);
  if (!tokenCheck.ok) {
    console.warn("M-Pesa callback: rejected, callback token", tokenCheck.reason);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 403 });
  }

  // A real callback is well under a kilobyte. Anything larger is not one we
  // should spend memory parsing; acknowledge it so Safaricom stops retrying.
  if (exceedsBodyLimit(request, CALLBACK_BODY)) {
    console.warn("M-Pesa callback: oversized body ignored");
    return NextResponse.json(ACCEPTED);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(ACCEPTED);
  }

  let db;
  try {
    db = serviceClient();
  } catch (error) {
    console.error("M-Pesa callback: no database client:", error?.message || error);
    return NextResponse.json(RETRY, { status: 500 });
  }

  // Ask Daraja for its own verdict. Only called when the body claims success.
  const config = mpesaConfig();
  const daraja = {
    async query(checkoutRequestId) {
      if (config.error) return { ok: false, reason: "MPESA_NOT_CONFIGURED" };

      const tokenResult = await resolveAccessToken(config);
      if (tokenResult.error) {
        console.error("M-Pesa callback: could not obtain an OAuth token", {
          status: tokenResult.status ?? null,
          code: tokenResult.code ?? null,
          message: tokenResult.message ?? null,
        });
        return { ok: false, reason: "DARAJA_AUTH_FAILED" };
      }

      const result = await stkQuery({
        config,
        accessToken: tokenResult.token,
        base: tokenResult.base ?? config.base,
        checkoutRequestId,
      });

      if (!result.ok) {
        console.error("M-Pesa callback: STK query returned no verdict", {
          httpStatus: result.httpStatus ?? null,
          reason: result.reason ?? null,
          resultDesc: result.resultDesc ?? null,
        });
      }
      return result;
    },
  };

  const { status, payload } = await handleMpesaCallback({
    body,
    store: supabaseStore(db),
    daraja,
    log: (message, meta) => {
      if (meta) console.warn(message, meta);
      else console.warn(message);
    },
  });

  return NextResponse.json(payload, { status });
}

export async function GET() {
  return NextResponse.json({ status: "M-Pesa callback endpoint active" });
}
