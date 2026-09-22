-- Turns lessons from a fixed 3-per-week array baked into the frontend into
-- real rows a teacher can add, rename, reorder-by-recreating and delete from
-- the admin panel -- and turns the per-week task into an editable field too.
-- Run this once in your Supabase project's SQL Editor.

create table if not exists public.week_lessons (
  id bigint generated always as identity primary key,
  week_number int not null check (week_number between 1 and 8),
  position int not null default 0,
  title text not null,
  duration text,
  video_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.week_lessons enable row level security;

create policy "week_lessons: signed-in can read" on public.week_lessons
  for select using (auth.uid() is not null);

create policy "week_lessons: admin can insert" on public.week_lessons
  for insert with check (public.is_admin());

create policy "week_lessons: admin can update" on public.week_lessons
  for update using (public.is_admin()) with check (public.is_admin());

create policy "week_lessons: admin can delete" on public.week_lessons
  for delete using (public.is_admin());

-- Seed from the curriculum that used to be hardcoded in site/app.js, so the
-- teacher starts from today's lesson list instead of a blank course and can
-- rename/delete/add from there.
insert into public.week_lessons (week_number, position, title, duration)
select * from (values
  (1,0,'Посадка и постановка рук','7 мин'),
  (1,1,'Аккорд Em: разбор постановки','5 мин'),
  (1,2,'Аккорд G: три варианта аппликатуры','6 мин'),
  (2,0,'Аккорд C: постановка и частые ошибки','6 мин'),
  (2,1,'Бой шестёркой: считаем вслух','8 мин'),
  (2,2,'Связка Em–C–G без остановки','7 мин'),
  (3,0,'Аккорд D: постановка «треугольником»','5 мин'),
  (3,1,'Перебор: чередование баса и мелодии','7 мин'),
  (3,2,'Куплет песни на Em–C–G–D','8 мин'),
  (4,0,'Что такое барре и зачем оно нужно','6 мин'),
  (4,1,'Мини-барре F на 4 струнах','7 мин'),
  (4,2,'Полный барре F','8 мин'),
  (5,0,'Ритмический рисунок восьмёрки','6 мин'),
  (5,1,'Восьмёрка на Am–F–C–G','8 мин'),
  (5,2,'Игра с метрономом','6 мин'),
  (6,0,'Hammer-on: удар пальцем по ладу','6 мин'),
  (6,1,'Pull-off: съём пальца со струны','6 мин'),
  (6,2,'Комбинации hammer-on/pull-off во фразе','7 мин'),
  (7,0,'Структура трека: куплет / припев / бридж','8 мин'),
  (7,1,'Разбор куплета и припева','10 мин'),
  (7,2,'Разбор бриджа и перехода','7 мин'),
  (8,0,'Повторение аккордов и техник курса','10 мин'),
  (8,1,'Работа над сложными переходами','8 мин'),
  (8,2,'Как проходит экзамен по видеозвонку','5 мин')
) as seed(week_number, position, title, duration)
where not exists (select 1 from public.week_lessons);

-- Carry over any videos already uploaded under the old fixed-index table.
do $$
declare
  r record;
  target_id bigint;
begin
  if to_regclass('public.lesson_videos') is not null then
    for r in select * from public.lesson_videos loop
      select id into target_id from public.week_lessons
        where week_number = r.week_number
        order by position
        offset r.lesson_index limit 1;
      if target_id is not null then
        update public.week_lessons set video_path = r.video_path where id = target_id;
      end if;
    end loop;
  end if;
end $$;

drop table if exists public.lesson_videos;

-- The task (assignment for the video report) becomes a teacher-editable
-- field on week_lectures instead of hardcoded copy, seeded from what used
-- to be baked into the frontend.
alter table public.week_lectures add column if not exists task text;

insert into public.week_lectures (week_number, task) values
  (1, 'Сними видео: чисто сыграй переход Em → G, 8 тактов подряд.'),
  (2, 'Пришли видео с боем «шестёрка» на связке Em–C–G, в темпе 80 BPM.'),
  (3, 'Сыграй куплет любой песни на Em–C–G–D без остановки.'),
  (4, 'Видео с чистым звучанием барре F, 4 переключения без глушения струн.'),
  (5, 'Запиши перебор восьмёркой на прогрессии Am–F–C–G, метроном обязателен.'),
  (6, 'Сыграй тренировочную фразу с hammer-on/pull-off на 5-м ладу.'),
  (7, 'Пришли полный разбор выбранного трека — куплет, припев, бридж.'),
  (8, 'Финальный прогон трека целиком, без остановок и подсказок.')
on conflict (week_number) do update set task = excluded.task;
