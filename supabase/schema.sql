-- Astris Field Kit: accounts and sync.
-- Run this once in your Supabase project (Dashboard, SQL Editor, New query, paste, Run).
-- Safe to run again.

-- One row per production plan, plus one row for the saved rigs, cameras and lenses.
create table if not exists public.user_data (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('project', 'library')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  -- When the edit was made, on the device that made it (milliseconds).
  updated_at bigint not null,
  -- When the server received it; devices ask for rows newer than the last one they saw.
  server_updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

create index if not exists user_data_changes on public.user_data (user_id, server_updated_at);

create or replace function public.touch_user_data() returns trigger
language plpgsql as $$
begin
  new.server_updated_at = now();
  return new;
end $$;

drop trigger if exists touch_user_data on public.user_data;
create trigger touch_user_data before insert or update on public.user_data
for each row execute function public.touch_user_data();

-- Each person can only ever see and change their own rows.
alter table public.user_data enable row level security;

drop policy if exists "own rows: read" on public.user_data;
create policy "own rows: read" on public.user_data for select using (auth.uid() = user_id);
drop policy if exists "own rows: add" on public.user_data;
create policy "own rows: add" on public.user_data for insert with check (auth.uid() = user_id);
drop policy if exists "own rows: change" on public.user_data;
create policy "own rows: change" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows: remove" on public.user_data;
create policy "own rows: remove" on public.user_data for delete using (auth.uid() = user_id);

-- Plan images (storyboard frames, shot designer backgrounds), private, in a folder per person.
insert into storage.buckets (id, name, public) values ('images', 'images', false) on conflict (id) do nothing;

drop policy if exists "own images: read" on storage.objects;
create policy "own images: read" on storage.objects for select
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own images: add" on storage.objects;
create policy "own images: add" on storage.objects for insert
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own images: change" on storage.objects;
create policy "own images: change" on storage.objects for update
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own images: remove" on storage.objects;
create policy "own images: remove" on storage.objects for delete
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
