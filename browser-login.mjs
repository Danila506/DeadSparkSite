const API = 'https://deadspark-api.duckdns.org';

export function parseGameLogin(fragment) {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  if (params.get('mode') !== 'game-login') return null;
  const request_id = params.get('request_id');
  const browser_secret = params.get('browser_secret');
  if (!/^[a-f0-9]{32}$/.test(request_id || '') || !/^[A-Za-z0-9_-]{32,128}$/.test(browser_secret || '')) {
    throw new Error('invalid_game_request');
  }
  return { request_id, browser_secret };
}

export function createGameLoginAPI(grant, fetcher = fetch) {
  return async (action, token) => {
    if (!['inspect', 'approve'].includes(action)) throw new Error('invalid_action');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetcher(`${API}/game/browser/${action}`, {
      method: 'POST', headers, body: JSON.stringify(grant),
      credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'game_auth_failed');
    return data;
  };
}

export async function initializeGameLogin(client) {
  let grant;
  try { grant = parseGameLogin(location.hash); }
  catch { alert('Ссылка входа в игру повреждена. Открой её заново из игры.'); return; }
  if (!grant) return;
  // The short-lived browser proof is a fragment, never an HTTP URL parameter.
  history.replaceState(null, '', location.pathname + location.search);
  const request = createGameLoginAPI(grant);
  const root = document.createElement('section');
  root.setAttribute('aria-label', 'Подтверждение входа в игру');
  root.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#101514ef;display:grid;place-items:center;padding:20px;color:#eef2e8;font:16px/1.5 sans-serif;overflow:auto';
  root.innerHTML = '<div style="max-width:440px;padding:28px;border:1px solid #6b795e;border-radius:12px;background:#1b241e"><h2>Вход в Dead Spark</h2><p data-code>Проверяем запрос…</p><p>Разрешай вход только если сам нажал «Войти через сайт» в игре и код совпадает.</p><p data-account></p><button data-login>Войти в аккаунт сайта</button><button data-approve hidden>Разрешить вход в игру</button><button data-close style="margin-top:12px">Закрыть</button><p data-status role="status" aria-live="polite"></p></div>';
  document.body.append(root);
  const code = root.querySelector('[data-code]');
  const account = root.querySelector('[data-account]');
  const login = root.querySelector('[data-login]');
  const approve = root.querySelector('[data-approve]');
  const status = root.querySelector('[data-status]');
  let closed = false;
  let completed = false;
  let ready = false;
  let rendering = false;
  const fail = () => { status.textContent = 'Запрос истёк, отменён или сервис недоступен. Начни вход заново из игры.'; };
  async function render() {
    if (closed || completed || rendering) return;
    rendering = true;
    try {
      const { data, error } = await client.auth.getUser();
      if (closed) return;
      const user = error ? null : data.user;
      account.textContent = user ? `Аккаунт: ${user.email || ''}` : 'Сначала войди в аккаунт сайта.';
      login.hidden = !!user;
      approve.hidden = !user;
      approve.disabled = !ready || !user?.email_confirmed_at;
      if (user && !user.email_confirmed_at) status.textContent = 'Подтверди email перед входом в игру.';
    } catch { account.textContent = 'Сначала войди в аккаунт сайта.'; approve.hidden = true; }
    finally { rendering = false; }
  }
  login.addEventListener('click', () => document.querySelector('#account-button').click());
  const subscription = client.auth.onAuthStateChange((event) => {
    // Supabase holds a session lock while delivering this event.
    setTimeout(() => {
      if (closed || completed) return;
      if (event === 'SIGNED_IN') document.querySelector('#account-dialog').close();
      render();
    }, 0);
  }).data.subscription;
  root.querySelector('[data-close]').addEventListener('click', () => {
    closed = true; subscription.unsubscribe(); root.remove();
  });
  approve.addEventListener('click', async () => {
    if (completed || !ready) return;
    approve.disabled = true;
    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data.session?.access_token) throw new Error('not_signed_in');
      await request('approve', data.session.access_token);
      completed = true;
      subscription.unsubscribe();
      approve.hidden = true; login.hidden = true;
      status.textContent = 'Вход разрешён. Вернись в игру — она автоматически получит подтверждение.';
    } catch { fail(); approve.disabled = true; }
  });
  try {
    const info = await request('inspect');
    if (!/^[A-F0-9]{8}$/.test(info.display_code || '')) throw new Error('invalid_code');
    code.textContent = `Код в игре: ${info.display_code}`;
    ready = true;
    await render();
  } catch { code.textContent = 'Запрос входа недоступен.'; fail(); login.hidden = true; }
}
