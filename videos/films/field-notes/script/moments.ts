// Field Notes' moments: every beat something happens on, by name, in beats
// from the film's start. The picture moves on these, the effects land on
// them and the score is written to them, so retiming a gag here retimes
// all three. Pure numbers.

import { FACTS } from '../../../brand/facts/facts.ts';
import { START } from '../beats.ts';

/** [n] moments from [from], [step] beats apart. */
const every = (n: number, from: number, step: number) => Array.from({ length: n }, (_, i) => from + i * step);

/** How many units pop out after A-01: one for every agent kind there is, less A-01 itself (thirteen today). */
export const OTHERS = FACTS.agents.length - 1;

const lights = START.lights;
const crew = START.crew;
const tools = START.tools;
const gate = START.gate;
const chores = START.chores;
const song = START.song;
const dawn = START.dawn;
const end = START.end;

export const MOMENTS = {
  lights: {
    /** The narrator's line is there from the first frame. */
    line: lights,
    /** A-01 opens its eyes, then hops out of bed. */
    wake: lights + 3,
    hop: lights + 4,
    /** A-01 pulls the cord; each lamp clicks on. */
    lamps: [lights + 5.5, lights + 6.25, lights + 6.75, lights + 7],
    /** The others wake, one after another, from here. */
    yawns: every(OTHERS, lights + 7.25, 0.125),
    strike: lights + 8.5,
    write: lights + 9.5,
  },
  crew: {
    line: crew,
    shrug: crew + 1.25,
    /** Each of the others pops out, a 16th apart. */
    pops: every(OTHERS, crew + 2, 0.25),
    strike: crew + 6.5,
    write: crew + 7.5,
    /** The digger sets off up the ladder, three more behind it. */
    climb: crew + 8.5,
  },
  tools: {
    line: tools,
    /** The breaker is thrown and the workshop wakes. */
    breaker: tools + 1,
    /** The terminal's lines come up one by one. */
    typing: every(6, tools + 1.5, 0.5),
    strike: tools + 4,
    write: tools + 5,
  },
  gate: {
    line: gate,
    /** The line walks in from here; its first unit hits the gate, the rest pile in behind. */
    march: gate,
    bonks: every(8, gate + 3, 0.15),
    /** Silence: they all turn and look at us. */
    look: gate + 4.5,
    /** The fingerprint presses on the lens, from and to. */
    scan: [gate + 6, gate + 8],
    /** ARMED BY YOU: the plate is stamped and the gate rolls open. */
    armed: gate + 8,
    cheer: gate + 8.5,
    strike: gate + 9,
    write: gate + 10,
    /** They walk on through the gate. */
    through: gate + 10.5,
  },
  chores: {
    line: chores,
    /** Each chore's DONE stamp. The last one flattens the narrator's word. */
    done: [chores + 2, chores + 3, chores + 4, chores + 5],
    strike: chores + 5,
    write: chores + 5.75,
  },
  song: {
    line: song,
    /** From the line to the drop nothing sounds but the needle being tapped. */
    taps: [song + 2, song + 2.5, song + 3],
    /** The needle drops: the whole phone plays. */
    drop: song + 4,
    strike: song + 6,
    write: song + 7,
  },
  dawn: {
    /** The night watch rings the bell; the music stops on the first ring. */
    bell: [dawn, dawn + 0.5, dawn + 1],
    /** Everyone runs for bed, from and to. */
    scramble: [dawn + 1.5, dawn + 6.5],
    line: dawn + 2,
    /** Each floor goes dark, top to bottom; the gate shuts between. */
    out: [dawn + 3.5, dawn + 4.25, dawn + 5, dawn + 6.75],
    shut: dawn + 4,
    /** One unit darts back for the hat it left on the glass. */
    hat: [dawn + 8.5, dawn + 10.5],
    grab: dawn + 9.75,
    /** For once the line is right. */
    right: dawn + 11,
    /** 07:00: the card slides onto the glass. */
    card: dawn + 12,
  },
  end: {
    line: end,
    /** The site's first screen forms: the mark, the headline, the button. */
    mark: end + 2,
    headline: end + 2.75,
    button: end + 4,
    /** A-01 pops up by the button, then blinks. */
    peek: end + 7,
    blink: end + 9,
    /** One last, late ding from inside. */
    ding: end + 10.5,
  },
} as const;
