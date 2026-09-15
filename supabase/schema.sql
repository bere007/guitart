-- GuitArt production schema for Supabase (Postgres)
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- ============ profiles ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  nickname text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Whether the *current* user is an admin. SECURITY DEFINER makes this run as
-- the function's owner (the table owner, which bypasses RLS by default)
-- instead of the calling user -- so it can read profiles.is_admin without
-- going through profiles' own RLS policies again. Any policy that instead
-- wrote `exists (select 1 from public.profiles where ... and is_admin)`
-- directly would re-trigger those same policies while evaluating them,
-- which is an infinite-recursion error ("infinite recursion detected in
-- policy for relation profiles") the moment two policies reference each
-- other like that -- this function is what breaks the cycle.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create policy "profiles: user can read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: admin can read all" on public.profiles
  for select using (public.is_admin());

create policy "profiles: user can update own row" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- The policy above is row-level only -- without the trigger below, a student
-- could update their OWN row and flip is_admin = true from devtools. This
-- clamps is_admin back to its previous value for anyone who isn't already an
-- admin, no matter what the client sends (name/nickname stay freely editable).
-- auth.uid() is null when a query runs with no JWT at all -- the Supabase
-- SQL Editor (as postgres) or a service-role backend call, both of which
-- already require credentials no student has. Only clamp when there IS an
-- authenticated caller and they aren't an admin; a null auth.uid() is
-- trusted by definition, otherwise this trigger silently undoes the exact
-- "make yourself an admin" bootstrap UPDATE at the bottom of this file.
create or replace function public.enforce_profile_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute procedure public.enforce_profile_columns();

-- ============ enrollments (payment status) ============
create table if not exists public.enrollments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paid boolean not null default false,
  paid_at timestamptz,
  stripe_session_id text
);

alter table public.enrollments enable row level security;

create policy "enrollments: user can read own" on public.enrollments
  for select using (auth.uid() = user_id);

create policy "enrollments: admin can read all" on public.enrollments
  for select using (public.is_admin());

-- NOTE: intentionally no INSERT/UPDATE policy for regular users.
-- "paid" can only be flipped by the create-checkout-session / stripe-webhook
-- edge functions, which use the service_role key and bypass RLS.
-- This is what stops a student from unlocking the paid weeks from devtools.

-- ============ week_reports ============
create table if not exists public.week_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_number int not null check (week_number between 1 and 8),
  video_path text, -- storage.objects path: "<user-id>/week-N-<timestamp>.<ext>"
  report_url text, -- legacy: a pasted link, from before reports were uploaded video
  submitted_at timestamptz not null default now(),
  unique (user_id, week_number)
);

alter table public.week_reports enable row level security;

create policy "reports: user can read own" on public.week_reports
  for select using (auth.uid() = user_id);

create policy "reports: admin can read all" on public.week_reports
  for select using (public.is_admin());

create policy "reports: user can insert own" on public.week_reports
  for insert with check (
    auth.uid() = user_id
    and (
      -- week 1 is free; weeks 2-8 require a paid enrollment
      week_number = 1
      or exists (select 1 from public.enrollments e where e.user_id = auth.uid() and e.paid)
    )
    and (
      -- the previous week's report must already exist (sequential gating)
      week_number = 1
      or exists (
        select 1 from public.week_reports r
        where r.user_id = auth.uid() and r.week_number = week_reports.week_number - 1
      )
    )
  );

-- ============ exam_bookings ============
create table if not exists public.exam_bookings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slot text,
  booked_at timestamptz,
  passed boolean not null default false,
  passed_at timestamptz,
  certificate_name text
);

alter table public.exam_bookings enable row level security;

create policy "exam: user can read own" on public.exam_bookings
  for select using (auth.uid() = user_id);

create policy "exam: admin can read all" on public.exam_bookings
  for select using (public.is_admin());

create policy "exam: user can book own slot" on public.exam_bookings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "exam: admin can update any" on public.exam_bookings
  for update using (public.is_admin())
  with check (public.is_admin());

-- RLS policies above only guard *which row* a student may touch, not *which
-- column* -- a student's own UPDATE would otherwise be able to set passed = true
-- directly from devtools. This trigger clamps passed/passed_at/certificate_name
-- back to their previous value for anyone who isn't an admin, no matter what
-- the client sends.
create or replace function public.enforce_exam_booking_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.passed := old.passed;
    new.passed_at := old.passed_at;
    new.certificate_name := old.certificate_name;
  end if;
  return new;
end;
$$;

drop trigger if exists exam_bookings_guard on public.exam_bookings;
create trigger exam_bookings_guard
  before update on public.exam_bookings
  for each row execute procedure public.enforce_exam_booking_columns();

-- ============ new user bootstrap ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, nickname)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      coalesce(
        nullif(new.raw_user_meta_data->>'nickname', ''),
        split_part(coalesce(new.raw_user_meta_data->>'name', new.email), ' ', 1)
      )
    );
  insert into public.enrollments (user_id) values (new.id);
  insert into public.exam_bookings (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ video reports storage ============
-- Private bucket -- videos are only ever read back through a short-lived
-- signed URL for the report's owner or an admin, never a public link.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports', 'reports', false,
  209715200, -- 200 MB
  array['video/mp4','video/quicktime','video/webm','video/x-matroska','video/3gpp','video/3gpp2']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects ships with RLS already enabled. Files are uploaded to
-- "<user-id>/week-N-<timestamp>.<ext>", so checking the first path segment
-- against auth.uid() scopes each student to their own folder.
create policy "reports bucket: user can upload own" on storage.objects
  for insert with check (
    bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "reports bucket: user can read own" on storage.objects
  for select using (
    bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "reports bucket: admin can read all" on storage.objects
  for select using (
    bucket_id = 'reports' and public.is_admin()
  );

-- ============ lesson videos (teacher-uploaded, student-only-watch) ============
create table if not exists public.lesson_videos (
  week_number int not null check (week_number between 1 and 8),
  lesson_index int not null check (lesson_index >= 0),
  video_path text not null,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  primary key (week_number, lesson_index)
);

alter table public.lesson_videos enable row level security;

create policy "lesson_videos: signed-in can read" on public.lesson_videos
  for select using (auth.uid() is not null);

create policy "lesson_videos: admin can insert" on public.lesson_videos
  for insert with check (public.is_admin());

create policy "lesson_videos: admin can update" on public.lesson_videos
  for update using (public.is_admin()) with check (public.is_admin());

create policy "lesson_videos: admin can delete" on public.lesson_videos
  for delete using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lessons', 'lessons', false,
  314572800, -- 300 MB
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

-- ============ make yourself a teacher/admin ============
-- After you sign up on the live site once, run this (swap the email):
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');
