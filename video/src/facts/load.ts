// The facts the timeline needs from the repo, read once.

import type { Facts } from '../timeline/script/types.ts';
import { agentLabels } from './agents.ts';
import { REPO } from './repo.ts';

export const loadFacts = (): Facts => ({ agents: agentLabels(REPO) });
