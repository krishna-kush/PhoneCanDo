import { fakeD1, openTestDb } from '../../testkit/sqlite.ts';
import { accountsScenarios } from '../../testkit/scenarios.ts';
import { createSqlStore } from '../sql/store.ts';
import { createD1Driver } from './index.ts';

accountsScenarios('sql store on a D1 binding', () => createSqlStore(createD1Driver(fakeD1(openTestDb()))));
