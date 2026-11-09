// phonecando-open: the @open line, what it refuses, and its fallback file,
// with every POSIX shell on the host.
//   node --test agents/kit/scripts/phonecando-open.test.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { run, shells } from './shells.mjs';

const SCRIPT = 'phonecando-open';

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-open-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { home: dir, events: join(dir, 'events') };
}

const lines = (file) => readFileSync(file, 'utf8').split('\n').slice(0, -1);

for (const shell of shells) {
  describe(`phonecando-open (${shell.name})`, () => {
    it('parses', () => {
      const [cmd, ...pre] = shell.argv;
      assert.equal(run({ argv: [cmd, ...pre, '-n'] }, SCRIPT, []).code, 0);
    });

    it('appends @open and the url', (t) => {
      const { events } = scratch(t);
      const url = 'https://example.com/device?code=AB-12&x=%20y';
      assert.equal(run(shell, SCRIPT, [url], { env: { PHONECANDO_EVENTS: events } }).code, 0);
      assert.equal(run(shell, SCRIPT, ['http://127.0.0.1:8080/cb'], { env: { PHONECANDO_EVENTS: events } }).code, 0);
      assert.deepEqual(lines(events), [`@open\t${url}`, '@open\thttp://127.0.0.1:8080/cb']);
    });

    it('takes a url of exactly 2 KiB', (t) => {
      const { events } = scratch(t);
      const url = `https://e.com/${'a'.repeat(2048 - 14)}`;
      assert.equal(url.length, 2048);
      assert.equal(run(shell, SCRIPT, [url], { env: { PHONECANDO_EVENTS: events } }).code, 0);
      assert.deepEqual(lines(events), [`@open\t${url}`]);
    });

    it('refuses a bad call with 64 and writes nothing', (t) => {
      const { events } = scratch(t);
      const bad = [
        [],
        ['https://a.com', 'extra'],
        ['ftp://a.com'],
        ['javascript:alert(1)'],
        ['https://'],
        ['a.com'],
        ['https://a.com/x y'],
        ['https://a.com/x\ty'],
        ['https://a.com/x\ny'],
        ['https://a.com/\x07'],
        [`https://e.com/${'a'.repeat(2048 - 13)}`],
      ];
      for (const args of bad) {
        assert.equal(run(shell, SCRIPT, args, { env: { PHONECANDO_EVENTS: events } }).code, 64, JSON.stringify(args));
      }
      assert.equal(existsSync(events), false);
    });

    it('falls back to $HOME/.phonecando/events, making the folder', (t) => {
      const { home } = scratch(t);
      assert.equal(run(shell, SCRIPT, ['https://a.com'], { env: { HOME: home } }).code, 0);
      assert.deepEqual(lines(join(home, '.phonecando/events')), ['@open\thttps://a.com']);
    });

    it('fails with 1 when it has nowhere to write', () => {
      assert.equal(run(shell, SCRIPT, ['https://a.com'], { env: {} }).code, 1);
    });
  });
}
