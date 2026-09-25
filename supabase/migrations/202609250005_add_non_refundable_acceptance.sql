alter table public.payment_orders
  add column if not exists non_refundable_accepted boolean not null default false,
  add column if not exists non_refundable_accepted_at timestamptz,
  add column if not exists non_refundable_policy_version text;
