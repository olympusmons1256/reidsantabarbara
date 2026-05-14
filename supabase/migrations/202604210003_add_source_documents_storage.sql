-- Dedicated object storage bucket for AI intake source documents

insert into storage.buckets (id, name, public)
values ('resume-source-docs', 'resume-source-docs', true)
on conflict (id) do nothing;

drop policy if exists "Public can read source docs" on storage.objects;
create policy "Public can read source docs"
on storage.objects
for select
using (bucket_id = 'resume-source-docs');

drop policy if exists "Users can upload source docs" on storage.objects;
create policy "Users can upload source docs"
on storage.objects
for insert
with check (
  bucket_id = 'resume-source-docs'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own source docs" on storage.objects;
create policy "Users can delete own source docs"
on storage.objects
for delete
using (
  bucket_id = 'resume-source-docs'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
