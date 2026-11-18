// cf-d1.mjs with a stub spawn: the arguments cf gets and how its answers are
// read. cf itself never runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cfD1Args, cfD1Query } from './cf-d1.mjs';

const ID = '00000000-0000-4000-8000-000000000000';

/** A spawn that records its calls and answers `answer` ({ status, stdout, stderr, error }). */
function stub(answer) {
  const calls = [];
  const spawn = (cmd, args) => {
    calls.push([cmd, ...args]);
    return { status: 0, stdout: '', stderr: '', ...answer };
  };
  return { spawn, calls };
}

test('values go as --params after the SQL, never into it; none: no --params', () => {
  assert.deepEqual(cfD1Args(ID, 'SELECT 1 WHERE ? = ?', ['a b', 7]), ['d1', 'query', ID, '--sql', 'SELECT 1 WHERE ? = ?', '--params', 'a b', '7']);
  assert.deepEqual(cfD1Args(ID, 'SELECT 1'), ['d1', 'query', ID, '--sql', 'SELECT 1']);
  assert.throws(() => cfD1Args(ID, 'SELECT ?', ['--json']), /cannot start with '-'/);
});

test('one row array per statement, from the bare or the wrapped result', () => {
  const sets = [{ success: true, results: [{ n: 1 }] }, { success: true }];
  for (const stdout of [JSON.stringify(sets), JSON.stringify({ result: sets })]) {
    const s = stub({ stdout });
    assert.deepEqual(cfD1Query(ID, 'SELECT 1;\nSELECT 2', [], { spawn: s.spawn }), [[{ n: 1 }], []]);
    assert.deepEqual(s.calls, [['cf', 'd1', 'query', ID, '--sql', 'SELECT 1;\nSELECT 2']]);
  }
});

test("failures throw in cf's own words", () => {
  const run = (answer) => () => cfD1Query(ID, 'SELECT 1', [], { spawn: stub(answer).spawn });
  assert.throws(run({ error: Object.assign(new Error('spawn cf ENOENT'), { code: 'ENOENT' }) }), /not on PATH/);
  assert.throws(run({ status: 1, stderr: '✘ ERROR: no such table: campaigns: SQLITE_ERROR' }), /exited 1:\n.*no such table: campaigns/);
  assert.throws(run({ stdout: 'Logged in as …' }), /something other than JSON/);
  assert.throws(run({ stdout: '{}' }), /no result sets/);
  assert.throws(run({ stdout: JSON.stringify([{ success: false, error: 'boom' }]) }), /statement 1 failed: "boom"/);
});
