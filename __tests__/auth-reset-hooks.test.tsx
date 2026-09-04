import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';

const mockInAppBrowserIsAvailable = InAppBrowser.isAvailable as jest.Mock;
const mockInAppBrowserOpenAuth = InAppBrowser.openAuth as jest.Mock;

const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockNavigation = { navigate: mockNavigate, reset: mockReset };
const mockAnalyticsLog = jest.fn();
let mockFocusCleanup: (() => void) | undefined;
let mockUrlListener: ((event: { url: string }) => void) | undefined;

let mockLoginState: any;
let mockGlobalState: any;

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => mockNavigation,
    useFocusEffect: (callback: any) => {
      React.useEffect(() => {
        const cleanup = typeof callback === 'function' ? callback() : undefined;
        mockFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;

        return () => {
          cleanup?.();
          if (mockFocusCleanup === cleanup) {
            mockFocusCleanup = undefined;
          }
        };
      }, [callback]);
    },
  };
});

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

jest.mock('@/shared/store/store', () => ({
  useLoginStore: (selector: any) => selector(mockLoginState),
  useGlobalStore: (selector: any) => selector(mockGlobalState),
}));

jest.mock('@/analytics/AppMetricaService', () => ({
  Analytics: { log: (...args: any[]) => mockAnalyticsLog(...args) },
  AnalyticsEvent: {
    ScreenOpen: 'ScreenOpen',
    AuthLogin: 'AuthLogin',
    AuthLoginFail: 'AuthLoginFail',
    AuthGoToResetPwd: 'AuthGoToResetPwd',
  },
}));

import { useAuthLogic } from '@/features/auth/model/useAuthLogic';
import { useResetPwdLogic } from '@/features/reset-pwd/model/useResetPwdLogic';

describe('auth/reset hooks', () => {
  const mockCheckToken = jest.fn();
  const mockAuth = jest.fn();
  const mockAuthWithSsoCode = jest.fn();
  const mockSendSMS = jest.fn();
  const mockSendCode = jest.fn();
  const mockShowModalText = jest.fn();

  function setupStore() {
    mockLoginState = {
      check_token: mockCheckToken,
      auth: mockAuth,
      authWithSsoCode: mockAuthWithSsoCode,
      is_load: false,
      sendSMS: mockSendSMS,
      sendCode: mockSendCode,
    };
    mockGlobalState = {
      showModalText: mockShowModalText,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFocusCleanup = undefined;
    mockUrlListener = undefined;
    setupStore();
    mockCheckToken.mockResolvedValue(false);
    mockAuth.mockResolvedValue({ st: false, text: 'fail' });
    mockAuthWithSsoCode.mockResolvedValue({ st: true, text: '' });
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);
    (Linking.openURL as jest.Mock).mockResolvedValue(true);
    mockInAppBrowserIsAvailable.mockResolvedValue(true);
    mockInAppBrowserOpenAuth.mockResolvedValue({type: 'cancel'});
    (Linking.addEventListener as jest.Mock).mockImplementation((_type, listener) => {
      mockUrlListener = listener as (event: { url: string }) => void;
      return { remove: jest.fn() };
    });
    mockSendSMS.mockResolvedValue({ st: false, text: 'fail' });
    mockSendCode.mockResolvedValue({ st: false, text: 'fail' });
  });

  it('useAuthLogic: при валидном token на focus ведет в список заказов', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;
    mockCheckToken.mockResolvedValueOnce(true);

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    await render(<Probe />);

    await waitFor(() =>
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'List_orders' }],
      }),
    );
    expect(api!.showPassword).toBe(false);
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'ScreenOpen',
      'Открытие страницы Список заказов',
    );
  });

  it('useAuthLogic: пустая форма не отправляется и переключает показ пароля', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    await render(<Probe />);
    await waitFor(() => expect(mockCheckToken).toHaveBeenCalled());
    mockReset.mockClear();

    await act(async () => {
      await api!.LogIn('', '');
    });

    expect(mockShowModalText).not.toHaveBeenCalled();
    expect(mockAuth).not.toHaveBeenCalled();
    expect(api!.loginError).toBe('');

    await act(async () => {
      api!.handleTogglePassword();
    });

    expect(api!.showPassword).toBe(true);
  });

  it('useAuthLogic: успешный login логирует событие и ведет в список заказов', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;
    mockAuth.mockResolvedValueOnce({ st: true, text: 'ok' });

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    await render(<Probe />);
    await waitFor(() => expect(mockCheckToken).toHaveBeenCalled());
    mockReset.mockClear();

    await act(async () => {
      api!.handleLoginChange('79990000000');
      api!.handlePasswordChange('123456');
      api!.handleTogglePassword();
    });

    await act(async () => {
      await api!.LogIn(api!.myLogin, api!.myPWD);
    });

    expect(mockAuth).toHaveBeenCalledWith('79990000000', '123456', '');
    expect(mockAnalyticsLog).toHaveBeenCalledWith('AuthLogin', 'Успешная авторизация');
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'List_orders' }],
    });
    expect(api!.myLogin).toBe('');
    expect(api!.myPWD).toBe('');
    expect(api!.showPassword).toBe(false);
    expect(api!.captchaRequired).toBe(false);
  });

  it('useAuthLogic: открывает системную auth-сессию и завершает SSO по callback', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;
    mockInAppBrowserOpenAuth.mockResolvedValueOnce({
      type: 'success',
      url: 'jacodriver://auth/sso?status=success&code=ok&login_code=one-time-code',
    });

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    await render(<Probe />);
    await waitFor(() => expect(mockCheckToken).toHaveBeenCalled());
    mockReset.mockClear();

    await act(async () => {
      await api!.LoginWithSSO();
    });

    expect(mockInAppBrowserOpenAuth).toHaveBeenCalledWith(
      'http://localhost:8080/auth/sso/login?client=mobile',
      'jacodriver://auth/sso',
      expect.objectContaining({
        ephemeralWebSession: false,
        forceCloseOnRedirection: true,
      }),
    );
    expect(Linking.openURL).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(mockAuthWithSsoCode).toHaveBeenCalledWith('one-time-code'),
    );
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'List_orders' }],
    });
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'AuthLogin',
      'Успешная авторизация через SSO',
    );
  });

  it('useAuthLogic: не выполняет обмен, если пользователь закрыл SSO', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    await render(<Probe />);

    await act(async () => {
      await api!.LoginWithSSO();
    });

    expect(mockInAppBrowserOpenAuth).toHaveBeenCalledTimes(1);
    expect(mockAuthWithSsoCode).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
    expect(api!.loginError).toBe('');
  });

  it('useAuthLogic: показывает ошибку, если системную SSO-сессию открыть не удалось', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;
    mockInAppBrowserOpenAuth.mockRejectedValueOnce(new Error('browser unavailable'));

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    await render(<Probe />);

    await act(async () => {
      await api!.LoginWithSSO();
    });

    expect(api!.loginError).toBe('Не удалось открыть вход через SSO.');
    expect(mockAuthWithSsoCode).not.toHaveBeenCalled();
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'AuthLoginFail',
      'Ошибка открытия SSO',
    );
  });

  it('useAuthLogic: показывает ошибку неуспешного обмена SSO-кода', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;
    mockInAppBrowserOpenAuth.mockResolvedValueOnce({
      type: 'success',
      url: 'jacodriver://auth/sso?status=success&login_code=expired-code',
    });
    mockAuthWithSsoCode.mockResolvedValueOnce({
      st: false,
      text: 'Код входа недействителен или уже использован.',
    });

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    await render(<Probe />);

    await act(async () => {
      await api!.LoginWithSSO();
    });

    expect(api!.loginError).toBe('Код входа недействителен или уже использован.');
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('useAuthLogic: обрабатывает SSO callback при холодном запуске', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValueOnce(
      'jacodriver://auth/sso?status=success&login_code=cold-start-code',
    );

    function Probe() {
      useAuthLogic();
      return null as any;
    }

    await render(<Probe />);

    await waitFor(() =>
      expect(mockAuthWithSsoCode).toHaveBeenCalledWith('cold-start-code'),
    );
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'List_orders'}],
    });
  });

  it('useAuthLogic: не обменивает один и тот же SSO callback дважды', async () => {
    const callbackUrl =
      'jacodriver://auth/sso?status=success&login_code=single-use-code';

    function Probe() {
      useAuthLogic();
      return null as any;
    }

    await render(<Probe />);

    await act(async () => {
      mockUrlListener?.({url: callbackUrl});
    });
    await waitFor(() => expect(mockAuthWithSsoCode).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockUrlListener?.({url: callbackUrl});
    });

    expect(mockAuthWithSsoCode).toHaveBeenCalledTimes(1);
  });

  it('useAuthLogic: использует обычный браузер только без поддержки auth-сессии', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;
    mockInAppBrowserIsAvailable.mockResolvedValueOnce(false);

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    await render(<Probe />);

    await act(async () => {
      await api!.LoginWithSSO();
    });

    expect(Linking.openURL).toHaveBeenCalledWith(
      'http://localhost:8080/auth/sso/login?client=mobile',
    );
  });

  it('useAuthLogic: показывает понятную ошибку отменённого SSO', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    await render(<Probe />);

    await act(async () => {
      mockUrlListener?.({
        url: 'jacodriver://auth/sso?status=error&code=access_denied',
      });
    });

    expect(api!.loginError).toBe('Вход через SSO отменён.');
    expect(mockAuthWithSsoCode).not.toHaveBeenCalled();
  });

  it('useAuthLogic: ошибка login логируется без перехода в список', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;
    mockAuth.mockResolvedValueOnce({
      st: false,
      text: 'bad',
      captcha_required: true,
    });

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    await render(<Probe />);
    await waitFor(() => expect(mockCheckToken).toHaveBeenCalled());
    mockReset.mockClear();

    await act(async () => {
      await api!.LogIn('79990000000', 'bad');
    });

    expect(mockAnalyticsLog).toHaveBeenCalledWith('AuthLoginFail', 'Ошибка авторизации');
    expect(mockReset).not.toHaveBeenCalled();
    expect(api!.loginError).toBe('Пройдите CAPTCHA, чтобы продолжить.');
    expect(api!.captchaRequired).toBe(true);

    await act(async () => {
      await api!.LogIn('79990000000', 'bad');
    });
    expect(mockAuth).toHaveBeenCalledTimes(1);
    expect(api!.loginError).toBe('Пройдите CAPTCHA, чтобы продолжить.');

    mockAuth.mockResolvedValueOnce({
      st: false,
      text: 'bad-again',
      captcha_required: true,
    });
    await act(async () => {
      api!.handleCaptchaTokenChange('captcha-token');
    });
    await act(async () => {
      await api!.LogIn('79990000000', 'bad');
    });
    expect(mockAuth).toHaveBeenLastCalledWith(
      '79990000000',
      'bad',
      'captcha-token',
    );
    expect(api!.loginError).toBe('bad-again');

    await act(async () => {
      api!.GoToResetPWD();
    });

    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'AuthGoToResetPwd',
      'Восстановление пароля',
    );
    expect(mockNavigate).toHaveBeenCalledWith('ResetPwd');
  });

  it('useResetPwdLogic: валидирует сложный пароль и переводит на шаг кода при успехе', async () => {
    let api: ReturnType<typeof useResetPwdLogic> | null = null;
    mockSendSMS.mockResolvedValueOnce({ st: true, text: 'sent' });

    function Probe() {
      api = useResetPwdLogic();
      return null as any;
    }

    await render(<Probe />);
    await waitFor(() => expect(mockCheckToken).toHaveBeenCalled());

    await act(async () => {
      await api!.requestRecoveryCode();
    });

    expect(mockSendSMS).not.toHaveBeenCalled();
    expect(api!.errorText).toBe('Введите номер телефона.');

    await act(async () => {
      api!.handleLoginChange('79990000000');
      api!.handlePasswordChange('Password1');
      api!.handleCaptchaTokenChange('captcha-token');
    });

    await act(async () => {
      await api!.requestRecoveryCode();
    });

    expect(mockSendSMS).toHaveBeenCalledWith(
      '79990000000',
      'Password1',
      'captcha-token',
    );
    expect(api!.activeStep).toBe(1);

    await act(async () => {
      api!.handleCodeChange('1107');
      api!.handleTogglePassword();
    });

    await act(async () => {
      mockFocusCleanup?.();
    });

    expect(api!.activeStep).toBe(0);
    expect(api!.myLogin).toBe('');
    expect(api!.myPWD).toBe('');
    expect(api!.myCode).toBe('');
    expect(api!.showPassword).toBe(false);
    expect(api!.errorText).toBe('');
  });

  it('useResetPwdLogic: оставляет первый шаг и показывает ошибку отправки SMS', async () => {
    let api: ReturnType<typeof useResetPwdLogic> | null = null;
    mockSendSMS.mockResolvedValueOnce({ st: false, text: 'SMS недоступна' });

    function Probe() {
      api = useResetPwdLogic();
      return null as any;
    }

    await render(<Probe />);
    await waitFor(() => expect(mockCheckToken).toHaveBeenCalled());

    await act(async () => {
      api!.handleLoginChange('79990000000');
      api!.handlePasswordChange('Password1');
      api!.handleCaptchaTokenChange('captcha-token');
    });

    await act(async () => {
      await api!.requestRecoveryCode();
    });

    expect(mockSendSMS).toHaveBeenCalledWith(
      '79990000000',
      'Password1',
      'captcha-token',
    );
    expect(api!.activeStep).toBe(0);
    expect(api!.errorText).toBe('SMS недоступна');
  });

  it('useResetPwdLogic: принимает только шесть цифр и при успехе ведет в список', async () => {
    let api: ReturnType<typeof useResetPwdLogic> | null = null;
    mockSendCode.mockResolvedValueOnce({ st: true, text: 'ok' });

    function Probe() {
      api = useResetPwdLogic();
      return null as any;
    }

    await render(<Probe />);
    await waitFor(() => expect(mockCheckToken).toHaveBeenCalled());
    mockNavigate.mockClear();

    await act(async () => {
      api!.handleCodeChange('12ab');
    });

    await act(async () => {
      await api!.confirmRecoveryCode();
    });

    expect(mockSendCode).not.toHaveBeenCalled();
    expect(api!.errorText).toBe('Введите шестизначный код из SMS.');

    await act(async () => {
      api!.handlePasswordChange('Password1');
      api!.handleCodeChange('1107123');
    });

    await act(async () => {
      await api!.confirmRecoveryCode();
    });

    expect(mockSendCode).toHaveBeenCalledWith('', '110712', 'Password1');
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'List_orders' }],
    });
  });

  it('useResetPwdLogic: показывает backend-ошибку неверного SMS-кода без перехода', async () => {
    let api: ReturnType<typeof useResetPwdLogic> | null = null;
    mockSendCode.mockResolvedValueOnce({
      st: false,
      text: 'Код из смс введен не верно',
    });

    function Probe() {
      api = useResetPwdLogic();
      return null as any;
    }

    await render(<Probe />);
    await waitFor(() => expect(mockCheckToken).toHaveBeenCalled());
    mockNavigate.mockClear();

    await act(async () => {
      api!.handleLoginChange('79990000000');
      api!.handlePasswordChange('Password1');
      api!.handleCodeChange('110712');
    });

    await act(async () => {
      await api!.confirmRecoveryCode();
    });

    expect(mockSendCode).toHaveBeenCalledWith('79990000000', '110712', 'Password1');
    expect(api!.errorText).toBe('Код из смс введен не верно');
    expect(mockReset).not.toHaveBeenCalled();
  });
});
