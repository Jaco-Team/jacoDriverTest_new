const fs = require('node:fs');
const path = require('node:path');

const externalPods = ['React-Core-prebuilt', 'ReactNativeDependencies'];

function inspectIOSReactNative({
  root = path.resolve(__dirname, '..'),
  installed = true,
} = {}) {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const json = file => JSON.parse(read(file));
  const version = json('package.json').dependencies['react-native'];
  const issues = [];
  const stalePods = new Set();
  const check = (label, actual, pod, expected = version) => {
    if (actual === expected) return;
    issues.push(`${label}: ${actual ?? 'не найдено'} вместо ${expected}`);
    if (pod) stalePods.add(pod);
  };

  if (installed) {
    check(
      'node_modules/react-native',
      json('node_modules/react-native/package.json').version,
    );
  }
  const locks = ['ios/Podfile.lock'];
  if (installed) locks.push('ios/Pods/Manifest.lock');
  for (const file of locks) {
    const contents = read(file);
    for (const pod of ['React-Core', ...externalPods]) {
      const match = contents.match(
        new RegExp(`^  - ${pod} \\(([^)]+)\\):?$`, 'm'),
      );
      check(
        `${file} / ${pod}`,
        match?.[1],
        externalPods.includes(pod) ? pod : undefined,
      );
    }
  }

  if (installed) {
    for (const pod of externalPods) {
      const spec = json(`ios/Pods/Local Podspecs/${pod}.podspec.json`);
      check(`${pod} podspec`, spec.version, pod);
      const phases = Array.isArray(spec.script_phases)
        ? spec.script_phases
        : [spec.script_phases];
      const script = phases.map(phase => phase?.script ?? '').join('\n');
      check(`${pod} build script`, script.match(/-r\s+"([^"]+)"/)?.[1], pod);
      check(
        `${pod} source`,
        spec.source?.http?.match(/\/react-native-artifacts\/([^/]+)\//)?.[1],
        pod,
      );
    }
    const header = read(
      'ios/Pods/React-Core-prebuilt/Headers/cxxreact/ReactNativeVersion.h',
    );
    const nativeVersion = ['MAJOR', 'MINOR', 'PATCH']
      .map(
        part =>
          header.match(
            new RegExp(`^#define REACT_NATIVE_VERSION_${part} (\\d+)$`, 'm'),
          )?.[1],
      )
      .join('.');
    check(
      'React-Core-prebuilt native header',
      nativeVersion,
      'React-Core-prebuilt',
      version.split('-')[0],
    );
  }

  return {version, issues, stalePods: [...stalePods]};
}

module.exports = {inspectIOSReactNative};

if (require.main === module) {
  try {
    const result = inspectIOSReactNative();
    if (process.argv.includes('--stale-pods')) {
      console.log(result.stalePods.join(' '));
    } else if (result.issues.length > 0) {
      throw new Error(
        `Версии React Native и iOS не совпадают:\n${result.issues.join('\n')}`,
      );
    } else {
      console.log(
        `React Native JS / iOS: ${result.version} — версии совпадают.`,
      );
    }
  } catch (error) {
    console.error(
      `error: ${error.message}\nВыполните npm run ios:pods перед сборкой iOS.`,
    );
    process.exitCode = 1;
  }
}
