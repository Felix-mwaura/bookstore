import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./app/lib/supabase-config";
import { buildCsp, createNonce, isNonceRoute, NONCE_HEADER } from "./app/lib/csp";

// Next.js 16 renamed the `middleware` file convention to `proxy`, and the
// file must live at the project root (same level as `app/`). The previous
// `app/middleware.js` was in neither place, so this guard never ran.
//
// Two jobs:
//
//   1. Attach the Content-Security-Policy to every page response. Request-time
//      rendered pages get a per-response nonce, which Next reads from the
//      request headers and stamps onto its own <script> tags. Prerendered
//      pages cannot carry a nonce (their HTML exists before the request), so
//      they get the 'unsafe-inline' tier — see app/lib/csp.js for why, and
//      for the exact list.
//
//   2. Gate /admin. This is a fast first check, NOT the security boundary:
//      app/admin/page.js re-checks server-side, and every /api/admin/* route
//      independently calls requireAdmin().

const IS_DEV = process.env.NODE_ENV !== "production";

function withCsp(response, csp) {
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const nonce = isNonceRoute(pathname) ? createNonce() : null;
  const csp = buildCsp({ nonce, supabaseUrl: SUPABASE_URL, isDev: IS_DEV });

  // Next looks for the nonce on the REQUEST, then propagates it to the
  // rendered script tags. The response header is what the browser enforces.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  if (nonce) requestHeaders.set(NONCE_HEADER, nonce);

  if (!pathname.startsWith("/admin")) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);
  }

  let response = withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // Rebuild the response ONCE with the request headers (so the CSP and
        // nonce survive a session refresh), then attach every cookie to that
        // same response.
        response = withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getUser() validates the JWT with the Auth server; getSession() only
  // decodes whatever is in the cookie and cannot be trusted here.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A missing profile is an expected state (never .single() here).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/access-denied";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Pages only. API responses are JSON (no script to police) and static
  // assets are already immutable and cacheable; running the proxy for them
  // would add latency for no security benefit.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
