// Read-only tools the admin assistant may call.
//
// Design rules, in order of importance:
//
//  1. EVERY tool is a SELECT. The assistant has no write tool at all, so a
//     prompt-injected message cannot mark an order paid, delete a book or
//     change a role. Mutations stay in the existing /api/admin/* endpoints,
//     behind their own confirmation dialogs and audit trail.
//  2. Every argument is validated and clamped here, not in the model. A model
//     that asks for 5,000 rows gets 25; one that asks for a bad status gets an
//     error it can read, never a query.
//  3. Results are trimmed to what an answer needs. Customer text and order
//     notes are data, never instructions — the system prompt says so and no
//     tool can act on them.
//  4. Nothing here is imported by a client component; it uses the service-role
//     client handed in by the route after requireAdmin() succeeded.

export const ORDER_STATUSES = ["Pending", "Processing", "Packed", "Shipped", "Delivered", "Cancelled"];
export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refund_pending", "refunded"];

const MAX_LIMIT = 25;

class ToolInputError extends Error {}

function str(value, { max = 80, allowed = null } = {}) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().slice(0, max);
  if (allowed && !allowed.includes(trimmed)) return "";
  return trimmed;
}

function int(value, { min = 1, max = 100, fallback = null } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * PostgREST's `or=` filter is a comma/parenthesis-delimited string, so user
 * text has to lose those characters before it can be interpolated safely.
 * This is not SQL injection (the value is still URL-encoded and parameterised
 * by PostgREST) — it stops a search term from changing the filter's shape.
 */
function safeTerm(value, max = 40) {
  return str(value, { max }).replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim();
}

function reference(id) {
  return id ? `BH-${String(id).slice(0, 8).toUpperCase()}` : "—";
}

function compactOrder(row, { withItems = true } = {}) {
  const d = row.delivery_details || {};
  return {
    reference: reference(row.id),
    id: row.id,
    status: row.status,
    payment_status: row.payment_status,
    payment_method: row.payment_method,
    total: row.total,
    created_at: row.created_at,
    customer: [d.firstName, d.lastName].filter(Boolean).join(" ") || "(no name)",
    phone: d.phone || "",
    city: d.city || "",
    ...(withItems
      ? {
          items: Array.isArray(row.items)
            ? row.items.slice(0, 12).map((i) => ({
                title: i?.title || "(untitled)",
                quantity: i?.quantity ?? 1,
                price: i?.price ?? null,
              }))
            : [],
          notes: typeof d.notes === "string" ? d.notes.slice(0, 300) : "",
        }
      : {}),
  };
}

/* ─────────────────────────────────────────────────────────────
   Tool schemas — sent to the model verbatim.
   ───────────────────────────────────────────────────────────── */
export const TOOL_DEFINITIONS = [
  {
    name: "store_metrics",
    description:
      "Totals for a date range: order counts by stage, revenue actually paid, pending value, refunds, inventory health and the best-selling titles. Use this first for any question about sales, performance, 'how are we doing', or a period summary. All money is Kenyan shillings.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 365,
          description: "How many days back from today to include. Default 7.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "list_orders",
    description:
      "Find orders by fulfilment status, payment status, age and/or a search term (order reference, customer name or town). Returns the newest matches with the customer, total and line items. Use it when the admin asks what needs action, what was ordered, or about a specific customer's orders.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ORDER_STATUSES, description: "Fulfilment status filter." },
        payment_status: { type: "string", enum: PAYMENT_STATUSES, description: "Payment status filter." },
        days: {
          type: "integer",
          minimum: 1,
          maximum: 365,
          description: "Only orders placed in the last N days. Default 30.",
        },
        search: {
          type: "string",
          description: "Order reference, customer name or town. Leave empty for all.",
        },
        limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, description: "Rows to return. Default 10." },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "get_order",
    description:
      "Full detail for one order, by its reference (BH-XXXXXXXX, the first eight characters are enough) or its full id. Use when the admin names one order and needs the items, totals, address or payment state.",
    input_schema: {
      type: "object",
      properties: {
        reference: { type: "string", description: "BH-XXXXXXXX, the eight-character id prefix, or a full uuid." },
      },
      required: ["reference"],
      additionalProperties: false,
    },
  },
  {
    name: "low_stock",
    description:
      "Titles at or below their low-stock threshold, plus which are completely out of stock. Use for restocking questions and 'what should I reorder'.",
    input_schema: {
      type: "object",
      properties: {
        include_ok: {
          type: "boolean",
          description: "Also return titles that are in stock (useful for a full stock table). Default false.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "search_books",
    description:
      "Search the catalogue by title or author, optionally within a category. Returns price, stock and whether the title is archived.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Title or author fragment." },
        category: { type: "string", description: "Exact category name, e.g. Fiction." },
        include_archived: { type: "boolean", description: "Include archived titles. Default false." },
        limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, description: "Rows to return. Default 10." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "find_customers",
    description:
      "Find customer accounts by name or email, with how many orders each has placed and how much they have actually paid. Never include passwords or auth internals.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name or email fragment." },
        limit: { type: "integer", minimum: 1, maximum: 10, description: "Rows to return. Default 5." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "stock_movements",
    description:
      "Recent stock adjustments for one book, with the reason, note and admin who made them. Use to explain why a quantity changed.",
    input_schema: {
      type: "object",
      properties: {
        book_id: { type: "integer", description: "The book's numeric id." },
        limit: { type: "integer", minimum: 1, maximum: 25, description: "Rows to return. Default 10." },
      },
      required: ["book_id"],
      additionalProperties: false,
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   Implementations
   ───────────────────────────────────────────────────────────── */

async function storeMetrics(db, input) {
  const days = int(input?.days, { min: 1, max: 365, fallback: 7 });
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);

  const { data, error } = await db.rpc("admin_dashboard_metrics", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) throw new ToolInputError(`Metrics are unavailable: ${error.message}`);

  const m = data || {};
  return {
    window: { days, from: from.toISOString(), to: to.toISOString() },
    currency: "KES",
    counts: m.counts || {},
    money: m.money || {},
    inventory: m.inventory || {},
    best_sellers: (m.best_sellers || []).slice(0, 5),
    daily: (m.daily || []).slice(-14),
    note: "net_revenue counts only orders marked paid and not cancelled; pending_value is money not yet collected.",
  };
}

async function listOrders(db, input) {
  const days = int(input?.days, { min: 1, max: 365, fallback: 30 });
  const limit = int(input?.limit, { min: 1, max: MAX_LIMIT, fallback: 10 });
  const status = str(input?.status, { max: 20 });
  const payment = str(input?.payment_status, { max: 20 });
  const search = safeTerm(input?.search, 60).toLowerCase();

  if (status && !ORDER_STATUSES.includes(status)) {
    throw new ToolInputError(`Unknown status "${status}". Use one of: ${ORDER_STATUSES.join(", ")}.`);
  }
  if (payment && !PAYMENT_STATUSES.includes(payment)) {
    throw new ToolInputError(`Unknown payment status "${payment}".`);
  }

  // Orders are filtered in one small window and matched here rather than with
  // PostgREST json-path operators. That keeps the tool reliable across
  // Supabase versions and lets one search cover a reference prefix, a name and
  // a town at once. The window is capped and the cap is reported to the model.
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const scanLimit = 1000;

  const { data, error } = await db
    .from("orders")
    .select("id,status,payment_status,payment_method,total,created_at,delivery_details,items")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(scanLimit);

  if (error) throw new ToolInputError(`Order lookup failed: ${error.message}`);

  const rows = data || [];
  const needle = search.replace(/^bh-/, "");
  const matches = rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (payment && row.payment_status !== payment) return false;
    if (!needle) return true;

    const d = row.delivery_details || {};
    return (
      String(row.id).toLowerCase().startsWith(needle) ||
      String(d.firstName || "").toLowerCase().includes(needle) ||
      String(d.lastName || "").toLowerCase().includes(needle) ||
      String(d.city || "").toLowerCase().includes(needle) ||
      String(d.phone || "").includes(needle)
    );
  });

  return {
    window_days: days,
    filters: { status: status || "any", payment_status: payment || "any", search: search || null },
    scanned: rows.length,
    scan_capped: rows.length === scanLimit,
    matched: matches.length,
    orders: matches.slice(0, limit).map((row) => compactOrder(row, { withItems: false })),
    note:
      rows.length === scanLimit
        ? `Only the ${scanLimit} most recent orders in this window were searched; narrow the window for a complete answer.`
        : "matched is the number of orders that satisfy the filters in this window.",
  };
}

async function getOrder(db, input) {
  const raw = str(input?.reference, { max: 40 });
  const needle = raw.replace(/^BH-/i, "").trim().toLowerCase();
  if (!needle) throw new ToolInputError("A reference is required, for example BH-1A2B3C4D.");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(needle);
  let id = isUuid ? needle : null;

  if (!id) {
    if (!/^[0-9a-f]{4,32}$/.test(needle)) {
      throw new ToolInputError("That does not look like an order reference. Use the eight characters after BH-.");
    }
    // A reference is the first eight characters of the order's uuid. Postgres
    // will not apply ILIKE to a uuid column, so the ids are matched here.
    const { data: candidates, error: idError } = await db
      .from("orders")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (idError) throw new ToolInputError(`Order lookup failed: ${idError.message}`);

    const hits = (candidates || []).filter((row) => String(row.id).toLowerCase().startsWith(needle));
    if (hits.length === 0) {
      throw new ToolInputError(`No recent order starts with ${needle.toUpperCase()}.`);
    }
    if (hits.length > 1) {
      throw new ToolInputError("More than one order matches that prefix — use more of the reference.");
    }
    id = hits[0].id;
  }

  const { data, error } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new ToolInputError(`Order lookup failed: ${error.message}`);
  if (!data) throw new ToolInputError("That order does not exist.");

  const d = data.delivery_details || {};
  return {
    ...compactOrder(data),
    address: [d.address, d.city].filter(Boolean).join(", "),
    email: d.email || "",
    subtotal: data.subtotal ?? null,
    delivery_fee: data.delivery_fee ?? null,
    payment_reference: data.payment_ref || null,
    courier: data.courier || null,
    tracking_ref: data.tracking_ref || null,
  };
}

async function lowStock(db, input) {
  const includeOk = input?.include_ok === true;

  const { data, error } = await db
    .from("books")
    .select("id,title,author,category,price,stock_quantity,low_stock_threshold,is_archived")
    .eq("is_archived", false)
    .order("stock_quantity", { ascending: true })
    .limit(500);

  if (error) throw new ToolInputError(`Stock lookup failed: ${error.message}`);

  const rows = (data || []).map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    category: b.category,
    price: b.price,
    stock_quantity: b.stock_quantity ?? 0,
    low_stock_threshold: b.low_stock_threshold ?? 5,
  }));

  const below = rows.filter((b) => b.stock_quantity <= b.low_stock_threshold);
  const out = rows.filter((b) => b.stock_quantity <= 0);
  return {
    titles_in_catalogue: rows.length,
    out_of_stock: out,
    at_or_below_threshold: below,
    ...(includeOk ? { all_titles: rows } : {}),
  };
}

async function searchBooks(db, input) {
  const query = safeTerm(input?.query, 60);
  const category = str(input?.category, { max: 40 });
  const limit = int(input?.limit, { min: 1, max: MAX_LIMIT, fallback: 10 });
  if (!query) throw new ToolInputError("Give me a title or author fragment to search for.");

  let q = db
    .from("books")
    .select("id,title,author,category,price,stock_quantity,low_stock_threshold,is_archived")
    .or(`title.ilike.%${query}%,author.ilike.%${query}%`)
    .order("title", { ascending: true })
    .limit(limit);

  if (category) q = q.eq("category", category);
  if (input?.include_archived !== true) q = q.eq("is_archived", false);

  const { data, error } = await q;
  if (error) throw new ToolInputError(`Catalogue search failed: ${error.message}`);

  return { query, count: (data || []).length, books: data || [] };
}

async function findCustomers(db, input) {
  const query = safeTerm(input?.query, 60);
  const limit = int(input?.limit, { min: 1, max: 10, fallback: 5 });
  if (!query) throw new ToolInputError("Give me a name or email fragment to search for.");

  const { data: profiles, error } = await db
    .from("profiles")
    .select("id,email,first_name,last_name,phone,role,created_at")
    .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new ToolInputError(`Customer lookup failed: ${error.message}`);

  const ids = (profiles || []).map((p) => p.id);
  const stats = new Map();
  if (ids.length) {
    const { data: orders } = await db
      .from("orders")
      .select("user_id,total,status,payment_status")
      .in("user_id", ids)
      .limit(1000);
    for (const o of orders || []) {
      const s = stats.get(o.user_id) || { orders: 0, paid_total: 0 };
      s.orders += 1;
      if (o.payment_status === "paid" && o.status !== "Cancelled") s.paid_total += Number(o.total) || 0;
      stats.set(o.user_id, s);
    }
  }

  return {
    query,
    count: (profiles || []).length,
    customers: (profiles || []).map((p) => ({
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "(no name)",
      email: p.email,
      phone: p.phone,
      role: p.role,
      joined: p.created_at,
      orders: stats.get(p.id)?.orders || 0,
      paid_total: stats.get(p.id)?.paid_total || 0,
    })),
  };
}

async function stockMovements(db, input) {
  const bookId = int(input?.book_id, { min: 1, max: 2147483647, fallback: null });
  const limit = int(input?.limit, { min: 1, max: 25, fallback: 10 });
  if (!bookId) throw new ToolInputError("A numeric book id is required.");

  const { data, error } = await db
    .from("stock_movements")
    .select("created_at,delta,quantity_before,quantity_after,reason,note,admin_email,order_id")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new ToolInputError(`Stock history failed: ${error.message}`);

  return {
    book_id: bookId,
    count: (data || []).length,
    movements: (data || []).map((m) => ({
      at: m.created_at,
      change: m.delta,
      before: m.quantity_before,
      after: m.quantity_after,
      reason: m.reason,
      note: typeof m.note === "string" ? m.note.slice(0, 200) : "",
      by: m.admin_email || null,
    })),
  };
}

const RUNNERS = {
  store_metrics: storeMetrics,
  list_orders: listOrders,
  get_order: getOrder,
  low_stock: lowStock,
  search_books: searchBooks,
  find_customers: findCustomers,
  stock_movements: stockMovements,
};

/** Execute one tool call. Throws ToolInputError with a message the model can read. */
export async function runTool(name, input, { db }) {
  const runner = RUNNERS[name];
  if (!runner) throw new ToolInputError(`Unknown tool "${name}".`);
  return runner(db, input || {});
}

/**
 * Reject anything the model did not define, and keep a single call from
 * returning a wall of JSON. The model gets a truncated notice rather than a
 * silently cut-off object.
 */
export function serialiseToolResult(result, limit = 12000) {
  const json = JSON.stringify(result);
  if (json.length <= limit) return json;
  return `${json.slice(0, limit)}… [truncated: the result was larger than ${limit} characters]`;
}

/**
 * A small, cheap snapshot for the tab's landing state. It needs no model, so
 * the page is still useful before a key is configured — and it is labelled as
 * data, not as assistant output.
 */
export async function storeSnapshot(db) {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86400000);
  const out = { generated_at: to.toISOString(), window_days: 7 };

  const [{ data: metrics, error: metricsError }, { data: books, error: booksError }] = await Promise.all([
    db.rpc("admin_dashboard_metrics", { p_from: from.toISOString(), p_to: to.toISOString() }),
    db
      .from("books")
      .select("id,title,stock_quantity,low_stock_threshold,is_archived")
      .eq("is_archived", false)
      .limit(500),
  ]);

  if (metricsError) out.metrics_error = metricsError.message;
  else {
    out.counts = metrics?.counts || {};
    out.money = metrics?.money || {};
    out.inventory = metrics?.inventory || {};
  }

  if (booksError) out.books_error = booksError.message;
  else {
    const rows = books || [];
    out.low_stock = rows
      .filter((b) => (b.stock_quantity ?? 0) <= (b.low_stock_threshold ?? 5))
      .slice(0, 6)
      .map((b) => ({ title: b.title, stock_quantity: b.stock_quantity ?? 0 }));
  }

  return out;
}

export { ToolInputError };
