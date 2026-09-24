alter table public.templates
  add column if not exists preview_url text;

insert into storage.buckets (id, name, public)
values ('template-previews', 'template-previews', true)
on conflict (id) do update set public = true;
