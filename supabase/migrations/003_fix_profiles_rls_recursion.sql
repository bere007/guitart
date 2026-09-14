-- Fixes: "infinite recursion detected in policy for relation profiles"
--
-- Cause: the "admin can read all" policies on profiles/enrollments/
-- week_reports/exam_bookings each did
--   exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
-- directly. On profiles itself, evaluating that policy means running a
-- SELECT against profiles, which re-triggers profiles' own RLS policies
-- (including this same one) -- infinite recursion. Any query that touches
-- profiles' RLS at all (even indirectly, e.g. Postgres deciding whether a
-- just-inserted week_reports row can be returned) hit this.
--
-- Fix: route the admin check through a SECURITY DEFINER function. Because
-- it runs as the function owner (which bypasses RLS on tables it owns),
-- the internal lookup never re-enters any policy, so there's no cycle.
--
-- Run this once in your Supabase project's SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "profiles: admin can read all" on public.profiles;
create policy "profiles: admin can read all" on public.profiles
  for select using (public.is_admin());

drop policy if exists "enrollments: admin can read all" on public.enrollments;
create policy "enrollments: admin can read all" on public.enrollments
  for select using (public.is_admin());

drop policy if exists "reports: admin can read all" on public.week_reports;
create policy "reports: admin can read all" on public.week_reports
  for select using (public.is_admin());

drop policy if exists "exam: admin can read all" on public.exam_bookings;
create policy "exam: admin can read all" on public.exam_bookings
  for select using (public.is_admin());

drop policy if exists "exam: admin can update any" on public.exam_bookings;
create policy "exam: admin can update any" on public.exam_bookings
  for update using (public.is_admin()) with check (public.is_admin());

-- Same simplification for the column-guard triggers (not required for the
-- fix, just avoids duplicating the lookup logic three different ways).
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
