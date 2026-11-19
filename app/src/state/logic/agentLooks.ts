// The looks an agent may wear in the app: any wearable design but plain,
// which is A-01's own (mascot/look.ts PLAIN, the brand mark): the face the
// app shows for itself and for an agent whose look is not picked yet, so no
// agent is mistaken for it. The site and videos still dress units in plain.
// Pure (zero RN imports).
import { DESIGNS, isWearable, type DesignId } from '../../../../mascot/designs.ts';
import { readLook, type Look } from '../../../../mascot/look.ts';
import { allLooks, assignLooks, pickLook } from '../../../../mascot/pick.ts';

const A01 = 'plain';

/** The designs an agent picks from, in the spec's order. */
export const AGENT_DESIGNS = DESIGNS.filter((d) => d.id !== A01);

/** A design an agent may wear here: wearable (mascot/designs.ts), and not A-01's. */
export const isAgentDesign = (id: unknown): id is DesignId => isWearable(id) && id !== A01;

/** An agent's look read back from storage, or null when it is not one an agent may wear here. */
export function readAgentLook(v: unknown): Look | null {
  const look = readLook(v);
  return look && isAgentDesign(look.design) ? look : null;
}

/** A look for a newcomer, unlike [taken] while that can last (mascot/pick.ts). */
export const pickAgentLook = (taken: readonly Look[], rand: () => number): Look => pickLook(taken, rand, AGENT_DESIGNS);

/** Looks for [ids], oldest first (mascot/pick.ts assignLooks). */
export const assignAgentLooks = (looks: Readonly<Record<string, Look>>, ids: readonly string[], rand: () => number) =>
  assignLooks(looks, ids, rand, AGENT_DESIGNS);

/** Every look an agent may wear. */
export const allAgentLooks = (): Look[] => allLooks(AGENT_DESIGNS);
