-- Production flow additions for payment verification and owner access.

alter table public.surprises
  add column if not exists theme_id text not null default 'royal-gold',
  add column if not exists management_token_hash text,
  add column if not exists payment_id uuid;

create unique index if not exists surprises_management_token_hash_idx
  on public.surprises(management_token_hash)
  where management_token_hash is not null;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_order_id text,
  provider_payment_id text,
  template_version_id uuid not null references public.template_versions(id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null default 'created'
    check (status in ('created', 'verified', 'failed', 'refunded')),
  customer_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

alter table public.surprises
  drop constraint if exists surprises_payment_id_fkey;

alter table public.surprises
  add constraint surprises_payment_id_fkey
  foreign key (payment_id) references public.payment_orders(id)
  on delete restrict;

create index if not exists payment_orders_template_version_idx
  on public.payment_orders(template_version_id);

create index if not exists payment_orders_status_idx
  on public.payment_orders(status);

alter table public.payment_orders enable row level security;

-- Payment and surprise writes are performed by Edge Functions using service role.
