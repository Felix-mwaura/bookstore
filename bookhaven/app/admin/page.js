import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase-config";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";

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
  //    gate — NOT an email comparison. ADMIN_EMAIL is optional and only
  //    protects the owner account from demotion (see lib/admin-auth.js).
  //    maybeSingle(): a missing profile is an expected state, not PGRST116.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/access-denied");

  // 3. Service-role client for the dashboard's read queries.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Add it in Vercel → Project → Settings → Environment Variables (server-only)."
    );
  }

  const { serviceClient } = await import("../lib/server");
  const admin = serviceClient();

  // These three are independent — run them concurrently. Deliberately NOT
  // included: auth.admin.listUsers(), which is a lazy fetch behind
  // GET /api/admin/users, only made once Users or Customers is opened.
  const [ordersResult, profilesResult, booksCountResult] = await Promise.all([
    admin.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("books").select("*", { count: "exact", head: true }),
  ]);

  const ordersData = ordersResult.data || [];
  const profilesData = profilesResult.data || [];
  const booksCount = booksCountResult.count || 0;

  // Initial user list from `profiles` alone — real names/roles/join dates,
  // but no email yet (email lives only in auth.users, which requires the
  // costlier Admin API call).
  const users = profilesData.map((p) => ({
    id: p.id,
    role: p.role,
    created_at: p.created_at,
    email: "",
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
    />
  );
}
