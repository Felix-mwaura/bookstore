import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import AdminClient from "./admin-client";

// ── Server-side admin check using service role ────────────
export default async function AdminPage() {
  const cookieStore = await cookies();

  // Regular client to check session
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

  // Get session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/");

  // ── Use service role to fetch ALL data ──────────────────
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  // Fetch ALL orders (bypasses RLS with service role)
  const { data: orders } = await adminSupabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch ALL profiles
  const { data: profiles } = await adminSupabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch ALL users from auth.users using admin API
  const { data: { users: authUsers } } = await adminSupabase.auth.admin.listUsers();

  // Merge profiles with auth user data (email, name, phone)
  const users = (profiles || []).map(profile => {
    const authUser = authUsers?.find(u => u.id === profile.id);
    const meta = authUser?.user_metadata || {};
    return {
      ...profile,
      email: authUser?.email || "",
      first_name: meta.first_name || "",
      last_name: meta.last_name || "",
      phone: meta.phone || "",
    };
  });

  // Books count
  const { count: booksCount } = await adminSupabase
    .from("books")
    .select("*", { count: "exact", head: true });

  return (
    <AdminClient
      initialOrders={orders || []}
      initialUsers={users || []}
      initialBooksCount={booksCount || 0}
      sessionUser={{ id: session.user.id, email: session.user.email }}
    />
  );
}