const mockApi = jest.fn();
const mockAnalyticsLog = jest.fn();

jest.mock('@/shared/store/api', () => ({
  api: (...args: any[]) => mockApi(...args),
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

    useGlobalStore.setState({
      tokenAuth: '',
      loadSpinner: false,
      is_show_modal_text: false,
      modal_text: '',
    });
    useLoginStore.setState({
      is_load: false,
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

  it('auth success: отправляет login/password, сохраняет token и запускает getSettings', async () => {
    mockApi.mockResolvedValueOnce({
      st: true,
      text: 'ok',
      data: { token: 'auth-token' },
    });

    const result = await useLoginStore.getState().auth('driver', '123456');

    expect(mockApi).toHaveBeenCalledWith('auth', {
      type: 'login',
      login: 'driver',
      pwd: '123456',
    });
    expect(result).toEqual({ st: true, text: 'ok' });
    expect(useGlobalStore.getState().tokenAuth).toBe('auth-token');
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
    expect(useLoginStore.getState().is_load).toBe(true);
    expect(useGlobalStore.getState().loadSpinner).toBe(true);

    jest.advanceTimersByTime(500);

    expect(useLoginStore.getState().is_load).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('auth error: показывает modal text и не обновляет token', async () => {
    mockApi.mockResolvedValueOnce({
      st: false,
      text: 'Неверный пароль',
    });

    const result = await useLoginStore.getState().auth('driver', 'bad');

    expect(result).toEqual({ st: false, text: 'Неверный пароль' });
    expect(useGlobalStore.getState().tokenAuth).toBe('');
    expect(mockGetSettings).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().is_show_modal_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe('Неверный пароль');

    jest.advanceTimersByTime(500);

    expect(useLoginStore.getState().is_load).toBe(false);
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('auth double click guard: пока is_load=true, API не вызывается повторно', async () => {
    useLoginStore.setState({ is_load: true });

    const result = await useLoginStore.getState().auth('driver', '123456');

    expect(result).toEqual({ st: false, text: 'Пожалуйста, подождите...' });
    expect(mockApi).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().loadSpinner).toBe(false);
  });

  it('sendSMS success/error: логирует результат и на ошибке показывает modal text', async () => {
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
    expect(useGlobalStore.getState().is_show_modal_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe('SMS недоступна');
  });

  it('sendCode success: сохраняет token и запускает getSettings', async () => {
    mockApi.mockResolvedValueOnce({
      st: true,
      text: 'ok',
      data: { token: 'sms-token' },
    });

    const result = await useLoginStore.getState().sendCode('driver', '0000');

    expect(mockApi).toHaveBeenCalledWith('auth', {
      type: 'check_code',
      login: 'driver',
      code: '0000',
    });
    expect(result).toEqual({ st: true, text: 'ok' });
    expect(useGlobalStore.getState().tokenAuth).toBe('sms-token');
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
  });

  it('check_token: без token не дергает API, с token проверяет сервер и обновляет настройки', async () => {
    const emptyResult = await useLoginStore.getState().check_token();

    expect(emptyResult).toBe(false);
    expect(mockApi).not.toHaveBeenCalled();

    useGlobalStore.setState({ tokenAuth: 'stored-token' });
    mockApi.mockResolvedValueOnce({ st: true });

    const result = await useLoginStore.getState().check_token();

    expect(result).toBe(true);
    expect(mockApi).toHaveBeenCalledWith('auth', {
      type: 'check_token',
      token: 'stored-token',
    });
    expect(useGlobalStore.getState().tokenAuth).toBe('stored-token');
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
  });

  it('logogout: логирует выход и очищает token', async () => {
    useGlobalStore.setState({ tokenAuth: 'auth-token' });

    useLoginStore.getState().logogout();

    expect(mockAnalyticsLog).toHaveBeenCalledWith('DrawerLogout', 'Выход из аккаунта');
    expect(useGlobalStore.getState().tokenAuth).toBe('');
  });
});
