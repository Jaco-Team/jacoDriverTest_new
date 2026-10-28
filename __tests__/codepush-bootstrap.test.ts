const mockConstants = jest.fn();
const mockAddTransformer = jest.fn();
const mockImage: {
  resolveAssetSource: {addCustomSourceTransformer?: typeof mockAddTransformer};
} = {
  resolveAssetSource: {addCustomSourceTransformer: mockAddTransformer},
};
const mockPlatform = {OS: 'android'};
const mockRegister = jest.fn();
jest.mock('react-native', () => ({
  Image: mockImage,
  Platform: mockPlatform,
  AppRegistry: {registerComponent: mockRegister},
}));
jest.mock('../src/codePush/NativeCodePush', () => ({
  __esModule: true,
  default: {getConstants: mockConstants},
}));

const originalDev = __DEV__;
function load(development: boolean): boolean {
  Object.defineProperty(global, '__DEV__', {
    value: development,
    writable: true,
    configurable: true,
  });
  let ready = false;
  jest.isolateModules(() => {
    ready = require('../src/codePush/bootstrap').areCodePushAssetsReady();
  });
  return ready;
}
beforeEach(() => {
  mockConstants
    .mockReset()
    .mockReturnValue({embeddedBundleUrl: 'assets://index.android.bundle'});
  mockAddTransformer.mockReset();
  mockImage.resolveAssetSource = {
    addCustomSourceTransformer: mockAddTransformer,
  };
});
afterEach(() => {
  Object.defineProperty(global, '__DEV__', {
    value: originalDev,
    writable: true,
    configurable: true,
  });
});

it('keeps Debug on the regular Metro resolver without accessing native constants', () => {
  expect(load(true)).toBe(true);
  expect(mockConstants).not.toHaveBeenCalled();
  expect(mockAddTransformer).not.toHaveBeenCalled();
});

it('installs the resolver before a Release app can report readiness', () => {
  expect(load(false)).toBe(true);
  expect(mockAddTransformer).toHaveBeenCalledTimes(1);
  expect(mockAddTransformer).toHaveBeenCalledWith(expect.any(Function));
});

it('blocks readiness when the embedded base is unavailable or untrusted', () => {
  mockConstants.mockReturnValue({embeddedBundleUrl: 'https://secret.invalid/'});
  expect(load(false)).toBe(false);
  expect(mockAddTransformer).not.toHaveBeenCalled();
});

it('blocks readiness when the installed RN resolver API is unavailable', () => {
  mockImage.resolveAssetSource = {};
  expect(load(false)).toBe(false);
  expect(mockConstants).not.toHaveBeenCalled();
});

it('does not crash or expose a rejected native exception', () => {
  mockConstants.mockImplementation(() => {
    throw new Error('SECRET_PATH');
  });
  expect(load(false)).toBe(false);
  expect(mockAddTransformer).not.toHaveBeenCalled();
});

it('executes the actual entry bootstrap before importing App', () => {
  Object.defineProperty(global, '__DEV__', {
    value: false,
    writable: true,
    configurable: true,
  });
  const order: string[] = [];
  mockAddTransformer.mockImplementation(() => order.push('assets-installed'));
  jest.doMock('react-native-gesture-handler', () => ({}));
  jest.doMock('../src/shared/lib/interactionManagerCompat', () => ({}));
  jest.doMock('../src/shared/lib/reanimatedGuard', () => ({}));
  jest.doMock('../App', () => {
    order.push('App-imported');
    return {__esModule: true, default: () => null};
  });
  jest.isolateModules(() => require('../index'));
  expect(order).toEqual(['assets-installed', 'App-imported']);
  expect(mockRegister).toHaveBeenCalled();
});
