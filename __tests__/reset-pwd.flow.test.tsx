import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

const mockNavigate = jest.fn();
const mockReset = jest.fn();
// Один и тот же объект на все рендеры: иначе эффект фокуса перезапускался бы бесконечно.
const mockNavigation = { navigate: mockNavigate, reset: mockReset };
const mockAnalyticsLog = jest.fn();
const mockFetchOptions = jest.fn();
const mockRequestCode = jest.fn();
const mockResetPassword = jest.fn();
const mockCheckToken = jest.fn();
const mockAuth = jest.fn();

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => mockNavigation,
    useFocusEffect: (callback: any) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

jest.mock('@/shared/store/store', () => ({
  useLoginStore: (selector: any) => selector({ check_token: mockCheckToken, auth: mockAuth }),
}));

jest.mock('@/shared/api/laravel/auth', () => ({
  fetchLaravelRecoveryOptions: (...args: any[]) => mockFetchOptions(...args),
  requestLaravelRecoveryCode: (...args: any[]) => mockRequestCode(...args),
  resetLaravelPasswordWithCode: (...args: any[]) => mockResetPassword(...args),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: { ScreenOpen: 'ScreenOpen', AuthSendSms: 'AuthSendSms', AuthSendSmsFail: 'AuthSendSmsFail' },
}));

import { useResetPwdLogic } from '@/features/reset-pwd/model/useResetPwdLogic';

type Api = ReturnType<typeof useResetPwdLogic>;

const ok = (extra: Record<string, unknown> = {}) => ({
  st: true,
  text: '',
  errorCode: '',
  retryAfter: 0,
  resendAfter: 0,
  captchaRequired: false,
  ...extra,
});
const fail = (extra: Record<string, unknown> = {}) => ok({ st: false, text: 'Отказ', ...extra });

async function mount() {
  const holder: { api: Api | null } = { api: null };

  function Probe() {
    holder.api = useResetPwdLogic();
    return null as any;
  }

  const screen = await render(<Probe />);
  await waitFor(() => expect(mockFetchOptions).toHaveBeenCalled());
  await act(async () => {});

  return { holder, screen, api: () => holder.api! };
}

async function reachPasswordStep(api: () => Api) {
  await act(async () => api().setPhone('79991234567'));
  await act(async () => api().submit());
  await act(async () => api().setCode('123456'));
  await act(async () => api().submit());
  await act(async () => {
    api().setPassword('NewPassword9');
    api().setRepeatPassword('NewPassword9');
  });
}

describe('useResetPwdLogic: сначала код, потом новый пароль', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckToken.mockResolvedValue(false);
    mockFetchOptions.mockResolvedValue({ channels: ['sms', 'telegram', 'voice'], captchaRequired: false });
    mockRequestCode.mockResolvedValue(ok({ text: 'Запрос принят', resendAfter: 30 }));
    mockResetPassword.mockResolvedValue(ok());
    mockAuth.mockResolvedValue({ st: true, text: '' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('при действующем входе сразу уводит в список заказов', async () => {
    mockCheckToken.mockResolvedValue(true);

    await mount();

    await waitFor(() =>
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'List_orders' }] }),
    );
  });

  it('предлагает способы, которые разрешил сервер, и отправляет код выбранным', async () => {
    const { api } = await mount();

    expect(api().channels).toEqual(['sms', 'telegram', 'voice']);
    expect(api().captchaVisible).toBe(false);
    expect(api().canSubmit).toBe(false);

    await act(async () => api().setPhone('79991234567'));
    await act(async () => api().setChannel('telegram'));
    expect(api().phone).toBe('+7 (999) 123-45-67');

    await act(async () => api().submit());

    expect(mockRequestCode).toHaveBeenCalledWith('+79991234567', 'telegram', '');
    expect(api().step).toBe('code');
    expect(api().maskedPhone).toBe('+7 (999) ***-**-67');
    expect(api().recoveryMessage).toBe('Запрос принят');
    expect(api().resendAfter).toBe(30);
    expect(mockAnalyticsLog).toHaveBeenCalledWith('AuthSendSms', 'Отправка кода восстановления');
  });

  it('без ответа о настройках оставляет SMS и обязательную CAPTCHA', async () => {
    mockFetchOptions.mockResolvedValue({ channels: ['sms'], captchaRequired: true });
    const { api } = await mount();

    await act(async () => api().setPhone('79991234567'));
    expect(api().captchaVisible).toBe(true);
    expect(api().canSubmit).toBe(false);

    await act(async () => api().resend());
    expect(mockRequestCode).not.toHaveBeenCalled();
    expect(api().error).toEqual({ text: 'Пройдите CAPTCHA, чтобы продолжить.', code: false });

    await act(async () => api().handleCaptchaTokenChange('token-1'));
    await act(async () => api().submit());
    expect(mockRequestCode).toHaveBeenCalledWith('+79991234567', 'sms', 'token-1');

    // Использованный токен сброшен: повторная отправка ждёт новой проверки.
    const key = api().captchaResetKey;
    await act(async () => api().resend());
    expect(mockRequestCode).toHaveBeenCalledTimes(1);
    expect(key).toBeGreaterThan(0);
  });

  it('не обращается к серверу с неполным номером и не дублирует запрос', async () => {
    const { api } = await mount();

    await act(async () => api().setPhone('7999'));
    await act(async () => api().resend());
    expect(mockRequestCode).not.toHaveBeenCalled();
    expect(api().phoneError).toBe('Введите номер в формате +7 или 8');

    let finish!: (value: unknown) => void;
    mockRequestCode.mockReturnValue(new Promise(resolve => (finish = resolve)));
    await act(async () => api().setPhone('79991234567'));
    await act(async () => {
      api().submit();
      api().submit();
    });
    expect(mockRequestCode).toHaveBeenCalledTimes(1);
    await act(async () => finish(ok()));
    expect(api().step).toBe('code');
  });

  it('неизвестный номер показывает под полем, как в ШЭФ', async () => {
    mockRequestCode.mockResolvedValue(
      fail({ errorCode: 'account_not_found', text: 'Аккаунт с таким номером не найден.' }),
    );
    const { api } = await mount();

    await act(async () => api().setPhone('79991234567'));
    await act(async () => api().submit());

    expect(api().step).toBe('request');
    expect(api().phoneError).toBe('Аккаунт с таким номером не найден.');
    expect(api().error).toBeNull();
    expect(mockAnalyticsLog).toHaveBeenCalledWith('AuthSendSmsFail', 'Ошибка отправки кода восстановления');

    await act(async () => api().setPhone('79991234568'));
    expect(api().phoneError).toBe('');
  });

  it('код проверяется сервером только вместе с новым паролем', async () => {
    const { api } = await mount();

    await act(async () => api().setPhone('79991234567'));
    await act(async () => api().submit());

    await act(async () => api().setCode('12'));
    await act(async () => api().submit());
    expect(api().step).toBe('code');
    expect(api().error).toEqual({ text: 'Введите 6 цифр кода', code: false });

    await act(async () => api().setCode('12a3456789'));
    expect(api().code).toBe('123456');
    await act(async () => api().submit());

    expect(api().step).toBe('password');
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('сохраняет пароль только при выполненных требованиях и входит с ним', async () => {
    const { api } = await mount();

    await reachPasswordStep(api);
    await act(async () => api().setRepeatPassword('NewPassword'));
    expect(api().passwordRules).toEqual({ length: true, characters: true, match: false });
    expect(api().canSubmit).toBe(false);
    await act(async () => api().submit());
    expect(mockResetPassword).not.toHaveBeenCalled();

    // Пробелы в пароль не попадают.
    await act(async () => api().setRepeatPassword('New Password9'));
    expect(api().repeatPassword).toBe('NewPassword9');
    await act(async () => api().submit());

    expect(mockResetPassword).toHaveBeenCalledWith('+79991234567', '123456', 'NewPassword9');
    expect(api().step).toBe('success');

    await act(async () => api().submit());

    expect(mockAuth).toHaveBeenCalledWith('+79991234567', 'NewPassword9');
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'List_orders' }] });
  });

  it('если войти с новым паролем не удалось, открывает экран входа', async () => {
    mockAuth.mockResolvedValue({ st: false, text: 'Ошибка' });
    const { api } = await mount();

    await reachPasswordStep(api);
    await act(async () => api().submit());
    await act(async () => api().submit());

    expect(mockNavigate).toHaveBeenCalledWith('Auth');
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('отклонённый код возвращает к его вводу и сохраняет новый пароль', async () => {
    mockResetPassword.mockResolvedValue(fail({ errorCode: 'invalid_code', text: 'Код не подошёл' }));
    const { api } = await mount();

    await reachPasswordStep(api);
    await act(async () => api().submit());

    expect(api().step).toBe('code');
    expect(api().code).toBe('');
    expect(api().error).toEqual({ text: 'Код не подошёл', code: true });
    expect(api().password).toBe('NewPassword9');
  });

  it('ждёт перед новой попыткой сохранить, когда сервер просит', async () => {
    mockResetPassword.mockResolvedValue(fail({ errorCode: 'too_many_requests', retryAfter: 20 }));
    const { api } = await mount();

    await reachPasswordStep(api);
    await act(async () => api().submit());

    expect(api().step).toBe('password');
    expect(api().retryAfter).toBe(20);
    expect(api().canSubmit).toBe(false);
  });

  it('отсчёт повторной отправки идёт по времени и догоняет его после возврата из фона', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    // AppState в тестах уже подменён: меняем его реализацию и возвращаем прежнюю в конце.
    const addListener = AppState.addEventListener as jest.Mock;
    const originalAddListener = addListener.getMockImplementation();
    addListener.mockImplementation((_type: string, listener: (state: AppStateStatus) => void) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    });

    try {
      const holder: { api: Api | null } = { api: null };
      function Probe() {
        holder.api = useResetPwdLogic();
        return null as any;
      }
      await render(<Probe />);
      await act(async () => {});
      const api = () => holder.api!;

      await act(async () => api().setPhone('79991234567'));
      await act(async () => api().submit());
      expect(api().resendAfter).toBe(30);

      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
      expect(api().resendAfter).toBe(20);

      jest.setSystemTime(new Date('2026-11-10T10:00:31Z'));
      await act(async () => appStateListener?.('active'));
      expect(api().resendAfter).toBe(0);
    } finally {
      addListener.mockImplementation(originalAddListener ?? (() => ({ remove: jest.fn() })));
    }
  });

  it('шаг назад и правка номера возвращают к предыдущим шагам', async () => {
    const { api } = await mount();

    await reachPasswordStep(api);
    await act(async () => api().back());
    expect(api().step).toBe('code');
    await act(async () => api().editPhone());
    expect(api().step).toBe('request');
    expect(api().code).toBe('');
    expect(api().password).toBe('');

    await act(async () => api().goToLogin());
    expect(mockNavigate).toHaveBeenCalledWith('Auth');
  });

  it('ответ, пришедший после ухода с экрана, игнорируется', async () => {
    let finish!: (value: unknown) => void;
    mockRequestCode.mockReturnValue(new Promise(resolve => (finish = resolve)));
    const { api, screen } = await mount();

    await act(async () => api().setPhone('79991234567'));
    await act(async () => {
      api().submit();
    });
    await screen.unmount();

    await act(async () => finish(ok()));
    expect(api().step).toBe('request');
  });
});
