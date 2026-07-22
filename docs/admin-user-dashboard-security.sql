-- Optional hardening for the Admin > User Settings inspect dashboard.
-- The application routes in this PR already enforce admin access on the server
-- before using the Supabase service role key. Run this SQL only if your
-- app_users table does not already have trusted role/email fields and you want
-- equivalent database-side RPC/RLS enforcement for direct Supabase clients.

alter table public.app_users
  add column if not exists role text not null default 'salesperson',
  add column if not exists email text;

create or replace function public.is_current_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users
    where user_id = auth.uid()
      and is_active = true
      and role = 'admin'
  );
$$;

create or replace function public.can_view_salesperson_credit_rows(target_salesperson text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users
    where user_id = auth.uid()
      and is_active = true
      and (
        role = 'admin'
        or salesperson_name = target_salesperson
      )
  );
$$;

alter table public.credit_rows enable row level security;

create policy "credit rows self or admin read"
on public.credit_rows
for select
to authenticated
using (public.can_view_salesperson_credit_rows(salesperson));

alter table public.credit_customer_list enable row level security;

create policy "customer list self or admin read"
on public.credit_customer_list
for select
to authenticated
using (public.can_view_salesperson_credit_rows(salesperson));
