-- Dedicated object storage bucket for profile hero images

insert into storage.buckets (id, name, public)
values ('resume-hero-images', 'resume-hero-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can read hero images" on storage.objects;
create policy "Public can read hero images"
on storage.objects
for select
using (bucket_id = 'resume-hero-images');

drop policy if exists "Users can upload hero images" on storage.objects;
create policy "Users can upload hero images"
on storage.objects
for insert
with check (
  bucket_id = 'resume-hero-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own hero images" on storage.objects;
create policy "Users can delete own hero images"
on storage.objects
for delete
using (
  bucket_id = 'resume-hero-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
