// The toys on a page talk to A-01 (components/Mascot.astro) through one
// document event, so a section never reaches into the mascot and the mascot
// keeps no list of toys. With nobody listening (narrow screens, where it
// stays hidden) a cue does nothing.

export const MASCOT_CUE = 'mascot:cue';

export type MascotCue = {
  /** The line, 17 characters at most (data/mascot.ts). */
  say: string;
  /** A hop for yes, a shake for no. */
  move?: 'hop' | 'shake';
  /** The line is a call, written like its own tap("…") narration. */
  code?: boolean;
  /** How long the line stays up; 1600ms when left out. */
  ms?: number;
  /** The gate's demo: true once the visitor arms it, false when locked again. */
  armed?: boolean;
};

export const cueMascot = (cue: MascotCue) =>
  document.dispatchEvent(new CustomEvent<MascotCue>(MASCOT_CUE, { detail: cue }));
