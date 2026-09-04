import { laravelApiConfig } from '@/shared/api/laravel/config'

export type SsoCallbackResult =
  | { handled: false }
  | { handled: true; loginCode: string; error: '' }
  | { handled: true; loginCode: ''; error: string }

const SSO_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Вход через SSO отменён.',
  invalid_state: 'Сессия SSO устарела. Начните вход ещё раз.',
  user_not_found: 'Для этого пользователя не найден аккаунт водителя.',
}

export function parseSsoCallbackUrl(url: string): SsoCallbackResult {
  if (!url.startsWith(laravelApiConfig.ssoCallbackUrl)) {
    return { handled: false }
  }

  try {
    const callback = new URL(url)
    const status = callback.searchParams.get('status') ?? ''
    const code = callback.searchParams.get('code') ?? ''
    const loginCode = callback.searchParams.get('login_code')?.trim() ?? ''

    if (status === 'success' && loginCode) {
      return { handled: true, loginCode, error: '' }
    }

    return {
      handled: true,
      loginCode: '',
      error: SSO_ERROR_MESSAGES[code] ?? 'Не удалось выполнить вход через SSO.',
    }
  } catch {
    return {
      handled: true,
      loginCode: '',
      error: 'Некорректный ответ SSO. Начните вход ещё раз.',
    }
  }
}
