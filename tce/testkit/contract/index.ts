// The behaviour every Store must have. A store's test file calls
// storeContract('<name>', make) once; every case gets a fresh store from
// make() and closes it afterwards. Checks go through the Store interface
// (listExpired exposes event/error rows, listSiteDaily the rollup, forget
// per-table counts, countReportsSince reports). When make() also returns
// `dump`, merged device, install, session, report and GitHub values are
// checked as well; without it those value checks are skipped. stores/memory
// is the reference. One file per concern registers its cases; harness.ts is
// what they share.

import { describe } from 'node:test';
import { applyBatchCases } from './apply-batch.ts';
import { forgetCases } from './forget.ts';
import { githubCases } from './github.ts';
import type { Make, StoreContractOptions } from './harness.ts';
import { mergeRuleCases } from './merge-rules.ts';
import { ownershipCases } from './ownership.ts';
import { reportCases } from './reports.ts';
import { retentionScanCases } from './retention-scans.ts';
import { siteDailyCases } from './site-daily.ts';
import { usageCases } from './usage.ts';

export type { MakeOptions, StoreContractOptions, StoreUnderTest } from './harness.ts';

/** Register the Store contract cases for one store under node:test. */
export function storeContract(name: string, make: Make, opts: StoreContractOptions = {}): void {
  describe(`Store contract: ${name}`, () => {
    applyBatchCases(make);
    mergeRuleCases(make);
    ownershipCases(make);
    reportCases(make);
    forgetCases(make);
    retentionScanCases(make);
    githubCases(make);
    siteDailyCases(make, opts);
    usageCases(make);
  });
}
