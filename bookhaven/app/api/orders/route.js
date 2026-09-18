// POST /api/orders — save a new order after checkout and deduct stock
export async function POST(request) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = clientForToken(token);
  const { data: { user }, error: userError } = await client.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { items, total, deliveryDetails, paymentMethod, checkoutRequestId } = body;

  if (!items || !total || !deliveryDetails || !paymentMethod) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // --- NEW: Deduct Stock Before Creating Order ---
  for (const item of items) {
    const { error: rpcError } = await client.rpc('decrement_book_stock', { 
      book_id: item.id, 
      quantity: item.quantity || 1 
    });

    if (rpcError) {
      // If stock is insufficient, the RPC function throws an error, which we catch here
      return NextResponse.json(
        { error: `Could not place order: Insufficient stock for ${item.title || 'a book in your cart'}.` }, 
        { status: 400 }
      );
    }
  }
  // -----------------------------------------------

  const { data, error } = await client
    .from("orders")
    .insert({
      user_id: user.id,
      items,
      total,
      delivery_details: deliveryDetails,
      payment_method: paymentMethod,
      checkout_request_id: checkoutRequestId || null,
      status: "Processing",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}