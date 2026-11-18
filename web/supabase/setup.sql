-- Private bucket: no anonymous/authenticated SELECT or INSERT policies.
-- Only the document-files function uses the backend service key after Firebase checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('college-documents', 'college-documents', false, 5242880,
  array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
