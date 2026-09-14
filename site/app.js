// GuitArt — shared backend client & UI logic.
// Real auth, real database, real RLS via Supabase. See ../supabase/schema.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, FUNCTIONS_URL } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const CURRICULUM = [
  {
    n: 1, title: 'Посадка, аккорды Em и G',
    lessons: [
      { title: 'Посадка и постановка рук', duration: '7 мин' },
      { title: 'Аккорд Em: разбор постановки', duration: '5 мин' },
      { title: 'Аккорд G: три варианта аппликатуры', duration: '6 мин' },
    ],
    task: 'Сними видео: чисто сыграй переход Em → G, 8 тактов подряд.',
    quiz: [
      { q: 'Сколько струн у стандартной гитары?', options: ['4', '5', '6', '7'], correct: 2 },
      { q: 'Аккорд Em — это...', options: ['Мажорное трезвучие', 'Минорное трезвучие', 'Септаккорд', 'Уменьшённое трезвучие'], correct: 1 },
      { q: 'В открытом аккорде Em зажаты струны:', options: ['Все шесть', '5-я и 4-я на 2-м ладу', '6-я и 1-я на 1-м ладу', 'Только 3-я'], correct: 1 },
      { q: 'Стандартный строй гитары снизу вверх:', options: ['E A D G B E', 'A D G C E A', 'E A D F B E', 'D A D G B E'], correct: 0 },
    ],
  },
  {
    n: 2, title: 'Бой шестёркой и аккорд C',
    lessons: [
      { title: 'Аккорд C: постановка и частые ошибки', duration: '6 мин' },
      { title: 'Бой шестёркой: считаем вслух', duration: '8 мин' },
      { title: 'Связка Em–C–G без остановки', duration: '7 мин' },
    ],
    task: 'Пришли видео с боем «шестёрка» на связке Em–C–G, в темпе 80 BPM.',
    quiz: [
      { q: 'Сколько ударов в бое «шестёрка» за один такт?', options: ['4', '5', '6', '8'], correct: 2 },
      { q: 'В открытом аккорде C какая струна обычно не звучит?', options: ['6-я (низкая E)', '1-я (высокая e)', '3-я (G)', '4-я (D)'], correct: 0 },
      { q: '«Шестёрку» обычно бьют как:', options: ['вниз-вниз-вверх-вверх-вниз-вверх', 'вниз-вверх-вниз-вверх-вниз-вверх', 'вверх-вверх-вниз-вниз-вверх-вниз', 'вниз-вниз-вниз-вверх-вверх-вверх'], correct: 0 },
      { q: 'Что важнее на этой неделе — скорость или чистота?', options: ['Скорость важнее', 'Чистота важнее, скорость придёт с практикой', 'Громкость важнее всего', 'Разницы нет'], correct: 1 },
    ],
  },
  {
    n: 3, title: 'Аккорд D и первый бой-перебор',
    lessons: [
      { title: 'Аккорд D: постановка «треугольником»', duration: '5 мин' },
      { title: 'Перебор: чередование баса и мелодии', duration: '7 мин' },
      { title: 'Куплет песни на Em–C–G–D', duration: '8 мин' },
    ],
    task: 'Сыграй куплет любой песни на Em–C–G–D без остановки.',
    quiz: [
      { q: 'В открытом аккорде D задействованы струны:', options: ['6, 5, 4', '4, 3, 2, 1', '3, 2, 1', 'Все шесть'], correct: 1 },
      { q: 'Чем перебор отличается от боя?', options: ['Играется только медиатором', 'Струны звучат по очереди, а не одним ударом', 'Перебор громче', 'Ничем не отличается'], correct: 1 },
      { q: 'Какой палец обычно отвечает за басовую струну в переборе?', options: ['Большой', 'Указательный', 'Средний', 'Безымянный'], correct: 0 },
      { q: 'Сколько аккордов в связке Em–C–G–D?', options: ['2', '3', '4', '5'], correct: 2 },
    ],
  },
  {
    n: 4, title: 'Барре F и зажимы',
    lessons: [
      { title: 'Что такое барре и зачем оно нужно', duration: '6 мин' },
      { title: 'Мини-барре F на 4 струнах', duration: '7 мин' },
      { title: 'Полный барре F', duration: '8 мин' },
    ],
    task: 'Видео с чистым звучанием барре F, 4 переключения без глушения струн.',
    quiz: [
      { q: 'Барре — это:', options: ['Удар по всем струнам сразу', 'Зажим нескольких струн одним пальцем', 'Игра без медиатора', 'Вид перебора'], correct: 1 },
      { q: 'Мини-F обычно играют без каких струн?', options: ['Без 6-й и 5-й', 'Без 1-й и 2-й', 'Без 3-й', 'Без 4-й'], correct: 0 },
      { q: 'Почему барре тяжело даётся новичкам?', options: ['Нужны сила и точность прижима указательного пальца', 'Нужна особая гитара', 'Нужен медиатор большого размера', 'На самом деле барре лёгкое'], correct: 0 },
      { q: 'Полный барре F строится как:', options: ['Указательный на 1-м ладу барре + форма E выше', 'Зажим только двух струн', 'Барре на 5-м ладу', 'Без единого зажатого лада'], correct: 0 },
    ],
  },
  {
    n: 5, title: 'Перебор восьмёркой',
    lessons: [
      { title: 'Ритмический рисунок восьмёрки', duration: '6 мин' },
      { title: 'Восьмёрка на Am–F–C–G', duration: '8 мин' },
      { title: 'Игра с метрономом', duration: '6 мин' },
    ],
    task: 'Запиши перебор восьмёркой на прогрессии Am–F–C–G, метроном обязателен.',
    quiz: [
      { q: 'В «восьмёрке» за такт 4/4 играется нот:', options: ['4', '6', '8', '16'], correct: 2 },
      { q: 'Зачем на этом этапе нужен метроном?', options: ['Чтобы не сбивать темп и играть ровно', 'Чтобы аккорды звучали громче', 'Метроном не нужен', 'Только для видео'], correct: 0 },
      { q: 'Аккорд Am — это:', options: ['Минорное трезвучие от ля', 'Мажорное трезвучие от ля', 'Септаккорд', 'Уменьшённый аккорд'], correct: 0 },
      { q: 'Прогрессия Am–F–C–G типична для тональности:', options: ['До мажор / Ля минор', 'Ре мажор', 'Соль минор', 'Ми мажор'], correct: 0 },
    ],
  },
  {
    n: 6, title: 'Соло-техника: хаммер-он и пул-офф',
    lessons: [
      { title: 'Hammer-on: удар пальцем по ладу', duration: '6 мин' },
      { title: 'Pull-off: съём пальца со струны', duration: '6 мин' },
      { title: 'Комбинации hammer-on/pull-off во фразе', duration: '7 мин' },
    ],
    task: 'Сыграй тренировочную фразу с hammer-on/pull-off на 5-м ладу.',
    quiz: [
      { q: 'Hammer-on выполняется:', options: ['Резким ударом пальца по струне на ладу без повторного щипка', 'Отпусканием пальца со струны', 'Ударом медиатора вниз', 'Глушением струны ладонью'], correct: 0 },
      { q: 'Pull-off — это:', options: ['Съём пальца так, чтобы струна продолжила звучать', 'Удар по струне сверху', 'Замена медиатора на пальцы', 'Смена строя гитары'], correct: 0 },
      { q: 'Эти техники относятся к:', options: ['Соло-технике / легато', 'Только к аккордовому бою', 'Только к настройке гитары', 'К технике на басу'], correct: 0 },
      { q: 'На каком ладу тренируем первые hammer-on/pull-off по программе?', options: ['На 5-м', 'На 12-м', 'На открытых струнах', 'На 1-м'], correct: 0 },
    ],
  },
  {
    n: 7, title: 'Разбор трека целиком',
    lessons: [
      { title: 'Структура трека: куплет / припев / бридж', duration: '8 мин' },
      { title: 'Разбор куплета и припева', duration: '10 мин' },
      { title: 'Разбор бриджа и перехода', duration: '7 мин' },
    ],
    task: 'Пришли полный разбор выбранного трека — куплет, припев, бридж.',
    quiz: [
      { q: 'Типичная структура поп-песни:', options: ['Куплет–припев–куплет–припев–бридж–припев', 'Только куплеты подряд', 'Только припев', 'Интро без остального'], correct: 0 },
      { q: 'Бридж в песне — это:', options: ['Связка, отличающаяся от куплета и припева', 'Начало песни', 'Название аккорда', 'Синоним слова «припев»'], correct: 0 },
      { q: 'Зачем разбирать трек по частям?', options: ['Так проще выучить и закрепить каждую часть', 'Так требует программа, смысла нет', 'Чтобы видео было длиннее', 'Без разницы, как учить'], correct: 0 },
      { q: 'Что сделать перед записью финального видео за неделю?', options: ['Прогнать трек целиком несколько раз без остановок', 'Играть только сложные места', 'Не тренироваться', 'Сыграть только первый аккорд'], correct: 0 },
    ],
  },
  {
    n: 8, title: 'Подготовка к экзамену',
    lessons: [
      { title: 'Повторение аккордов и техник курса', duration: '10 мин' },
      { title: 'Работа над сложными переходами', duration: '8 мин' },
      { title: 'Как проходит экзамен по видеозвонку', duration: '5 мин' },
    ],
    task: 'Финальный прогон трека целиком, без остановок и подсказок.',
    quiz: [
      { q: 'Сколько недель длится курс GuitArt?', options: ['4', '6', '8', '12'], correct: 2 },
      { q: 'Что оценивает преподаватель на экзамене?', options: ['Только скорость игры', 'Чистоту аккордов, ритм и целостное исполнение', 'Только внешний вид', 'Экзамен формальный, ничего не оценивается'], correct: 1 },
      { q: 'Как получить сертификат?', options: ['Сдать все отчёты, оплатить курс и пройти экзамен по видеозвонку', 'Просто зарегистрироваться', 'Досмотреть видео без практики', 'Он выдаётся автоматически после недели 1'], correct: 0 },
      { q: 'Формат финального экзамена:', options: ['Личный видеозвонок с преподавателем', 'Письменный тест', 'Экзамена нет', 'Отправка аудио без видео'], correct: 0 },
    ],
  },
];

let cachedUser = null;
let cachedProfile = null;
let sessionReady = null;

function loadSession(){
  if(!sessionReady){
    sessionReady = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      cachedUser = session?.user ?? null;
      cachedProfile = null;
      if(cachedUser){
        const { data } = await supabase.from('profiles').select('name, nickname, is_admin').eq('id', cachedUser.id).single();
        cachedProfile = data ?? null;
      }
    })();
  }
  return sessionReady;
}

export function currentUser(){ return cachedUser; }
export function currentProfile(){ return cachedProfile; }

/** What we call the signed-in person everywhere in the UI -- their nickname, with sensible fallbacks. */
export function displayName(){
  return cachedProfile?.nickname || cachedProfile?.name?.split(' ')[0] || cachedUser?.email?.split('@')[0] || 'гость';
}

/** Loads the session without redirecting -- use on auth.html to check "already logged in?". */
export async function whoAmI(){
  await loadSession();
  return cachedUser;
}

/** Forces the next loadSession() to hit the network again instead of the cached result. */
function invalidateSession(){ sessionReady = null; }

export async function signUp(name, nickname, email, password){
  const { error } = await supabase.auth.signUp({
    email, password, options: { data: { name, nickname: nickname || name.split(' ')[0] } },
  });
  if(!error){ invalidateSession(); await loadSession(); }
  return error;
}

export async function signIn(email, password){
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if(!error){ invalidateSession(); await loadSession(); }
  return error;
}

/** Re-sends the sign-up confirmation email (for "Проверь почту" -> "не пришло письмо"). */
export async function resendConfirmation(email){
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  return error;
}

/** Sends a password-reset email with a link back to reset-password.html. */
export async function requestPasswordReset(email){
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}${location.pathname.replace(/[^/]+$/, '')}reset-password.html`,
  });
  return error;
}

/** Sets a new password -- only works inside the recovery session created by the reset-password link. */
export async function updatePassword(newPassword){
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error;
}

/** Lets a signed-in user rename how the site addresses them. */
export async function updateNickname(nickname){
  const { error } = await supabase.from('profiles').update({ nickname }).eq('id', cachedUser.id);
  if(!error && cachedProfile) cachedProfile.nickname = nickname;
  return error;
}

export async function signInGoogle(){
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${location.pathname.replace(/[^/]+$/, '')}course.html` },
  });
}

export async function signOutUser(){
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

/** Guards a page that requires login; redirects to auth.html if not signed in. */
export async function requireAuth(){
  await loadSession();
  if(!cachedUser){
    const dest = encodeURIComponent(window.location.pathname.split('/').pop() || 'course.html');
    window.location.href = 'auth.html?next=' + dest;
    return null;
  }
  return cachedUser;
}

/** Loads reports + payment + exam state for the signed-in user and shapes it like CURRICULUM. */
export async function fetchDashboard(){
  const user = cachedUser;
  const [{ data: reports }, { data: enrollment }, { data: exam }] = await Promise.all([
    supabase.from('week_reports').select('week_number, report_url, submitted_at').eq('user_id', user.id),
    supabase.from('enrollments').select('paid, paid_at').eq('user_id', user.id).single(),
    supabase.from('exam_bookings').select('slot, booked_at, passed, passed_at, certificate_name').eq('user_id', user.id).single(),
  ]);
  const reportByWeek = {};
  (reports || []).forEach(r => { reportByWeek[r.week_number] = r; });
  const paid = !!enrollment?.paid;
  const weeks = {};
  CURRICULUM.forEach(w => {
    const submitted = !!reportByWeek[w.n];
    const unlocked = w.n === 1 || (paid && !!reportByWeek[w.n - 1]);
    weeks[w.n] = { unlocked, reportSubmitted: submitted, reportText: reportByWeek[w.n]?.report_url || '' };
  });
  return { paid, weeks, exam: exam || {}, reportsDone: (reports || []).length };
}

export function courseProgressPercent(weeks){
  const done = CURRICULUM.filter(w => weeks[w.n].reportSubmitted).length;
  return Math.round((done / CURRICULUM.length) * 100);
}

/** Inserts a report row; RLS on the server re-checks payment + sequencing, so this can't be spoofed. */
export async function submitReport(weekNumber, url){
  const { error } = await supabase
    .from('week_reports')
    .insert({ user_id: cachedUser.id, week_number: weekNumber, report_url: url });
  return error;
}

/** Calls the create-checkout-session Edge Function: real Stripe redirect, or a secure demo unlock if Stripe isn't configured yet. */
export async function startCheckout(){
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FUNCTIONS_URL}/create-checkout-session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ origin: location.origin + location.pathname.replace(/[^/]+$/, '') }),
  });
  if(!res.ok) throw new Error('Оплата временно недоступна, попробуй позже.');
  return res.json();
}

export async function bookExamSlot(slot){
  const { error } = await supabase
    .from('exam_bookings')
    .update({ slot, booked_at: new Date().toISOString() })
    .eq('user_id', cachedUser.id);
  return error;
}

/** Admin-only: full roster with progress, gated server-side by the is_admin RLS policies. */
export async function fetchAdminRoster(){
  const [{ data: profiles }, { data: enrollments }, { data: exams }, { data: reports }] = await Promise.all([
    supabase.from('profiles').select('id, name, nickname, is_admin').order('created_at', { ascending: true }),
    supabase.from('enrollments').select('user_id, paid'),
    supabase.from('exam_bookings').select('user_id, slot, booked_at, passed, passed_at'),
    supabase.from('week_reports').select('user_id, week_number'),
  ]);
  const paidBy = Object.fromEntries((enrollments || []).map(e => [e.user_id, e.paid]));
  const examBy = Object.fromEntries((exams || []).map(e => [e.user_id, e]));
  const reportCountBy = {};
  (reports || []).forEach(r => { reportCountBy[r.user_id] = (reportCountBy[r.user_id] || 0) + 1; });
  return (profiles || [])
    .filter(p => !p.is_admin)
    .map(p => ({
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      paid: !!paidBy[p.id],
      reportsDone: reportCountBy[p.id] || 0,
      exam: examBy[p.id] || {},
    }));
}

export async function markExamPassed(userId, studentName){
  const { error } = await supabase
    .from('exam_bookings')
    .update({ passed: true, passed_at: new Date().toISOString(), certificate_name: studentName })
    .eq('user_id', userId);
  return error;
}

export function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function pickSvg(){
  return `<svg class="pick" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 20L18 4M18 4L13 4.5M18 4L17.5 9" stroke="var(--copper)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export async function renderNav(){
  const mount = document.getElementById('site-nav');
  if(!mount) return;
  await loadSession();

  const links = [
    { href:'index.html#course', label:'Курс' },
    { href:'index.html#teachers', label:'Преподаватели' },
    { href:'index.html#reviews', label:'Отзывы' },
    { href:'index.html#pricing', label:'Стоимость' },
    { href:'contact.html', label:'Контакты' },
  ];
  const linksHtml = links.map(l => `<a href="${l.href}">${l.label}</a>`).join('');

  const actionsHtml = cachedUser
    ? `<span class="nav-user"><span aria-hidden="true">●</span>${escapeHtml(displayName())}</span>
       <a href="course.html" class="btn btn-ghost btn-sm">Уроки</a>
       <a href="payment.html" class="btn btn-ghost btn-sm">Оплата</a>
       ${cachedProfile?.is_admin ? '<a href="admin.html" class="btn btn-ghost btn-sm">Админ</a>' : ''}
       <button class="btn btn-pedal btn-sm" id="nav-logout" type="button">Выйти</button>`
    : `<a href="auth.html" class="btn btn-ghost btn-sm">Войти</a>
       <a href="auth.html?mode=register" class="btn btn-pedal btn-sm">Начать бесплатно</a>`;

  const mobileActionsHtml = cachedUser
    ? `<a href="course.html">Уроки</a>
       <a href="payment.html">Оплата</a>
       ${cachedProfile?.is_admin ? '<a href="admin.html">Админ</a>' : ''}
       <button type="button" id="nav-logout-mobile">Выйти</button>`
    : `<a href="auth.html">Войти</a>
       <a href="auth.html?mode=register">Начать бесплатно</a>`;

  mount.innerHTML = `
    <div class="wrap row">
      <a class="logo" href="index.html">${pickSvg()}GuitArt</a>
      <nav class="nav-links">${linksHtml}</nav>
      <div class="nav-actions">${actionsHtml}</div>
      <button class="nav-burger" id="nav-burger" type="button" aria-label="Меню" aria-expanded="false">☰</button>
    </div>
    <nav class="nav-mobile" id="nav-mobile">${linksHtml}${mobileActionsHtml}</nav>`;

  [document.getElementById('nav-logout'), document.getElementById('nav-logout-mobile')]
    .forEach(btn => btn && btn.addEventListener('click', signOutUser));

  const burgerBtn = document.getElementById('nav-burger');
  const mobilePanel = document.getElementById('nav-mobile');
  burgerBtn.addEventListener('click', () => {
    const isOpen = mobilePanel.classList.toggle('is-open');
    burgerBtn.setAttribute('aria-expanded', String(isOpen));
    burgerBtn.textContent = isOpen ? '✕' : '☰';
  });
  mobilePanel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobilePanel.classList.remove('is-open');
    burgerBtn.setAttribute('aria-expanded', 'false');
    burgerBtn.textContent = '☰';
  }));
}

document.addEventListener('DOMContentLoaded', () => { renderNav(); });
