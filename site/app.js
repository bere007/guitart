// GuitArt — shared backend client & UI logic.
// Real auth, real database, real RLS via Supabase. See ../supabase/schema.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, FUNCTIONS_URL } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Structural week titles only -- lessons (title/duration/video) and the
// per-week task now live in the database and are fully managed by teachers
// from admin.html: add, rename, delete, upload/replace video.
export const CURRICULUM = [
  { n: 1, title: 'Посадка, аккорды Em и G' },
  { n: 2, title: 'Бой шестёркой и аккорд C' },
  { n: 3, title: 'Аккорд D и первый бой-перебор' },
  { n: 4, title: 'Барре F и зажимы' },
  { n: 5, title: 'Перебор восьмёркой' },
  { n: 6, title: 'Соло-техника: хаммер-он и пул-офф' },
  { n: 7, title: 'Разбор трека целиком' },
  { n: 8, title: 'Подготовка к экзамену' },
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
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${location.pathname.replace(/[^/]+$/, '')}course.html` },
  });
  // On success the browser navigates away to Google immediately, so any
  // return here means it failed before that redirect (e.g. the Google
  // provider isn't enabled in Supabase yet).
  return error;
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
    supabase.from('week_reports').select('week_number, report_url, video_path, submitted_at').eq('user_id', user.id),
    supabase.from('enrollments').select('paid, paid_at').eq('user_id', user.id).single(),
    supabase.from('exam_bookings').select('slot, booked_at, passed, passed_at, certificate_name').eq('user_id', user.id).single(),
  ]);
  const reportByWeek = {};
  (reports || []).forEach(r => { reportByWeek[r.week_number] = r; });
  const paid = !!enrollment?.paid;
  const weeks = {};
  CURRICULUM.forEach(w => {
    const report = reportByWeek[w.n];
    const unlocked = w.n === 1 || (paid && !!reportByWeek[w.n - 1]);
    weeks[w.n] = {
      unlocked,
      reportSubmitted: !!report,
      videoPath: report?.video_path || null,
      reportUrl: report?.report_url || null, // legacy: reports submitted before video upload existed
    };
  });
  return { paid, weeks, exam: exam || {}, reportsDone: (reports || []).length };
}

export function courseProgressPercent(weeks){
  const done = CURRICULUM.filter(w => weeks[w.n].reportSubmitted).length;
  return Math.round((done / CURRICULUM.length) * 100);
}

const MAX_REPORT_BYTES = 200 * 1024 * 1024; // matches the "reports" bucket's file_size_limit

/** Uploads the video to private storage, then records it; RLS re-checks payment + sequencing server-side. */
export async function uploadReportVideo(weekNumber, file){
  if(file.size > MAX_REPORT_BYTES){
    return { error: { message: 'Файл больше 200 МБ — сожми видео или укороти его.' } };
  }
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
  const path = `${cachedUser.id}/week-${weekNumber}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('reports')
    .upload(path, file, { contentType: file.type || 'video/mp4', upsert: false });
  if(uploadError) return { error: uploadError };

  const { error } = await supabase
    .from('week_reports')
    .insert({ user_id: cachedUser.id, week_number: weekNumber, video_path: path });
  if(error){
    // Row was rejected (e.g. gating check failed) -- don't leave an orphaned file behind.
    await supabase.storage.from('reports').remove([path]);
    return { error };
  }
  return { error: null };
}

/** A short-lived signed URL for playing back a private report video. */
export async function getReportVideoUrl(path){
  const { data, error } = await supabase.storage.from('reports').createSignedUrl(path, 3600);
  if(error) return null;
  return data.signedUrl;
}

const MAX_LESSON_BYTES = 300 * 1024 * 1024; // matches the "lessons" bucket's file_size_limit
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/** { weekNumber: [{id, title, duration, video_path}, ...] }, ordered -- any signed-in user can read this. */
export async function fetchWeekLessons(){
  const { data } = await supabase.from('week_lessons').select('id, week_number, position, title, duration, video_path').order('position');
  const map = {};
  (data || []).forEach(row => { (map[row.week_number] ||= []).push(row); });
  return map;
}

/** Admin-only in practice: adds a new lesson row to the end of a week's list. */
export async function createLesson(weekNumber, title, duration, position){
  const { error } = await supabase.from('week_lessons').insert({ week_number: weekNumber, title, duration, position });
  return error;
}

/** Admin-only in practice: renames a lesson / changes its duration text. */
export async function updateLesson(id, { title, duration }){
  const { error } = await supabase.from('week_lessons').update({ title, duration, updated_at: new Date().toISOString() }).eq('id', id);
  return error;
}

/** Admin-only in practice: deletes a lesson (and its video file, if any). */
export async function deleteLesson(id, videoPath){
  const { error } = await supabase.from('week_lessons').delete().eq('id', id);
  if(!error && videoPath) await supabase.storage.from('lessons').remove([videoPath]);
  return error;
}

/** Admin-only in practice: uploads/replaces the video for one lesson row. */
export async function uploadLessonVideo(id, weekNumber, file, oldVideoPath){
  if(file.size > MAX_LESSON_BYTES){
    return { error: { message: 'Файл больше 300 МБ — сожми видео или укороти его.' } };
  }
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
  const path = `week-${weekNumber}/lesson-${id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('lessons')
    .upload(path, file, { contentType: file.type || 'video/mp4', upsert: false });
  if(uploadError) return { error: uploadError };

  const { error } = await supabase
    .from('week_lessons')
    .update({ video_path: path, updated_at: new Date().toISOString() })
    .eq('id', id);
  if(error){
    await supabase.storage.from('lessons').remove([path]);
    return { error };
  }
  if(oldVideoPath) await supabase.storage.from('lessons').remove([oldVideoPath]);
  return { error: null };
}

/** Admin-only in practice: removes a lesson's video without deleting the lesson itself. */
export async function removeLessonVideo(id, videoPath){
  const { error } = await supabase.from('week_lessons').update({ video_path: null }).eq('id', id);
  if(!error && videoPath) await supabase.storage.from('lessons').remove([videoPath]);
  return error;
}

/** A short-lived signed URL for playing back a lesson video. */
export async function getLessonVideoUrl(path){
  const { data, error } = await supabase.storage.from('lessons').createSignedUrl(path, 3600);
  if(error) return null;
  return data.signedUrl;
}

/** { weekNumber: {title, body, photo_path, task} } for every week that has content -- any signed-in user can read this. */
export async function fetchLectures(){
  const { data } = await supabase.from('week_lectures').select('week_number, title, body, photo_path, task');
  const map = {};
  (data || []).forEach(row => { map[row.week_number] = row; });
  return map;
}

/** Admin-only in practice: writes/replaces the lecture text + task for one week (photo is uploaded separately). */
export async function saveLecture(weekNumber, { title, body, task }){
  const { error } = await supabase
    .from('week_lectures')
    .upsert({ week_number: weekNumber, title, body, task, updated_by: cachedUser.id }, { onConflict: 'week_number' });
  return error;
}

/** Admin-only in practice: uploads/replaces the lecture photo for one week. */
export async function uploadLecturePhoto(weekNumber, file){
  if(file.size > MAX_PHOTO_BYTES){
    return { error: { message: 'Файл больше 15 МБ — сожми фото.' } };
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `week-${weekNumber}/lecture-photo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('lessons')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if(uploadError) return { error: uploadError };

  const { error } = await supabase
    .from('week_lectures')
    .upsert({ week_number: weekNumber, photo_path: path, updated_by: cachedUser.id }, { onConflict: 'week_number' });
  if(error){
    await supabase.storage.from('lessons').remove([path]);
    return { error };
  }
  return { error: null };
}

/** A short-lived signed URL for displaying a lecture photo. */
export async function getLecturePhotoUrl(path){
  const { data, error } = await supabase.storage.from('lessons').createSignedUrl(path, 3600);
  if(error) return null;
  return data.signedUrl;
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

/** Markup for a styled file input (see .file-picker in style.css) -- native <input type=file> hidden, a real button triggers it. */
export function filePickerHtml(id, accept, label){
  return `<div class="file-picker">
    <input type="file" class="file-input" id="${id}" accept="${accept}">
    <label for="${id}" class="btn btn-ghost btn-sm file-picker-btn">${escapeHtml(label)}</label>
    <span class="file-picker-name" id="${id}-name">Файл не выбран</span>
  </div>`;
}

function pickSvg(){
  return `<svg class="pick" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="pickGrad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="var(--copper)"/>
        <stop offset="1" stop-color="var(--pedal)"/>
      </linearGradient>
    </defs>
    <path d="M12 3.2C16.1 3.2 19.4 6.4 19.4 10.3C19.4 14 16.2 17.9 12 20.3C7.8 17.9 4.6 14 4.6 10.3C4.6 6.4 7.9 3.2 12 3.2Z" fill="url(#pickGrad)"/>
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

// Styled file inputs: a real <input type="file"> is visually hidden inside
// .file-picker and triggered via its <label>; this just keeps the visible
// filename text in sync, delegated so it works for inputs added later by
// dynamically rendered admin UI too.
document.addEventListener('change', (e) => {
  if(!e.target.matches('.file-input')) return;
  const wrap = e.target.closest('.file-picker');
  const nameEl = wrap?.querySelector('.file-picker-name');
  if(nameEl) nameEl.textContent = e.target.files[0]?.name || 'Файл не выбран';
});
