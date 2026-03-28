-- Deliveries assigned to drivers (auth.users). Used by the driver app + push webhook on INSERT.
-- Apply via Supabase CLI or SQL editor in filename order with other migrations in this folder.

create type public.delivery_status as enum ('pending', 'out_for_delivery', 'delivered');

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  customer_name text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  status public.delivery_status not null default 'pending',
  driver_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliveries_driver_id_idx on public.deliveries(driver_id);
create index if not exists deliveries_status_idx on public.deliveries(status);

alter table public.deliveries enable row level security;

create policy "Drivers can read own deliveries"
on public.deliveries
for select
using (auth.uid() = driver_id);

create policy "Drivers can update own deliveries"
on public.deliveries
for update
using (auth.uid() = driver_id)
with check (auth.uid() = driver_id);
