-- Ensure the administrator audit trail exists in the Supabase migration path.
-- The Edge Function writes through the service role; clients have no table access.

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_role text not null,
  action text not null,
  target_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs(created_at desc);

create index if not exists admin_audit_logs_target_user_idx
  on public.admin_audit_logs(target_user_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

create or replace function public.reject_admin_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin audit logs are append-only';
end;
$$;

drop trigger if exists admin_audit_logs_no_update on public.admin_audit_logs;
create trigger admin_audit_logs_no_update
before update on public.admin_audit_logs
for each row execute function public.reject_admin_audit_mutation();

drop trigger if exists admin_audit_logs_no_delete on public.admin_audit_logs;
create trigger admin_audit_logs_no_delete
before delete on public.admin_audit_logs
for each row execute function public.reject_admin_audit_mutation();
