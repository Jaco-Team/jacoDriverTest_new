import YaMap from 'react-native-yamap';
import { initYaMap, resetYaMapInit, YAMAP_API_KEY } from '@/shared/lib/yaMapInit';

describe('initYaMap', () => {
  beforeEach(() => {
    resetYaMapInit();
    jest.clearAllMocks();
    (YaMap.init as jest.Mock).mockImplementation(() => Promise.resolve());
  });

  it('инициализирует MapKit один раз и переиспользует тот же промис', async () => {
    const first = initYaMap();
    const second = initYaMap();

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(first).toBe(second);
    expect(YaMap.init).toHaveBeenCalledTimes(1);
    expect(YaMap.init).toHaveBeenCalledWith(YAMAP_API_KEY);
  });

  it('после ошибки позволяет принудительно повторить инициализацию', async () => {
    (YaMap.init as jest.Mock)
      .mockImplementationOnce(() => Promise.reject(new Error('init failed')))
      .mockImplementationOnce(() => Promise.resolve());

    await expect(initYaMap()).resolves.toBe(false);
    await expect(initYaMap({ force: true })).resolves.toBe(true);
    expect(YaMap.init).toHaveBeenCalledTimes(2);
  });
});
