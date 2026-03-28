-- Ensures push_token exists if an older migration dropped it.
alter table public.driver_profiles add column if not exists push_token text;
