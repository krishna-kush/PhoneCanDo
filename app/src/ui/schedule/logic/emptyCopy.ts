// The Schedules page with nothing on it (empty/): which scene it shows,
// its box's title, A-01's caption as it naps or is woken, and the week it
// lays out. Pure (zero RN imports).

export const EMPTY_TITLE = 'Nothing booked';

/** Its scenes: the blank week, or the live alarm clock with nothing set. */
export type EmptyLook = 'week' | 'clock';
export const EMPTY_LOOKS: readonly EmptyLook[] = ['week', 'clock'];

/** The scene for a page opening, [r] (0 to 1) picking one at random. */
export function pickLook(r: number): EmptyLook {
  return EMPTY_LOOKS[Math.min(EMPTY_LOOKS.length - 1, Math.floor(r * EMPTY_LOOKS.length))];
}

/** A-01's caption under each look: napping, or woken by a tap. */
export const EMPTY_CAPTION: Record<EmptyLook, { asleep: string; up: string }> = {
  week: { asleep: 'A-01 · free all week', up: 'a whole week free? book me in' },
  clock: { asleep: 'A-01 · no alarms set', up: 'ring ring · nothing to wake for' },
};

/** What a screen reader hears for each look's scene. */
export const EMPTY_FACE: Record<EmptyLook, string> = {
  week: 'A-01, napping on today. Tap it.',
  clock: 'An alarm clock with nothing set, A-01 asleep against it. Tap to ring it.',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The seven days from [now]'s, today first, by short name. */
export function weekAhead(now: number): { day: string; today: boolean }[] {
  const d = new Date(now).getDay();
  return Array.from({ length: 7 }, (_, i) => ({ day: DAYS[(d + i) % 7], today: i === 0 }));
}
