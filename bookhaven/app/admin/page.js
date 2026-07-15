import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import AdminClient from "./admin-client";

const ADMIN_EMAIL = "mwaurafelix754@gmail.com";

export default async function AdminPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );

  // 1. Must be logged in
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // 2. Must be the specific admin email
  if (session.user.email !== ADMIN_EMAIL) redirect("/");

  // 3. Must have admin role in profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  // 4. Use service role to fetch ALL data (bypasses RLS)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch ALL orders from all users
  const { data: orders } = await adminClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch ALL profiles
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("*");

  // Fetch ALL auth users (real emails, names, phones)
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers();

  // Merge profiles + auth users
  const users = (profiles || []).map(p => {
    const au = (authUsers || []).find(u => u.id === p.id);
    const meta = au?.user_metadata || {};
    return {
      id: p.id,
      role: p.role,
      created_at: p.created_at,
      email: au?.email || "",
      first_name: meta.first_name || "",
      last_name: meta.last_name || "",
      phone: meta.phone || au?.phone || "",
    };
  });

  // Books count
  const { count: booksCount } = await adminClient
    .from("books")
    .select("*", { count: "exact", head: true });

  return (
    <AdminClient
      initialOrders={orders || []}
      initialUsers={users}
      initialBooksCount={booksCount || 0}
      sessionUser={{ id: session.user.id, email: session.user.email }}
    />
  );
}