import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makePreparedFixture} from './helpers/codepushPreparedFixture';

type Remote = {status: 200; bytes: Buffer; etag: string; cacheControl: string} | {status: 404};
interface Transport {
  read: (key: string, limit: number) => Promise<Remote>;
  put: (key: string, file: string, bytes: Buffer, condition: {etag?: string}, manifest: boolean) => void;
}
const {publishPrepared, parseArguments, awsTransport}: {
  publishPrepared: (options: {prepared: string; execute?: boolean; profile?: string}, deps?: {
    transport?: Transport; now?: number;
  }) => Promise<Record<string, unknown>>;
  parseArguments: (args: string[]) => Record<string, unknown>;
  awsTransport: (profile: string, spawn: jest.Mock) => Transport;
} = require('../scripts/codepush-publish.cjs');
const {PreparedError}: {PreparedError: new (code: string) => Error} = require('../scripts/codepush-prepared.cjs');

describe('CodePush publication of an existing signed artifact', () => {
  let directory: string;
  let fixture: ReturnType<typeof makePreparedFixture>;
  let remote: Map<string, Remote>;
  let writes: Array<{key: string; condition: {etag?: string}; manifest: boolean}>;
  let events: string[];
  let transport: Transport;
  const now = Date.parse('2026-10-25T12:00:00Z');
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codepush-publish-test-'));
    fixture = makePreparedFixture(directory);
    remote = new Map(); writes = []; events = [];
    transport = {
      read: jest.fn(async (key): Promise<Remote> => { events.push(`read:${key}`); return remote.get(key) ?? {status: 404}; }),
      put(key, file, bytes, condition, manifest) {
        expect(fs.readFileSync(file)).toEqual(bytes);
        events.push(`put:${key}`); writes.push({key, condition, manifest});
        remote.set(key, {status: 200, bytes, etag: '"abcdef"', cacheControl: manifest ? 'no-store, max-age=0' : 'immutable'});
      },
    };
  });
  afterEach(() => fs.rmSync(directory, {recursive: true, force: true}));
  const execute = () => publishPrepared({prepared: fixture.prepared, execute: true}, {transport, now});

  it('validates offline by default without calling any transport method', async () => {
    const result = await publishPrepared({prepared: fixture.prepared}, {transport, now});
    expect(result.status).toBe('prepared');
    expect(events).toEqual([]); expect(writes).toEqual([]);
  });
  it('publishes the bundle, reads its bytes back, and writes the manifest last', async () => {
    expect((await execute()).status).toBe('published');
    expect(writes).toEqual([
      {key: fixture.bundleKey, condition: {}, manifest: false},
      {key: fixture.manifestKey, condition: {}, manifest: true},
    ]);
    expect(events.indexOf(`read:${fixture.bundleKey}`, 3)).toBeLessThan(events.indexOf(`put:${fixture.manifestKey}`));
    expect(fs.readFileSync(path.join(fixture.prepared, 'publish', fixture.bundleKey))).toEqual(fixture.bundle);
  });
  it('does not rewrite an existing matching immutable bundle', async () => {
    remote.set(fixture.bundleKey, {status: 200, bytes: fixture.bundle, etag: '"bundle"', cacheControl: 'immutable'});
    await execute(); expect(writes.map(value => value.key)).toEqual([fixture.manifestKey]);
  });
  it('uses the exact prior ETag when replacing a lower manifest sequence', async () => {
    remote.set(fixture.manifestKey, {status: 200,
      bytes: fixture.envelope({...fixture.payload, manifestSequence: 6}), etag: '"old-etag"', cacheControl: 'no-store'});
    await execute(); expect(writes.at(-1)?.condition).toEqual({etag: '"old-etag"'});
  });
  it('is idempotent for the same signed payload without rewriting its manifest', async () => {
    await execute(); writes.length = 0;
    expect((await execute()).status).toBe('already_published'); expect(writes).toEqual([]);
  });
  it('does not report an identical remotely cached manifest as successfully published', async () => {
    remote.set(fixture.manifestKey, {status: 200, bytes: fixture.manifest, etag: '"cached"', cacheControl: 'max-age=3600'});
    remote.set(fixture.bundleKey, {status: 200, bytes: fixture.bundle, etag: '"bundle"', cacheControl: 'immutable'});
    await expect(execute()).rejects.toThrow('manifest_cache_invalid'); expect(writes).toEqual([]);
  });
  it.each([7, 8])('rejects conflicting/replayed remote sequence %s before writing', async sequence => {
    remote.set(fixture.manifestKey, {status: 200, bytes: fixture.envelope({...fixture.payload,
      manifestSequence: sequence, version: 'different'}), etag: '"old"', cacheControl: 'no-store'});
    await expect(execute()).rejects.toThrow('manifest_sequence_conflict'); expect(writes).toEqual([]);
  });
  it('does not overwrite a different remote object at the same content-addressed key', async () => {
    remote.set(fixture.bundleKey, {status: 200, bytes: Buffer.from('BAD'), etag: '"bad"', cacheControl: ''});
    await expect(execute()).rejects.toThrow('remote_bundle_invalid'); expect(writes).toEqual([]);
  });
  it('never publishes a manifest after a failed bundle verification', async () => {
    transport.put = (_key, _file, _bytes, _condition, manifest) => { if (manifest) throw new Error('must not publish'); };
    await expect(execute()).rejects.toThrow('remote_bundle_invalid');
  });
  it('handles a parallel matching immutable upload but fails a manifest CAS conflict', async () => {
    const original = transport.put;
    transport.put = (...args) => {
      original(...args);
      throw new PreparedError('publication_conflict');
    };
    await expect(execute()).rejects.toThrow('publication_conflict');
    expect(writes.map(value => value.key)).toEqual([fixture.bundleKey, fixture.manifestKey]);
  });
  it('rejects a bad remote signature even if its sequence would be lower', async () => {
    remote.set(fixture.manifestKey, {status: 200, bytes: Buffer.from('{}'), etag: '"bad"', cacheControl: ''});
    await expect(execute()).rejects.toThrow('manifest_invalid'); expect(writes).toEqual([]);
  });
  it.each(['bundle', 'signature', 'payload-metadata', 'public-key', 'expired', 'symlink', 'hardlink'])(
    'rejects local %s damage without touching the network', async kind => {
      if (kind === 'bundle') fs.appendFileSync(path.join(fixture.prepared, 'publish', fixture.bundleKey), 'changed');
      if (kind === 'signature') fs.writeFileSync(path.join(fixture.prepared, 'publish', fixture.manifestKey), '{}');
      if (kind === 'payload-metadata') fs.writeFileSync(path.join(fixture.prepared, 'metadata/payload.json'), '{}');
      if (kind === 'public-key') fs.writeFileSync(path.join(fixture.prepared, 'metadata/signing-public-key.pem'), 'PRIVATE_SENTINEL');
      if (kind === 'expired') {
        const changed = {...fixture.payload, expiresAt: '2026-10-02T00:00:00Z'};
        fs.writeFileSync(path.join(fixture.prepared, 'publish', fixture.manifestKey), fixture.envelope(changed));
      }
      if (kind === 'symlink' || kind === 'hardlink') {
        const file = path.join(fixture.prepared, 'publish', fixture.bundleKey);
        const original = path.join(directory, 'outside'); fs.renameSync(file, original);
        if (kind === 'symlink') fs.symlinkSync(original, file); else fs.linkSync(original, file);
      }
      await expect(execute()).rejects.toThrow(); expect(events).toEqual([]);
    });
  it('keeps temporary upload bytes stable if original files change after validation', async () => {
    const original = transport.read;
    transport.read = async (key, limit) => {
      fs.writeFileSync(path.join(fixture.prepared, 'publish', fixture.bundleKey), 'tampered during network');
      return original(key, limit);
    };
    expect((await execute()).status).toBe('published');
    expect((remote.get(fixture.bundleKey) as {bytes: Buffer}).bytes).toEqual(fixture.bundle);
  });
  it('checks fresh public manifest bytes and no-store after publication', async () => {
    const original = transport.put;
    transport.put = (...args) => {
      original(...args);
      if (args[4]) remote.set(args[0], {status: 200, bytes: args[2], etag: '"a"', cacheControl: 'public, max-age=3600'});
    };
    await expect(execute()).rejects.toThrow('manifest_cache_invalid');
  });
});

describe('CodePush publication command boundary', () => {
  it('requires an explicit execute flag and rejects unknown/duplicate flags', () => {
    expect(parseArguments(['--prepared', '/tmp/reviewed'])).toEqual({execute: false, prepared: '/tmp/reviewed'});
    expect(parseArguments(['--prepared', '/tmp/reviewed', '--execute'])).toMatchObject({execute: true});
    for (const args of [[], ['--execute'], ['--prepared', 'x', '--execute', '--execute'],
      ['--prepared', 'x', '--endpoint', 'http://bad'], ['--prepared', 'x', '--prepared', 'y']]) {
      expect(() => parseArguments(args)).toThrow('arguments_invalid');
    }
  });
  it('pins AWS endpoint/bucket, conditional headers and suppresses raw credential errors', () => {
    const spawn = jest.fn(() => ({status: 0, stdout: '{}'}));
    const client = awsTransport('mini-codepush', spawn);
    client.put('android/runtime/manifest.json', '/tmp/manifest', Buffer.from('{}'), {etag: '"old"'}, true);
    const [program, args, options] = spawn.mock.calls[0] as unknown as [string, string[], {shell: boolean}];
    expect(program).toBe('aws'); expect(options.shell).toBe(false);
    expect(args).toEqual(expect.arrayContaining(['https://storage.yandexcloud.net', 'jaco-driver-codepush', '--if-match', '"old"']));
    spawn.mockReturnValue({status: 1, stderr: 'PRIVATE_SENTINEL'} as never);
    expect(() => client.put('x', '/tmp/x', Buffer.from('x'), {}, false)).toThrow('upload_failed');
    expect(() => awsTransport('--endpoint=http://bad', spawn)).toThrow('profile_invalid');
  });
});
