// The score's plan: its sections by kind, where each starts (from the
// film's shots and moments, so a retimed picture retimes the music), and
// the engine's plan of them: what plays from when to when, the two
// silences and the tape stop. All times in beats from the film's start.

import { planOf as layoutOf, type Change, type Plan as Layout, type Span as Stretch } from '../../../engine/sound/score/plan.ts';
import { START } from '../beats.ts';
import { MOMENTS } from '../script/moments.ts';

/** The sections, by kind: what each one plays. The rests between them, `gap` and `stop`, are the engine's. */
export const KINDS = {
  lights: 'A dark room: a bare A and E pad, a clock’s tick, the narrator’s theme alone. Each lamp is a note of the hook; then the tiptoe starts.',
  crew: 'The tiptoe: plucked bass on 1 and 3, ticks between. A marimba run, a note a unit; the hook’s first whole bar, plucked; a line climbing the ladder.',
  tools: 'The narrator in the dark, cut short; then the machine room: kick, 16th hats, a 16th bass on A, rims, quiet fast arps, a slide whistle for the fix.',
  march: 'A small march: snare 8ths, plucked bass, the hook on the lead, the narrator under it. It trips down the scale as the crew piles up at the gate.',
  open: 'The scan: a pad swelling on E, a heartbeat. Then A major: a stab, bells, the hook’s opening as a cheer, and a roll up to the build.',
  chores: 'The build: a kick on every beat, 8th bass, the arp opening up, a stab climbing Am, C, D, E on each stamp, a snare roll. Cut dead at its end.',
  hush: 'The narrator alone, very quiet, until the needle is tapped.',
  drop: 'The whole phone dancing: four on the floor, claps, open hats, offbeat bass and stabs, the hook on the lead and the marimba.',
  dawn: 'A chase: the hook at double speed, plucked, over a galloping bass, dying away. Lights out, a tiptoe for the hat; then C major, and a music box.',
  end: 'Home, in C major: the narrator’s theme whole, the hook on marimba and bell, soft drums, a last chord left to ring.',
} as const;

export type Kind = keyof typeof KINDS;

export type Span = Stretch<Kind>;

export type Plan = Layout<Span>;

const m = MOMENTS;

/** Where each section starts. The stare at the gate and the taps before the drop are silence; the bell stops the tape. */
export const CHANGES: readonly Change<Kind>[] = [
  { at: START.lights, section: 'lights' },
  { at: START.crew, section: 'crew' },
  { at: START.tools, section: 'tools' },
  { at: START.gate, section: 'march' },
  { at: m.gate.look, section: 'gap' },
  { at: m.gate.scan[0], section: 'open' },
  { at: START.chores, section: 'chores' },
  { at: m.song.line, section: 'hush' },
  { at: m.song.taps[0], section: 'gap' },
  { at: m.song.drop, section: 'drop' },
  { at: m.dawn.bell[0], section: 'stop' },
  { at: m.dawn.scramble[0], section: 'dawn' },
  { at: START.end, section: 'end' },
];

/** Kinds cut dead where they end: nothing they play, and no echo of it, sounds past their last beat. */
const CUT_DEAD: readonly Kind[] = ['chores'];

/** The plan of [changes] over [total] beats. */
export function planOf(changes: readonly Change<Kind>[], total: number): Plan {
  const layout = layoutOf(changes, total);
  const cuts = new Set(layout.cuts);
  const spans = layout.spans.map((s) => {
    if (!CUT_DEAD.includes(s.kind)) return s;
    cuts.add(s.to);
    return { ...s, limit: Math.min(s.limit, s.to) };
  });
  return { ...layout, spans, cuts: [...cuts].sort((a, b) => a - b) };
}
