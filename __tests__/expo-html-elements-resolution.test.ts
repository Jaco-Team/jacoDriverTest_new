import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {resolve} from 'metro-resolver';
import type {CustomResolver, ResolutionContext} from 'metro-resolver';

const {resolveExpoHtmlElements}: {resolveExpoHtmlElements: CustomResolver} =
  require('../scripts/metro-expo-html-elements.cjs');

const projectRoot = path.resolve(__dirname, '..');
const packageRoot = path.join(projectRoot, 'node_modules/@expo/html-elements');
const platforms = ['android', 'ios'] as const;
const entryPoints = [
  ['@expo/html-elements', 'Elements'],
  ['@expo/html-elements/primitives/Text', 'primitives/Text'],
  ['@expo/html-elements/primitives/View', 'primitives/View'],
  ['@expo/html-elements/primitives/Table', 'primitives/Table'],
] as const;

type PackageJson = NonNullable<ReturnType<ResolutionContext['getPackage']>>;
const packageJsonCache = new Map<string, PackageJson>();

function readPackage(packageJsonPath: string): PackageJson | null {
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }
  let value = packageJsonCache.get(packageJsonPath);
  if (!value) {
    value = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;
    packageJsonCache.set(packageJsonPath, value);
  }
  return value;
}

const fileSystemLookup: ResolutionContext['fileSystemLookup'] = candidate => {
  try {
    const stat = fs.statSync(candidate);
    return {
      exists: true,
      type: stat.isDirectory() ? 'd' : 'f',
      realPath: fs.realpathSync(candidate),
    };
  } catch {
    return {exists: false};
  }
};

const getPackageForModule: ResolutionContext['getPackageForModule'] = candidate => {
  const lookup = fileSystemLookup(candidate);
  let directory = lookup.exists && lookup.type === 'd'
    ? candidate
    : path.dirname(candidate);

  while (path.basename(directory) !== 'node_modules') {
    const packageJson = readPackage(path.join(directory, 'package.json'));
    if (packageJson) {
      return {
        packageJson,
        rootPath: directory,
        packageRelativePath: path.relative(directory, candidate),
      };
    }
    const parent = path.dirname(directory);
    if (directory === parent) {
      break;
    }
    directory = parent;
  }
  return null;
};

// Supply filesystem hooks only; package exports and platform selection use real Metro.
function createContext(overrides: Partial<ResolutionContext> = {}): ResolutionContext {
  return Object.freeze({
    allowHaste: false,
    assetExts: new Set<string>(),
    customResolverOptions: Object.freeze({}),
    disableHierarchicalLookup: false,
    doesFileExist: (candidate: string) => {
      const lookup = fileSystemLookup(candidate);
      return lookup.exists && lookup.type === 'f';
    },
    extraNodeModules: null,
    dev: false,
    fileSystemLookup,
    getPackage: readPackage,
    getPackageForModule,
    isESMImport: true,
    mainFields: Object.freeze(['react-native', 'browser', 'main']),
    nodeModulesPaths: Object.freeze([path.join(projectRoot, 'node_modules')]),
    originModulePath: path.join(projectRoot, 'index.js'),
    preferNativePlatform: true,
    redirectModulePath: (modulePath: string) => modulePath,
    resolveAsset: () => null,
    resolveHasteModule: () => null,
    resolveHastePackage: () => null,
    resolveRequest: resolveExpoHtmlElements,
    sourceExts: Object.freeze(['js', 'jsx', 'json', 'ts', 'tsx', 'mjs']),
    unstable_conditionNames: Object.freeze(['react-native']),
    unstable_conditionsByPlatform: Object.freeze({}),
    unstable_enablePackageExports: true,
    unstable_incrementalResolution: false,
    unstable_logWarning: (message: string) => {
      throw new Error(`Unexpected Metro fallback: ${message}`);
    },
    ...overrides,
  });
}

function sourcePath(context: ResolutionContext, moduleName: string, platform: string): string {
  const result = resolve(context, moduleName, platform);
  if (result.type !== 'sourceFile') {
    throw new Error(`Expected sourceFile for ${moduleName}, got ${result.type}`);
  }
  return result.filePath;
}

describe.each(platforms)('Expo source resolution on %s', platform => {
  it.each(entryPoints)('resolves %s through official source exports', (moduleName, relativePath) => {
    expect(sourcePath(createContext(), moduleName, platform)).toBe(
      path.join(packageRoot, 'src', `${relativePath}.tsx`),
    );
  });

  it.each(entryPoints)('uses the compiled export for %s without the selector', (moduleName, relativePath) => {
    expect(sourcePath(createContext({resolveRequest: resolve}), moduleName, platform)).toBe(
      path.join(packageRoot, 'build', `${relativePath}.js`),
    );
  });

  it('preserves native file selection within the selected sources', () => {
    const text = sourcePath(createContext(), '@expo/html-elements/primitives/Text', platform);
    expect(sourcePath(createContext({originModulePath: text}), '../css/createSafeStyledView', platform)).toBe(
      path.join(packageRoot, 'src/css/createSafeStyledView.native.tsx'),
    );
  });

  it('keeps React and the package.json export on default resolution', () => {
    for (const moduleName of ['react', '@expo/html-elements/package.json']) {
      expect(sourcePath(createContext(), moduleName, platform)).toBe(
        sourcePath(createContext({resolveRequest: resolve}), moduleName, platform),
      );
    }
  });

  it.each(['@expo/html-elements-extra', '@expo/html-elements-extra/primitives/Text'])(
    'does not select source exports for lookalike %s', moduleName => {
      // A real Metro alias exposes the same conditional exports under another name.
      const options = {extraNodeModules: {'@expo/html-elements-extra': packageRoot}};
      const expected = sourcePath(createContext({...options, resolveRequest: resolve}), moduleName, platform);
      expect(expected).toContain(`${path.sep}build${path.sep}`);
      expect(sourcePath(createContext(options), moduleName, platform)).toBe(expected);
    },
  );
});

it('preserves frozen context and existing conditions while selecting the source', () => {
  const conditions = Object.freeze(['react-native', 'existing-custom-condition']);
  const context = createContext({unstable_conditionNames: conditions});
  const before = {...context};

  expect(sourcePath(context, '@expo/html-elements', 'ios')).toBe(
    path.join(packageRoot, 'src/Elements.tsx'),
  );
  expect(context).toEqual(before);
  expect(context.unstable_conditionNames).toBe(conditions);
  expect(context.unstable_conditionNames).toEqual(['react-native', 'existing-custom-condition']);
  expect(context.resolveRequest).toBe(resolveExpoHtmlElements);
});

it('transforms real Expo sources with NativeWind while keeping compiled and RN JSX unchanged', () => {
  const context = createContext();
  const entry = sourcePath(context, '@expo/html-elements', 'ios');
  const text = sourcePath(context, '@expo/html-elements/primitives/Text', 'ios');
  const files = [
    sourcePath(createContext({originModulePath: entry}), './elements/Table', 'ios'),
    sourcePath(createContext({originModulePath: entry}), './elements/Headings', 'ios'),
    sourcePath(createContext({originModulePath: text}), '../css/createSafeStyledView', 'ios'),
    path.join(packageRoot, 'build/elements/Table.js'),
    path.join(projectRoot, 'node_modules/react-native/Libraries/LogBox/UI/LogBoxButton.js'),
  ];

  // Bypass Jest's UI mappers and disable project config, including the MapKit key plugin.
  const transformed = JSON.parse(execFileSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    const babel = require('@babel/core');
    const files = JSON.parse(fs.readFileSync(0, 'utf8'));
    process.stdout.write(JSON.stringify(files.map(filename =>
      babel.transformFileSync(filename, {
        babelrc: false,
        configFile: false,
        envName: 'production',
        presets: ['module:@react-native/babel-preset'],
        overrides: [{
          exclude: /[\\\\/]node_modules[\\\\/]react-native[\\\\/]/,
          presets: ['nativewind/babel'],
        }],
      }).code
    )));
  `], {
    cwd: projectRoot,
    encoding: 'utf8',
    input: JSON.stringify(files),
    env: {...process.env, NODE_ENV: 'production'},
  })) as string[];

  for (const code of transformed.slice(0, 3)) {
    expect(code).toContain('react-native-css-interop/jsx-runtime');
    expect(code).not.toContain('require("react/jsx-runtime")');
  }
  for (const code of transformed.slice(3)) {
    expect(code).toContain('require("react/jsx-runtime")');
    expect(code).not.toContain('react-native-css-interop/jsx-runtime');
  }
});
