import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missingNewTable, readWithNewTables } from './new-tables.mjs';
import { NEW_TABLES } from './queries.mjs';

test('missingNewTable: the D1 messages each source throws, only for our new tables', () => {
  // tokenSource (REST), namedResults (a failed statement's JSON) and the cf CLI.
  assert.equal(missingNewTable('D1: HTTP 400: no such table: campaign_daily: SQLITE_ERROR'), 'campaign_daily');
  assert.equal(missingNewTable('cf d1 query exited 1: ✘ [ERROR] no such table: campaigns: SQLITE_ERROR [code: 7500]'), 'campaigns');
  assert.equal(missingNewTable('query "campaignList" failed: {"message":"no such table: main.campaigns"}'), 'campaigns');
  assert.equal(missingNewTable('cf d1 query exited 1: ✘ ERROR: No such table: campaign_daily'), 'campaign_daily');
  assert.equal(missingNewTable('D1: HTTP 400: no such table: share_links: SQLITE_ERROR'), null);
  assert.equal(missingNewTable('D1: HTTP 403: Authentication error (the token needs D1: Read)'), null);
  assert.equal(missingNewTable(undefined), null);
});

test('readWithNewTables: one read when the tables are there', async () => {
  const calls = [];
  const r = await readWithNewTables(async (missing) => {
    calls.push(missing);
    return { results: { a: [] }, rowsRead: 7 };
  });
  assert.deepEqual(calls, [[]]);
  assert.deepEqual(r, { results: { a: [] }, rowsRead: 7, missing: [] });
});

/** A read on a database that lacks `absent`: D1 names the first absent table the batch reads (newest first, as d1Statements orders it). */
function databaseWithout(absent) {
  const calls = [];
  const read = async (missing) => {
    calls.push(missing);
    const named = [...NEW_TABLES].reverse().find((t) => absent.includes(t) && !missing.includes(t));
    if (named) throw new Error(`D1: HTTP 400: no such table: ${named}: SQLITE_ERROR`);
    return { results: {}, rowsRead: 3 };
  };
  return { read, calls };
}

test('readWithNewTables: only campaigns missing leaves out only it', async () => {
  const db = databaseWithout(['campaigns']);
  const r = await readWithNewTables(db.read);
  assert.deepEqual(db.calls, [[], ['campaigns']]);
  assert.deepEqual(r.missing, ['campaigns']);
  assert.equal(r.rowsRead, 3);
});

test('readWithNewTables: before 0005, one more read per missing table, until all are left out', async () => {
  const db = databaseWithout(NEW_TABLES);
  const r = await readWithNewTables(db.read);
  assert.deepEqual(db.calls, [[], ['campaigns'], ['campaigns', 'campaign_daily']]);
  assert.deepEqual([...r.missing].sort(), [...NEW_TABLES].sort());
});

test('readWithNewTables: a table already left out named again is a failure, not another read', async () => {
  let calls = 0;
  const read = async () => {
    calls++;
    throw new Error('no such table: campaigns');
  };
  await assert.rejects(readWithNewTables(read), /no such table: campaigns/);
  assert.equal(calls, 2);
});

test('readWithNewTables: any other failure rejects as before, with no second read', async () => {
  let calls = 0;
  const read = async () => {
    calls++;
    throw new Error('D1: HTTP 403: Authentication error');
  };
  await assert.rejects(readWithNewTables(read), /Authentication error/);
  assert.equal(calls, 1);
  // A second failure after a missing table is that failure.
  await assert.rejects(
    readWithNewTables(async (missing) => {
      throw new Error(missing.length ? 'request failed: timed out after 30 s' : 'no such table: campaign_daily');
    }),
    /timed out/,
  );
});
