import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PATH_MARK, SECRET_MARK, redactPaths, redactSecrets, redactText } from './redact.ts';

/** Every input this file feeds a redactor, for the idempotence sweep at the end. */
const seen: string[] = [];

function each(fn: (s: string) => string, cases: readonly (readonly [string, string])[]): void {
  for (const [input, expected] of cases) {
    seen.push(input, expected);
    assert.equal(fn(input), expected, input);
  }
}

function unchanged(fn: (s: string) => string, inputs: readonly string[]): void {
  for (const s of inputs) {
    seen.push(s);
    assert.equal(fn(s), s, s);
  }
}

describe('redactPaths', () => {
  it('replaces every listed device location, keeping :line:col', () => {
    each(redactPaths, [
      ['at f (/data/user/0/com.phonecando.app/files/home/acme/a.js:12:5)', 'at f (<path>:12:5)'],
      ['open /data/user/10/com.phonecando.app/cache/x failed', 'open <path> failed'],
      ['/data/user_de/0/com.phonecando.app/no_backup/k', '<path>'],
      ['ENOENT /data/data/com.phonecando.app/files/.env', 'ENOENT <path>'],
      ['/data/media/0/acme/Documents/plan.txt', '<path>'],
      ['/data/app/~~abc==/com.phonecando.app-1/base.apk', '<path>'],
      ['at a (/data/app/com.example.bank-2/lib/arm64/libx.so:10)', 'at a (<path>:10)'],
      ["'/storage/emulated/0/Download/taxes.pdf'", "'<path>'"],
      ['saved to /sdcard/DCIM/x.jpg.', 'saved to <path>.'],
      ['at x (file:///sdcard/notes/secret.txt:3:4)', 'at x (<path>:3:4)'],
      ['file://data/local/tmp/x', '<path>'],
      ['/sdcard', '<path>'],
      ['/data/data', '<path>'],
      ['two: /sdcard/a and /data/data/b', 'two: <path> and <path>'],
      ['at g (/data/user/0/app/files/a.js:7)', 'at g (<path>:7)'],
      ['/storage/emulated/0/Download/taxes-2026.pdf: open failed', '<path>: open failed'],
    ]);
  });

  it('consumes the whole path up to whitespace or a delimiter, not just to the first colon', () => {
    each(redactPaths, [
      // A space-free remainder after a colon or other punctuation is still the path.
      ['open /sdcard/acme:projects/plan.txt now', 'open <path> now'],
      ['/data/user/0/app/files/home/acme@host:secret/key.pem', '<path>'],
      ['/storage/emulated/0/a=b&c?d#e!f~g/h.txt', '<path>'],
      ['/data/data/app/files/x:1:2/y.js', '<path>'],
      // Each delimiter ends the path.
      ...["'", '"', '`', '(', ')', '<', '>', '[', ']', '{', '}', ',', ';', ' ', '\t', '\n'].map(
        (d) => [`/sdcard/a/b${d}tail`, `<path>${d}tail`] as const,
      ),
    ]);
  });

  it('consumes a quoted path up to its closing quote, spaces included', () => {
    each(redactPaths, [
      ['"/storage/emulated/0/Download/Tax Return 2025.pdf"', '"<path>"'],
      ["'/data/user/0/x/My Documents/plan.docx'", "'<path>'"],
      ['`/sdcard/My Notes/today.md`', '`<path>`'],
      ['"~/My Projects/acme/a b.txt"', '"<path>"'],
      ['"content://media/external/My Album/1"', '"<path>"'],
      // The ENOENT shape of Node/JS file errors.
      [
        "ENOENT: no such file or directory, open '/data/user/0/com.phonecando.app/files/home/My File.txt'",
        "ENOENT: no such file or directory, open '<path>'",
      ],
      ["Error: EACCES: permission denied, scandir '/storage/emulated/0/Android/data/My App'", "Error: EACCES: permission denied, scandir '<path>'"],
      // JSON values: the closing quote ends the path, an escaped quote does not.
      ['{"path":"/sdcard/Download/Bank Statement.pdf","size":3}', '{"path":"<path>","size":3}'],
      ['{"path":"/sdcard/a \\"b\\" c.txt","x":1}', '{"path":"<path>","x":1}'],
      // Two quoted paths on one line stay two paths; the text between them is kept.
      ['copy "/sdcard/My A.txt" to "/data/data/app/files/My B.txt" failed', 'copy "<path>" to "<path>" failed'],
      // :line:col and trailing punctuation are given back, inside the quotes too.
      ['"/data/user/0/app/files/My Lib/a b.js:12:5"', '"<path>:12:5"'],
      ["'/sdcard/DCIM/My Trip/x.jpg.'", "'<path>.'"],
      // The upstream-redactor backstop, quoted.
      ['"<path>/My Documents/plan.docx"', '"<path>"'],
      ["at f ('<path>/acme corp/x.ts:3:4')", "at f ('<path>:3:4')"],
    ]);
  });

  it('applies the unquoted rule when the quote does not close on the same line, or the path does not start at the quote', () => {
    each(redactPaths, [
      ["'/sdcard/My File.txt", "'<path> File.txt"],
      ['"/sdcard/My File.txt\nnext" line', '"<path> File.txt\nnext" line'],
      ['"open /sdcard/My File.txt now"', '"open <path> File.txt now"'],
      ['java.io.FileNotFoundException: /sdcard/x.txt: open failed: ENOENT', 'java.io.FileNotFoundException: <path>: open failed: ENOENT'],
    ]);
  });

  it('consumes an unquoted path with spaces up to a Java file-error suffix', () => {
    each(redactPaths, [
      [
        'java.io.FileNotFoundException: /storage/emulated/0/Download/Tax Return 2025.pdf: open failed: ENOENT (No such file or directory)',
        'java.io.FileNotFoundException: <path>: open failed: ENOENT (No such file or directory)',
      ],
      ['FileNotFoundException: /sdcard/My Docs/plan v2.txt (No such file or directory)', 'FileNotFoundException: <path> (No such file or directory)'],
      ['/data/user/0/com.x/files/Read Only/a.txt (Read-only file system)', '<path> (Read-only file system)'],
      ['/storage/emulated/0/Pictures/x y.jpg: open failed: EACCES (Permission denied)', '<path>: open failed: EACCES (Permission denied)'],
    ]);
  });

  it('consumes percent-encoded spaces in file:// URIs whole', () => {
    each(redactPaths, [
      ['file:///storage/emulated/0/Download/My%20File.txt', '<path>'],
      ['at x (file:///sdcard/My%20Docs/a%20b.js:3:4)', 'at x (<path>:3:4)'],
      ['load file:///data/user/0/com.app/files/My%20Notes/n.md failed', 'load <path> failed'],
      ["open 'file:///sdcard/My%20File.txt'", "open '<path>'"],
    ]);
  });

  it('leaves quoted strings that do not start with a device path alone', () => {
    unchanged(redactPaths, [
      '"hello world"',
      "'it is fine' and 'so is this'",
      '"/proc/self/maps here"',
      "'/system/lib64/My Lib.so'",
      '"/sdcardx/My Notes"',
      '`/data/local/tmp/a b`',
      '{"name":"My Documents","path":null}',
      '"https://phonecando.app/docs and more"',
    ]);
  });

  it('covers every shared-storage volume and mount point', () => {
    each(redactPaths, [
      ['/storage/emulated/0', '<path>'],
      ['/storage/emulated/10/DCIM/a.jpg', '<path>'],
      ['/storage/self/primary/Documents/acme.txt', '<path>'],
      ['/storage/1A2B-3C4D/DCIM/y.jpg', '<path>'],
      ['/storage/abcd-ef01', '<path>'],
      ['/mnt/media_rw/1A2B-3C4D/z', '<path>'],
      ['/mnt/user/0/emulated/0/a', '<path>'],
      ['/mnt/expand/0f1e2d3c/user/0/app', '<path>'],
    ]);
  });

  it('covers ~/, file:// and content:// forms', () => {
    each(redactPaths, [
      ['user@host:~/proj/acme$ ls', 'user@host:<path> ls'],
      ['cat ~/notes.txt', 'cat <path>'],
      ['~/a.js:3:4', '<path>:3:4'],
      ['load file:///android_asset/x.html', 'load <path>'],
      ['FILE:///sdcard/x', '<path>'],
      ['content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Facme', '<path>'],
      ['uri=content://media/external/images/media/42', 'uri=<path>'],
      ['jar:file:///data/app/x.apk!/classes.dex', 'jar:<path>'],
    ]);
  });

  it('covers URL-encoded paths, ending them at & in a query string', () => {
    each(redactPaths, [
      ['GET /x?path=%2Fdata%2Fuser%2F0%2Fcom.app%2Ffiles&x=1', 'GET /x?path=<path>&x=1'],
      ['q=%2fstorage%2femulated%2f0%2facme.txt', 'q=<path>'],
      ['%2Fsdcard%2FDownload%2Fa.pdf', '<path>'],
      ['%2Fmnt%2Fmedia_rw%2Fx', '<path>'],
      ['u=file%3A%2F%2F%2Fsdcard%2Fa&v=2', 'u=<path>&v=2'],
      ['u=content%3A%2F%2Fmedia%2Fexternal', 'u=<path>'],
      ['foo%2Fdata%2Fdata%2Fapp', 'foo<path>'],
    ]);
  });

  it('treats <path>/... as a path whose prefix an upstream redactor already replaced', () => {
    each(redactPaths, [
      ['at y (<path>/acme/projects/x.ts:3:4)', 'at y (<path>:3:4)'],
      ['ENOENT <path>/home/acme/.env', 'ENOENT <path>'],
      ['<path>/a:b/c d', '<path> d'],
      ['<path>', '<path>'],
      ['<path>: open failed', '<path>: open failed'],
    ]);
  });

  it('leaves non-device text alone', () => {
    unchanged(redactPaths, [
      'at render (index.android.bundle:1:2048)',
      'java.lang.IllegalStateException: boom',
      'Class.method(File.kt:42)',
      'see https://phonecando.app/docs',
      '/sdcardx/notes',
      'tmp/data/data/x',
      '/data/apps/x',
      '/data/local/tmp/x',
      '/data/user/0abc',
      '/proc/self/maps',
      '/system/lib64/libc.so',
      '/storage',
      '/mnt',
      'x:1:2:3',
      'a~/b',
      'profile://x',
    ]);
  });

  it('uses a fixed marker', () => {
    assert.equal(PATH_MARK, '<path>');
  });
});

describe('redactSecrets', () => {
  it('redacts Authorization header values, keeping the header name and scheme', () => {
    each(redactSecrets, [
      ['Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.e30.abc', 'Authorization: Bearer <secret>'],
      ['{"Authorization":"Basic dXNlcjpwYXNz"}', '{"Authorization":"Basic <secret>"}'],
      ['authorization=token ghp_abc', 'authorization=token <secret>'],
      ["headers: {'authorization': 'abc123'}", "headers: {'authorization': '<secret>'}"],
      // An unquoted header value runs to the end of the line (Digest has spaces and quotes).
      ['Proxy-Authorization: Digest username="x", response="ab12"\nnext line', 'Proxy-Authorization: Digest <secret>\nnext line'],
      // A quoted value ends at its closing quote, skipping escaped ones.
      ['{"authorization":"Bearer a\\"b","x":1}', '{"authorization":"Bearer <secret>","x":1}'],
      ['authorization failed for this user', 'authorization failed for this user'],
    ]);
  });

  it('redacts bare Bearer and Basic credentials', () => {
    each(redactSecrets, [
      ['sent bearer eyJhbGciOiJIUzI1NiJ9.e30.sig to the API', 'sent bearer <secret> to the API'],
      ['Basic dXNlcjpwYXNz=', 'Basic <secret>'],
      ['bearer token expired', 'bearer token expired'],
      ['Basic auth', 'Basic auth'],
    ]);
  });

  it('redacts provider, GitHub, Slack, AWS and Google keys', () => {
    each(redactSecrets, [
      ['key sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv_wx-yz end', 'key <secret> end'],
      ['OPENAI_KEY sk-proj-abcdefghijklmnop1234', 'OPENAI_KEY <secret>'],
      ['sk-abcdefghijklmnopqrstuvwxyz012345', '<secret>'],
      ['token ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'token <secret>'],
      ['gho_abcdefghijklmnopqrstuvwxyz0123456789', '<secret>'],
      ['github_pat_11ABCDEFG0123456789_abcdefghijklmnop', '<secret>'],
      ['xoxb-1234567890-abcdefghij', '<secret>'],
      ['xoxp-1234567890-1234567890-abcdef', '<secret>'],
      ['id AKIAIOSFODNN7EXAMPLE used', 'id <secret> used'],
      ['AIzaSyA1234567890abcdefghijklmnopqrstuv', '<secret>'],
      ['GROQ gsk_abcdefghijklmnopqrstuvwxyz0123', 'GROQ <secret>'],
      ['xai-abcdefghijklmnopqrstuvwxyz0123456789', '<secret>'],
      ['ghs_abcdefghijklmnopqrstuvwxyz0123456789 ghu_abcdefghijklmnopqrstuvwxyz0123456789', '<secret> <secret>'],
    ]);
  });

  it('redacts JSON string values and key=value pairs under credential keys', () => {
    each(redactSecrets, [
      ['{"api_key": "abc123"}', '{"api_key": "<secret>"}'],
      ['{"apiKey":"abc","api-key":"def"}', '{"apiKey":"<secret>","api-key":"<secret>"}'],
      ['{"token":"a\\"b"}', '{"token":"<secret>"}'],
      ['{"access_token": "x", "client_secret": "y", "password": "hunter2"}', '{"access_token": "<secret>", "client_secret": "<secret>", "password": "<secret>"}'],
      ['{"githubToken":"x"}', '{"githubToken":"<secret>"}'],
      ['https://x.test/cb?access_token=abc.def&state=1', 'https://x.test/cb?access_token=<secret>&state=1'],
      ['PASSWORD=hunter2 ./run', 'PASSWORD=<secret> ./run'],
      ['--token=abc123', '--token=<secret>'],
      ['at call (https://api.x.test/v1?access_token=zzz:1:2)', 'at call (https://api.x.test/v1?access_token=<secret>)'],
    ]);
  });

  it('leaves look-alikes alone', () => {
    unchanged(redactSecrets, [
      '{"max_tokens": 100, "token_count": "5", "tokens": "x"}',
      'max_tokens=100 tokenizer=bpe',
      'task-abcdefghijklmnopqrstuvwxyz',
      'sk-short',
      'gsk_short',
      'xai-grok',
      'AKIA-not-a-key',
      'the secret is out',
      'ghp_short',
    ]);
  });

  it('uses a fixed marker', () => {
    assert.equal(SECRET_MARK, '<secret>');
  });
});

describe('redactText', () => {
  it('never lets a secret-looking folder split a path and leak its tail', () => {
    each(redactText, [
      ['/storage/emulated/0/sk-learn-abcdefghijklmnop/salaries.csv', '<path>'],
      ['/storage/emulated/0/ghp_abcdefghijklmnopqrstuvwxyz0123/acme/x', '<path>'],
      ['/storage/ghp_abcdefghijklmnopqrstuvwxyz0123/acme/x', '<path>'],
      ['open ~/xoxb-1234567890-abcdefghij/acme.txt:3:4 failed', 'open <path>:3:4 failed'],
      ['at f (<path>/sk-ant-api03-abcdefghijklmnopqrst/acme/a.js:1:2)', 'at f (<path>:1:2)'],
      ['file:///sdcard/a?token=abc/def', '<path>'],
      ["open '/sdcard/sk-proj-abcdefghijklmnop1234/My Salaries.csv'", "open '<path>'"],
    ]);
  });

  it('redacts secrets and paths side by side', () => {
    each(redactText, [
      ['{"password":"/sdcard/x"} Authorization: Bearer abcdefghijkl', '{"password":"<secret>"} Authorization: Bearer <secret>'],
      ['ENOENT /data/data/app/files/.env (key sk-proj-abcdefghijklmnop1234)', 'ENOENT <path> (key <secret>)'],
      ['GET https://x.test/?access_token=abc&path=%2Fdata%2Fuser%2F0%2Fx', 'GET https://x.test/?access_token=<secret>&path=<path>'],
      ['ghp_abcdefghijklmnopqrstuvwxyz0123/data/data/x', '<secret><path>'],
      // A private-use character (the internal placeholder) in the input is treated as a secret.
      ['odd \uE000 char', 'odd <secret> char'],
    ]);
  });

  it('is idempotent: every input and output in this file is a fixed point after one pass', () => {
    assert.ok(seen.length > 150, `swept ${seen.length} strings`);
    for (const s of seen) {
      for (const fn of [redactPaths, redactSecrets, redactText]) {
        const once = fn(s);
        assert.equal(fn(once), once, `${fn.name}: ${s}`);
      }
    }
  });

  it('stays linear on hostile input', () => {
    const hostile = [
      'a-'.repeat(20_000) + '=x',
      '/sdcard/' + '.a'.repeat(20_000),
      '/sdcard/x' + ':1'.repeat(20_000),
      '"token":"'.repeat(4_000) + '\\',
      // Quoted paths that never close, or close on every segment.
      "'/sdcard/" + 'a b'.repeat(20_000),
      `"'\`/sdcard/` + ' x\\'.repeat(20_000),
      '"/sdcard/x '.repeat(10_000),
      "'/sdcard/x \"".repeat(10_000),
    ];
    for (const s of hostile) {
      const started = performance.now();
      redactText(s);
      assert.ok(performance.now() - started < 1000, `${s.slice(0, 20)}... took too long`);
    }
  });
});
