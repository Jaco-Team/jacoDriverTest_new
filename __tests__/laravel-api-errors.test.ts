import { getLaravelApiErrorInfo } from '@/shared/api/laravel/errors'

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
})
