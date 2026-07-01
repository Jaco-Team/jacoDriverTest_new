import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockAnalyticsLog = jest.fn();

let mockLoginState: any;
let mockGlobalState: any;

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate }),
    useFocusEffect: (callback: any) => {
      React.useEffect(() => (typeof callback === 'function' ? callback() : undefined), [callback]);
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
  const mockSendSMS = jest.fn();
  const mockSendCode = jest.fn();
  const mockShowModalText = jest.fn();

  function setupStore() {
    mockLoginState = {
      check_token: mockCheckToken,
      auth: mockAuth,
      sendSMS: mockSendSMS,
      sendCode: mockSendCode,
    };
    mockGlobalState = {
      showModalText: mockShowModalText,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setupStore();
    mockCheckToken.mockResolvedValue(false);
    mockAuth.mockResolvedValue({ st: false, text: 'fail' });
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

    render(<Probe />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('List_orders'));
    expect(api!.showPassword).toBe(false);
    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'ScreenOpen',
      'Открытие страницы Список заказов',
    );
  });

  it('useAuthLogic: валидирует пустой логин/пароль и переключает показ пароля', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    render(<Probe />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Auth'));
    mockNavigate.mockClear();

    await act(async () => {
      await api!.LogIn('', '');
    });

    expect(mockShowModalText).toHaveBeenCalledWith(
      true,
      'Номер телефона или пароль не должны быть пустыми',
    );
    expect(mockAuth).not.toHaveBeenCalled();

    act(() => {
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

    render(<Probe />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Auth'));
    mockNavigate.mockClear();

    await act(async () => {
      await api!.LogIn('79990000000', '123456');
    });

    expect(mockAuth).toHaveBeenCalledWith('79990000000', '123456');
    expect(mockAnalyticsLog).toHaveBeenCalledWith('AuthLogin', 'Успешная авторизация');
    expect(mockNavigate).toHaveBeenCalledWith('List_orders');
  });

  it('useAuthLogic: ошибка login логируется без перехода в список', async () => {
    let api: ReturnType<typeof useAuthLogic> | null = null;
    mockAuth.mockResolvedValueOnce({ st: false, text: 'bad' });

    function Probe() {
      api = useAuthLogic();
      return null as any;
    }

    render(<Probe />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Auth'));
    mockNavigate.mockClear();

    await act(async () => {
      await api!.LogIn('79990000000', 'bad');
    });

    expect(mockAnalyticsLog).toHaveBeenCalledWith('AuthLoginFail', 'Ошибка авторизации');
    expect(mockNavigate).not.toHaveBeenCalledWith('List_orders');

    act(() => {
      api!.GoToResetPWD();
    });

    expect(mockAnalyticsLog).toHaveBeenCalledWith(
      'AuthGoToResetPwd',
      'Восстановление пароля',
    );
    expect(mockNavigate).toHaveBeenCalledWith('ResetPwd');
  });

  it('useResetPwdLogic: SMS flow валидирует форму и переводит на шаг кода при успехе', async () => {
    let api: ReturnType<typeof useResetPwdLogic> | null = null;
    mockSendSMS.mockResolvedValueOnce({ st: true, text: 'sent' });

    function Probe() {
      api = useResetPwdLogic();
      return null as any;
    }

    render(<Probe />);
    await waitFor(() => expect(mockCheckToken).toHaveBeenCalled());

    await act(async () => {
      await api!.sendsms('', '');
    });

    expect(mockShowModalText).toHaveBeenCalledWith(
      true,
      'Номер телефона или пароль не должны быть пустыми',
    );

    await act(async () => {
      await api!.sendsms('79990000000', '123456');
    });

    expect(mockSendSMS).toHaveBeenCalledWith('79990000000', '123456');
    expect(api!.activeStep).toBe(1);
  });

  it('useResetPwdLogic: check_code игнорирует короткий код и при успехе ведет в список', async () => {
    let api: ReturnType<typeof useResetPwdLogic> | null = null;
    mockSendCode.mockResolvedValueOnce({ st: true, text: 'ok' });

    function Probe() {
      api = useResetPwdLogic();
      return null as any;
    }

    render(<Probe />);
    await waitFor(() => expect(mockCheckToken).toHaveBeenCalled());
    mockNavigate.mockClear();

    await act(async () => {
      await api!.check_code('79990000000', '123');
    });

    expect(mockSendCode).not.toHaveBeenCalled();

    await act(async () => {
      await api!.check_code('79990000000', '1234');
    });

    expect(mockSendCode).toHaveBeenCalledWith('79990000000', '1234');
    expect(mockNavigate).toHaveBeenCalledWith('List_orders');
  });
});
