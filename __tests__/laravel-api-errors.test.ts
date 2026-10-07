import { getLaravelApiErrorInfo, getLaravelRecoveryMetadata } from '@/shared/api/laravel/errors'

describe('Laravel API errors', () => {
  it('берёт текст и CAPTCHA-флаг из Laravel validation response', () => {
    expect(
      getLaravelApiErrorInfo({
        response: {
          status: 422,
          data: {
            captcha_required: true,
            errors: { login: ['Неверный логин или пароль.'] },
          },
        },
      }),
    ).toEqual({
      captchaRequired: true,
      message: 'Неверный логин или пароль.',
      status: 422,
    })
  })

  it('преобразует сетевую ошибку в понятное сообщение', () => {
    expect(
      getLaravelApiErrorInfo({ code: 'ENOTFOUND', message: 'socket failed' }),
    ).toEqual({
      captchaRequired: false,
      message: 'Не удалось подключиться к серверу.',
      status: null,
    })
  })
  it('переводит транспортный 429 и сохраняет Retry-After из заголовка', () => {
    expect(getLaravelApiErrorInfo({ response: {
      status: 429,
      headers: { 'retry-after': '30' },
      data: { message: 'Too Many Attempts.' },
    } })).toEqual({
      captchaRequired: false,
      status: 429,
      retryAfter: 30,
      message: 'Слишком много попыток. Повторите через 30 с.',
    })
  })

  it('приоритет у времени сервера, некорректные интервалы игнорируются', () => {
    expect(getLaravelApiErrorInfo({ response: {
      status: 429,
      headers: { 'Retry-After': '60' },
      data: { retry_after: 12.1, captcha_required: true },
    } })).toEqual(expect.objectContaining({ retryAfter: 13, captchaRequired: true }))
    expect(getLaravelRecoveryMetadata({ retry_after: -2, resend_after: 'NaN', locked: true }))
      .toEqual({ locked: true })
    expect(getLaravelApiErrorInfo({ response: {
      status: 429, headers: { 'retry-after': '-1' }, data: {},
    } }).message).toBe('Слишком много попыток. Повторите немного позже.')
  })

})
