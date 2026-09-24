create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'Surprizyy',
  support_email text not null default '',
  whatsapp_number text not null default '',
  instagram_url text not null default '',
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (site_name)
select 'Surprizyy'
where not exists (select 1 from public.site_settings);

alter table public.site_settings enable row level security;

create policy "Public can read maintenance status"
on public.site_settings
for select
to anon, authenticated
using (true);
