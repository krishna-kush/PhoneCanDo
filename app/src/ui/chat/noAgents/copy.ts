// Home's words with every agent deleted (NoAgents.tsx): the empty office's
// title and line, the hiring sign, A-01's caption as it dozes or wakes, and
// the button. Pure (zero RN imports).

export const NO_AGENTS = {
  title: 'Nobody on shift',
  line: 'Every agent has clocked out for good. Hire a new one and the lights come back on.',
  button: 'Hire an agent',
  /** The face's label for a screen reader. */
  face: 'A-01, dozing in the empty office. Tap it.',
} as const;

/** A-01's caption: dozing in the empty office, or woken by a tap. */
export const officeLine = (up: boolean): string => (up ? 'oh! hiring?' : 'zzz · minding the empty office');

/** The hanging sign: its two words; one letter of the second (its index) flickers, as a tired neon's does. */
export const SIGN = { now: 'Now', hiring: 'Hiring', flicker: 3 } as const;
