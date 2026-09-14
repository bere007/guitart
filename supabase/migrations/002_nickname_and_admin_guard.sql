-- Migration for a project that already ran the original schema.sql once.
-- Run this once in your Supabase project's SQL Editor. Safe to run even if
-- some pieces already exist.

-- 1) nickname column, backfilled from existing names/emails
alter table public.profiles add column if not exists nickname text;

update public.profiles p
set nickname = split_part(coalesce(p.name, u.email), ' ', 1)
from auth.users u
where u.id = p.id and (p.nickname is null or p.nickname = '');

alter table public.profiles alter column nickname set not null;

-- 2) new signups: store nickname from the sign-up form, fallback to first name
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

-- 3) security fix: without this, a signed-in student could run
--    supabase.from('profiles').update({ is_admin: true }).eq('id', myId)
--    from devtools and grant themselves admin access, since the existing
--    "user can update own row" policy is row-level, not column-level.
create or replace function public.enforce_profile_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute procedure public.enforce_profile_columns();
