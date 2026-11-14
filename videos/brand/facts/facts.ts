// The repo's facts, for a film's script: the same list in the picture and
// in the sound. `pnpm facts` writes the file this reads (write.ts).

import generated from './facts.gen.json' with { type: 'json' };
import type { Facts } from './collect.ts';

export const FACTS: Facts = generated;

export type { Facts };
