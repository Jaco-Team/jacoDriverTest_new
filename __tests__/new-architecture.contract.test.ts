import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('New Architecture contract', () => {
  it('включает Fabric в native flags', () => {
    expect(read('android/gradle.properties')).toMatch(/newArchEnabled\s*=\s*true/);
    expect(read('android/gradle.properties')).toMatch(/android\.builtInKotlin\s*=\s*false/);
    expect(read('android/gradle.properties')).toMatch(/android\.newDsl\s*=\s*false/);
    expect(read('ios/Podfile')).toMatch(/ENV\['RCT_NEW_ARCH_ENABLED'\]\s*=\s*'1'/);
    expect(read('ios/jacoDriverTest/Info.plist')).toMatch(
      /<key>RCTNewArchEnabled<\/key>\s*<true\/>/,
    );
  });

  it('держит RN 0.87, Reanimated 4.6+, worklets и yamap-plus', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies: Record<string, string>;
    };
    const deps = pkg.dependencies;

    expect(deps['react-native']).toBe('0.87.0');
    expect(deps['react-native-reanimated']).toMatch(/^4\.(6|7|8|9)/);
    expect(deps['react-native-worklets']).toBeTruthy();
    expect(deps['react-native-yamap-plus']).toMatch(/^\^?6\.11/);
    expect(deps['react-native-screens']).toMatch(/^\^?4\.27/);
    expect(deps['react-native-gesture-handler']).toMatch(/^\^?3\.2/);
    expect(deps['react-native-safe-area-context']).toMatch(/^\^?5\.9/);
    expect(deps['react-native-yamap']).toBeUndefined();
    expect(deps['react-native-worklets-core']).toBeUndefined();
  });

  it('держит Navigation 7.13+, Sentry 8, Firebase 26 и CocoaPods Firebase', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const deps = pkg.dependencies;

    expect(deps['@react-navigation/drawer']).toMatch(/^\^?7\.13/);
    expect(deps['@react-navigation/native']).toMatch(/^\^?7\.3/);
    expect(deps['@react-navigation/native-stack']).toMatch(/^\^?7\.18/);
    expect(deps['@sentry/react-native']).toMatch(/^\^?8\./);
    expect(deps['@react-native-firebase/app']).toMatch(/^\^?26\./);
    expect(deps['@react-native-firebase/messaging']).toMatch(/^\^?26\./);
    expect(pkg.devDependencies.eslint).toMatch(/^\^?10\./);
    expect(pkg.devDependencies['@babel/core']).toMatch(/^\^?7\.29/);
    expect(pkg.devDependencies.typescript).toMatch(/^\^?5\.9/);
    expect(deps['@appmetrica/react-native-analytics']).toMatch(/^\^?4\.2/);
    expect(deps['@react-native-async-storage/async-storage']).toMatch(/^\^?3\.1/);
    expect(deps['@react-native-community/datetimepicker']).toMatch(/^\^?9\.1/);
    expect(deps['@fortawesome/react-native-fontawesome']).toMatch(/^\^?1\.0/);
    expect(deps['lucide-react-native']).toMatch(/^\^?1\.34/);
    expect(deps['@react-native-community/netinfo']).toMatch(/^\^?12\.0/);
    expect(deps['react-native-device-info']).toMatch(/^\^?15\.0/);
    expect(read('ios/Podfile')).toMatch(/\$RNFirebaseDisableSPM\s*=\s*true/);
    expect(
      fs.existsSync(path.join(root, 'patches/@sentry+react-native+7.13.0.patch')),
    ).toBe(false);
  });

  it('babel и metro не тянут worklets-core', () => {
    const babel = read('babel.config.js');
    expect(babel).toContain('react-native-worklets/plugin');
    expect(babel).not.toContain('worklets-core');

    const metro = read('metro.config.js');
    expect(metro).toContain('metro-config/private/defaults/exclusionList');
    expect(metro).not.toContain('metro-config/src/defaults/exclusionList');
    expect(metro).toContain('"mjs"');
    expect(read('jest.config.js')).toContain("preset: '@react-native/jest-preset'");
  });

  it('Android MapKit pin совпадает с yamap-plus 4.42', () => {
    expect(read('android/build.gradle')).toContain("maps.mobile:4.42.0-full");
    expect(read('android/app/build.gradle')).toContain("maps.mobile:4.42.0-full");
    expect(read('android/app/build.gradle')).not.toContain('4.19.0-full');
  });

  it('не включает индикатор сети/GPS в AppProviders', () => {
    const providers = read('src/app/providers/AppProviders.tsx');
    expect(providers).not.toMatch(/^import \{ ConnectivityLocationIndicator \}/m);
    expect(providers).not.toMatch(/^\s*<ConnectivityLocationIndicator/m);
    expect(providers).toContain('//import { ConnectivityLocationIndicator }');
    expect(providers).toContain('//<ConnectivityLocationIndicator />');
  });

  it('токен в store остаётся на default AsyncStorage, не createAsyncStorage', () => {
    const store = read('src/shared/store/store.ts');
    expect(store).toMatch(
      /import AsyncStorage from '@react-native-async-storage\/async-storage'/,
    );
    expect(store).not.toContain('createAsyncStorage');
    expect(store).toContain("AsyncStorage.setItem('token'");
    expect(store).toContain("AsyncStorage.getItem('token'");
  });

  it('index.js подключает InteractionManager shim до App', () => {
    const index = read('index.js');
    const shim = index.indexOf("import './src/shared/lib/interactionManagerCompat'");
    const app = index.indexOf("import App from './App'", shim);
    expect(shim).toBeGreaterThanOrEqual(0);
    expect(app).toBeGreaterThan(shim);
  });
});
