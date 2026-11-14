// Every scene on the timeline, drawn: one view each, a few sharing a
// picture across two scripts (the asks in chores and scratch, the reel in
// reel and end).

import type { SceneId } from '../../timeline/scenes.ts';
import { makeAgents } from './agents.ts';
import { makeApart } from './apart.ts';
import { makeAsks } from './asks.ts';
import { makeCrew } from './crew.ts';
import { makeFinale } from './finale.ts';
import { makeGhost } from './ghost.ts';
import { makeLocked } from './locked.ts';
import { makeNight } from './night.ts';
import { makeReveal } from './reveal.ts';
import type { Ctx, View } from './scene.ts';
import { makeStamps } from './stamps.ts';
import { makeTerminal } from './terminal.ts';
import { makeTitle } from './title.ts';

export function makeViews(ctx: Ctx): Record<SceneId, View> {
  const asks = makeAsks(ctx);
  const finale = makeFinale(ctx);
  return {
    ghost: makeGhost(ctx),
    reveal: makeReveal(ctx),
    title: makeTitle(ctx),
    chores: asks.chores,
    scratch: asks.scratch,
    apart: makeApart(ctx),
    terminal: makeTerminal(ctx),
    agents: makeAgents(ctx),
    crew: makeCrew(ctx),
    night: makeNight(ctx),
    locked: makeLocked(ctx),
    stamps: makeStamps(ctx),
    reel: finale.reel,
    end: finale.end,
  };
}
