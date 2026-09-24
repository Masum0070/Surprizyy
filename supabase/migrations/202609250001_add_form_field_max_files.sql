-- Keep existing deployments compatible with the form builder's upload limit.
alter table if exists public.form_fields
  add column if not exists max_files integer default 1;

alter table if exists public.form_fields
  add column if not exists updated_at timestamptz default now();

update public.form_fields
set max_files = 1
where max_files is null;

update public.form_fields
set updated_at = now()
where updated_at is null;
