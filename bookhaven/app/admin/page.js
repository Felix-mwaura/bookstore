import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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

  // 1. Secure check using getUser()
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  // 2. Case-insensitive email check using environment variables
  const adminEmail = process.env.ADMIN_EMAIL || "mwaurafelix754@gmail.com";
  if (user.email?.toLowerCase() !== adminEmail.toLowerCase()) redirect("/");

  // 3. Validate admin role in DB
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  // 4. Service role client
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch ALL orders with error logging
  const { data: ordersData, error: ordersError } = await admin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (ordersError) console.error("Error fetching orders:", ordersError);

  // Fetch ALL profiles
  const { data: profilesData } = await admin.from("profiles").select("*");

  // Increase listUsers perPage limit to retrieve all users
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authUsers = authData?.users || [];

  // Merge profiles with auth user data
  const users = (profilesData || []).map((p) => {
    const au = authUsers.find((u) => u.id === p.id);
    const meta = au?.user_metadata || {};
    return {
      id: p.id,
      role: p.role,
      created_at: au?.created_at || p.created_at,
      email: au?.email || "",
      first_name: meta.first_name || p.first_name || "",
      last_name: meta.last_name || p.last_name || "",
      phone: meta.phone || p.phone || "",
    };
  });

  // Books count
  const { count: booksCount } = await admin
    .from("books")
    .select("*", { count: "exact", head: true });

  return (
    <AdminClient
      initialOrders={ordersData || []}
      initialUsers={users}
      initialBooksCount={booksCount || 0}
      sessionUser={{ id: user.id, email: user.email }}
    />
  );
}