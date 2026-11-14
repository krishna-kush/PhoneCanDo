// Every section kind of the score, by name: the notes it plays over its
// span of the plan. A kind added to the plan (plan.ts) fails tsc here
// until it is written. The rests play nothing: the mix makes them.

import type { Note } from '../notes.ts';
import type { Kind, Span } from '../plan.ts';
import { chores } from './chores.ts';
import { crew } from './crew.ts';
import { dawn } from './dawn.ts';
import { drop } from './drop.ts';
import { end } from './end.ts';
import { hush } from './hush.ts';
import { lights } from './lights.ts';
import { march } from './march.ts';
import { open } from './open.ts';
import { tools } from './tools.ts';

export const NOTES: Record<Kind, (span: Span) => Note[]> = { lights, crew, tools, march, open, chores, hush, drop, dawn, end };
