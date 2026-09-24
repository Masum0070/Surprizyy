-- Existing deployments may have form_sections without the timestamp expected
-- by the shared updated_at trigger.
alter table if exists public.form_sections
  add column if not exists updated_at timestamptz default now();

update public.form_sections
set updated_at = now()
where updated_at is null;
