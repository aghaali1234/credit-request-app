-- =============================================================================
-- Turkana Credit App — Login & Core Schema Recovery
-- =============================================================================
-- WHEN TO RUN THIS:
--   Only if the original Supabase project (ref: estmjhnugeeegosijohg) cannot be
--   restored by Supabase support. This script rebuilds the STRUCTURE the app
--   needs so users can log in again. It does NOT and cannot restore historical
--   data (customers, invoices/credit_rows, distribution list). Those rows only
--   exist in the original project's backups — recover that first if possible.
--
-- HOW TO RUN:
--   1. Connect a fresh/empty Supabase database to the Vercel project so that
--      NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY point at it.
--   2. Open that project's Supabase SQL Editor and run this whole file.
--   3. Log in with the seeded admin account below, then create real users.
--
-- SEEDED ADMIN (change the password immediately after first login):
--   username: admin
--   password: ChangeMe!2026
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- app_users: authentication + role source of truth
-- The app reads: id, username, salesperson_name, role, email, is_active.
-- auth.ts expects the login RPC to return user_id == app_users.id.
-- -----------------------------------------------------------------------------
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  salesperson_name text,
  role text not null default 'salesperson',
  email text,
  is_active boolean not null default true,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- verify_app_user_password: called by NextAuth authorize().
-- Returns one row (user_id, username, salesperson_name) on a correct password,
-- and zero rows otherwise. Uses bcrypt via pgcrypto crypt().
-- -----------------------------------------------------------------------------
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
stable
security definer
set search_path = public
as $$
  select u.id, u.username, u.salesperson_name
  from public.app_users u
  where u.username = p_username
    and u.is_active = true
    and u.password_hash = crypt(p_password, u.password_hash);
$$;

-- Helper to create/reset a user with a plaintext password (hashes on insert).
create or replace function public.upsert_app_user(
  p_username text,
  p_password text,
  p_salesperson_name text default null,
  p_role text default 'salesperson',
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.app_users (username, salesperson_name, role, email, is_active, password_hash)
  values (
    p_username,
    coalesce(p_salesperson_name, p_username),
    p_role,
    p_email,
    true,
    crypt(p_password, gen_salt('bf'))
  )
  on conflict (username) do update
    set salesperson_name = excluded.salesperson_name,
        role = excluded.role,
        email = excluded.email,
        is_active = true,
        password_hash = excluded.password_hash
  returning id into v_id;

  return v_id;
end;
$$;

-- Seed the first admin so you can get back in. CHANGE THIS PASSWORD after login.
select public.upsert_app_user('admin', 'ChangeMe!2026', 'admin', 'admin', null);

-- -----------------------------------------------------------------------------
-- Core data tables (created empty so the app's pages do not crash).
-- Columns match what the application code selects/inserts. Historical rows
-- are NOT restored here.
-- -----------------------------------------------------------------------------

-- Customer list shown on the dashboard.
create table if not exists public.credit_customer_list (
  id uuid primary key default gen_random_uuid(),
  customer_code text,
  customer_name text,
  salesperson text,
  bp_email text,
  free_txt text,
  created_at timestamptz not null default now()
);
create index if not exists credit_customer_list_salesperson_idx
  on public.credit_customer_list (salesperson);
create index if not exists credit_customer_list_customer_code_idx
  on public.credit_customer_list (customer_code);

-- Invoice / sales line items backing customer + invoice views.
create table if not exists public.credit_rows (
  id uuid primary key default gen_random_uuid(),
  customer_code text,
  customer_name text,
  salesperson text,
  invoice_no text,
  invoice_date date,
  item_no text,
  item_descp text,
  quantity numeric,
  sales_amount numeric,
  piece_price numeric,
  sales_batch_number text,
  sales_lot_no text,
  batch_expiration_date date,
  free_txt text,
  created_at timestamptz not null default now()
);
create index if not exists credit_rows_customer_code_idx on public.credit_rows (customer_code);
create index if not exists credit_rows_salesperson_idx on public.credit_rows (salesperson);
create index if not exists credit_rows_invoice_no_idx on public.credit_rows (invoice_no);

-- Analytics view used by the profile page.
create or replace view public.credit_rows_analytics as
  select
    salesperson,
    customer_code,
    customer_name,
    count(*)                as row_count,
    sum(coalesce(sales_amount, 0)) as total_sales_amount,
    sum(coalesce(quantity, 0))     as total_quantity
  from public.credit_rows
  group by salesperson, customer_code, customer_name;

-- Cart drafts: one active draft per (user, salesperson).
create table if not exists public.credit_request_cart_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  salesperson text not null,
  updated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, salesperson)
);

-- Items added to a credit-request cart.
create table if not exists public.credit_request_cart_items (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.credit_request_cart_drafts (id) on delete cascade,
  user_id text not null,
  salesperson text not null,
  customer_code text,
  customer_name text,
  invoice_no text,
  invoice_date date,
  item_no text,
  item_descp text,
  quantity numeric,
  sales_amount numeric,
  piece_price numeric,
  sales_batch_number text,
  sales_lot_no text,
  batch_expiration_date date,
  free_txt text,
  removed_from_cart_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cart_items_user_salesperson_idx
  on public.credit_request_cart_items (user_id, salesperson);

-- Photos attached to a cart draft.
create table if not exists public.credit_request_photos (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.credit_request_cart_drafts (id) on delete cascade,
  file_name text,
  public_url text,
  storage_path text,
  removed_from_cart_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cart_photos_draft_idx on public.credit_request_photos (draft_id);

-- =============================================================================
-- After running: sign in as admin / ChangeMe!2026, change the password, then
-- recreate salesperson accounts and re-import customer/invoice data.
-- =============================================================================
