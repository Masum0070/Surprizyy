-- Existing deployments may have form_fields without the timestamp expected by
-- the shared updated_at trigger.
alter table if exists public.form_fields
  add column if not exists updated_at timestamptz default now();

update public.form_fields
set updated_at = now()
where updated_at is null;
