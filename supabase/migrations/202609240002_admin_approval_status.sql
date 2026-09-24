alter table public.admin_profiles
  add column if not exists approval_status text
  not null default 'approved';

alter table public.admin_profiles
  drop constraint if exists admin_profiles_approval_status_check;

alter table public.admin_profiles
  add constraint admin_profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

create index if not exists admin_profiles_approval_status_idx
  on public.admin_profiles(approval_status);
