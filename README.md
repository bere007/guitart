# GuitArt

Онлайн-школа гитары: 8-недельный курс, бесплатная первая неделя, видео-отчёты, оплата, экзамен и сертификат.

- **Фронтенд** — статический сайт (`site/`), без сборки, деплоится на GitHub Pages.
- **Бэкенд** — [Supabase](https://supabase.com) (Postgres + Auth + Row Level Security). Реальные аккаунты, реальная база данных, никакого localStorage.
- **Оплата** — Stripe Checkout через Supabase Edge Function. Пока не подключён Stripe-ключ, оплата проходит в безопасном демо-режиме (тот же серверный код, просто без реального списания).

## Быстрый старт (15–20 минут)

### 1. Supabase — база данных и аккаунты

1. Зайди на [supabase.com](https://supabase.com) → создай бесплатный проект.
2. В **SQL Editor** вставь и выполни весь файл [`supabase/schema.sql`](supabase/schema.sql) — он создаёт таблицы, политики безопасности (RLS) и триггер, который заводит профиль/подписку/экзамен при регистрации.
3. В **Project Settings → API** скопируй `Project URL` и `anon public` key.
4. Вставь их в [`site/config.js`](site/config.js):
   ```js
   export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```
5. (Необязательно) **Authentication → Providers → Google** — включи, если нужен реальный вход через Google. Без этого шага email/пароль уже работает.
6. **Authentication → Email Templates** — по умолчанию Supabase требует подтверждение почты после регистрации; это нормально, можно отключить в Authentication → Sign In / Providers → Email → «Confirm email», если хочешь мгновенный вход без письма. Со встроенной почтой лимит — пара писем в час; для реального потока учеников подключи свой SMTP в Authentication → Settings → SMTP Settings (например, [Resend](https://resend.com), бесплатно).

> **Уже выполнял(а) `schema.sql` раньше?** Обязательно выполни ещё и [`supabase/migrations/002_nickname_and_admin_guard.sql`](supabase/migrations/002_nickname_and_admin_guard.sql) — он добавляет никнейм и **закрывает уязвимость**: без него любой ученик мог сам выдать себе admin-доступ через devtools (`supabase.from('profiles').update({is_admin:true})`), потому что политика проверяла только «своя ли это строка», а не какие поля меняются.

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

### 4. Оплата (Stripe) — опционально

Без этого шага кнопка «Оплатить» работает в демо-режиме (сразу открывает недели 2–8 через защищённую серверную функцию, без реального списания).

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
   supabase secrets set PRICE_AMOUNT=999000 PRICE_CURRENCY=kzt
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
  course.html                личный кабинет ученика (+ смена никнейма)
  payment.html                 оплата
  exam.html                      запись на экзамен + сертификат (PNG)
  admin.html                       панель преподавателя
  app.js                             клиент Supabase + вся общая логика
  config.js                           ключи Supabase (заполнить)
  style.css                            дизайн-система
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
- поле `paid` нельзя изменить из браузера напрямую — только через серверную функцию (сервисным ключом), которая либо реально списывает деньги через Stripe, либо (в демо-режиме) сама решает выдать доступ;
- поле `passed` (экзамен сдан) может выставить только аккаунт с `is_admin = true` — это форсируется триггером в базе, а не только в интерфейсе, так что подделать через devtools нельзя;
- то же самое для поля `is_admin` в `profiles` — свой никнейм и имя ученик может менять свободно, но выставить себе `is_admin = true` не даст триггер `profiles_guard`, даже если строка «своя» по RLS;
- отчёт за неделю N нельзя отправить, если не сдан отчёт за неделю N−1 или (для недель 2–8) курс не оплачен — проверка встроена в саму политику INSERT в базе.
