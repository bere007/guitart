-- Fixes: running the "make yourself admin" UPDATE from the README (or
-- ../schema.sql's bottom comment) silently did nothing -- is_admin stayed
-- false even though the UPDATE reported success.
--
-- Cause: profiles_guard and exam_bookings_guard clamp is_admin/passed back
-- to their old value unless the caller is *already* an admin. That check
-- used public.is_admin(), which reads auth.uid() -- and auth.uid() is NULL
-- for a query run from the Supabase SQL Editor (as the postgres role) or
-- from a service-role backend call, since neither carries a user JWT. So
-- the trigger treated "you, the project owner, in the SQL Editor" the same
-- as "a student trying to self-promote from devtools", and blocked both.
--
-- Fix: only clamp when there IS an authenticated non-admin caller. A null
-- auth.uid() already means the request could only have come from someone
-- with SQL Editor or service-role access -- which a student never has --
-- so it's trusted by definition, and is exactly what the admin-bootstrap
-- step needs to be able to do.
--
-- Run this once in your Supabase project's SQL Editor, then re-run your
-- "update public.profiles set is_admin = true where id = ..." command --
-- it will actually stick this time.

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
