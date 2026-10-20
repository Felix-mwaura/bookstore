import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-auth";
import { mpesaConfig, mpesaAccessToken } from "../../../lib/mpesa";

// GET /api/mpesa/token — admin-only connectivity check.
//
// This used to return the raw Daraja access token to any anonymous caller,
// which let anyone spend the merchant's API quota. The token now never
// leaves the server: this endpoint only reports whether credentials work.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const config = mpesaConfig();
  if (config.error) {
    return NextResponse.json({ ok: false, error: config.error }, { status: 503 });
  }

  const result = await mpesaAccessToken(config);
  if (result.error) {
    return NextResponse.json({ ok: false, error: "Daraja authentication failed" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    environment: config.base.includes("sandbox") ? "sandbox" : "production",
    expiresIn: result.expiresIn ?? null,
  });
}
