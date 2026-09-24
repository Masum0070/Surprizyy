-- Allow the public customer form to read only active form definitions.
-- Writes remain restricted to the form-management Edge Function.

drop policy if exists "Public can read active form sections"
  on public.form_sections;

create policy "Public can read active form sections"
  on public.form_sections
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.template_versions
      join public.templates
        on templates.id = template_versions.template_id
      where template_versions.id = form_sections.template_version_id
        and template_versions.is_active = true
        and templates.is_active = true
    )
  );

drop policy if exists "Public can read active form fields"
  on public.form_fields;

create policy "Public can read active form fields"
  on public.form_fields
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.form_sections
      join public.template_versions
        on template_versions.id = form_sections.template_version_id
      join public.templates
        on templates.id = template_versions.template_id
      where form_sections.id = form_fields.section_id
        and form_sections.is_active = true
        and template_versions.is_active = true
        and templates.is_active = true
    )
  );
