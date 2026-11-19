// The faces on the Choose agent step: each kind on offer stands there as
// an applicant wearing a mascot, a look unlike every agent's here and each
// other's (state/logic/agentLooks.ts), and the one picked is the look the new agent
// keeps (state/flows/newAgent.ts). Pure (zero RN imports).
import type { Look } from '../../../../../../../mascot/look.ts';
import { pickAgentLook } from '../../../../../state/logic/agentLooks.ts';

/**
 * A look for each id in [ids]: one in [kept] stays; a new one is picked
 * unlike [taken] (the agents' looks) and the applicants' so far. [kept]
 * itself comes back when nothing changed.
 */
export function applicantLooks(
  ids: readonly string[],
  kept: Readonly<Record<string, Look>>,
  taken: readonly Look[],
  rand: () => number,
): Readonly<Record<string, Look>> {
  const next: Record<string, Look> = {};
  const worn = [...taken, ...ids.flatMap((id) => (kept[id] ? [kept[id]] : []))];
  let changed = Object.keys(kept).some((id) => !ids.includes(id));
  for (const id of ids) {
    if (kept[id]) {
      next[id] = kept[id];
      continue;
    }
    next[id] = pickAgentLook(worn, rand);
    worn.push(next[id]);
    changed = true;
  }
  return changed ? next : kept;
}
