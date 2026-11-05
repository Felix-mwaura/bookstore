// Covers for books in an order.
//
// An order's `items` is a JSONB snapshot written by place_order(): it keeps
// the id, quantity, price, title and author at the moment of purchase, and
// deliberately nothing else. That is the right thing for a price record — a
// later cover upload must not rewrite history — but it means the order pages
// had no image to show, so a customer looking at what they bought saw a row
// of text.
//
// Rather than change the stored shape (a migration, and every existing order
// would still lack the field), the covers are looked up from `books` at render
// time by id. One query for every book in every order on the page.
//
// This is presentation only: titles, authors and prices still come from the
// order itself, so a book edited or deleted after purchase cannot change what
// the customer was charged.

/**
 * @param {object} client a Supabase client (server or browser — `books` is
 *   readable by both; only the public columns are selected)
 * @param {Array<object>} orders rows from `orders`
 * @returns {Promise<Array<object>>} the same orders, each item carrying
 *   `cover_url` and `cover` when the book still exists
 */
export async function attachOrderItemCovers(client, orders) {
  if (!Array.isArray(orders) || orders.length === 0) return orders || [];
  if (!client) return orders;

  const ids = new Set();
  for (const order of orders) {
    for (const item of order?.items || []) {
      const id = Number(item?.id);
      if (Number.isInteger(id) && id > 0) ids.add(id);
    }
  }
  if (ids.size === 0) return orders;

  let rows = [];
  try {
    const { data, error } = await client.from("books").select("id, cover_url, cover").in("id", [...ids]);
    // A failed lookup must not take an order page down: the covers degrade to
    // the typographic fallback that OrderView already draws.
    if (error) return orders;
    rows = data || [];
  } catch {
    return orders;
  }

  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  return orders.map((order) => ({
    ...order,
    items: (order?.items || []).map((item) => {
      const book = byId.get(Number(item?.id));
      if (!book) return item;
      return {
        ...item,
        cover_url: book.cover_url ?? item.cover_url ?? null,
        cover: book.cover ?? item.cover ?? null,
      };
    }),
  }));
}
