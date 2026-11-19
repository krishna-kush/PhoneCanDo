// A custom agent kind's mascot in its row (list/KindRows.tsx), picked by
// its id, so a kind keeps its face for as long as it keeps its id. Pure
// (zero RN imports).
import type { Look } from '../../../../../../mascot/look.ts';
import { allAgentLooks } from '../../../../state/logic/agentLooks.ts';
import { pickIndex } from '../../../common/keyPick.ts';

/** Its mascot: one of every look an agent may wear. */
export function kindLook(id: string): Look {
  const looks = allAgentLooks();
  return looks[pickIndex(id, looks.length)];
}
