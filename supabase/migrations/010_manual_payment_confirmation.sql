-- Lets a teacher (is_admin = true) manually mark a student's enrollment as
-- paid/unpaid from the admin panel -- for confirming a real Kaspi transfer
-- by hand instead of (or alongside) Stripe. Run this once in your Supabase
-- project's SQL Editor.

create policy "enrollments: admin can update" on public.enrollments
  for update using (public.is_admin()) with check (public.is_admin());
