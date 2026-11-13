import { accountsScenarios } from '../../testkit/scenarios.ts';
import { createMemoryStore } from './index.ts';

accountsScenarios('memory store', createMemoryStore);
