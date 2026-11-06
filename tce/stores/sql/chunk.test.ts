import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  STATEMENT_LIMITS,
  buildInserts,
  buildKeyedDeletes,
  packStatements,
  placeholders,
  statementBytes,
  toSqlValue,
  utf8Length,
} from './chunk.ts';
import type { SqlTuple } from './chunk.ts';
import { splitSqlStatements } from './split.ts';
import { DEVICES, ERRORS, EVENTS, SESSIONS } from './tables.ts';
import { deviceRow, errorRow, eventRow, sessionRow } from '../../testkit/fixtures.ts';

describe('utf8Length', () => {
  test('matches Buffer.byteLength for 1-, 2-, 3- and 4-byte characters', () => {
    for (const s of ['', 'abc', 'é', 'ñandú', '日本語', '🙂', 'a🙂b€', 'x'.repeat(1000)]) {
      assert.equal(utf8Length(s), Buffer.byteLength(s, 'utf8'), s);
    }
  });

  test('counts a lone surrogate as U+FFFD (3 bytes), like the encoder', () => {
    assert.equal(utf8Length('\ud800'), 3);
    assert.equal(utf8Length('a\udc00b'), 5);
    assert.equal(utf8Length('\ud800'), Buffer.byteLength('\ud800', 'utf8'));
  });
});

describe('packStatements', () => {
  const tuple = (params: (string | number | null)[]): SqlTuple => ({ text: placeholders(params.length), params });

  test('never binds more than maxParams per statement and keeps every value in order', () => {
    const tuples = Array.from({ length: 500 }, (_, i) => tuple([i, `r${i}`, null, i * 2, 'x', 'y', 'z', 1, 2]));
    const stmts = packStatements('INSERT INTO t VALUES ', ', ', '', tuples);
    assert.equal(stmts.length, Math.ceil(500 / 11)); // 9 params per row -> 11 rows per statement
    for (const s of stmts) {
      assert.ok(s.params.length <= STATEMENT_LIMITS.maxParams, `${s.params.length} params`);
      assert.equal((s.sql.match(/\?/g) ?? []).length, s.params.length);
    }
    assert.deepEqual(
      stmts.flatMap((s) => s.params),
      tuples.flatMap((t) => t.params),
    );
  });

  test('splits on the byte limit before the parameter limit when rows are large', () => {
    const big = 'é'.repeat(5_000); // 10,000 bytes
    const tuples = Array.from({ length: 30 }, (_, i) => tuple([i, big]));
    const stmts = packStatements('INSERT INTO t VALUES ', ', ', ' ON CONFLICT DO NOTHING', tuples);
    assert.ok(stmts.length > 1);
    for (const s of stmts) assert.ok(statementBytes(s) <= STATEMENT_LIMITS.maxBytes, `${statementBytes(s)} bytes`);
    assert.equal(
      stmts.reduce((n, s) => n + s.params.length / 2, 0),
      30,
    );
    // Greedy: every statement but the last is full enough that one more row would not fit.
    for (const s of stmts.slice(0, -1)) assert.ok(statementBytes(s) + 10_000 > STATEMENT_LIMITS.maxBytes);
  });

  test('honours custom limits exactly at the boundary', () => {
    const tuples = Array.from({ length: 7 }, (_, i) => tuple([i, i]));
    const stmts = packStatements('X ', ',', '', tuples, { maxParams: 4, maxBytes: 1_000 });
    assert.deepEqual(
      stmts.map((s) => s.params.length),
      [4, 4, 4, 2],
    );
    // Byte cap: "X " (2) + "(?, ?)" (6) + two numbers (16) = 24 for one row, +1 sep +22 for the second.
    const bytesCapped = packStatements('X ', ',', '', tuples, { maxParams: 100, maxBytes: 47 });
    assert.deepEqual(
      bytesCapped.map((s) => s.params.length),
      [4, 4, 4, 2],
    );
    for (const s of bytesCapped) assert.ok(statementBytes(s) <= 47);
  });

  test('gives a single oversized row its own statement instead of dropping it', () => {
    const huge = 'a'.repeat(STATEMENT_LIMITS.maxBytes + 10);
    const stmts = packStatements('INSERT INTO t VALUES ', ', ', '', [tuple([1]), tuple([huge]), tuple([3])]);
    assert.equal(stmts.length, 3);
    assert.deepEqual(stmts[1]!.params, [huge]);
  });

  test('rejects one tuple that binds more than maxParams', () => {
    assert.throws(() => packStatements('X ', ',', '', [tuple([1, 2, 3])], { maxParams: 2, maxBytes: 1000 }), RangeError);
  });

  test('returns nothing for no tuples', () => {
    assert.deepEqual(packStatements('X ', ',', '', []), []);
  });
});

describe('buildInserts', () => {
  test('events: 9 columns -> 11 rows per statement, upsert-free insert-or-ignore', () => {
    const rows = Array.from({ length: 23 }, (_, i) => eventRow({ seq: i }));
    const stmts = buildInserts(EVENTS, rows);
    assert.deepEqual(
      stmts.map((s) => s.params.length / 9),
      [11, 11, 1],
    );
    assert.match(
      stmts[0]!.sql,
      /^INSERT INTO events \(session_id, seq, install_id, device_id, name, props, ts_client, ts, received\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?\)(, \(\?(, \?){8}\)){10} ON CONFLICT \(session_id, seq\) DO NOTHING$/,
    );
  });

  test('errors: 14 columns -> 7 rows per statement; sessions: 19 -> 5', () => {
    assert.deepEqual(
      buildInserts(ERRORS, Array.from({ length: 50 }, (_, i) => errorRow({ error_id: `e${i}` }))).map((s) => s.params.length / 14),
      [7, 7, 7, 7, 7, 7, 7, 1],
    );
    assert.deepEqual(
      buildInserts(SESSIONS, Array.from({ length: 20 }, (_, i) => sessionRow({ session_id: `s${i}` }))).map((s) => s.params.length / 19),
      [5, 5, 5, 5],
    );
  });

  test('binds columns in spec order, nulls as null', () => {
    const [stmt] = buildInserts(DEVICES, [deviceRow({ drm_id: null, asn: null })]);
    const row = deviceRow({ drm_id: null, asn: null });
    assert.deepEqual(
      stmt!.params,
      DEVICES.columns.map((c) => row[c]),
    );
    assert.match(stmt!.sql, /^INSERT INTO devices \(device_id, verifier, hw_hash, drm_id, .*last_seen\) VALUES \(\?(, \?){14}\) ON CONFLICT \(device_id\) DO UPDATE SET /);
  });

  test('returns nothing for no rows', () => {
    assert.deepEqual(buildInserts(EVENTS, []), []);
  });
});

describe('buildKeyedDeletes', () => {
  test('single-column key uses IN (?, ...), up to 100 keys per statement', () => {
    const keys = Array.from({ length: 150 }, (_, i) => [`e${i}`]);
    const stmts = buildKeyedDeletes('errors', ['error_id'], keys);
    assert.deepEqual(
      stmts.map((s) => s.params.length),
      [100, 50],
    );
    assert.equal(stmts[1]!.sql, `DELETE FROM errors WHERE error_id IN (${Array(50).fill('?').join(', ')})`);
  });

  test('composite key uses row values, up to 50 keys per statement', () => {
    const keys = Array.from({ length: 120 }, (_, i) => ['s', i]);
    const stmts = buildKeyedDeletes('events', ['session_id', 'seq'], keys);
    assert.deepEqual(
      stmts.map((s) => s.params.length / 2),
      [50, 50, 20],
    );
    assert.match(stmts[2]!.sql, /^DELETE FROM events WHERE \(session_id, seq\) IN \(VALUES \(\?, \?\)(, \(\?, \?\)){19}\)$/);
  });

  test('returns nothing for no keys', () => {
    assert.deepEqual(buildKeyedDeletes('errors', ['error_id'], []), []);
  });
});

describe('toSqlValue', () => {
  test('passes strings, numbers and null; maps booleans and undefined', () => {
    assert.equal(toSqlValue('a', 'c'), 'a');
    assert.equal(toSqlValue(0, 'c'), 0);
    assert.equal(toSqlValue(null, 'c'), null);
    assert.equal(toSqlValue(undefined, 'c'), null);
    assert.equal(toSqlValue(true, 'c'), 1);
    assert.equal(toSqlValue(false, 'c'), 0);
  });

  test('throws on values a column cannot hold', () => {
    assert.throws(() => toSqlValue(Number.NaN, 'c'), /non-finite/);
    assert.throws(() => toSqlValue(Infinity, 'c'), /non-finite/);
    assert.throws(() => toSqlValue({}, 'c'), /cannot bind/);
    assert.throws(() => toSqlValue(1n, 'c'), /cannot bind/);
  });
});

describe('splitSqlStatements', () => {
  test('splits the shared migration into its 13 statements without comments', () => {
    const sql = readFileSync(new URL('./migrations/0001_init.sql', import.meta.url), 'utf8');
    const stmts = splitSqlStatements(sql);
    assert.equal(stmts.length, 13);
    assert.equal(stmts.filter((s) => s.startsWith('CREATE TABLE')).length, 8);
    assert.equal(stmts.filter((s) => s.startsWith('CREATE INDEX')).length, 5);
    for (const s of stmts) {
      assert.ok(!s.includes('--'), s);
      assert.ok(!s.endsWith(';'), s);
    }
  });

  test('splits migration 0002 into its column and three indexes', () => {
    const sql = readFileSync(new URL('./migrations/0002_ownership_indexes.sql', import.meta.url), 'utf8');
    assert.deepEqual(splitSqlStatements(sql), [
      'ALTER TABLE devices ADD COLUMN verifier TEXT',
      'CREATE INDEX errors_device ON errors (device_id)',
      'CREATE INDEX reports_device ON reports (device_id)',
      'CREATE INDEX reports_received ON reports (received)',
    ]);
  });

  test('keeps semicolons and comment markers inside strings and quoted identifiers', () => {
    assert.deepEqual(splitSqlStatements(`INSERT INTO t VALUES ('a;b', 'it''s -- not a comment'); SELECT "x;y", [z;w], \`q;r\` FROM t;`), [
      `INSERT INTO t VALUES ('a;b', 'it''s -- not a comment')`,
      'SELECT "x;y", [z;w], `q;r` FROM t',
    ]);
  });

  test('drops line and block comments and empty statements', () => {
    assert.deepEqual(splitSqlStatements('-- head\n/* a; b */ SELECT 1; ;; -- tail ;\nSELECT 2 /* ; */'), ['SELECT 1', 'SELECT 2']);
  });

  test('keeps a trigger body (with CASE ... END) in one statement', () => {
    const sql = `CREATE TEMP TRIGGER tr AFTER INSERT ON t BEGIN
      UPDATE t SET x = CASE WHEN new.y > 0 THEN 1 ELSE 0 END WHERE id = new.id;
      DELETE FROM u;
    END;
    SELECT 1;`;
    const stmts = splitSqlStatements(sql);
    assert.equal(stmts.length, 2);
    assert.match(stmts[0]!, /^CREATE TEMP TRIGGER tr .*DELETE FROM u;\s+END$/s);
    assert.equal(stmts[1], 'SELECT 1');
  });
});
