import {
  createEmbeddedAssetTransformer,
  type AssetResolver,
} from '../src/codePush/assets';

type ResolverClass = new (
  server: string | null,
  bundle: string | null,
  asset: object,
) => AssetResolver;
const Resolver = jest.requireActual(
  'react-native/Libraries/Image/AssetSourceResolver',
).default as ResolverClass;
const platform = jest.requireActual(
  'react-native/Libraries/Utilities/Platform',
).default;
const platformDescriptor = Object.getOwnPropertyDescriptor(platform, 'OS')!;
const asset = {
  __packager_asset: true,
  fileSystemLocation: '/project/src/shared/assets',
  httpServerLocation: '/assets/src/shared/assets',
  width: 150,
  height: 150,
  scales: [1, 2, 3],
  hash: 'a'.repeat(32),
  name: 'logo',
  type: 'png',
};

function setPlatform(value: string) {
  Object.defineProperty(platform, 'OS', {
    value,
    writable: true,
    configurable: true,
  });
}
afterEach(() => Object.defineProperty(platform, 'OS', platformDescriptor));

it('uses the actual RN 0.88 iOS asset path in the installed app, preserving scale', () => {
  setPlatform('ios');
  const embedded = 'file:///private/app/Jaco%20Driver.app/';
  const downloaded = new Resolver(
    null,
    'file:///private/support/codepush/candidate/',
    asset,
  );
  expect(downloaded.defaultAsset().uri).toContain('/codepush/candidate/');
  const transform = createEmbeddedAssetTransformer(
    'ios',
    `${embedded}main.jsbundle`,
  )!;
  const resolved = transform(downloaded);
  expect(resolved).toEqual(new Resolver(null, embedded, asset).defaultAsset());
  expect(resolved!.uri).toBe(`${embedded}assets/src/shared/assets/logo@2x.png`);
  expect(downloaded.defaultAsset().uri).toContain('/codepush/candidate/');
});

it.each(['png', 'xml', 'ttf', 'mp3'])(
  'preserves Android native resource resolution for %s',
  type => {
    setPlatform('android');
    const value = {...asset, type};
    const transform = createEmbeddedAssetTransformer(
      'android',
      'assets://index.android.bundle',
    )!;
    expect(
      transform(
        new Resolver(null, 'file:///private/codepush/candidate/', value),
      ),
    ).toEqual(new Resolver(null, null, value).defaultAsset());
  },
);

it('preserves RN resolver metadata rather than rewriting PNG filenames itself', () => {
  setPlatform('ios');
  const value = {...asset, resolver: 'generic', scales: [1]};
  const transform = createEmbeddedAssetTransformer(
    'ios',
    'file:///app/Jaco.app/main.jsbundle',
  )!;
  expect(transform(new Resolver(null, 'file:///codepush/', value))).toEqual(
    new Resolver(null, 'file:///app/Jaco.app/', value).defaultAsset(),
  );
});

it.each(['ios', 'android'])('leaves Metro resolution on %s unchanged', os => {
  setPlatform(os);
  const transform = createEmbeddedAssetTransformer(
    os,
    os === 'ios'
      ? 'file:///app/Jaco.app/main.jsbundle'
      : 'assets://index.android.bundle',
  )!;
  const resolver = new Resolver('http://localhost:8081/', null, asset);
  expect(transform(resolver)).toBeNull();
  expect(resolver.defaultAsset().uri).toContain('http://localhost:8081/');
});

it.each([
  ['ios', 'https://storage.yandexcloud.net/main.jsbundle'],
  ['ios', 'file:///app/main.jsbundle?secret=1'],
  ['ios', 'file:///app/main.jsbundle#fragment'],
  ['android', 'file:///codepush/index.android.bundle'],
  ['web', 'file:///app/main.jsbundle'],
])('fails closed for an unexpected embedded base %s %s', (os, url) => {
  expect(createEmbeddedAssetTransformer(os, url)).toBeNull();
});

it('does not touch URI objects in the real RN require-asset pipeline', () => {
  const resolve = jest.requireActual(
    'react-native/Libraries/Image/resolveAssetSource',
  ).default;
  const transformer = jest.fn();
  resolve.addCustomSourceTransformer(transformer);
  const source = {uri: 'https://storage.yandexcloud.net/images/about.png'};
  expect(resolve(source)).toBe(source);
  expect(transformer).not.toHaveBeenCalled();
});
