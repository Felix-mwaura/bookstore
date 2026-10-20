import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase-config";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";

// Renders the admin dashboard.
//
// Reads run with the ADMIN'S OWN JWT, so Row Level Security decides what is
// visible and no secret is needed just to open the page. (This used to throw
// a 500 whenever SUPABASE_SERVICE_ROLE_KEY was absent — which is always the
// case on preview deployments, where Vercel scopes secrets to production.)
//
// The service role is still required for *mutations* (create/edit books,
// change order status, change roles); those live in /api/admin/* and fail
// with an explicit message rather than a crash.
export default async function AdminPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore; proxy.js refreshes.
        }
      },
    },
  });

  // 1. Must be signed in. getUser() verifies the JWT with the Auth server,
  //    unlike getSession() which only decodes the cookie.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  // 2. Must have role = admin in the database. This is the authorization
  //    gate — NOT an email comparison.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/access-denied");

  // 3. Dashboard reads, scoped by RLS to what an admin may see.
  const [ordersResult, profilesResult, booksCountResult] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("books").select("*", { count: "exact", head: true }),
  ]);

  const readError =
    ordersResult.error || profilesResult.error || booksCountResult.error;

  if (readError) {
    // Surface the real reason instead of a blank "server error" page. This is
    // a configuration problem (usually a missing RLS policy or env var), not
    // something the admin can retry their way out of.
    console.error("Admin dashboard read failed:", readError.message);
    throw new Error(`Could not load the admin dashboard: ${readError.message}`);
  }

  const ordersData = ordersResult.data || [];
  const profilesData = profilesResult.data || [];
  const booksCount = booksCountResult.count || 0;

  const users = profilesData.map((p) => ({
    id: p.id,
    role: p.role,
    created_at: p.created_at,
    email: p.email || "",
    first_name: p.first_name || "",
    last_name: p.last_name || "",
    phone: p.phone || "",
  }));

  return (
    <AdminClient
      initialOrders={ordersData}
      initialUsers={users}
      initialBooksCount={booksCount}
      sessionUser={{ id: user.id, email: user.email }}
      canMutate={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
    />
  );
}
