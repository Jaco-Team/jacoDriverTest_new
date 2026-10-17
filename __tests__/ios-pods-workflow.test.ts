import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repository = path.resolve(__dirname, '..');
const version = '0.88.0';
let directory: string;
let project: string;
let binaries: string;
let callsFile: string;

type RunOptions = {
  core?: string;
  dependencies?: string;
  arguments?: string[];
  repair?: boolean;
  installExit?: number;
  updateExit?: number;
};

function metadata(core = version, dependencies = version) {
  const lock = [
    'PODS:',
    `  - React-Core (${version}):`,
    '    - React-Core-prebuilt',
    `  - React-Core-prebuilt (${core}):`,
    '    - ReactNativeDependencies',
    `  - ReactNativeDependencies (${dependencies})`,
    '',
  ].join('\n');
  const files: Record<string, string> = {
    'ios/Podfile.lock': lock,
    'ios/Pods/Manifest.lock': lock,
    'ios/Pods/React-Core-prebuilt/Headers/cxxreact/ReactNativeVersion.h':
      core
        .split('.')
        .map(
          (value, index) =>
            `#define REACT_NATIVE_VERSION_${['MAJOR', 'MINOR', 'PATCH'][index]} ${value}`,
        )
        .join('\n'),
  };
  for (const [pod, podVersion] of [
    ['React-Core-prebuilt', core],
    ['ReactNativeDependencies', dependencies],
  ]) {
    files[`ios/Pods/Local Podspecs/${pod}.podspec.json`] = JSON.stringify({
      version: podVersion,
      script_phases: {script: `node replace-version.js -r "${podVersion}"`},
      source: {
        http: `https://example.invalid/react-native-artifacts/${podVersion}/artifact.tar.gz`,
      },
    });
  }
  return files;
}

function writeFiles(files: Record<string, string>) {
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(project, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, contents);
  }
}

function run({
  core = version,
  dependencies = version,
  arguments: arguments_ = [],
  repair = true,
  installExit = 0,
  updateExit = 0,
}: RunOptions = {}) {
  writeFiles(metadata(core, dependencies));
  fs.writeFileSync(
    path.join(project, 'after-update.json'),
    JSON.stringify(repair ? metadata() : {}),
  );
  return spawnSync(
    '/bin/bash',
    [path.join(project, 'scripts/ios-pods.sh'), ...arguments_],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${binaries}${path.delimiter}${process.env.PATH ?? ''}`,
        IOS_PODS_TEST_ROOT: project,
        IOS_PODS_TEST_CALLS: callsFile,
        IOS_PODS_TEST_INSTALL_EXIT: String(installExit),
        IOS_PODS_TEST_UPDATE_EXIT: String(updateExit),
      },
    },
  );
}

function calls(): string[][] {
  if (!fs.existsSync(callsFile)) return [];
  return fs
    .readFileSync(callsFile, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jaco-ios-pods-workflow-'));
  project = path.join(directory, 'project with spaces');
  binaries = path.join(directory, 'bin');
  callsFile = path.join(directory, 'bundle-calls.jsonl');
  fs.mkdirSync(binaries);
  fs.mkdirSync(path.join(project, 'scripts'), {recursive: true});
  for (const script of ['ios-pods.sh', 'check-ios-rn-version.cjs']) {
    fs.copyFileSync(
      path.join(repository, 'scripts', script),
      path.join(project, 'scripts', script),
    );
  }
  writeFiles({
    'package.json': JSON.stringify({dependencies: {'react-native': version}}),
    'node_modules/react-native/package.json': JSON.stringify({version}),
  });
  fs.symlinkSync(process.execPath, path.join(binaries, 'node'));
  fs.writeFileSync(path.join(binaries, 'ruby'), '#!/bin/sh\nexit 0\n', {
    mode: 0o755,
  });
  fs.writeFileSync(
    path.join(binaries, 'bundle'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.IOS_PODS_TEST_CALLS, JSON.stringify(args) + '\\n');
if (args[0] === 'install') process.exit(0);
if (args.slice(0, 3).join(' ') === 'exec pod install') {
  process.exit(Number(process.env.IOS_PODS_TEST_INSTALL_EXIT));
}
if (args.slice(0, 3).join(' ') === 'exec pod update') {
  const exit = Number(process.env.IOS_PODS_TEST_UPDATE_EXIT);
  if (exit !== 0) process.exit(exit);
  const root = process.env.IOS_PODS_TEST_ROOT;
  const files = JSON.parse(fs.readFileSync(path.join(root, 'after-update.json'), 'utf8'));
  for (const [relative, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, relative), contents);
  }
  process.exit(0);
}
process.exit(99);
`,
    {mode: 0o755},
  );
});

afterEach(() => {
  fs.rmSync(directory, {recursive: true, force: true});
});

describe('iOS Pods version repair workflow', () => {
  it('не обновляет согласованные Pods и передаёт аргументы pod install', () => {
    const result = run({arguments: ['--verbose']});

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(calls()).toEqual([
      ['install'],
      ['exec', 'pod', 'install', '--verbose'],
    ]);
    expect(result.stdout).toContain('версии совпадают');
  });

  it.each<{pod: string; stale: RunOptions}>([
    {pod: 'React-Core-prebuilt', stale: {core: '0.87.1'}},
    {pod: 'ReactNativeDependencies', stale: {dependencies: '0.87.1'}},
  ])('точечно обновляет только устаревший $pod', ({pod, stale}) => {
    const result = run(stale);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(calls()).toEqual([
      ['install'],
      ['exec', 'pod', 'install'],
      ['exec', 'pod', 'update', pod, '--no-repo-update'],
    ]);
    expect(result.stdout).toContain('версии совпадают');
    expect(fs.readFileSync(path.join(project, 'ios/Podfile.lock'), 'utf8')).toBe(
      metadata()['ios/Podfile.lock'],
    );
  });

  it('передаёт оба устаревших Pods отдельными аргументами одного update', () => {
    const result = run({core: '0.87.1', dependencies: '0.87.1'});

    expect(result.status).toBe(0);
    expect(calls()).toEqual([
      ['install'],
      ['exec', 'pod', 'install'],
      [
        'exec',
        'pod',
        'update',
        'React-Core-prebuilt',
        'ReactNativeDependencies',
        '--no-repo-update',
      ],
    ]);
  });

  it('при --deployment не обновляет устаревшие Pods и не меняет lock', () => {
    const result = run({core: '0.87.1', arguments: ['--deployment']});

    expect(result.status).toBe(1);
    expect(calls()).toEqual([
      ['install'],
      ['exec', 'pod', 'install', '--deployment'],
    ]);
    expect(result.stderr).toContain('без --deployment');
    expect(fs.readFileSync(path.join(project, 'ios/Podfile.lock'), 'utf8')).toBe(
      metadata('0.87.1')['ios/Podfile.lock'],
    );
  });

  it('останавливается после одной попытки, если update не устранил mismatch', () => {
    const result = run({core: '0.87.1', repair: false});

    expect(result.status).toBe(1);
    expect(calls()).toEqual([
      ['install'],
      ['exec', 'pod', 'install'],
      ['exec', 'pod', 'update', 'React-Core-prebuilt', '--no-repo-update'],
    ]);
    expect(result.stderr).toContain('Версии React Native и iOS не совпадают');
    expect(result.stdout).not.toContain('версии совпадают');
  });

  it('сохраняет код ошибки pod install и не выполняет update', () => {
    const result = run({core: '0.87.1', installExit: 17});

    expect(result.status).toBe(17);
    expect(calls()).toEqual([['install'], ['exec', 'pod', 'install']]);
  });

  it('сохраняет код ошибки точечного pod update', () => {
    const result = run({core: '0.87.1', updateExit: 23});

    expect(result.status).toBe(23);
    expect(calls()).toEqual([
      ['install'],
      ['exec', 'pod', 'install'],
      ['exec', 'pod', 'update', 'React-Core-prebuilt', '--no-repo-update'],
    ]);
    expect(result.stdout).not.toContain('версии совпадают');
  });
});
