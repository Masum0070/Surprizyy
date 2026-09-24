-- ============================================================
-- SURPRIZYY
-- Migration 004 — Form Builder schema
-- ============================================================

create table if not exists public.form_sections (
  id uuid primary key default gen_random_uuid(),

  template_version_id uuid not null
    references public.template_versions(id)
    on delete cascade,

  title text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_fields (
  id uuid primary key default gen_random_uuid(),

  section_id uuid not null
    references public.form_sections(id)
    on delete cascade,

  field_key text not null,
  label text not null,
  field_type text not null default 'text',
  placeholder text,
  helper_text text,
  required boolean not null default false,
  options text[] default '{}',
  max_files integer default 1,
  sort_order integer not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (section_id, field_key)
);

create index if not exists form_sections_template_version_idx
  on public.form_sections(template_version_id, sort_order);

create index if not exists form_fields_section_idx
  on public.form_fields(section_id, sort_order);

create index if not exists form_fields_active_idx
  on public.form_fields(is_active);

create trigger form_sections_set_updated_at
before update on public.form_sections
for each row
execute function public.set_updated_at();

create trigger form_fields_set_updated_at
before update on public.form_fields
for each row
execute function public.set_updated_at();

alter table public.form_sections enable row level security;
alter table public.form_fields enable row level security;
