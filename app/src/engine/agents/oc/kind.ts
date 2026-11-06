// opencode as an agent kind (contract: ../types.ts).
import type { AgentKind } from '../types';
import { listSessions, pairUrl } from './client';
import { wipeData } from './data';
import { isIdle } from './idle';
import { tui } from './tui';
import { web } from './web';

export const opencodeKind: AgentKind = {
  id: 'opencode',
  label: 'opencode',
  listSessions,
  pairUrl,
  isIdle,
  web,
  tui,
  wipeData,
};
