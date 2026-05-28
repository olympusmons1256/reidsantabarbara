alter table public.resume_templates
  add column if not exists is_published boolean not null default false,
  add column if not exists published_at timestamptz;

create index if not exists resume_templates_is_published_idx
  on public.resume_templates(is_published)
  where is_published = true;

drop policy if exists "Published templates are selectable publicly" on public.resume_templates;
create policy "Published templates are selectable publicly"
on public.resume_templates
for select
using (is_published = true);
