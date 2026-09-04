const mockApi = jest.fn();
const mockAnalyticsLog = jest.fn();
const mockFetchLaravelMe = jest.fn();
const mockExchangeLaravelSsoLoginCode = jest.fn();
const mockLoginWithLaravel = jest.fn();
const mockLogoutFromLaravel = jest.fn();
const mockSaveLaravelAuthToken = jest.fn();
const mockGetLaravelAuthToken = jest.fn();
const mockClearLaravelAuthToken = jest.fn();

jest.mock('@/shared/store/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

jest.mock('@/shared/api/laravel/auth', () => ({
  exchangeLaravelSsoLoginCode: (...args: any[]) => mockExchangeLaravelSsoLoginCode(...args),
  fetchLaravelMe: (...args: any[]) => mockFetchLaravelMe(...args),
  loginWithLaravel: (...args: any[]) => mockLoginWithLaravel(...args),
  logoutFromLaravel: (...args: any[]) => mockLogoutFromLaravel(...args),
}));

jest.mock('@/shared/lib/laravelAuthTokenStorage', () => ({
  clearLaravelAuthToken: (...args: any[]) => mockClearLaravelAuthToken(...args),
  getLaravelAuthToken: (...args: any[]) => mockGetLaravelAuthToken(...args),
  saveLaravelAuthToken: (...args: any[]) => mockSaveLaravelAuthToken(...args),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: {
    AuthSendSms: 'AuthSendSms',
    AuthSendSmsFail: 'AuthSendSmsFail',
    DrawerLogout: 'DrawerLogout',
  },
}));

import { useGlobalStore, useLoginStore, useSettingsStore } from '@/shared/store/store';

describe('useLoginStore auth flow', () => {
  const mockGetSettings = jest.fn();
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockGetLaravelAuthToken.mockResolvedValue('');
    mockClearLaravelAuthToken.mockResolvedValue(undefined);
    mockSaveLaravelAuthToken.mockResolvedValue(undefined);
    mockLogoutFromLaravel.mockResolvedValue(undefined);
    mockFetchLaravelMe.mockResolvedValue({ login: 'driver' });
    mockExchangeLaravelSsoLoginCode.mockResolvedValue({
      token: 'sso-token',
      token_type: 'Bearer',
    });
    mockLoginWithLaravel.mockResolvedValue({
      login: 'driver',
      token: 'laravel-token',
      token_type: 'Bearer',
    });

    useGlobalStore.setState({
      tokenAuth: '',
      loadSpinner: false,
      is_show_modal_text: false,
      modal_text: '',
    });
    useLoginStore.setState({
      is_load: false,
      currentUser: null,
    });
    useSettingsStore.setState({
      getSettings: mockGetSettings,
    } as any);
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
  });

  it('auth success: создаёт Laravel-сессию и запускает getSettings', async () => {
    const result = await useLoginStore.getState().auth('driver', '123456');

    expect(mockLoginWithLaravel).toHaveBeenCalledWith('driver', '123456', '');
    expect(mockApi).not.toHaveBeenCalled();
    expect(result).toEqual({ st: true, text: '' });
    expect(mockSaveLaravelAuthToken).toHaveBeenCalledWith('laravel-token');
    expect(mockFetchLaravelMe).toHaveBeenCalledWith('laravel-token');
    expect(useGlobalStore.getState().tokenAuth).toBe('laravel-token');
    expect(useLoginStore.getState().currentUser?.login).toBe('driver');
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
    expect(useLoginStore.getState().is_load).toBe(true);
    expect(useGlobalStore.getState().loadSpinner).toBe(true);

    jest.advanceTimersByTime(500);

    expect(useLoginStore.getState().is_load).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('auth error: возвращает Laravel-ошибку и не вызывает legacy API', async () => {
    mockLoginWithLaravel.mockRejectedValueOnce({
      response: {
        status: 422,
        data: { text: 'Неверный логин или пароль.' },
      },
    });

    const result = await useLoginStore.getState().auth('driver', 'bad');

    expect(result).toEqual({
      st: false,
      text: 'Неверный логин или пароль.',
      captcha_required: false,
    });
    expect(mockApi).not.toHaveBeenCalled();
    expect(mockSaveLaravelAuthToken).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().tokenAuth).toBe('');
    expect(useLoginStore.getState().currentUser).toBeNull();
    expect(mockGetSettings).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().is_show_modal_text).toBe(false);
    expect(useGlobalStore.getState().modal_text).toBe('');

    jest.advanceTimersByTime(500);

    expect(useLoginStore.getState().is_load).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('authWithSsoCode: обменивает одноразовый код и создаёт Laravel-сессию', async () => {
    const result = await useLoginStore.getState().authWithSsoCode('one-time-code');

    expect(mockExchangeLaravelSsoLoginCode).toHaveBeenCalledWith('one-time-code');
    expect(mockSaveLaravelAuthToken).toHaveBeenCalledWith('sso-token');
    expect(mockFetchLaravelMe).toHaveBeenCalledWith('sso-token');
    expect(useGlobalStore.getState().tokenAuth).toBe('sso-token');
    expect(useLoginStore.getState().currentUser?.login).toBe('driver');
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ st: true, text: '' });
  });

  it('authWithSsoCode: не сохраняет token при ошибке обмена', async () => {
    mockExchangeLaravelSsoLoginCode.mockRejectedValueOnce({
      response: {
        status: 422,
        data: { message: 'Код входа недействителен или уже использован.' },
      },
    });

    const result = await useLoginStore.getState().authWithSsoCode('expired-code');

    expect(result).toEqual({
      st: false,
      text: 'Код входа недействителен или уже использован.',
    });
    expect(mockSaveLaravelAuthToken).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().tokenAuth).toBe('');
  });

  it('authWithSsoCode: очищает сессию, если Keychain не сохранил token', async () => {
    mockSaveLaravelAuthToken.mockRejectedValueOnce(new Error('Keychain unavailable'));

    const result = await useLoginStore.getState().authWithSsoCode('one-time-code');

    expect(result).toEqual({st: false, text: 'Keychain unavailable'});
    expect(mockClearLaravelAuthToken).toHaveBeenCalledTimes(1);
    expect(mockFetchLaravelMe).not.toHaveBeenCalled();
    expect(mockGetSettings).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().tokenAuth).toBe('');
    expect(useLoginStore.getState().currentUser).toBeNull();

    jest.advanceTimersByTime(500);
    expect(useLoginStore.getState().is_load).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('auth captcha_required: передаёт UI требование показать CAPTCHA-заглушку', async () => {
    mockLoginWithLaravel.mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          text: 'Требуется CAPTCHA',
          captcha_required: true,
        },
      },
    });

    const result = await useLoginStore.getState().auth('driver', 'bad');

    expect(result).toEqual({
      st: false,
      text: 'Требуется CAPTCHA',
      captcha_required: true,
    });
    expect(useGlobalStore.getState().tokenAuth).toBe('');
  });

  it('auth double click guard: пока is_load=true, API не вызывается повторно', async () => {
    useLoginStore.setState({ is_load: true });

    const result = await useLoginStore.getState().auth('driver', '123456');

    expect(result).toEqual({ st: false, text: 'Пожалуйста, подождите...' });
    expect(mockApi).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('sendSMS success/error: логирует результат и возвращает ошибку для inline-блока', async () => {
    mockApi
      .mockResolvedValueOnce({ st: true, text: 'sent' })
      .mockResolvedValueOnce({ st: false, text: 'SMS недоступна' });

    const success = await useLoginStore.getState().sendSMS('driver', '123456');

    expect(success).toEqual({ st: true, text: 'sent' });
    expect(mockApi).toHaveBeenNthCalledWith(1, 'auth', {
      type: 'get_sms',
      login: 'driver',
      pwd: '123456',
    });
    expect(mockAnalyticsLog).toHaveBeenCalledWith('AuthSendSms', 'Отправка СМС-кода');

    jest.advanceTimersByTime(500);

    const error = await useLoginStore.getState().sendSMS('driver', 'bad');

    expect(error).toEqual({ st: false, text: 'SMS недоступна' });
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'AuthSendSmsFail',
      'Ошибка отправки СМС-кода',
    );
    expect(useGlobalStore.getState().is_show_modal_text).toBe(false);
    expect(useGlobalStore.getState().modal_text).toBe('');
  });

  it('sendCode success: подтверждает код и выполняет Laravel-вход с новым паролем', async () => {
    mockApi.mockResolvedValueOnce({
      st: true,
      text: 'ok',
    });

    const result = await useLoginStore.getState().sendCode('driver', '123456', 'NewPassword1!');

    expect(mockApi).toHaveBeenCalledWith('auth', {
      type: 'check_code',
      login: 'driver',
      code: '123456',
    });
    expect(result).toEqual({ st: true, text: 'ok' });
    expect(mockLoginWithLaravel).toHaveBeenCalledWith('driver', 'NewPassword1!');
    expect(mockSaveLaravelAuthToken).toHaveBeenCalledWith('laravel-token');
    expect(mockFetchLaravelMe).toHaveBeenCalledWith('laravel-token');
    expect(useGlobalStore.getState().tokenAuth).toBe('laravel-token');
    expect(useLoginStore.getState().currentUser?.login).toBe('driver');
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
  });

  it('sendCode error: возвращает inline-ошибку и не сохраняет token', async () => {
    mockApi.mockResolvedValueOnce({
      st: false,
      text: 'Код из смс введен не верно',
    });

    const result = await useLoginStore.getState().sendCode('driver', '123456', 'NewPassword1!');

    expect(mockApi).toHaveBeenCalledWith('auth', {
      type: 'check_code',
      login: 'driver',
      code: '123456',
    });
    expect(result).toEqual({
      st: false,
      text: 'Код из смс введен не верно',
    });
    expect(useGlobalStore.getState().tokenAuth).toBe('');
    expect(mockGetSettings).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().is_show_modal_text).toBe(false);
  });

  it('check_token: без Laravel token очищает сессию и не дергает API', async () => {
    const emptyResult = await useLoginStore.getState().check_token();

    expect(emptyResult).toBe(false);
    expect(mockApi).not.toHaveBeenCalled();
    expect(mockClearLaravelAuthToken).toHaveBeenCalledTimes(1);
  });

  it('check_token: при недоступном Keychain завершает Greeting и открывает вход', async () => {
    mockGetLaravelAuthToken.mockRejectedValueOnce(new Error('Keychain unavailable'));
    useGlobalStore.setState({
      tokenAuth: 'stale-token',
      loadSpinner: true,
      loadSpinnerHidden: true,
    });
    useLoginStore.setState({ is_load: true });

    const result = await useLoginStore.getState().check_token();

    expect(result).toBe(false);
    expect(useGlobalStore.getState().tokenAuth).toBe('');
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
    expect(useGlobalStore.getState().loadSpinnerHidden).toBe(false);
    expect(useLoginStore.getState().is_load).toBe(false);
    expect(useLoginStore.getState().currentUser).toBeNull();
    expect(mockFetchLaravelMe).not.toHaveBeenCalled();
  });

  it('check_token: проверяет Laravel-сессию перед открытием приложения', async () => {
    mockGetLaravelAuthToken.mockResolvedValueOnce('laravel-token');

    const result = await useLoginStore.getState().check_token();

    expect(result).toBe(true);
    expect(mockFetchLaravelMe).toHaveBeenCalledWith('laravel-token');
    expect(mockApi).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().tokenAuth).toBe('laravel-token');
    expect(useLoginStore.getState().currentUser?.login).toBe('driver');
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
  });

  it('check_token: при Laravel 401 очищает token', async () => {
    mockGetLaravelAuthToken.mockResolvedValueOnce('expired-laravel-token');
    mockFetchLaravelMe.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Unauthenticated.' } },
    });
    useGlobalStore.setState({ tokenAuth: 'expired-laravel-token' });

    const result = await useLoginStore.getState().check_token();

    expect(result).toBe(false);
    expect(mockClearLaravelAuthToken).toHaveBeenCalledTimes(1);
    expect(useGlobalStore.getState().tokenAuth).toBe('');
    expect(useLoginStore.getState().currentUser).toBeNull();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('logogout: логирует выход и очищает token', async () => {
    mockGetLaravelAuthToken.mockResolvedValueOnce('laravel-token');
    useGlobalStore.setState({ tokenAuth: 'auth-token' });

    await useLoginStore.getState().logogout();

    expect(mockAnalyticsLog).toHaveBeenCalledWith('DrawerLogout', 'Выход из аккаунта');
    expect(mockClearLaravelAuthToken).toHaveBeenCalledTimes(1);
    expect(useGlobalStore.getState().tokenAuth).toBe('');
    expect(useLoginStore.getState().currentUser).toBeNull();
    expect(mockLogoutFromLaravel).toHaveBeenCalledWith('laravel-token');
  });

  it('после фейкового удаления demo-аккаунт может войти повторно', async () => {
    mockGetLaravelAuthToken.mockResolvedValueOnce('demo-token');
    useLoginStore.setState({
      currentUser: { login: '79990000001' } as any,
    });
    useGlobalStore.setState({ tokenAuth: 'demo-token' });

    await useLoginStore.getState().logogout();

    mockLoginWithLaravel.mockResolvedValueOnce({
      login: '79990000001',
      token: 'new-demo-token',
      token_type: 'Bearer',
    });
    mockFetchLaravelMe.mockResolvedValueOnce({ login: '79990000001' });

    const result = await useLoginStore
      .getState()
      .auth('79990000001', 'DemoDriver1!');

    expect(result).toEqual({ st: true, text: '' });
    expect(mockLoginWithLaravel).toHaveBeenCalledWith(
      '79990000001',
      'DemoDriver1!',
      '',
    );
    expect(useGlobalStore.getState().tokenAuth).toBe('new-demo-token');
    expect(useLoginStore.getState().currentUser?.login).toBe('79990000001');
  });

  it('передаёт CAPTCHA token в Laravel login и восстановление пароля', async () => {
    await useLoginStore.getState().auth('driver', '123456', 'login-captcha-token');

    expect(mockLoginWithLaravel).toHaveBeenCalledWith(
      'driver',
      '123456',
      'login-captcha-token',
    );

    jest.advanceTimersByTime(500);
    mockApi.mockResolvedValueOnce({ st: true, text: 'sent' });

    await useLoginStore
      .getState()
      .sendSMS('driver', 'NewPassword1!', 'recovery-captcha-token');

    expect(mockApi).toHaveBeenCalledWith('auth', {
      type: 'get_sms',
      login: 'driver',
      pwd: 'NewPassword1!',
      captcha_token: 'recovery-captcha-token',
    });
  });
});
