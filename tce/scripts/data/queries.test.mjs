import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AE_MAX_DAYS, aeStatements, assertReadOnly, d1Statements, windowOf } from './queries.mjs';

const NOW = Date.parse('2026-11-06T12:00:00Z');

test('windowOf: whole UTC days, today included', () => {
  const w = windowOf(NOW, 7);
  assert.equal(w.days.length, 7);
  assert.equal(w.days[0], '2026-10-31');
  assert.equal(w.today, '2026-11-06');
  assert.equal(w.since, Date.parse('2026-10-31T00:00:00Z'));
  assert.equal(windowOf(NOW, 1).days.join(), '2026-11-06');
});

test('d1Statements: unique names, single read-only SELECTs, the window in every time filter', () => {
  const s = d1Statements({ now: NOW, days: 30 });
  assert.equal(new Set(s.map((x) => x.name)).size, s.length);
  assertReadOnly(s);
  const since = String(windowOf(NOW, 30).since);
  for (const name of ['sessionsDaily', 'eventsDaily', 'eventNames', 'errorKeys', 'versions', 'models']) {
    assert.ok(s.find((x) => x.name === name).sql.includes(since), name);
  }
  assert.ok(s.find((x) => x.name === 'siteDaily').sql.includes("'2026-10-08'"));
});

test('d1Statements: tester devices are left out unless asked for', () => {
  const hidden = d1Statements({ now: NOW, days: 7 }).map((x) => x.sql).join('\n');
  const shown = d1Statements({ now: NOW, days: 7, testers: true }).map((x) => x.sql).join('\n');
  assert.match(hidden, /device_id NOT IN \(SELECT device_id FROM devices WHERE tester = 1\)/);
  assert.match(hidden, /FROM devices WHERE tester = 0/);
  assert.doesNotMatch(shown, /NOT IN/);
  assert.doesNotMatch(shown, /tester = 0/);
  // The tester count itself is always there.
  assert.match(shown, /WHERE tester = 1\) AS testers/);
});

test('aeStatements: capped at Analytics Engine retention, bots separable', () => {
  const s = aeStatements({ days: 365 });
  assertReadOnly(s);
  assert.ok(s.every((x) => x.sql.includes(`INTERVAL '${AE_MAX_DAYS}' DAY`)));
  assert.ok(s.find((x) => x.name === 'viewReferrers').sql.includes("blob4 != 'bot'"));
  assert.ok(aeStatements({ days: 7, pageviews: 'pv', downloads: 'dl' }).every((x) => /FROM (pv|dl) /.test(x.sql)));
});

test('assertReadOnly refuses writes and stacked statements', () => {
  assert.throws(() => assertReadOnly([{ name: 'x', sql: 'DELETE FROM events' }]), /only single SELECTs/);
  assert.throws(() => assertReadOnly([{ name: 'x', sql: 'SELECT 1; DROP TABLE events' }]), /only single SELECTs/);
  assert.doesNotThrow(() => assertReadOnly([{ name: 'x', sql: 'WITH a AS (SELECT 1) SELECT * FROM a' }]));
});
