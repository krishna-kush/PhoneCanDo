// testkit's Store contract against the node:sqlite store: in memory, and on a
// WAL file, each case on a fresh database. For the failing-sink case the store
// is assembled from the same database and driver with a points sink that throws.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import type { Logger } from '../../core/op.ts';
import type { TableName } from '../../core/schema/rows.ts';
import { storeContract } from '../../testkit/contract/index.ts';
import type { MakeOptions, StoreUnderTest } from '../../testkit/contract/index.ts';
import { createSqlStore } from '../sql/store.ts';
import type { PointsSink } from '../sql/store.ts';
import { createSqliteStore, openSqliteDatabase } from './store.ts';

const tmp = mkdtempSync(join(tmpdir(), 'tce-sqlite-contract-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;

// The contract's all-or-nothing and failing-sink cases make the store log on purpose.
const quiet: Logger = { info() {}, warn() {}, error() {} };

/** A points sink whose every write throws. */
const FAILING_SINK: PointsSink = {
  page() {
    throw new Error('points table unavailable');
  },
  download() {
    throw new Error('points table unavailable');
  },
};

/** A fresh store at `path` with a dump hook on the same connection. */
function make(path: (i: number) => string): (opts?: MakeOptions) => Promise<StoreUnderTest> {
  return async (opts: MakeOptions = {}) => {
    const file = path(n++);
    if (opts.failingPointSink) {
      const h = openSqliteDatabase(file);
      return {
        store: createSqlStore(h.driver, { points: FAILING_SINK }, quiet),
        close: async () => h.close(),
        dump: (table: TableName) => h.driver.all<object>(`SELECT * FROM ${table}`, []),
      };
    }
    const s = createSqliteStore(file, { log: quiet });
    return {
      store: s.store,
      close: s.close,
      dump: (table: TableName) => s.driver.all<object>(`SELECT * FROM ${table}`, []),
    };
  };
}

storeContract('sqlite (:memory:)', make(() => ':memory:'), { pointSinkFailure: true });
storeContract('sqlite (WAL file)', make((i) => join(tmp, `contract-${i}.db`)), { pointSinkFailure: true });
