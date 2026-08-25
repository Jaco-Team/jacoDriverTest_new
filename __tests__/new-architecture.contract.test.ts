import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('New Architecture contract', () => {
  it('включает Fabric в native flags', () => {
    expect(read('android/gradle.properties')).toMatch(/newArchEnabled\s*=\s*true/);
    expect(read('ios/Podfile')).toMatch(/ENV\['RCT_NEW_ARCH_ENABLED'\]\s*=\s*'1'/);
    expect(read('ios/jacoDriverTest/Info.plist')).toMatch(
      /<key>RCTNewArchEnabled<\/key>\s*<true\/>/,
    );
  });

  it('держит RN 0.86, Reanimated 4, worklets и yamap-plus', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies: Record<string, string>;
    };
    const deps = pkg.dependencies;

    expect(deps['react-native']).toBe('0.86.0');
    expect(deps['react-native-reanimated']).toMatch(/^4\./);
    expect(deps['react-native-worklets']).toBeTruthy();
    expect(deps['react-native-yamap-plus']).toBeTruthy();
    expect(deps['react-native-yamap']).toBeUndefined();
    expect(deps['react-native-worklets-core']).toBeUndefined();
  });

  it('babel и metro не тянут worklets-core', () => {
    const babel = read('babel.config.js');
    expect(babel).toContain('react-native-worklets/plugin');
    expect(babel).not.toContain('worklets-core');

    const metro = read('metro.config.js');
    expect(metro).toContain('metro-config/private/defaults/exclusionList');
    expect(metro).not.toContain('metro-config/src/defaults/exclusionList');
  });

  it('Android MapKit pin совпадает с yamap-plus 4.42', () => {
    expect(read('android/build.gradle')).toContain("maps.mobile:4.42.0-full");
    expect(read('android/app/build.gradle')).toContain("maps.mobile:4.42.0-full");
    expect(read('android/app/build.gradle')).not.toContain('4.19.0-full');
  });
});
