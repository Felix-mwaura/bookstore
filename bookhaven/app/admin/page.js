import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminClient from './admin-client';

export default async function AdminPage() {
  const cookieStore = await cookies();

  // 1. Check session server-side
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/login?tab=login');
  }

  // 2. Verify admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/account');
  }

  // 3. Fetch ALL auth users with SERVICE ROLE (server-only)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
  const authUsers = authData?.users || [];

  // 4. Fetch profiles
  const { data: profilesData } = await supabase.from('profiles').select('*');
  const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

  // 5. Merge auth users + profiles
  const allUsers = authUsers.map(u => {
    const prof = profilesMap.get(u.id) || {};
    return {
      id: u.id,
      email: u.email,
      first_name: u.user_metadata?.first_name || prof.first_name || '',
      last_name: u.user_metadata?.last_name || prof.last_name || '',
      phone: u.phone || u.user_metadata?.phone || '',
      role: prof.role || 'customer',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    };
  });

  // 6. Fetch orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  // 7. Fetch books count
  const { count: booksCount } = await supabase
    .from('books')
    .select('*', { count: 'exact', head: true });

  return (
    <AdminClient
      initialOrders={orders || []}
      initialUsers={allUsers}
      initialBooksCount={booksCount || 0}
      sessionUser={session.user}
    />
  );
}