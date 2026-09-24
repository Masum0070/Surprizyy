-- ============================================================
-- SURPRIZYY
-- Migration 001 — Catalog Foundation
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. GIFT TYPES
-- Examples: Birthday, Rakhi, Anniversary
-- ============================================================

create table public.gift_types (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null unique,
  description text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- 2. TEMPLATES
-- A template belongs to one gift type.
-- ============================================================

create table public.templates (
  id uuid primary key default gen_random_uuid(),

  gift_type_id uuid not null
    references public.gift_types(id)
    on delete restrict,

  name text not null,
  slug text not null unique,
  description text,

  thumbnail_path text,

  base_price numeric(10,2) not null default 0
    check (base_price >= 0),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- 3. TEMPLATE VERSIONS
-- Allows us to keep old customer experiences unchanged.
-- ============================================================

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),

  template_id uuid not null
    references public.templates(id)
    on delete restrict,

  version text not null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  unique (template_id, version)
);


-- ============================================================
-- INDEXES
-- ============================================================

create index templates_gift_type_id_idx
  on public.templates(gift_type_id);

create index templates_active_idx
  on public.templates(is_active);

create index template_versions_template_id_idx
  on public.template_versions(template_id);

create index template_versions_active_idx
  on public.template_versions(is_active);


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


create trigger gift_types_set_updated_at
before update on public.gift_types
for each row
execute function public.set_updated_at();


create trigger templates_set_updated_at
before update on public.templates
for each row
execute function public.set_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.gift_types enable row level security;
alter table public.templates enable row level security;
alter table public.template_versions enable row level security;


-- ============================================================
-- PUBLIC CATALOG READ ACCESS
--
-- Anyone can read ACTIVE catalog items.
-- No public INSERT / UPDATE / DELETE policies.
-- ============================================================

create policy "Public can view active gift types"
on public.gift_types
for select
to anon, authenticated
using (is_active = true);


create policy "Public can view active templates"
on public.templates
for select
to anon, authenticated
using (is_active = true);


create policy "Public can view active template versions"
on public.template_versions
for select
to anon, authenticated
using (is_active = true);