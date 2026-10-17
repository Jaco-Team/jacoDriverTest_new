import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {inspectIOSReactNative} = require('../scripts/check-ios-rn-version.cjs');
const version = '0.88.0';
let root: string;

function write(file: string, value: unknown) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(
    target,
    typeof value === 'string' ? value : JSON.stringify(value),
  );
}

function header(nativeVersion: string) {
  return nativeVersion
    .split('.')
    .map(
      (part, index) =>
        `#define REACT_NATIVE_VERSION_${['MAJOR', 'MINOR', 'PATCH'][index]} ${part}`,
    )
    .join('\n');
}

const headerPath =
  'ios/Pods/React-Core-prebuilt/Headers/cxxreact/ReactNativeVersion.h';

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'jaco-ios-rn-version-'));
  write('package.json', {dependencies: {'react-native': version}});
  write('node_modules/react-native/package.json', {version});
  const lock = `PODS:\n  - React-Core (${version}):\n    - React-Core-prebuilt\n  - React-Core-prebuilt (${version}):\n    - ReactNativeDependencies\n  - ReactNativeDependencies (${version})\n`;
  write('ios/Podfile.lock', lock);
  write('ios/Pods/Manifest.lock', lock);
  for (const pod of ['React-Core-prebuilt', 'ReactNativeDependencies']) {
    write(`ios/Pods/Local Podspecs/${pod}.podspec.json`, {
      version,
      source: {
        http: `https://repo.reactnative.dev/maven2/com/facebook/react/react-native-artifacts/${version}/artifact.tar.gz`,
      },
      script_phases: {script: `node replace-version.js -r "${version}"`},
    });
  }
  write(headerPath, header(version));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(
    path.resolve(__dirname, '../scripts/check-ios-rn-version.cjs'),
    path.join(root, 'scripts/check-ios-rn-version.cjs'),
  );
});

afterEach(() => {
  fs.rmSync(root, {recursive: true, force: true});
});

it('принимает согласованные JS, locks, podspec, build script и нативный заголовок', () => {
  expect(inspectIOSReactNative({root})).toEqual({
    version,
    issues: [],
    stalePods: [],
  });
});

it('проверяет сохранённый lock без Pods и node_modules на чистом CI', () => {
  fs.rmSync(path.join(root, 'ios/Pods'), {recursive: true});
  fs.rmSync(path.join(root, 'node_modules'), {recursive: true});
  expect(inspectIOSReactNative({root, installed: false})).toEqual({
    version,
    issues: [],
    stalePods: [],
  });
  expect(() => inspectIOSReactNative({root})).toThrow();
});

it.each(['ios/Podfile.lock', 'ios/Pods/Manifest.lock'])(
  'обнаруживает устаревшее ядро в %s',
  file => {
    const contents = fs.readFileSync(path.join(root, file), 'utf8');
    write(
      file,
      contents.replace(
        `React-Core-prebuilt (${version})`,
        'React-Core-prebuilt (0.87.1)',
      ),
    );
    const result = inspectIOSReactNative({root});
    expect(result.issues).toEqual([
      `${file} / React-Core-prebuilt: 0.87.1 вместо ${version}`,
    ]);
    expect(result.stalePods).toEqual(['React-Core-prebuilt']);
  },
);

it('не обновляет внешние pods из-за одной лишь неверной версии JS в node_modules', () => {
  write('node_modules/react-native/package.json', {version: '0.87.1'});
  const result = inspectIOSReactNative({root});
  expect(result.issues).toEqual([
    `node_modules/react-native: 0.87.1 вместо ${version}`,
  ]);
  expect(result.stalePods).toEqual([]);
});

it.each(['React-Core-prebuilt', 'ReactNativeDependencies'])(
  'обнаруживает закешированный podspec %s',
  pod => {
    const file = `ios/Pods/Local Podspecs/${pod}.podspec.json`;
    const spec = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    write(file, {...spec, version: '0.87.1'});
    const result = inspectIOSReactNative({root});
    expect(result.issues).toEqual([`${pod} podspec: 0.87.1 вместо ${version}`]);
    expect(result.stalePods).toEqual([pod]);
  },
);

it('проверяет версию в build script даже при правильной версии podspec', () => {
  const file = 'ios/Pods/Local Podspecs/React-Core-prebuilt.podspec.json';
  const spec = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  write(file, {
    ...spec,
    script_phases: [{script: 'node replace-version.js -r "0.87.1"'}],
  });
  expect(inspectIOSReactNative({root}).issues).toEqual([
    `React-Core-prebuilt build script: 0.87.1 вместо ${version}`,
  ]);
});

it('не принимает старый архив с правильным номером podspec', () => {
  const file = 'ios/Pods/Local Podspecs/React-Core-prebuilt.podspec.json';
  const spec = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  write(file, {
    ...spec,
    source: {http: spec.source.http.replace(version, '0.87.1')},
  });
  expect(inspectIOSReactNative({root}).issues).toEqual([
    `React-Core-prebuilt source: 0.87.1 вместо ${version}`,
  ]);
});

it('проверяет реальный заголовок ядра, а не только список зависимостей', () => {
  write(headerPath, header('0.87.1'));
  expect(inspectIOSReactNative({root}).issues).toEqual([
    `React-Core-prebuilt native header: 0.87.1 вместо ${version}`,
  ]);
});

it('не принимает отсутствующую версию ядра в lock-файле', () => {
  write('ios/Podfile.lock', 'PODS:\n  - React-Core (0.88.0):\n');
  const result = inspectIOSReactNative({root});
  expect(result.issues).toHaveLength(2);
  expect(result.stalePods).toEqual([
    'React-Core-prebuilt',
    'ReactNativeDependencies',
  ]);
});

it('останавливает preios с понятной ошибкой до запуска сборки', () => {
  write(headerPath, header('0.87.1'));
  const result = spawnSync(
    process.execPath,
    ['scripts/check-ios-rn-version.cjs'],
    {cwd: root, encoding: 'utf8'},
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('0.87.1 вместо 0.88.0');
  expect(result.stderr).toContain('npm run ios:pods');
});

it('возвращает только имена устаревших pods для точечного обновления', () => {
  write(headerPath, header('0.87.1'));
  const result = spawnSync(
    process.execPath,
    ['scripts/check-ios-rn-version.cjs', '--stale-pods'],
    {cwd: root, encoding: 'utf8'},
  );
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe('React-Core-prebuilt');
});

it('включает проверку перед штатным npm run ios', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'),
  );
  expect(pkg.scripts.preios).toBe('node scripts/check-ios-rn-version.cjs');
});
