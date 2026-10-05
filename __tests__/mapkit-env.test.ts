import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {readMapKitApiKey, writeIosMapKitConfig} = require('../scripts/mapkit-env.cjs');
let directory: string;

beforeEach(() => {directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jaco-mapkit-env-'));});
afterEach(() => {fs.rmSync(directory, {recursive: true, force: true});});

it('читает ключ из .env с кавычками и комментариями без исполнения содержимого', () => {
  fs.writeFileSync(path.join(directory, '.env'), 'YAMAP_API_KEY="local-key" # MapKit\nOTHER=$(exit 1)\n');
  expect(readMapKitApiKey({root: directory, env: {}})).toBe('local-key');
});

it('предпочитает переменную сборки локальному .env и разрешает CI без файла', () => {
  expect(readMapKitApiKey({root: directory, env: {YAMAP_API_KEY: 'ci-key'}})).toBe('ci-key');
  fs.writeFileSync(path.join(directory, '.env'), 'YAMAP_API_KEY=local-key\n');
  expect(readMapKitApiKey({root: directory, env: {YAMAP_API_KEY: 'ci-key'}})).toBe('ci-key');
});

it('останавливает сборку при отсутствующем или явно пустом ключе', () => {
  expect(() => readMapKitApiKey({root: directory, env: {}})).toThrow('YAMAP_API_KEY');
  fs.writeFileSync(path.join(directory, '.env'), 'YAMAP_API_KEY=local-key\n');
  expect(() => readMapKitApiKey({root: directory, env: {YAMAP_API_KEY: '  '}})).toThrow('YAMAP_API_KEY');
});

it.each(['development', 'production'])('встраивает один и тот же ключ в JS и нативный пакет iOS: %s', envName => {
  const apiKey = 'build-test-key';
  const code = execFileSync(process.execPath, ['-e', `
    const {transformFileSync} = require('@babel/core');
    process.stdout.write(transformFileSync('src/shared/lib/yaMapInit.ts', {
      envName: ${JSON.stringify(envName)}
    }).code);
  `], {cwd: process.cwd(), encoding: 'utf8', env: {...process.env, YAMAP_API_KEY: apiKey}});
  expect(code).toContain(JSON.stringify(apiKey));
  expect(code).not.toContain('process.env.YAMAP_API_KEY');

  writeIosMapKitConfig({YAMAP_API_KEY: apiKey, TARGET_BUILD_DIR: directory, UNLOCALIZED_RESOURCES_FOLDER_PATH: 'Test.app'});
  expect(JSON.parse(fs.readFileSync(path.join(directory, 'Test.app/MapKitConfig.json'), 'utf8'))).toEqual({apiKey});
});
