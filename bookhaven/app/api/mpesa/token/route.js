import { NextResponse } from "next/server";

export async function GET() {
  try {
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;

    if (!key || !secret) {
      return NextResponse.json({ error: "M-Pesa credentials not configured" }, { status: 500 });
    }

    const auth = Buffer.from(`${key}:${secret}`).toString("base64");

    const res = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        method: "GET",
        headers: { Authorization: `Basic ${auth}` },
      }
    );

    const data = await res.json();

    if (!res.ok || !data.access_token) {
      return NextResponse.json({ error: "Failed to get token", details: data }, { status: 500 });
    }

    return NextResponse.json({ token: data.access_token });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}