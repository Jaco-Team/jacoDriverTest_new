import { parseSsoCallbackUrl } from '@/features/auth/model/ssoCallback'

describe('parseSsoCallbackUrl', () => {
  it('игнорирует ссылки, не относящиеся к SSO приложения', () => {
    expect(parseSsoCallbackUrl('https://example.com/auth')).toEqual({ handled: false })
  })

  it('извлекает одноразовый login_code из успешного callback', () => {
    expect(
      parseSsoCallbackUrl(
        'jacodriver://auth/sso?status=success&code=ok&login_code=abc123',
      ),
    ).toEqual({ handled: true, loginCode: 'abc123', error: '' })
  })

  it('переводит ошибку провайдера в понятный текст', () => {
    expect(
      parseSsoCallbackUrl(
        'jacodriver://auth/sso?status=error&code=user_not_found',
      ),
    ).toEqual({
      handled: true,
      loginCode: '',
      error: 'Для этого пользователя не найден аккаунт водителя.',
    })
  })

  it.each([
    ['access_denied', 'Вход через SSO отменён.'],
    ['invalid_state', 'Сессия SSO устарела. Начните вход ещё раз.'],
    ['unknown_error', 'Не удалось выполнить вход через SSO.'],
  ])('переводит код %s в ожидаемую ошибку', (code, message) => {
    expect(
      parseSsoCallbackUrl(`jacodriver://auth/sso?status=error&code=${code}`),
    ).toEqual({handled: true, loginCode: '', error: message})
  })

  it('не принимает success без одноразового login_code', () => {
    expect(parseSsoCallbackUrl('jacodriver://auth/sso?status=success')).toEqual({
      handled: true,
      loginCode: '',
      error: 'Не удалось выполнить вход через SSO.',
    })
  })
})
