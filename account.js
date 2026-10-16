import { authConfig } from './auth-config.js';
import { isAuthConfigured, createAccountService, authErrorMessage } from './auth-service.mjs';

const dialog = document.querySelector('#account-dialog');
const form = document.querySelector('#account-form');
const title = document.querySelector('#account-title');
const status = document.querySelector('#account-status');
const submit = document.querySelector('#account-submit');
const profile = document.querySelector('#account-profile');
const accountButton = document.querySelector('#account-button');
const email = form.elements.email;
const password = form.elements.password;
const confirmPassword = form.elements.confirm_password;
const displayName = form.elements.display_name;
let mode = 'signin';
let user = null;
let service = null;
let busy = false;
let recoverySession = false;
let subscription;

function message(text, isError = false) {
  status.textContent = text;
  status.classList.toggle('error', isError);
}
function showMode(next) {
  mode = next;
  form.reset();
  message('');
  const signup = next === 'signup';
  const recovery = next === 'recover';
  const update = next === 'password';
  title.textContent = ({ signin: 'С возвращением.', signup: 'Твоя история начинается.', recover: 'Вернём доступ.', password: 'Новый пароль.' })[next];
  document.querySelector('#name-field').hidden = !signup;
  document.querySelector('#email-field').hidden = update;
  document.querySelector('#password-field').hidden = recovery;
  document.querySelector('#confirm-field').hidden = !(signup || update);
  email.disabled = update;
  password.disabled = recovery;
  confirmPassword.disabled = !(signup || update);
  displayName.disabled = !signup;
  password.minLength = signup || update ? 12 : 1;
  password.autocomplete = signup || update ? 'new-password' : 'current-password';
  submit.textContent = ({ signin: 'Войти →', signup: 'Создать аккаунт →', recover: 'Отправить письмо →', password: 'Сохранить пароль →' })[next];
  document.querySelectorAll('[data-auth-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.authMode === next);
    button.setAttribute('aria-pressed', String(button.dataset.authMode === next));
  });
  render();
  if (!isAuthConfigured(authConfig)) message('Регистрация ещё не открыта. Подключение сервиса аккаунтов готовится.');
}
function render() {
  const showProfile = !!user && mode !== 'password';
  form.hidden = showProfile;
  profile.hidden = !showProfile;
  document.querySelector('#account-tabs').hidden = showProfile || mode === 'password';
  document.querySelector('#account-recover').hidden = showProfile || mode !== 'signin';
  accountButton.textContent = user ? 'Мой аккаунт ↗' : 'Вход / Регистрация ↗';
  if (showProfile) {
    title.textContent = 'На связи, выживший.';
    document.querySelector('#account-name').textContent = user.user_metadata?.display_name || 'Выживший';
    document.querySelector('#account-email').textContent = user.email || '';
    document.querySelector('#account-id').textContent = user.id;
    document.querySelector('#account-confirmed').textContent = user.email_confirmed_at ? 'Email подтверждён' : 'Email ожидает подтверждения';
  }
  submit.disabled = busy || !service;
  dialog.setAttribute('aria-busy', String(busy));
  document.querySelectorAll('[data-auth-mode], #account-logout, #account-recover').forEach(button => button.disabled = busy);
}
accountButton.addEventListener('click', () => {
  if (!recoverySession) showMode('signin');
  dialog.showModal();
  if (!service) message('Регистрация ещё не открыта. Подключение сервиса аккаунтов готовится.');
});
document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => showMode(button.dataset.authMode)));
document.querySelector('#account-recover').addEventListener('click', () => showMode('recover'));
document.querySelector('#account-close').addEventListener('click', () => { form.reset(); dialog.close(); });
dialog.addEventListener('close', () => form.reset());
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !service) return;
  if ((mode === 'signup' || mode === 'password') && password.value !== confirmPassword.value) {
    message('Пароли не совпадают.', true); confirmPassword.focus(); return;
  }
  if (mode === 'password' && !recoverySession) { message('Открой ссылку восстановления из письма.', true); return; }
  busy = true; render(); message('Подожди, связываемся с сервисом…');
  try {
    if (mode === 'signin') {
      user = await service.signIn(email.value, password.value);
      message('Вход выполнен. Этот же аккаунт можно использовать в игре после подключения авторизации.');
    } else if (mode === 'signup') {
      const result = await service.signUp(email.value, password.value, displayName.value);
      if (result.confirmationRequired) {
        showMode('signin');
        message('Если регистрация доступна для этого адреса, придёт письмо. Подтверди email и затем войди.');
      } else { user = result.user; message('Аккаунт создан.'); }
    } else if (mode === 'recover') {
      await service.recover(email.value);
      message('Если аккаунт с таким email существует, придёт письмо со ссылкой восстановления.');
    } else {
      await service.updatePassword(password.value);
      recoverySession = false; mode = 'signin';
      message('Пароль обновлён. Используй новый пароль на сайте и в игре.');
    }
    password.value = ''; confirmPassword.value = '';
  } catch (error) { message(authErrorMessage(error), true); }
  finally { busy = false; render(); }
});
document.querySelector('#account-logout').addEventListener('click', async () => {
  if (!service || busy) return;
  busy = true; render();
  try { await service.signOut(); user = null; recoverySession = false; showMode('signin'); message('Ты вышел из аккаунта на этом устройстве.'); }
  catch (error) { message(authErrorMessage(error), true); }
  finally { busy = false; render(); }
});

async function initialize() {
  showMode('signin');
  if (!isAuthConfigured(authConfig)) return;
  try {
    const { createClient } = await import('./vendor/supabase.js');
    const client = createClient(authConfig.supabaseUrl, authConfig.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'dead-spark-account-v1' },
    });
    const callback = new URL('index.html', location.href);
    callback.search = ''; callback.hash = '';
    service = createAccountService(client, callback.href);
    // Do not await SDK auth calls inside this callback (SDK holds a session lock).
    subscription = service.onChange((event, session) => {
      user = session?.user || null;
      if (event === 'PASSWORD_RECOVERY') {
        recoverySession = true; showMode('password');
        if (!dialog.open) dialog.showModal();
      }
      if (event === 'SIGNED_OUT') { recoverySession = false; mode = 'signin'; }
      render();
    });
    // A cached user is informational only; verify the initial identity with Auth.
    try { user = await service.currentUser(); } catch { user = null; }
    render();
    const params = new URLSearchParams(location.search);
    if (params.has('error') || params.has('error_description')) {
      showMode('recover'); dialog.showModal();
      message('Ссылка недействительна или истекла. Запроси новое письмо.', true);
      history.replaceState(null, '', location.pathname);
    }
  } catch { service = null; render(); message('Сервис аккаунтов недоступен. Попробуй позже.', true); }
}
initialize();
