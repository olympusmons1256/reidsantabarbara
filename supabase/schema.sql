-- Supabase schema for the generic resume template editor

create extension if not exists "pgcrypto";

create table if not exists public.resume_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resume_templates_owner_id_idx on public.resume_templates(owner_id);
create index if not exists resume_templates_updated_at_idx on public.resume_templates(updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists resume_templates_set_updated_at on public.resume_templates;
create trigger resume_templates_set_updated_at
before update on public.resume_templates
for each row execute procedure public.set_updated_at();

alter table public.resume_templates enable row level security;

-- Users can read and write only their own templates.
drop policy if exists "Templates are selectable by owner" on public.resume_templates;
create policy "Templates are selectable by owner"
on public.resume_templates
for select
using (auth.uid() = owner_id);

drop policy if exists "Templates are insertable by owner" on public.resume_templates;
create policy "Templates are insertable by owner"
on public.resume_templates
for insert
with check (auth.uid() = owner_id);

drop policy if exists "Templates are updatable by owner" on public.resume_templates;
create policy "Templates are updatable by owner"
on public.resume_templates
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Templates are deletable by owner" on public.resume_templates;
create policy "Templates are deletable by owner"
on public.resume_templates
for delete
using (auth.uid() = owner_id);

-- Object storage bucket for uploaded media assets
insert into storage.buckets (id, name, public)
values ('resume-media', 'resume-media', true)
on conflict (id) do nothing;

-- Public read policy for media URLs
drop policy if exists "Public can read resume media" on storage.objects;
create policy "Public can read resume media"
on storage.objects
for select
using (bucket_id = 'resume-media');

-- Authenticated users can upload/delete their own media objects under user folder prefix.
drop policy if exists "Users can upload resume media" on storage.objects;
create policy "Users can upload resume media"
on storage.objects
for insert
with check (
  bucket_id = 'resume-media'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own resume media" on storage.objects;
create policy "Users can delete own resume media"
on storage.objects
for delete
using (
  bucket_id = 'resume-media'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
