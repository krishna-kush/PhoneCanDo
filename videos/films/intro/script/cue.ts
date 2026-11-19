// A sound on a script's beat line, from its scene's start: the engine's
// cue, named from its effects (engine/sound/effects/names.ts).

import type { Cue as BeatCue } from '../../../engine/beats/cue.ts';
import type { EffectName } from '../../../engine/sound/effects/names.ts';

export type Cue = BeatCue<EffectName>;
