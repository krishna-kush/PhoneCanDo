// Every section kind that makes sound, by name. Silence (stop, gap) is the
// mix's (mix/silence.ts, mix/tapestop.ts). A kind added to the timeline
// fails tsc here until it is played.

import type { Playing } from '../plan.ts';
import type { Ctx } from '../play.ts';
import { breakdown } from './breakdown.ts';
import { build } from './build.ts';
import { drop, finale } from './groove.ts';
import { halftime } from './halftime.ts';
import { intro } from './intro.ts';
import { lift } from './lift.ts';
import { outro } from './outro.ts';
import { tech } from './tech.ts';

export const PLAY: Record<Playing, (ctx: Ctx) => void> = { intro, build, drop, tech, halftime, breakdown, lift, finale, outro };
