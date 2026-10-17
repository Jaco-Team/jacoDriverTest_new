import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repository = path.resolve(__dirname, '..');
const fallbackHomes = [
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home',
  '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
];

type Call = {
  command: string;
  args: string[];
  cwd: string;
  javaHome?: string;
  executable?: string;
  searchPath: string;
};

type RunOptions = {
  javaHome?: string | null;
  arguments?: string[];
  toolExit?: number;
};

let directory: string;
let project: string;
let binaries: string;
let callsFile: string;
let primaryJdk: string;
let fallbackJdks: string[];

function executable(file: string, contents: string) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, contents, {mode: 0o755});
}

function recordTool(command: string) {
  return `#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync(process.env.ANDROID_WORKFLOW_TEST_CALLS, JSON.stringify({
  command: ${JSON.stringify(command)}, args: process.argv.slice(2),
  cwd: process.cwd(), javaHome: process.env.JAVA_HOME,
  searchPath: process.env.PATH,
}) + '\\n');
process.exit(Number(process.env.ANDROID_WORKFLOW_TEST_TOOL_EXIT));
`;
}

function jdk(home: string, version: string, compiler = true) {
  executable(
    path.join(home, 'bin/java'),
    `#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync(process.env.ANDROID_WORKFLOW_TEST_CALLS, JSON.stringify({
  command: 'java', args: process.argv.slice(2), executable: process.argv[1],
  cwd: process.cwd(), javaHome: process.env.JAVA_HOME,
  searchPath: process.env.PATH,
}) + '\\n');
process.stderr.write('    java.specification.version = ' + ${JSON.stringify(version)} + '\\n');
`,
  );
  if (compiler) {
    executable(path.join(home, 'bin/javac'), '#!/bin/sh\nexit 0\n');
  }
}

function run({
  javaHome = primaryJdk,
  arguments: arguments_ = [],
  toolExit = 0,
}: RunOptions = {}) {
  const env: NodeJS.ProcessEnv = {
    // Do not inherit the real npx, Java, SDK or Gradle from the user's PATH.
    PATH: binaries,
    ANDROID_WORKFLOW_TEST_CALLS: callsFile,
    ANDROID_WORKFLOW_TEST_TOOL_EXIT: String(toolExit),
  };
  if (javaHome !== null) env.JAVA_HOME = javaHome;
  return spawnSync(
    '/bin/bash',
    [path.join(project, 'scripts/android.sh'), ...arguments_],
    {cwd: directory, encoding: 'utf8', timeout: 10000, env},
  );
}

function calls(): Call[] {
  if (!fs.existsSync(callsFile)) return [];
  return fs
    .readFileSync(callsFile, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function toolCalls() {
  return calls().filter(call => call.command !== 'java');
}

beforeEach(() => {
  directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'jaco-android-workflow-')),
  );
  project = path.join(directory, 'project with spaces');
  binaries = path.join(directory, 'bin');
  callsFile = path.join(directory, 'tool-calls.jsonl');
  primaryJdk = path.join(directory, 'custom jdk');
  fallbackJdks = fallbackHomes.map((_, index) =>
    path.join(directory, `fallback jdk ${index}`),
  );

  let script = fs.readFileSync(
    path.join(repository, 'scripts/android.sh'),
    'utf8',
  );
  // Redirect only the absolute discovery roots in the disposable copy. Execute
  // the real validation, selection and command bodies, never a host JDK/SDK.
  fallbackHomes.forEach((home, index) => {
    expect(script.split(home)).toHaveLength(2);
    // The first entry is already quoted; quote the remaining temporary roots
    // because their deliberate spaces must not change the fallback loop.
    script = script.replace(
      home,
      index === 0 ? fallbackJdks[index] : `"${fallbackJdks[index]}"`,
    );
  });
  expect(script).not.toMatch(/\/Applications\/|\/opt\/homebrew\//);
  // An unset JAVA_HOME otherwise probes /bin/{javac,java}, which can be a real
  // JDK on Linux. Map that filesystem boundary too: these tests describe the
  // controlled discovery environment, not a real Linux/Android build.
  const absentSystemJdk = path.join(directory, 'absent system jdk');
  expect(fs.existsSync(absentSystemJdk)).toBe(false);
  for (const tool of ['javac', 'java']) {
    const original = `"$1/bin/${tool}"`;
    expect(script.split(original)).toHaveLength(2);
    script = script.replace(
      original,
      '"${1:-' + absentSystemJdk + '}/bin/' + tool + '"',
    );
  }
  executable(path.join(project, 'scripts/android.sh'), script);
  fs.mkdirSync(binaries);
  for (const command of ['dirname', 'sed']) {
    fs.symlinkSync(`/usr/bin/${command}`, path.join(binaries, command));
  }
  executable(path.join(binaries, 'npx'), recordTool('npx'));
  executable(path.join(project, 'android/gradlew'), recordTool('gradlew'));
  jdk(primaryJdk, '21');
});

afterEach(() => {
  fs.rmSync(directory, {recursive: true, force: true});
});

describe('Android command workflow', () => {
  it.each(['17', '21'])(
    'сохраняет заданный JDK %s и передаёт параметры run-android',
    version => {
      jdk(primaryJdk, version);
      jdk(fallbackJdks[0], '25');
      const result = run({
        arguments: ['--deviceId', 'test emulator', '--no-packager'],
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(toolCalls()).toEqual([
        {
          command: 'npx',
          args: [
            '--no-install',
            'react-native',
            'run-android',
            '--deviceId',
            'test emulator',
            '--no-packager',
          ],
          cwd: project,
          javaHome: primaryJdk,
          searchPath: `${primaryJdk}/bin:${binaries}`,
        },
      ]);
      expect(calls().filter(call => call.command === 'java')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            executable: path.join(primaryJdk, 'bin/java'),
            args: ['-XshowSettings:properties', '-version'],
          }),
        ]),
      );
      expect(
        calls().some(call => call.executable?.startsWith(fallbackJdks[0])),
      ).toBe(false);
    },
  );

  it.each([null, 'old', 'jre'])(
    'находит первый пригодный fallback вместо %s',
    initial => {
      const badHome = path.join(directory, 'bad jdk');
      if (initial === 'old') jdk(badHome, '1.8');
      if (initial === 'jre') jdk(badHome, '21', false);
      jdk(fallbackJdks[0], '11');
      jdk(fallbackJdks[1], '17');
      jdk(fallbackJdks[2], '25');
      const result = run({javaHome: initial === null ? null : badHome});

      expect(result.status).toBe(0);
      expect(toolCalls()).toEqual([
        expect.objectContaining({
          command: 'npx',
          javaHome: fallbackJdks[1],
          searchPath: `${fallbackJdks[1]}/bin:${binaries}`,
        }),
      ]);
      expect(
        calls().some(call => call.executable?.startsWith(fallbackJdks[2])),
      ).toBe(false);
    },
  );

  it.each([null, '1.8', '16', 'not-a-version'])(
    'не запускает сборку или установку без подходящего JDK: %s',
    version => {
      const invalidHome = path.join(directory, 'invalid jdk');
      if (version !== null) jdk(invalidHome, version);
      const result = run({
        javaHome: version === null ? null : invalidHome,
        arguments: ['--build'],
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Для Android нужен JDK >=17');
      expect(toolCalls()).toEqual([]);
    },
  );

  it.each([
    ['--build', ':app:assembleDebug'],
    ['--build-local-release', ':app:assembleLocalRelease'],
  ])(
    '%s вызывает только нужную Gradle-задачу без установки приложения',
    (mode, task) => {
      const result = run({
        arguments: [mode, '--offline', '-Pcustom=value with spaces'],
      });

      expect(result.status).toBe(0);
      expect(toolCalls()).toEqual([
        {
          command: 'gradlew',
          args: [task, '--offline', '-Pcustom=value with spaces'],
          cwd: path.join(project, 'android'),
          javaHome: primaryJdk,
          searchPath: `${primaryJdk}/bin:${binaries}`,
        },
      ]);
    },
  );

  it.each([
    {arguments: [], command: 'npx', exit: 19},
    {arguments: ['--build'], command: 'gradlew', exit: 23},
    {arguments: ['--build-local-release'], command: 'gradlew', exit: 27},
  ])('сохраняет код ошибки $command ($exit)', scenario => {
    const result = run({
      arguments: scenario.arguments,
      toolExit: scenario.exit,
    });

    expect(result.status).toBe(scenario.exit);
    expect(toolCalls()).toHaveLength(1);
    expect(toolCalls()[0].command).toBe(scenario.command);
  });
});
