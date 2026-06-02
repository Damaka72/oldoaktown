create table if not exists public.blog_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  slug text not null,
  meta_description text,
  category text,
  tags text[],
  is_breaking boolean not null default false,
  body text not null,
  image_prompt text,
  needs_voice boolean not null default false,
  editor_note text,
  source_url text,
  status text not null default 'draft',
  week_number integer
);

alter table public.blog_drafts enable row level security;

create policy "Service role full access" on public.blog_drafts
  for all using (true) with check (true);
