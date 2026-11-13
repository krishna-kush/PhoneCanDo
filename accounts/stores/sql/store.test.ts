import { openTestDb, sqliteDriver } from '../../testkit/sqlite.ts';
import { accountsScenarios } from '../../testkit/scenarios.ts';
import { createSqlStore } from './store.ts';

accountsScenarios('sql store on node:sqlite', () => createSqlStore(sqliteDriver(openTestDb())));
