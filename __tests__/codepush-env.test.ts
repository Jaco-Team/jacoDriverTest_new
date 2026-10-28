import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type CodePushEnvironment = {
  CODEPUSH_TRUSTED_KEYS?: string;
  CODEPUSH_PRIVATE_KEY_FILE?: string;
  CODEPUSH_PUBLIC_KEY_FILE?: string;
  CODEPUSH_KEY_ID?: string;
};

const {
  readCodePushEnvironment,
  EnvironmentError,
}: {
  readCodePushEnvironment: (options: {
    root: string;
    env: NodeJS.ProcessEnv;
  }) => CodePushEnvironment;
  EnvironmentError: new () => Error & {code: string};
} = require('../scripts/codepush-env.cjs');

let root: string;
const names = [
  'CODEPUSH_TRUSTED_KEYS',
  'CODEPUSH_PRIVATE_KEY_FILE',
  'CODEPUSH_PUBLIC_KEY_FILE',
  'CODEPUSH_KEY_ID',
];

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'jaco-codepush-env-'));
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(root, {recursive: true, force: true});
});

function writeEnv(text: string | Buffer) {
  fs.writeFileSync(path.join(root, '.env'), text);
}

function expectEnvironmentError(action: () => unknown) {
  try {
    action();
    throw new Error('Expected environment_invalid');
  } catch (error) {
    expect(error).toBeInstanceOf(EnvironmentError);
    expect(error).toMatchObject({
      message: 'environment_invalid',
      code: 'environment_invalid',
    });
    expect((error as Error).message).not.toContain(root);
  }
}

it('allows a missing .env and returns only the four supported variables', () => {
  expect(readCodePushEnvironment({root, env: {}})).toEqual(
    Object.fromEntries(names.map(name => [name, undefined])),
  );
});

it('reads quoted paths with spaces, comments and an exported key ID', () => {
  writeEnv(
    'CODEPUSH_PRIVATE_KEY_FILE="/outside/key directory/private.pem" # private path\n' +
      "CODEPUSH_PUBLIC_KEY_FILE='/outside/key directory/public.pem'\n" +
      'CODEPUSH_TRUSTED_KEYS=/outside/trusted-keys.json\n' +
      'export CODEPUSH_KEY_ID=courier-key-1\n',
  );

  expect(readCodePushEnvironment({root, env: {}})).toEqual({
    CODEPUSH_PRIVATE_KEY_FILE: '/outside/key directory/private.pem',
    CODEPUSH_PUBLIC_KEY_FILE: '/outside/key directory/public.pem',
    CODEPUSH_TRUSTED_KEYS: '/outside/trusted-keys.json',
    CODEPUSH_KEY_ID: 'courier-key-1',
  });
});

it('prefers trimmed nonempty process variables over file values', () => {
  writeEnv(names.map(name => `${name}=file-value`).join('\n'));
  const env = Object.fromEntries(
    names.map(name => [name, '  process-value  ']),
  );

  expect(readCodePushEnvironment({root, env})).toEqual(
    Object.fromEntries(names.map(name => [name, 'process-value'])),
  );
});

it.each(['', '  \t '])(
  'falls back to .env for empty inherited values %j',
  value => {
    writeEnv(names.map(name => `${name}="  file-value  "`).join('\n'));
    const env = Object.fromEntries(names.map(name => [name, value]));

    expect(readCodePushEnvironment({root, env})).toEqual(
      Object.fromEntries(names.map(name => [name, 'file-value'])),
    );
  },
);

it('supports CI variables without a local file', () => {
  expect(
    readCodePushEnvironment({root, env: {CODEPUSH_KEY_ID: 'ci-key'}}),
  ).toMatchObject({CODEPUSH_KEY_ID: 'ci-key'});
});

it('returns undefined for empty local values', () => {
  writeEnv('CODEPUSH_KEY_ID="  "\nCODEPUSH_PRIVATE_KEY_FILE=\n');
  expect(readCodePushEnvironment({root, env: {}})).toEqual(
    Object.fromEntries(names.map(name => [name, undefined])),
  );
});

it('does not return unrelated secrets or mutate the caller environment or file', () => {
  const text =
    'SENTRY_AUTH_TOKEN=not-a-codepush-variable\n' +
    'AWS_SECRET_ACCESS_KEY=not-a-codepush-variable\n' +
    'CODEPUSH_KEY_ID=file-key\n';
  writeEnv(text);
  const env = Object.freeze({
    CODEPUSH_KEY_ID: 'process-key',
    AWS_SECRET_ACCESS_KEY: 'another-secret',
  });
  const processBefore = {...process.env};

  expect(readCodePushEnvironment({root, env})).toEqual({
    CODEPUSH_KEY_ID: 'process-key',
    CODEPUSH_PRIVATE_KEY_FILE: undefined,
    CODEPUSH_PUBLIC_KEY_FILE: undefined,
    CODEPUSH_TRUSTED_KEYS: undefined,
  });
  expect(env).toEqual({
    CODEPUSH_KEY_ID: 'process-key',
    AWS_SECRET_ACCESS_KEY: 'another-secret',
  });
  expect(process.env).toEqual(processBefore);
  expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toBe(text);
});

it('keeps shell expressions and tilde literal without executing or expanding them', () => {
  const sentinel = path.join(root, 'must-not-exist');
  writeEnv(
    'CODEPUSH_PRIVATE_KEY_FILE="~/keys/${HOME}/private.pem"\n' +
      `CODEPUSH_KEY_ID="$(touch '${sentinel}')"\n`,
  );

  expect(
    readCodePushEnvironment({root, env: {HOME: '/different-home'}}),
  ).toMatchObject({
    CODEPUSH_PRIVATE_KEY_FILE: '~/keys/${HOME}/private.pem',
    CODEPUSH_KEY_ID: `$(touch '${sentinel}')`,
  });
  expect(fs.existsSync(sentinel)).toBe(false);
});

it('rejects a directory in place of .env without exposing its path', () => {
  fs.mkdirSync(path.join(root, '.env'));
  expectEnvironmentError(() => readCodePushEnvironment({root, env: {}}));
});

it.each([
  Buffer.from([0x43, 0x3d, 0xff]),
  Buffer.from('CODEPUSH_KEY_ID=key\0other-secret'),
])('rejects malformed file bytes without exposing their contents', bytes => {
  writeEnv(bytes);
  expectEnvironmentError(() => readCodePushEnvironment({root, env: {}}));
});

it('normalizes filesystem failures and closes an opened file', () => {
  writeEnv('CODEPUSH_KEY_ID=file-key\n');
  const close = jest.spyOn(fs, 'closeSync');
  jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
    throw new Error(`Cannot read ${root}: secret-value`);
  });

  expectEnvironmentError(() => readCodePushEnvironment({root, env: {}}));
  expect(close).toHaveBeenCalledTimes(1);
});

it('normalizes errors opening the local file', () => {
  jest.spyOn(fs, 'openSync').mockImplementationOnce(() => {
    throw Object.assign(new Error(`Cannot open ${root}: secret-value`), {
      code: 'EACCES',
    });
  });

  expectEnvironmentError(() => readCodePushEnvironment({root, env: {}}));
});

it('rejects a nonstring selected environment value without exposing it', () => {
  expectEnvironmentError(() =>
    readCodePushEnvironment({
      root,
      env: {CODEPUSH_KEY_ID: 42} as unknown as NodeJS.ProcessEnv,
    }),
  );
});
