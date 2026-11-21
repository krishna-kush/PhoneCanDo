// ./manage campaign against a stub cf (campaigns-d1.mjs with its own spawn):
// the cf lines add and list send, what they print, what they refuse before
// any cf call, and a database without migration 0005. cf never runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TAG, campaignLink } from './campaigns.mjs';
import { campaignsD1 } from './campaigns-d1.mjs';
import { campaign } from './commands/campaign.mjs';
import { Stop, UsageError } from './errors.mjs';
import { main } from './main.mjs';

const TODAY = '2026-11-18';
const DB = '00000000-0000-4000-8000-0000000000db';

/**
 * A fake D1 behind a stub spawn: the campaigns rows in `rows` (null: no
 * table, as before migration 0005). `calls` records every cf argv.
 */
function fakeCf(rows = []) {
  const calls = [];
  const answer = (results) => ({ status: 0, stdout: JSON.stringify([{ success: true, results, meta: {} }]), stderr: '' });
  const spawn = (cmd, args) => {
    calls.push([cmd, ...args]);
    if (rows === null) return { status: 1, stdout: '', stderr: '✘ [ERROR] no such table: campaigns: SQLITE_ERROR [code: 7500]' };
    const sql = args[args.indexOf('--sql') + 1];
    const at = args.indexOf('--params');
    const params = at < 0 ? [] : args.slice(at + 1);
    if (sql.startsWith('SELECT') && sql.includes('WHERE tag = ?')) return answer(rows.filter((r) => r.tag === params[0]));
    if (sql.startsWith('SELECT')) return answer([...rows].sort((a, b) => a.added.localeCompare(b.added) || a.tag.localeCompare(b.tag)));
    if (sql.startsWith('INSERT')) {
      rows.push({ tag: params[0], note: params[1], added: params[2] });
      return answer([]);
    }
    return { status: 1, stdout: '', stderr: `unexpected SQL: ${sql}` };
  };
  return { spawn, calls, rows };
}

/** Runs the command on `cf`; returns what it printed. */
function run(cf, args) {
  const out = [];
  const { log } = console;
  console.log = (...line) => out.push(line.join(' '));
  try {
    campaign(args, { d1: campaignsD1({ spawn: cf.spawn, databaseId: DB }), today: TODAY });
  } finally {
    console.log = log;
  }
  return out.join('\n').replace(/\x1b\[\d+m/g, '');
}

test('add: checks the tag is new, inserts it with today (UTC) as --params, prints its link and that it counts now', () => {
  const cf = fakeCf();
  const out = run(cf, ['add', 'hn', '  Hacker News launch post ']);
  assert.deepEqual(cf.calls, [
    ['cf', 'd1', 'query', DB, '--sql', 'SELECT tag, note, added FROM campaigns WHERE tag = ?', '--params', 'hn'],
    ['cf', 'd1', 'query', DB, '--sql', 'INSERT INTO campaigns (tag, note, added) VALUES (?, ?, ?)', '--params', 'hn', 'Hacker News launch post', TODAY],
  ]);
  assert.deepEqual(cf.rows, [{ tag: 'hn', note: 'Hacker News launch post', added: TODAY }]);
  assert.match(out, /https:\/\/phonecando\.app\/\?c=hn/);
  assert.match(out, /counts from now on/);
  assert.match(out, /nothing to commit or push/);
});

test('add: a tag already listed stops before the insert and says when it was added', () => {
  const cf = fakeCf([{ tag: 'hn', note: 'HN', added: '2026-11-01' }]);
  assert.throws(() => run(cf, ['add', 'hn', 'again']), (e) => e instanceof Stop && /already listed \(added 2026-11-01\)/.test(e.message));
  assert.equal(cf.calls.length, 1);
  assert.equal(cf.rows.length, 1);
});

test('add: a bad tag, no note, a leading dash or a bad line is a usage error before any cf call', () => {
  const cf = fakeCf();
  for (const tag of ['HN', 'h n', 'hn!', '', 'a'.repeat(25), 'ünï']) assert.throws(() => run(cf, ['add', tag, 'note']), UsageError, tag);
  assert.throws(() => run(cf, ['add', 'new', '   ']), UsageError);
  assert.throws(() => run(cf, ['add', '-x', 'note']), UsageError);
  assert.throws(() => run(cf, ['add', 'new', '--sql DROP']), UsageError);
  assert.throws(() => run(cf, ['add', 'only-tag']), UsageError);
  assert.throws(() => run(cf, ['list', 'x']), UsageError);
  assert.throws(() => run(cf, ['nope']), UsageError);
  assert.deepEqual(cf.calls, []);
});

test('list: tag, note, day added and link, oldest first; an empty list says how to add one', () => {
  const cf = fakeCf([
    { tag: 'reddit', note: 'r/androiddev thread', added: '2026-11-20' },
    { tag: 'hn', note: 'Hacker News launch post', added: '2026-11-18' },
  ]);
  const out = run(cf, ['list']);
  assert.deepEqual(cf.calls, [['cf', 'd1', 'query', DB, '--sql', 'SELECT tag, note, added FROM campaigns ORDER BY added, tag']]);
  assert.match(out, /^hn {6}Hacker News launch post {2}added 2026-11-18 {2}https:\/\/phonecando\.app\/\?c=hn$/m);
  assert.ok(out.indexOf('hn') < out.indexOf('reddit'));
  assert.match(run(fakeCf(), ['list']), /No campaigns yet: \.\/manage campaign add <tag> "<note>"/);
});

test('before migration 0005: add and list say so and how to apply it, and never run it', () => {
  for (const args of [['list'], ['add', 'hn', 'note']]) {
    const cf = fakeCf(null);
    assert.throws(
      () => run(cf, args),
      (e) => e instanceof Stop && /migration 0005 is not applied/.test(e.message) && e.message.includes(`cf d1 migrations apply ${DB} --dir tce/stores/sql/migrations`),
      args.join(' '),
    );
    assert.equal(cf.calls.length, 1);
    assert.ok(!cf.calls.some((c) => c.includes('migrations')));
  }
});

test('a failed cf run stops with its words', () => {
  const spawn = () => ({ status: 1, stdout: '', stderr: 'Authentication error [code: 10000]' });
  assert.throws(() => campaign(['list'], { d1: campaignsD1({ spawn, databaseId: DB }) }), (e) => e instanceof Stop && /exited 1:\nAuthentication error/.test(e.message));
});

test('the tag rule and link match the contract', () => {
  assert.equal(TAG.source, '^[a-z0-9-]{1,24}$');
  assert.equal(campaignLink('launch-2'), 'https://phonecando.app/?c=launch-2');
});

test('./manage campaign: bad lines exit 2 before any cf call', () => {
  // Why the empty PATH: a cf call these lines must never make cannot reach a real cf either.
  const { error } = console;
  const path = process.env.PATH;
  console.error = () => {};
  process.env.PATH = '';
  try {
    for (const argv of [['campaign'], ['campaign', 'add', 'Bad Tag', 'note'], ['campaign', 'add', 'hn'], ['campaign', 'add', 'hn', ' '], ['campaign', 'list', 'x']]) {
      assert.equal(main(argv), 2, argv.join(' '));
    }
  } finally {
    console.error = error;
    process.env.PATH = path;
  }
});
