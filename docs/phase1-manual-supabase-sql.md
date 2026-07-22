# Phase 1 manual Supabase SQL (only if missing)

This app expects a database function named `public.verify_app_user_password`.

Run the SQL below in Supabase SQL Editor **only if the function does not already exist**:

```sql
create or replace function public.verify_app_user_password(
  p_username text,
  p_password text
)
returns table (
  user_id uuid,
  username text,
  salesperson_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select u.user_id, u.username, u.salesperson_name
  from public.app_users u
  where u.username = p_username
    and u.password_hash = crypt(p_password, u.password_hash)
    and u.is_active = true
  limit 1;
$$;

revoke all on function public.verify_app_user_password(text, text) from public;
grant execute on function public.verify_app_user_password(text, text) to service_role;
```

Optional performance index (only if not already present):

```sql
create index if not exists idx_credit_rows_salesperson_customer
  on public.credit_rows (salesperson, customer_code, customer_name);
```

Admin password reset support (required for the dashboard User Settings panel):

```sql
create or replace function public.update_app_user_password(
  p_salesperson_name text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.app_users
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where salesperson_name = p_salesperson_name;

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

revoke all on function public.update_app_user_password(text, text) from public;
grant execute on function public.update_app_user_password(text, text) to service_role;
```
