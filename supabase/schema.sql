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
create or replace function public.enforce_profile_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
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
  report_url text not null,
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
  if not public.is_admin() then
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

-- ============ make yourself a teacher/admin ============
-- After you sign up on the live site once, run this (swap the email):
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');
