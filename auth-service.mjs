export function isAuthConfigured(config) {
  try {
    const url = new URL(config.supabaseUrl);
    const key = config.publishableKey;
    // Legacy anon JWT keys are supported, but never accept a service-role JWT.
    let legacyAnon = false;
    if (typeof key === 'string' && key.startsWith('eyJ')) {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      legacyAnon = payload.role === 'anon';
    }
    return url.protocol === 'https:' && !url.username && !url.password &&
      url.pathname === '/' && !url.search && !url.hash &&
      typeof key === 'string' && (key.startsWith('sb_publishable_') || legacyAnon);
  } catch { return false; }
}

export function createAccountService(client, redirectTo) {
  const auth = client.auth;
  function checked(result) {
    if (result.error) throw result.error;
    return result.data;
  }
  return {
    onChange(listener) {
      return auth.onAuthStateChange(listener).data.subscription;
    },
    async currentUser() {
      const data = checked(await auth.getUser());
      return data.user;
    },
    async signIn(email, password) {
      const data = checked(await auth.signInWithPassword({ email: email.trim(), password }));
      if (!data.session || !data.user) throw new Error('invalid_session');
      return data.user;
    },
    async signUp(email, password, displayName) {
      const data = checked(await auth.signUp({
        email: email.trim(), password,
        options: { emailRedirectTo: redirectTo, data: { display_name: displayName.trim() } },
      }));
      return { user: data.user, confirmationRequired: !data.session };
    },
    async recover(email) {
      checked(await auth.resetPasswordForEmail(email.trim(), { redirectTo }));
    },
    async updatePassword(password) {
      // The SDK supplies the authenticated recovery session, never a user ID from the form.
      checked(await auth.updateUser({ password }));
    },
    async signOut() { checked(await auth.signOut({ scope: 'local' })); },
  };
}

export function authErrorMessage(error) {
  const code = error?.code || error?.message;
  const messages = {
    invalid_credentials: 'Неверный email или пароль.',
    email_not_confirmed: 'Подтверди email по ссылке из письма, затем войди.',
    weak_password: 'Пароль слишком простой. Используй не менее 12 символов.',
    over_email_send_rate_limit: 'Лимит отправки писем. Попробуй позже.',
    over_request_rate_limit: 'Слишком много попыток. Попробуй позже.',
    signup_disabled: 'Регистрация временно отключена.',
    same_password: 'Новый пароль должен отличаться от прежнего.',
    invalid_session: 'Не удалось подтвердить вход. Попробуй ещё раз.',
    session_not_found: 'Сессия истекла. Запроси новую ссылку восстановления.',
  };
  return messages[code] || 'Не удалось выполнить запрос. Проверь соединение и попробуй ещё раз.';
}
