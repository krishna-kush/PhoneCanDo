// The guide who leads the way on a walk: A-09, one of our own A-series
// characters (mascot/designs.ts OURS), never the agent it shows you round,
// so its face and serial are its own: a wide red unit with a signpost on
// its head, its arrow pointing the way it looks. No agent can take an
// A-series serial (state/flows/logic/names.ts) nor wear its outfit
// (mascot/look.ts readLook, state/mascots.ts setLook). Pure.
import type { Look } from '../../../../../mascot/look.ts';

export const GUIDE_SERIAL = 'A-09';

export const GUIDE_LOOK: Look = { design: 'a09', shape: 'wide', swap: false };
