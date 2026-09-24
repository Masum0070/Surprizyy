-- ============================================================
-- SURPRIZYY
-- Migration 002 — Surprise Data System
-- ============================================================

-- ============================================================
-- 1. SURPRISES
-- One row = one customer's digital surprise.
-- ============================================================

create table public.surprises (
  id uuid primary key default gen_random_uuid(),

  template_version_id uuid not null
    references public.template_versions(id)
    on delete restrict,

  public_id uuid not null default gen_random_uuid()
    unique,

  status text not null default 'draft'
    check (status in (
      'draft',
      'processing',
      'published',
      'expired',
      'archived'
    )),

  recipient_name text,

  customer_email text,

  customer_phone text,

  expires_at timestamptz,

  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- 2. SUBMISSION VALUES
--
-- Flexible customer form data.
--
-- Examples:
-- field_key = recipient_name
-- field_key = special_message
-- field_key = relationship
-- ============================================================

create table public.submission_values (
  id uuid primary key default gen_random_uuid(),

  surprise_id uuid not null
    references public.surprises(id)
    on delete cascade,

  field_key text not null,

  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  value_json jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (surprise_id, field_key),

  check (
    num_nonnulls(
      value_text,
      value_number,
      value_boolean,
      value_date,
      value_json
    ) <= 1
  )
);


-- ============================================================
-- 3. MEDIA FILES
--
-- Database metadata for files stored in Supabase Storage.
-- Actual binary files will NOT be stored in this table.
-- ============================================================

create table public.media_files (
  id uuid primary key default gen_random_uuid(),

  surprise_id uuid not null
    references public.surprises(id)
    on delete cascade,

  field_key text,

  bucket_name text not null,

  storage_path text not null,

  original_filename text,

  mime_type text,

  file_size_bytes bigint
    check (file_size_bytes is null or file_size_bytes >= 0),

  sort_order integer not null default 0,

  created_at timestamptz not null default now()
);


-- ============================================================
-- INDEXES
-- ============================================================

create index surprises_template_version_idx
  on public.surprises(template_version_id);

create index surprises_public_id_idx
  on public.surprises(public_id);

create index surprises_status_idx
  on public.surprises(status);

create index surprises_created_at_idx
  on public.surprises(created_at desc);

create index submission_values_surprise_idx
  on public.submission_values(surprise_id);

create index media_files_surprise_idx
  on public.media_files(surprise_id);

create index media_files_field_idx
  on public.media_files(surprise_id, field_key);


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create trigger surprises_set_updated_at
before update on public.surprises
for each row
execute function public.set_updated_at();


create trigger submission_values_set_updated_at
before update on public.submission_values
for each row
execute function public.set_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.surprises enable row level security;
alter table public.submission_values enable row level security;
alter table public.media_files enable row level security;


-- ============================================================
-- IMPORTANT
--
-- NO PUBLIC SELECT POLICY IS CREATED HERE.
--
-- Customer surprise data is private by default.
-- ============================================================