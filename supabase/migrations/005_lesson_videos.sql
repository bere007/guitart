-- Lets teachers (is_admin = true) upload the actual video for each lesson;
-- students can only watch, never upload/replace/delete.
-- Run this once in your Supabase project's SQL Editor.

create table if not exists public.lesson_videos (
  week_number int not null check (week_number between 1 and 8),
  lesson_index int not null check (lesson_index >= 0),
  video_path text not null,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  primary key (week_number, lesson_index)
);

alter table public.lesson_videos enable row level security;

-- Lesson content isn't private -- any signed-in student can see which
-- lessons have a video attached (and later fetch a signed URL for it).
create policy "lesson_videos: signed-in can read" on public.lesson_videos
  for select using (auth.uid() is not null);

create policy "lesson_videos: admin can insert" on public.lesson_videos
  for insert with check (public.is_admin());

create policy "lesson_videos: admin can update" on public.lesson_videos
  for update using (public.is_admin()) with check (public.is_admin());

create policy "lesson_videos: admin can delete" on public.lesson_videos
  for delete using (public.is_admin());

-- Private bucket, same as "reports" -- playback only via a signed URL, but
-- the read policy here is "any signed-in user", not "only your own folder",
-- since lesson videos are shared course content, not personal submissions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lessons', 'lessons', false,
  314572800, -- 300 MB, lesson videos tend to run longer than a report clip
  array['video/mp4','video/quicktime','video/webm','video/x-matroska']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "lessons bucket: signed-in can read" on storage.objects
  for select using (bucket_id = 'lessons' and auth.uid() is not null);

create policy "lessons bucket: admin can upload" on storage.objects
  for insert with check (bucket_id = 'lessons' and public.is_admin());

create policy "lessons bucket: admin can update" on storage.objects
  for update using (bucket_id = 'lessons' and public.is_admin());

create policy "lessons bucket: admin can delete" on storage.objects
  for delete using (bucket_id = 'lessons' and public.is_admin());
