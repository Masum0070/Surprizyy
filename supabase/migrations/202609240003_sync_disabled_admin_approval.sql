update public.admin_profiles
set
  approval_status = 'pending',
  updated_at = now()
where active = false
  and approval_status = 'approved'
  and role <> 'super_admin';
