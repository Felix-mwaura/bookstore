import { NextResponse } from "next/server";
import { clientForToken, bearerToken } from "../../lib/server";

// Same bug as the wishlist route: the old code never attached the caller's
// token, so every address query ran as `anon` and matched nothing.
//
// PATCH also spread `...rest` straight into the update, which let a caller
// set `user_id` (moving the address to another account) or any other
// column. Only the fields below may be written now.

const FIELDS = ["label", "name", "address", "city", "phone", "is_default"];

async function requireUser(request) {
  const token = bearerToken(request);
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const client = clientForToken(token);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  return { client, user };
}

function pick(body) {
  const out = {};
  for (const key of FIELDS) {
    if (body?.[key] === undefined) continue;
    if (key === "is_default") out[key] = !!body[key];
    else if (typeof body[key] === "string") out[key] = body[key].trim().slice(0, 240);
  }
  return out;
}

export async function GET(request) {
  const { client, user, error } = await requireUser(request);
  if (error) return error;

  const { data, error: dbError } = await client
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ addresses: data || [] });
}

export async function POST(request) {
  const { client, user, error } = await requireUser(request);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fields = pick(body);
  if (!fields.name || !fields.address || !fields.city || !fields.phone) {
    return NextResponse.json(
      { error: "name, address, city and phone are required" },
      { status: 400 }
    );
  }

  // Clear the old default first — a partial unique index allows only one
  // default address per user.
  if (fields.is_default) {
    await client.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  }

  const { data, error: dbError } = await client
    .from("addresses")
    .insert({ ...fields, user_id: user.id, is_default: !!fields.is_default })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ address: data });
}

export async function PATCH(request) {
  const { client, user, error } = await requireUser(request);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = body?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Address id is required" }, { status: 400 });
  }

  const fields = pick(body);
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (fields.is_default) {
    await client.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  }

  const { data, error: dbError } = await client
    .from("addresses")
    .update(fields)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Address not found" }, { status: 404 });
  return NextResponse.json({ address: data });
}

export async function DELETE(request) {
  const { client, user, error } = await requireUser(request);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = body?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Address id is required" }, { status: 400 });
  }

  const { error: dbError } = await client
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
