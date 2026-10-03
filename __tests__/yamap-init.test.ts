import { Platform } from 'react-native';
import { YamapInstance } from 'react-native-yamap-plus';
import { initYaMap, resetYaMapInit, YAMAP_API_KEY } from '@/shared/lib/yaMapInit';

describe('initYaMap', () => {
  const originalPlatform = Platform.OS;

  beforeEach(async () => {
    resetYaMapInit();
    jest.clearAllMocks();
    (YamapInstance.init as jest.Mock).mockImplementation(() => Promise.resolve());
    (YamapInstance.setLocale as jest.Mock).mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('задаёт русскую локаль на Android до инициализации MapKit', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const callOrder: string[] = [];
    (YamapInstance.setLocale as jest.Mock).mockImplementation(async () => {
      callOrder.push('locale');
    });
    (YamapInstance.init as jest.Mock).mockImplementation(async () => {
      callOrder.push('init');
    });

    await expect(initYaMap()).resolves.toBe(true);
    expect(YamapInstance.setLocale).toHaveBeenCalledWith('ru_RU');
    expect(callOrder).toEqual(['locale', 'init']);
  });

  it('инициализирует MapKit один раз и переиспользует тот же промис', async () => {
    const first = initYaMap();
    const second = initYaMap();

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(first).toBe(second);
    expect(YamapInstance.init).toHaveBeenCalledTimes(1);
    expect(YamapInstance.init).toHaveBeenCalledWith(YAMAP_API_KEY);
  });

  it('после ошибки позволяет принудительно повторить инициализацию', async () => {
    const expectedError = new Error('init failed');
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    (YamapInstance.init as jest.Mock)
      .mockImplementationOnce(() => Promise.reject(expectedError))
      .mockImplementationOnce(() => Promise.resolve());

    try {
      await expect(initYaMap()).resolves.toBe(false);
      await expect(initYaMap({ force: true })).resolves.toBe(true);
      expect(YamapInstance.init).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith(expectedError);
    } finally {
      log.mockRestore();
    }
  });
});
