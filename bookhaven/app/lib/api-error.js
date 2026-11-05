// One place where a database error becomes a response.
//
// Postgres error text is written for whoever runs the database, not for a
// shopper: "duplicate key value violates unique constraint
// newsletter_subscribers_email_key", "new row violates row-level security
// policy for table \"orders\"", or a column name that tells an attacker what
// the schema looks like. Returning it to the browser leaked all of that, and
// it read like a crash rather than an answer.
//
// Every route now logs the real error server-side and returns a short,
// human sentence. A few codes deserve a specific sentence; everything else
// shares one.


/**
 * Server-side log with the route, the database's own code and the parts of
 * its message that are about *what happened* rather than where.
 * Never pass a credential or a whole row through here.
 */
export function logRouteError(route, error, context = {}) {
  // One line, so it survives log search: `console.error(route, obj)` renders
  // the object as [object Object] in some collectors, and this line is the
  // only copy of the real error once the response has been generalised.
  console.error(
    `${route}: ${JSON.stringify({
      code: error?.code ?? null,
      message: error?.message ?? String(error),
      details: error?.details ?? null,
      hint: error?.hint ?? null,
      ...context,
    })}`
  );
}

/**
 * A route handler may return any Response, so this one builds a plain one:
 * `Response.json()` is in both the Node and the Edge runtime, and it keeps
 * this module importable from a plain `node scripts/...` test (a bare
 * `next/server` import does not resolve outside the bundler).
 *
 * @param {{ route: string, error: any, fallback: string, context?: object }} input
 * @returns {Response} a 500 with a generic sentence (409 for a duplicate)
 */
export function dbErrorResponse({ route, error, fallback, context }) {
  logRouteError(route, error, context);

  // 23505 unique_violation. Only callers that already allow for a duplicate
  // should pass this through; the newsletter handles its own (a repeat
  // sign-up is a success, not an error).
  if (error?.code === "23505") {
    return Response.json({ error: "That already exists." }, { status: 409 });
  }

  return Response.json({ error: fallback }, { status: 500 });
}
