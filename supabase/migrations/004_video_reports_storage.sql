-- Switches weekly reports from a pasted link to a real uploaded video file,
-- stored in Supabase Storage instead of a third-party host.
-- Run this once in your Supabase project's SQL Editor.

-- 1) week_reports: video_path replaces report_url as the primary field.
-- report_url is kept (now nullable) so reports submitted before this change
-- keep working -- the UI just stops asking for a link.
alter table public.week_reports add column if not exists video_path text;
alter table public.week_reports alter column report_url drop not null;

-- 2) storage bucket for the videos. Private (not public) -- videos are only
-- readable via a short-lived signed URL that the app requests for the
-- report's owner or an admin, never a permanent public link.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports', 'reports', false,
  209715200, -- 200 MB
  array['video/mp4','video/quicktime','video/webm','video/x-matroska','video/3gpp','video/3gpp2']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3) storage.objects already ships with RLS enabled in every Supabase
-- project. Files are uploaded to "<user-id>/week-N-<timestamp>.<ext>", so
-- checking the first path segment against auth.uid() is what scopes each
-- student to their own folder.
drop policy if exists "reports bucket: user can upload own" on storage.objects;
create policy "reports bucket: user can upload own" on storage.objects
  for insert with check (
    bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "reports bucket: user can read own" on storage.objects;
create policy "reports bucket: user can read own" on storage.objects
  for select using (
    bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "reports bucket: admin can read all" on storage.objects;
create policy "reports bucket: admin can read all" on storage.objects
  for select using (
    bucket_id = 'reports' and public.is_admin()
  );
