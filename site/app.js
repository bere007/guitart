// GuitArt — shared backend client & UI logic.
// Real auth, real database, real RLS via Supabase. See ../supabase/schema.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, FUNCTIONS_URL } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const CURRICULUM = [
  { n: 1, title: 'Посадка, аккорды Em и G', task: 'Сними видео: чисто сыграй переход Em → G, 8 тактов подряд.' },
  { n: 2, title: 'Бой шестёркой и аккорд C', task: 'Пришли видео с боем «шестёрка» на связке Em–C–G, в темпе 80 BPM.' },
  { n: 3, title: 'Аккорд D и первый бой-перебор', task: 'Сыграй куплет любой песни на Em–C–G–D без остановки.' },
  { n: 4, title: 'Барре F и зажимы', task: 'Видео с чистым звучанием барре F, 4 переключения без глушения струн.' },
  { n: 5, title: 'Перебор восьмёркой', task: 'Запиши перебор восьмёркой на прогрессии Am–F–C–G, метроном обязателен.' },
  { n: 6, title: 'Соло-техника: хаммер-он и пул-офф', task: 'Сыграй тренировочную фразу с hammer-on/pull-off на 5-м ладу.' },
  { n: 7, title: 'Разбор трека целиком', task: 'Пришли полный разбор выбранного трека — куплет, припев, бридж.' },
  { n: 8, title: 'Подготовка к экзамену', task: 'Финальный прогон трека целиком, без остановок и подсказок.' },
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
        const { data } = await supabase.from('profiles').select('name, is_admin').eq('id', cachedUser.id).single();
        cachedProfile = data ?? null;
      }
    })();
  }
  return sessionReady;
}

export function currentUser(){ return cachedUser; }
export function currentProfile(){ return cachedProfile; }

/** Loads the session without redirecting -- use on auth.html to check "already logged in?". */
export async function whoAmI(){
  await loadSession();
  return cachedUser;
}

/** Forces the next loadSession() to hit the network again instead of the cached result. */
function invalidateSession(){ sessionReady = null; }

export async function signUp(name, email, password){
  const { error } = await supabase.auth.signUp({
    email, password, options: { data: { name } },
  });
  if(!error){ invalidateSession(); await loadSession(); }
  return error;
}

export async function signIn(email, password){
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if(!error){ invalidateSession(); await loadSession(); }
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
    supabase.from('profiles').select('id, name, is_admin').order('created_at', { ascending: true }),
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
  ];
  const linksHtml = links.map(l => `<a href="${l.href}">${l.label}</a>`).join('');

  const actionsHtml = cachedUser
    ? `<span class="nav-user"><span aria-hidden="true">●</span>${escapeHtml((cachedProfile?.name || cachedUser.email).split(' ')[0])}</span>
       <a href="course.html" class="btn btn-ghost btn-sm">Кабинет</a>
       ${cachedProfile?.is_admin ? '<a href="admin.html" class="btn btn-ghost btn-sm">Админ</a>' : ''}
       <button class="btn btn-pedal btn-sm" id="nav-logout" type="button">Выйти</button>`
    : `<a href="auth.html" class="btn btn-ghost btn-sm">Войти</a>
       <a href="auth.html?mode=register" class="btn btn-pedal btn-sm">Начать бесплатно</a>`;

  mount.innerHTML = `
    <div class="wrap row">
      <a class="logo" href="index.html">${pickSvg()}GuitArt</a>
      <nav class="nav-links">${linksHtml}</nav>
      <div class="nav-actions">${actionsHtml}</div>
    </div>`;

  const logoutBtn = document.getElementById('nav-logout');
  if(logoutBtn) logoutBtn.addEventListener('click', signOutUser);
}

document.addEventListener('DOMContentLoaded', () => { renderNav(); });
