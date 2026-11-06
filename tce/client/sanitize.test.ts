import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { redactText } from '../core/redact.ts';
import { LIMITS } from '../core/schema/limits.ts';
import {
  clip,
  jsonBytes,
  mergeCounters,
  redact,
  sanitizeApp,
  sanitizeDevice,
  sanitizeErrorText,
  sanitizeFrames,
  sanitizeLogTail,
  sanitizeNote,
  sanitizeProps,
  sanitizeSessionFields,
  tail,
  utf8Length,
} from './sanitize.ts';

describe('redact', () => {
  it('replaces whole device paths, keeping a frame position', () => {
    const cases: Array<[string, string]> = [
      ['open /data/user/0/com.phonecando.app/files/a.txt failed', 'open <path> failed'],
      ['at /data/user/10/x', 'at <path>'],
      ['de /data/user_de/0/com.x/files', 'de <path>'],
      ['ENOENT /data/data/com.phonecando.app/cache', 'ENOENT <path>'],
      ['media /data/media/0/Download/taxes.pdf', 'media <path>'],
      ['dir /storage/emulated/0/Download/notes.md', 'dir <path>'],
      ['self /storage/self/primary/DCIM/a.jpg', 'self <path>'],
      ['vol /storage/1A2B-3C4D/Music', 'vol <path>'],
      ['card /sdcard/DCIM/x.jpg', 'card <path>'],
      ['bare /sdcard', 'bare <path>'],
      ['mnt /mnt/media_rw/1A2B-3C4D/secret', 'mnt <path>'],
      ['home ~/projects/acme/.env', 'home <path>'],
      ['at render (file:///data/user/0/com.phonecando.app/files/index.bundle:12:34)', 'at render (<path>:12:34)'],
      ['load file:///android_asset/x.html', 'load <path>'],
      ['uri content://com.android.providers.media/external/1234', 'uri <path>'],
      ['q ?dir=%2Fdata%2Fuser%2F0%2Fcom.x%2Ffiles&x=1', 'q ?dir=<path>&x=1'],
      ['q ?dir=%2Fstorage%2Femulated%2F0%2FDownload', 'q ?dir=<path>'],
      ['upstream <path>/home/acme/project/a.ts:3:1', 'upstream <path>:3:1'],
      // A colon inside a path does not end it, so nothing after it leaks.
      ['open /sdcard/a:b/secret.txt failed', 'open <path> failed'],
      // A quoted path runs to its closing quote, spaces included.
      ["open '/data/user/0/a/b c'", "open '<path>'"],
      [
        "ENOENT: no such file or directory, open '/storage/emulated/0/Download/My File.txt'",
        "ENOENT: no such file or directory, open '<path>'",
      ],
      ['{"file":"/storage/emulated/0/Download/Tax Return 2025.pdf"}', '{"file":"<path>"}'],
      // A Java file-error suffix ends an unquoted path, spaces included.
      [
        'java.io.FileNotFoundException: /storage/emulated/0/Download/Tax Return 2025.pdf: open failed: ENOENT (No such file or directory)',
        'java.io.FileNotFoundException: <path>: open failed: ENOENT (No such file or directory)',
      ],
      ['/sdcard/My Docs/plan v2.txt (No such file or directory)', '<path> (No such file or directory)'],
    ];
    for (const [input, want] of cases) assert.equal(redact(input), want, input);
  });

  it('replaces credential values with <secret>', () => {
    const cases: Array<[string, string]> = [
      ['Authorization: Bearer abcdef0123456789xyz', 'Authorization: Bearer <secret>'],
      ['auth Bearer abcdef0123456789xyz ok', 'auth Bearer <secret> ok'],
      ['auth Basic b3BlbmNvZGU6aHVudGVyMg== ok', 'auth Basic <secret> ok'],
      ['key sk-ant-api03-abcdefghijklmnop1234 used', 'key <secret> used'],
      ['key sk-proj-ABCDEFGHIJKLMNOPqrstuvwx used', 'key <secret> used'],
      ['gh ghp_abcdefghijklmnopqrstuvwxyz0123', 'gh <secret>'],
      ['gh gho_abcdefghijklmnopqrstuvwxyz0123', 'gh <secret>'],
      ['gh github_pat_11ABCDEFG0123456789_abcdefghijklmnop', 'gh <secret>'],
      ['slack xoxb-1234567890-abcdefghij', 'slack <secret>'],
      ['aws AKIAIOSFODNN7EXAMPLE end', 'aws <secret> end'],
      ['google AIzaSyA-abcdefghijklmnopqrstuvwxyz012345', 'google <secret>'],
      ['{"api_key": "v1-secret-value"}', '{"api_key": "<secret>"}'],
      ['{"token":"abc","n":1}', '{"token":"<secret>","n":1}'],
      ['{"client_secret": "s3cr3t"}', '{"client_secret": "<secret>"}'],
      ['{"password": "hunter2 with spaces"}', '{"password": "<secret>"}'],
    ];
    for (const [input, want] of cases) assert.equal(redact(input), want, input);
  });

  it('leaves look-alikes and other text alone', () => {
    for (const s of [
      '/sdcardx/y',
      '/data/user/0abc',
      '/data/local/tmp/x',
      'tmp/data/data/x',
      'TypeError: x is undefined',
      'a/b/c',
      'at render (index.android.bundle:1:2048)',
      'Class.method(File.kt:42)',
      'see https://phonecando.app/docs',
      'a bearer token was missing',
      'sk-learn',
    ]) {
      assert.equal(redact(s), s);
    }
  });

  it('is idempotent', () => {
    const once = redact('at f (/data/user/0/a/b.js:1:2) Bearer abcdef0123456789xyz {"token":"x"}');
    assert.equal(redact(once), once);
  });

  // The phone must redact at least what the server does; it uses the
  // server's own rules, and this pins that on the shapes both care about.
  it('matches the server redaction on every shared shape', () => {
    const corpus = [
      'open /data/user/0/com.phonecando.app/files/a.txt failed',
      '/data/user_de/0/x /data/data/y /data/media/0/z',
      '/storage/emulated/0/a /storage/ABCD-1234/b /storage/self/primary/c',
      '/sdcard /sdcard/DCIM/x.jpg. /mnt/expand/uuid/user/0',
      '~/notes.txt file:///sdcard/a.js:3:4 content://media/external/1',
      '?p=%2Fdata%2Fuser%2F0%2Fx&q=%2Fstorage%2Femulated%2F0%2Fy %2Fsdcard%2Fz',
      'file%3A%2F%2F%2Fsdcard%2Fa <path>/home/acme/b.ts:9',
      'Authorization: Bearer abcdef0123456789xyz',
      'Basic b3BlbmNvZGU6aHVudGVyMg== sk-ant-api03-abcdefghijklmnop1234',
      'ghp_abcdefghijklmnopqrstuvwxyz0123 gho_abcdefghijklmnopqrstuvwxyz0123',
      'github_pat_11ABCDEFG0123456789_abcdefghijklmnop xoxp-1234567890-abcdefghij',
      'AKIAIOSFODNN7EXAMPLE AIzaSyA-abcdefghijklmnopqrstuvwxyz012345',
      '{"api_key":"a","token":"b","secret":"c","password":"d"}',
      'access_token=abcdef0123 /data/user/0/x/sk-ant-api03-abcdefghijklmnop1234',
      'at a (/data/user/0/x/index.bundle:12:34) at b (index.android.bundle:1:2)',
      "open '/storage/emulated/0/Download/My File.txt' failed",
      '"/storage/emulated/0/Download/Tax Return 2025.pdf" `~/My Docs/a b.md` \'/sdcard/no close',
      'java.io.FileNotFoundException: /storage/emulated/0/Download/Tax Return 2025.pdf: open failed: ENOENT (No such file or directory)',
      '/sdcard/My Docs/plan v2.txt (No such file or directory)\n/data/user/0/x/a b (Permission denied)',
      '/mnt/media_rw/X Y/z (Is a directory) /storage/1A2B-3C4D/My Music (Read-only file system)',
    ];
    for (const s of corpus) assert.equal(redact(s), redactText(s), s);
  });
});

describe('clip, tail and utf8Length', () => {
  it('never splits a surrogate pair', () => {
    const s = 'ab😀cd';
    assert.equal(clip(s, 3), 'ab');
    assert.equal(clip(s, 4), 'ab😀');
    assert.equal(tail(s, 3), 'cd');
    assert.equal(tail(s, 4), '😀cd');
    assert.equal(clip('abc', 10), 'abc');
    assert.equal(tail('abc', 0), '');
  });

  it('counts UTF-8 bytes', () => {
    assert.equal(utf8Length('abc'), 3);
    assert.equal(utf8Length('é'), 2);
    assert.equal(utf8Length('€'), 3);
    assert.equal(utf8Length('😀'), 4);
    assert.equal(utf8Length(JSON.stringify('\ud800')), 8); // escaped lone surrogate
  });
});

describe('sanitizeProps', () => {
  it('caps key count, key length and string length', () => {
    const many: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) many[`k${i}`] = i;
    assert.equal(Object.keys(sanitizeProps(many)!).length, LIMITS.propsKeys);

    const long = sanitizeProps({ ['x'.repeat(100)]: 'y'.repeat(1000) })!;
    const [key] = Object.keys(long);
    assert.equal(key!.length, LIMITS.propKeyLength);
    assert.ok((long[key!] as string).length <= LIMITS.propStringLength);
  });

  it('keeps finite numbers, booleans and strings only', () => {
    const out = sanitizeProps({ a: 1, b: true, c: 'x', d: NaN, e: Infinity, f: null, g: { h: 1 }, i: [1] });
    assert.deepEqual(out, { a: 1, b: true, c: 'x' });
    assert.equal(sanitizeProps({ d: NaN }), undefined);
    assert.equal(sanitizeProps(undefined), undefined);
    assert.equal(sanitizeProps([1, 2]), undefined);
  });

  it('keeps the JSON size within propsBytes', () => {
    const big: Record<string, unknown> = {};
    for (let i = 0; i < 16; i++) big[`key${i}`] = '€'.repeat(200);
    const out = sanitizeProps(big)!;
    assert.ok(jsonBytes(out) <= LIMITS.propsBytes, `size ${jsonBytes(out)}`);
    assert.ok(Object.keys(out).length >= 1);
  });

  it('redacts paths in string values and ignores __proto__', () => {
    const input = JSON.parse('{"__proto__": "x", "p": "/sdcard/a.txt"}') as Record<string, unknown>;
    const out = sanitizeProps(input)!;
    assert.deepEqual(out, { p: '<path>' });
    assert.equal(Object.getPrototypeOf(out), Object.prototype);
  });
});

describe('mergeCounters', () => {
  it('replaces key-wise, caps keys, drops non-finite values', () => {
    assert.deepEqual(mergeCounters({ a: 1, b: 2 }, { b: 5, c: 1, d: NaN }), { a: 1, b: 5, c: 1 });
    const full: Record<string, number> = {};
    for (let i = 0; i < LIMITS.counterKeys; i++) full[`k${i}`] = i;
    const merged = mergeCounters(full, { k0: 99, extra: 1 })!;
    assert.equal(Object.keys(merged).length, LIMITS.counterKeys);
    assert.equal(merged.k0, 99);
    assert.equal(merged.extra, undefined);
    assert.equal(mergeCounters(undefined, 'nope'), undefined);
  });

  it('makes keys and values acceptable to the server', () => {
    assert.deepEqual(mergeCounters(undefined, { 'tool.pce act/x': 1, 'engine.starts': 2.4, neg: -1, big: 2 ** 60, ok: 3 }), {
      'tool.pce_act_x': 1,
      'engine.starts': 2,
      ok: 3,
    });
    assert.equal(Object.keys(mergeCounters(undefined, { ['k'.repeat(100)]: 1 })!)[0]!.length, LIMITS.shortText);
  });
});

describe('session, error, device and report fields', () => {
  it('cleans session fields and never keeps engine output', () => {
    const out = sanitizeSessionFields({
      bootMs: 1234.6,
      engineExitCode: 137.9,
      lowMemoryTrims: -1,
      engineOk: true,
      a11yOn: 'yes' as unknown as boolean,
      engineStderrTail: 'user prompt: summarise my medical notes',
    });
    assert.equal(out.bootMs, 1235);
    assert.equal(out.engineExitCode, 137);
    assert.equal(out.lowMemoryTrims, undefined);
    assert.equal(out.engineOk, true);
    assert.equal(out.a11yOn, undefined);
    // Raw engine output can hold prompt text: it only ever goes in a user report.
    assert.equal('engineStderrTail' in out, false);
    // Values the server would reject are left out.
    assert.deepEqual(sanitizeSessionFields({ endedAt: 5, bootMs: 2 ** 40, engineExitCode: 2 ** 40 }), {});
    assert.equal(sanitizeSessionFields({ endedAt: 1_750_000_000_000.4 }).endedAt, 1_750_000_000_000);
  });

  it('redacts paths and secrets in error text, frames, note and log tail', () => {
    const t = sanitizeErrorText('E', 'auth failed for sk-ant-api03-abcdefghijklmnop1234 at /sdcard/a:b/c');
    assert.equal(t.message, 'auth failed for <secret> at <path>');
    assert.deepEqual(sanitizeFrames(['at x (~/app/a.js:1:2)']), ['at x (<path>:1:2)']);
    assert.equal(sanitizeNote('my key is ghp_abcdefghijklmnopqrstuvwxyz0123'), 'my key is <secret>');
    assert.equal(
      sanitizeLogTail('POST Authorization: Bearer abcdef0123456789xyz\nopen %2Fdata%2Fuser%2F0%2Fx failed'),
      'POST Authorization: Bearer <secret>\nopen <path> failed',
    );
    assert.deepEqual(sanitizeProps({ p: 'content://media/1', k: 'Bearer abcdef0123456789xyz' }), {
      p: '<path>',
      k: 'Bearer <secret>',
    });
  });

  it('redacts and cuts error text and keeps the top frames', () => {
    const t = sanitizeErrorText('E'.repeat(500), `cannot open /data/data/app/x ${'m'.repeat(500)}`);
    assert.equal(t.className.length, LIMITS.errorClass);
    assert.equal(t.message.length, LIMITS.errorMessage);
    assert.ok(t.message.startsWith('cannot open <path> '));
    assert.equal(sanitizeErrorText('', 'x').className, 'Error');

    const frames = sanitizeFrames(['', '  at a (file:///data/user/0/x.js:1:2)', 'b', 'c', 'd', 'e', 'f', 42]);
    assert.deepEqual(frames, ['at a (<path>:1:2)', 'b', 'c', 'd', 'e']);
    assert.deepEqual(sanitizeFrames('nope'), []);
    assert.deepEqual(sanitizeFrames(null), []);
    assert.equal(sanitizeFrames(['f'.repeat(999)])[0]!.length, LIMITS.errorFrameLength);
  });

  it('cuts device and app facts and defaults the channel', () => {
    const d = sanitizeDevice(
      { manufacturer: 'M'.repeat(100), model: '', sdkInt: 35.4, abi: 'arm64-v8a', ramGb: 7.6, locale: '', installSource: '  ' },
      true,
    );
    assert.equal(d.manufacturer.length, LIMITS.shortText);
    assert.equal(d.model, 'unknown');
    assert.equal(d.sdkInt, 35);
    assert.equal(d.ramGb, 8);
    assert.equal(d.locale, 'und');
    assert.equal(d.installSource, null);
    assert.equal(d.tester, true);
    assert.equal(sanitizeDevice({ ...d, sdkInt: 0, ramGb: -3 }, false).sdkInt, 1);
    assert.equal(sanitizeDevice({ ...d, sdkInt: 0, ramGb: -3 }, false).ramGb, 0);
    assert.equal(sanitizeDevice({ ...d, sdkInt: 5000, ramGb: 99_999 }, false).sdkInt, 1000);
    assert.equal(sanitizeDevice({ ...d, sdkInt: 5000, ramGb: 99_999 }, false).ramGb, 4096);
    assert.deepEqual(sanitizeApp({ version: '1.2.3', versionCode: 9, channel: 'beta' as 'full' }), {
      version: '1.2.3',
      versionCode: 9,
      channel: 'full',
    });
  });

  it('trims report note and log tail', () => {
    assert.equal(sanitizeNote('   '), undefined);
    assert.equal(sanitizeNote('n'.repeat(900))!.length, LIMITS.reportNote);
    const log = sanitizeLogTail(`/sdcard/secret ${'l'.repeat(40_000)} tail`)!;
    assert.equal(log.length, LIMITS.logTail);
    assert.ok(log.endsWith(' tail'));
    assert.equal(sanitizeLogTail(''), undefined);
  });
});
