import { YamapInstance } from 'react-native-yamap-plus';
import { initYaMap, resetYaMapInit, YAMAP_API_KEY } from '@/shared/lib/yaMapInit';

describe('initYaMap', () => {
  beforeEach(async () => {
    resetYaMapInit();
    jest.clearAllMocks();
    (YamapInstance.init as jest.Mock).mockImplementation(() => Promise.resolve());
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
    (YamapInstance.init as jest.Mock)
      .mockImplementationOnce(() => Promise.reject(new Error('init failed')))
      .mockImplementationOnce(() => Promise.resolve());

    await expect(initYaMap()).resolves.toBe(false);
    await expect(initYaMap({ force: true })).resolves.toBe(true);
    expect(YamapInstance.init).toHaveBeenCalledTimes(2);
  });
});
