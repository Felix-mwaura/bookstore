import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";

// Was hardcoded here previously — now required from the environment.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export default async function AdminPage() {
  if (!ADMIN_EMAIL) {
    // Fail loudly and specifically rather than silently misbehaving —
    // this is a deployment/config problem, not a normal access-denied case.
    throw new Error("Server misconfigured: ADMIN_EMAIL environment variable is not set");
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  // 1. Not logged in → go to login
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // 2. Wrong email → go to home (not account, so they can't snoop)
  if (session.user.email !== ADMIN_EMAIL) redirect("/");

  // 3. Must have admin role in DB — this, not the email check above, is
  // the real authorization gate every mutation ultimately relies on.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  // 4. Service role client — bypasses ALL RLS
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // These three are fully independent — run them concurrently instead of
  // one after another. Deliberately NOT included here: auth.admin.listUsers(),
  // which used to run unconditionally on every single page load just to get
  // real email addresses. That's now a separate, lazy fetch
  // (GET /api/admin/users) the client only makes once the Users or
  // Customers tab is actually opened — the initial dashboard load no
  // longer waits on it.
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
  // costlier Admin API call). The Users/Customers tabs fetch the full,
  // email-inclusive version themselves on first open.
  const users = profilesData.map(p => ({
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
      sessionUser={{ id: session.user.id, email: session.user.email }}
    />
  );
}