import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { mpesaDiagnostics } from "../../../lib/mpesa";

// GET /api/mpesa/token — admin-only "is this configured correctly?" check.
//
// It used to report only whether a token could be fetched, which is true for
// four different problems (wrong key, regenerated secret, sandbox credentials
// against the live host, live credentials against the sandbox host) and
// therefore diagnoses none of them.
//
// It now probes BOTH Daraja hosts and says which one these credentials
// actually work on. That turns the most common cause of "M-Pesa is temporarily
// unavailable" — an unset MPESA_ENV defaulting to sandbox while the shop holds
// live credentials — into a one-line instruction.
//
// No credential, secret or access token is ever returned. Only Daraja's own
// error code and message, which are about authentication, not identity.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const diagnostics = await mpesaDiagnostics();

  return NextResponse.json(
    {
      ok: diagnostics.configured && !diagnostics.problem,
      ...diagnostics,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
