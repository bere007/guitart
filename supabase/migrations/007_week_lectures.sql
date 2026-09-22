-- Adds a teacher-editable "lecture" per week: title + text + one photo.
-- All content is authored by teachers (is_admin = true) in the admin panel
-- -- nothing here is pre-filled; students see a placeholder until a teacher
-- fills it in. Run this once in your Supabase project's SQL Editor.

create table if not exists public.week_lectures (
  week_number int primary key check (week_number between 1 and 8),
  title text,
  body text,
  photo_path text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.week_lectures enable row level security;

create policy "week_lectures: signed-in can read" on public.week_lectures
  for select using (auth.uid() is not null);

create policy "week_lectures: admin can insert" on public.week_lectures
  for insert with check (public.is_admin());

create policy "week_lectures: admin can update" on public.week_lectures
  for update using (public.is_admin()) with check (public.is_admin());

create policy "week_lectures: admin can delete" on public.week_lectures
  for delete using (public.is_admin());

-- Lecture photos live in the same "lessons" bucket as lesson videos (same
-- admin-writes/students-read RLS already covers it) -- just widen the
-- allowed mime types to include images.
update storage.buckets
set allowed_mime_types = array['video/mp4','video/quicktime','video/webm','video/x-matroska','image/jpeg','image/png','image/webp']
where id = 'lessons';
