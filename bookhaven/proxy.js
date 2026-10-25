import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./app/lib/supabase-config";

// Next.js 16 renamed the `middleware` file convention to `proxy`, and the
// file must live at the project root (same level as `app/`). The previous
// `app/middleware.js` was in neither place, so this guard never ran.
//
// This is a fast first gate for /admin pages only. It is NOT the security
// boundary: app/admin/page.js re-checks server-side, and every
// /api/admin/* route independently calls requireAdmin().

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // Rebuild the response ONCE with the mutated request, then attach
        // every cookie to that same response. (The previous version created
        // a new response inside the loop, discarding earlier cookies.)
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getUser() validates the JWT with the Auth server; getSession() only
  // decodes whatever is in the cookie and cannot be trusted here.
  //
  // Guarded because an unconfigured deployment (a preview with no
  // NEXT_PUBLIC_* variables) points at an unresolvable placeholder: the call
  // fails, and "no user" is exactly the right interpretation. An exception
  // here would turn /admin into a 500 instead of the sign-in page.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A missing profile is an expected state (never .single() here) and an
  // unreachable database is treated the same way: no admin role, no entry.
  let profile = null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profile = data ?? null;
  } catch {
    profile = null;
  }

  if (profile?.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/access-denied";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
