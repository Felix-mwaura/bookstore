-- Fix: /admin returned a 500 whenever SUPABASE_SERVICE_ROLE_KEY was absent.
-- The dashboard now reads with the admin's own JWT (RLS), so no secret is
-- needed just to open the page. Applied to project luniopceavtkljywukyi.

begin;

-- 1. "Is the caller an admin?" SECURITY DEFINER so a policy ON profiles can
--    call it without the infinite recursion a plain subquery would cause.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin'
  );
$function$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- 2. Admins may read every profile (dashboard user list). Customers keep
--    read-own through the existing profiles_select_own policy; policies are
--    OR-ed together.
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

-- 3. profiles.email was referenced by sync_user_email() but never existed,
--    so changing an email address failed inside the auth trigger.
alter table public.profiles add column if not exists email text;

update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

create index if not exists idx_profiles_email on public.profiles (lower(email));

commit;
