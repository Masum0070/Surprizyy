-- Music files are kept private. The public-music and public-surprise
-- Edge Functions issue short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('template-music', 'template-music', false)
on conflict (id) do update
set public = excluded.public;
