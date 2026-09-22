-- Lets a teacher attach several photos to one week's lecture, not just one.
-- Run this once in your Supabase project's SQL Editor.

create table if not exists public.week_lecture_photos (
  id bigint generated always as identity primary key,
  week_number int not null check (week_number between 1 and 8),
  photo_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.week_lecture_photos enable row level security;

create policy "week_lecture_photos: signed-in can read" on public.week_lecture_photos
  for select using (auth.uid() is not null);

create policy "week_lecture_photos: admin can insert" on public.week_lecture_photos
  for insert with check (public.is_admin());

create policy "week_lecture_photos: admin can delete" on public.week_lecture_photos
  for delete using (public.is_admin());

-- Carry over a photo already uploaded under the old single-photo column, if any.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'week_lectures' and column_name = 'photo_path'
  ) then
    insert into public.week_lecture_photos (week_number, photo_path, position)
    select week_number, photo_path, 0 from public.week_lectures where photo_path is not null;

    alter table public.week_lectures drop column photo_path;
  end if;
end $$;
