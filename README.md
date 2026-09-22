# GuitArt

Онлайн-школа гитары: 8-недельный курс, бесплатная первая неделя, видео-отчёты, оплата, экзамен и сертификат.

- **Фронтенд** — статический сайт (`site/`), без сборки, деплоится на GitHub Pages.
- **Бэкенд** — [Supabase](https://supabase.com) (Postgres + Auth + Row Level Security). Реальные аккаунты, реальная база данных, никакого localStorage.
- **Оплата** — перевод на Kaspi Gold по номеру телефона (бесплатно, без комиссии и без юрлица), подтверждает вручную преподаватель в админ-панели. Есть и готовый код для Stripe Checkout через Supabase Edge Function, если позже понадобится приём карт — см. «Оплата картой (Stripe)» ниже.

## Быстрый старт (15–20 минут)

### 1. Supabase — база данных и аккаунты

1. Зайди на [supabase.com](https://supabase.com) → создай бесплатный проект.
2. В **SQL Editor** вставь и выполни весь файл [`supabase/schema.sql`](supabase/schema.sql) — он создаёт таблицы, политики безопасности (RLS) и триггер, который заводит профиль/подписку/экзамен при регистрации.
3. В **Project Settings → API** скопируй `Project URL` и `anon public` key.
4. Вставь их в [`site/config.js`](site/config.js), там же впиши номер и имя для Kaspi-переводов (см. «1b. Оплата» ниже):
   ```js
   export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```
5. **Authentication → Email Templates** — по умолчанию Supabase требует подтверждение почты после регистрации; это нормально, можно отключить в Authentication → Sign In / Providers → Email → «Confirm email», если хочешь мгновенный вход без письма. Со встроенной почтой лимит — пара писем в час; для реального потока учеников подключи свой SMTP в Authentication → Settings → SMTP Settings (например, [Resend](https://resend.com), бесплатно).

> **Уже выполнял(а) `schema.sql` раньше?** Выполни по порядку ещё девять файлов:
> 1. [`supabase/migrations/002_nickname_and_admin_guard.sql`](supabase/migrations/002_nickname_and_admin_guard.sql) — добавляет никнейм и закрывает уязвимость (ученик мог сам выдать себе admin через devtools).
> 2. [`supabase/migrations/003_fix_profiles_rls_recursion.sql`](supabase/migrations/003_fix_profiles_rls_recursion.sql) — чинит ошибку `infinite recursion detected in policy for relation "profiles"` (она была в политиках с самого начала, просто не успела проявиться раньше).
> 3. [`supabase/migrations/004_video_reports_storage.sql`](supabase/migrations/004_video_reports_storage.sql) — переводит отчёты со ссылки на загрузку видео (создаёт приватный Storage bucket `reports`).
> 4. [`supabase/migrations/005_lesson_videos.sql`](supabase/migrations/005_lesson_videos.sql) — даёт преподавателям (`is_admin = true`) загружать видео к урокам в админ-панели; ученики только смотрят.
> 5. [`supabase/migrations/006_fix_admin_bootstrap_trigger.sql`](supabase/migrations/006_fix_admin_bootstrap_trigger.sql) — **выполни перед шагом 2 ниже**, иначе команда `update profiles set is_admin = true` из SQL Editor молча ничего не сделает (защитный триггер путал «владелец сайта в SQL Editor» с «ученик из devtools» и откатывал изменение).
> 6. [`supabase/migrations/007_week_lectures.sql`](supabase/migrations/007_week_lectures.sql) — убирает тесты-квизы, добавляет лекцию (текст + фото) на каждую неделю; текст и фото пишет и загружает преподаватель в админ-панели, ничего не захардкожено заранее.
> 7. [`supabase/migrations/008_dynamic_lessons_and_tasks.sql`](supabase/migrations/008_dynamic_lessons_and_tasks.sql) — уроки (название, длительность, видео) и задание на отчёт становятся полностью редактируемыми преподавателем: добавить, переименовать, удалить урок, загрузить/заменить/убрать видео — прямо в админ-панели, без правки кода. Переносит текущий список уроков и видео (если уже загружены) в новую структуру, ничего не теряется.
> 8. [`supabase/migrations/009_multiple_lecture_photos.sql`](supabase/migrations/009_multiple_lecture_photos.sql) — к лекции можно прикрепить несколько фото вместо одного; переносит уже загруженное фото (если было) в новую галерею.
> 9. [`supabase/migrations/010_manual_payment_confirmation.sql`](supabase/migrations/010_manual_payment_confirmation.sql) — разрешает преподавателю вручную подтверждать оплату (Kaspi-перевод) из админ-панели.

### 1a. Оплата (Kaspi)

По умолчанию оплата курса идёт переводом на Kaspi Gold — бесплатно, без комиссии, без юрлица и без стороннего платёжного сервиса.

1. Впиши свой номер (привязанный к Kaspi Gold) и имя получателя в [`site/config.js`](site/config.js):
   ```js
   export const KASPI_PHONE = '+7 700 000 00 00';
   export const KASPI_NAME = 'Имя Фамилия';
   ```
2. Выполни `supabase/migrations/010_manual_payment_confirmation.sql` (см. список выше).
3. Ученик на странице оплаты видит номер, сумму и текст для комментария к переводу (его email — чтобы платёж было легко найти), переводит в своём приложении Kaspi.
4. Ты видишь перевод в своём Kaspi → заходишь в `admin.html` → находишь ученика → жмёшь «Отметить оплату». Недели 2–8 открываются ученику сразу же.

Ошибиться — не страшно: рядом есть кнопка «Отменить оплату», если отметил(а) не того ученика.

### 1b. Google-вход

Кнопка «Продолжить с Google» в коде уже полностью рабочая — не хватает только Google-провайдера, включённого в Supabase (это shared step для любого Supabase-проекта, я не могу сделать это за тебя, нужен твой Google-аккаунт):

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → создай проект (если нет) → **Create Credentials → OAuth client ID** → тип **Web application**.
2. **Authorized JavaScript origins**: `https://bere007.github.io`
3. **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback` (сам URL — в Supabase Dashboard → Authentication → Providers → Google, там же есть готовая кнопка «Copy redirect URI»).
4. Скопируй **Client ID** и **Client Secret** → вставь в Supabase Dashboard → **Authentication → Providers → Google** → включи тумблер → Save.
5. **Обязательный отдельный шаг** (без него после входа в Google браузер попытается открыть `localhost` и покажет «не удаётся получить доступ к сайту» — это не связано с шагами 1–4 выше, а с отдельной настройкой): Supabase Dashboard → **Authentication → URL Configuration**:
   - **Site URL**: `https://bere007.github.io/guitart`
   - **Redirect URLs**: добавь `https://bere007.github.io/guitart/**`

   По умолчанию в новом Supabase-проекте здесь стоит `http://localhost:3000` — именно на него Supabase и отправляет браузер после входа, если реальный адрес сайта не в этом списке, независимо от того, что передаёт код страницы.

После этого кнопка на сайте заработает без единой правки кода. Пока не настроено — кнопка покажет понятную ошибку вместо тишины.

### 2. Стать преподавателем (admin)

Зарегистрируйся один раз на сайте, затем в SQL Editor:
```sql
update public.profiles set is_admin = true
  where id = (select id from auth.users where email = 'твоя-почта@example.com');
```
Теперь в шапке сайта появится ссылка «Админ» → `admin.html`, где можно подтверждать сдачу экзамена.

### 3. GitHub Pages — хостинг

1. Создай пустой репозиторий на GitHub.
2. Запушь в него содержимое этой папки (`git init && git add . && git commit -m "GuitArt" && git remote add origin <URL> && git push -u origin main`).
3. В репозитории: **Settings → Pages → Source → GitHub Actions**. Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) задеплоит `site/` автоматически при пуше в `main`.
4. Через минуту сайт будет доступен по адресу вида `https://<username>.github.io/<repo>/`.

### 4. Оплата картой (Stripe) — опционально, вместо/вместе с Kaspi

Сейчас `payment.html` показывает только реквизиты Kaspi (см. «1a» выше) — код для Stripe Checkout уже есть в репозитории (`supabase/functions/create-checkout-session`, `stripe-webhook`), но кнопка на странице оплаты его не вызывает. Если захочешь принимать карты вместо или в дополнение к Kaspi, разверни функции ниже и верни в `site/payment.html` кнопку, вызывающую `startCheckout()` из `app.js` (она уже экспортирована и работает без правок).

1. Установи [Supabase CLI](https://supabase.com/docs/guides/cli) и авторизуйся: `supabase login`.
2. Свяжи проект: `supabase link --project-ref <ref-из-URL-проекта>`.
3. Задеплой функции:
   ```bash
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
4. Заведи аккаунт на [stripe.com](https://stripe.com), возьми тестовый секретный ключ и укажи секреты:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
   supabase secrets set PRICE_AMOUNT=499000 PRICE_CURRENCY=kzt
   ```
5. В Stripe Dashboard → Developers → Webhooks добавь endpoint `https://<project-ref>.functions.supabase.co/stripe-webhook`, событие `checkout.session.completed`, и добавь его подписной секрет:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

> Важно: Stripe пока не работает как локальный эквайер для Казахстана — счёт Stripe регистрируется на поддерживаемую страну. Для реального приёма карт в KZT в проде обычно берут локального провайдера (Kaspi Pay, Freedom Pay, CloudPayments, epay.kz) — они выпускают отдельный SDK/API, но встраиваются в то же место (`site/app.js → startCheckout()` и `supabase/functions/create-checkout-session`), архитектуру менять не придётся.

## Структура проекта

```
site/                   статический фронтенд (деплоится на GitHub Pages)
  index.html             лендинг
  auth.html               регистрация / вход / восстановление пароля
  reset-password.html      установка нового пароля по ссылке из письма
  course.html                личный кабинет ученика (уроки, тесты, загрузка видео-отчёта)
  contact.html                 связь с преподавателями (WhatsApp)
  payment.html                   оплата
  exam.html                        запись на экзамен + сертификат (PNG)
  admin.html                         панель преподавателя
  app.js                               клиент Supabase + вся общая логика
  config.js                             ключи Supabase (заполнить)
  favicon.svg                            иконка вкладки браузера
  style.css                              дизайн-система
supabase/
  schema.sql              таблицы + RLS-политики + триггеры (для нового проекта)
  migrations/               точечные изменения для уже существующего проекта
  functions/
    create-checkout-session   Stripe Checkout / демо-оплата
    stripe-webhook              подтверждение реальной оплаты от Stripe
.github/workflows/deploy.yml  автодеплой на GitHub Pages
```

## Как устроена защита данных

Прогресс и оплата хранятся в Postgres с включённым Row Level Security:
- ученик видит и создаёт **только свои** отчёты, оплату и запись на экзамен;
- поле `paid` не может изменить сам ученик — только аккаунт с `is_admin = true` (подтверждение Kaspi-перевода вручную) или серверная функция Stripe (сервисным ключом, если она подключена);
- поле `passed` (экзамен сдан) может выставить только аккаунт с `is_admin = true` — это форсируется триггером в базе, а не только в интерфейсе, так что подделать через devtools нельзя;
- то же самое для поля `is_admin` в `profiles` — свой никнейм и имя ученик может менять свободно, но выставить себе `is_admin = true` не даст триггер `profiles_guard`, даже если строка «своя» по RLS;
- отчёт за неделю N нельзя отправить, если не сдан отчёт за неделю N−1 или (для недель 2–8) курс не оплачен — проверка встроена в саму политику INSERT в базе;
- видео-отчёты лежат в приватном Storage bucket `reports`, путь к файлу — `<user-id>/week-N-...`; читать и загружать в свою папку может только сам ученик (первый сегмент пути = его `auth.uid()`), весь бакет целиком видят только админы — смотреть видео можно только по короткоживущей подписанной ссылке (`createSignedUrl`, час), а не по постоянной публичной;
- уроки (bucket `lessons`, таблица `week_lessons`) — зеркальная схема прав: **добавлять, переименовывать, удалять урок и загружать/заменять/убирать видео может только `is_admin = true`**, а видеть и смотреть — любой залогиненный ученик; ученик физически не может вызвать insert/update/delete из devtools, RLS отклонит запрос на уровне базы, а не только скроет кнопку в интерфейсе;
- лекции (текст + фото, таблица `week_lectures`, фото — в том же bucket `lessons`) — та же схема: пишет и загружает только преподаватель, ученик только читает. Никакого текста или фото не зашито в код — до первого сохранения в админке ученик видит «преподаватель готовит материал».
