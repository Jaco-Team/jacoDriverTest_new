import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearLaravelAuthToken,
  saveLaravelAuthToken,
} from '@/shared/lib/laravelAuthTokenStorage';
import { useGlobalStore } from '@/shared/store/store';

describe('useGlobalStore state helpers', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await clearLaravelAuthToken();
    useGlobalStore.setState({
      loadSpinner: false,
      loadSpinnerHidden: false,
      is_show_modal_text: false,
      is_show_alert_text: false,
      modal_text: '',
      tokenAuth: '',
      globalFontSize: 16,
      theme: 'white',
      mapScale: 1,
      phones: null,
      is_need_avg_time: true,
      is_need_page_stat: true,
      avgTime: '',
      notifToken: '',
    });
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('setTokenAuth: хранит token только в памяти store', async () => {
    await useGlobalStore.getState().setTokenAuth('auth-token');

    expect(useGlobalStore.getState().tokenAuth).toBe('auth-token');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('setTokenAuth: очищает token в памяти store', async () => {
    useGlobalStore.setState({ tokenAuth: 'auth-token' });

    await useGlobalStore.getState().setTokenAuth('');

    expect(useGlobalStore.getState().tokenAuth).toBe('');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('getAuthToken: если token уже есть в store, не читает AsyncStorage', async () => {
    useGlobalStore.setState({ tokenAuth: 'memory-token' });

    const token = await useGlobalStore.getState().getAuthToken();

    expect(token).toBe('memory-token');
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('getAuthToken: если token пустой, читает защищённое хранилище и кеширует результат', async () => {
    await saveLaravelAuthToken('stored-token');

    const token = await useGlobalStore.getState().getAuthToken();

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(token).toBe('stored-token');
    expect(useGlobalStore.getState().tokenAuth).toBe('stored-token');
  });

  it('showModalText/showAlertText: обновляет тексты и auto-hide alert по таймеру', async () => {
    useGlobalStore.getState().showModalText(true, 'Ошибка');

    expect(useGlobalStore.getState().is_show_modal_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe('Ошибка');

    useGlobalStore.getState().showAlertText(true, 'Сохранено');

    expect(useGlobalStore.getState().is_show_alert_text).toBe(true);
    expect(useGlobalStore.getState().modal_text).toBe('Сохранено');

    jest.advanceTimersByTime(4999);

    expect(useGlobalStore.getState().is_show_alert_text).toBe(true);

    jest.advanceTimersByTime(1);

    expect(useGlobalStore.getState().is_show_alert_text).toBe(false);
  });

  it('setters: обновляют глобальные настройки и service flags', async () => {
    const phones = { point: 'Центр', phone: '+70000000000' } as any;

    useGlobalStore.getState().setSpinner(true);
    useGlobalStore.getState().setSpinnerHidden(true);
    useGlobalStore.getState().setFontSize(22);
    useGlobalStore.getState().setTheme('black');
    useGlobalStore.getState().setMapScale(1.5);
    useGlobalStore.getState().setPhone(phones);
    useGlobalStore.getState().setNeedAvgTime(false);
    useGlobalStore.getState().setNeedPageStat(false);
    useGlobalStore.getState().setAvgTime('27 мин');
    useGlobalStore.getState().setNotifToken('push-token');

    expect(useGlobalStore.getState()).toEqual(
      expect.objectContaining({
        loadSpinner: true,
        loadSpinnerHidden: true,
        globalFontSize: 22,
        theme: 'black',
        mapScale: 1.5,
        phones,
        is_need_avg_time: false,
        is_need_page_stat: false,
        avgTime: '27 мин',
        notifToken: 'push-token',
      }),
    );
  });
});
