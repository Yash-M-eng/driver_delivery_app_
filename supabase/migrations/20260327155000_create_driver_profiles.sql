create table if not exists public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  push_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_profiles enable row level security;

create policy "Drivers can read own profile"
on public.driver_profiles
for select
using (auth.uid() = user_id);

create policy "Drivers can upsert own profile"
on public.driver_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
