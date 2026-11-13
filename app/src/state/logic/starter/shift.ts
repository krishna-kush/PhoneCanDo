// The first shift's state: whether it was offered, is on or was waved off,
// each mission's mark, the finale and the reward. A mission is done when
// the app sees it happen, whatever the shift is doing, so one done before
// the shift (or after waving it off) is already ticked when it is back.
// Done beats skipped. The reward (the Shift lead mascot) is earned once
// every mission is done, skips not counting, and kept for good: Start over
// clears the marks only. Pure (zero RN imports).
import { isMissionId, type MissionId } from './missions.ts';

/** new: the hello not answered yet · on: running · off: "I'll wing it" or skipped whole. */
export type ShiftStatus = 'new' | 'on' | 'off';

export type MissionMark = 'done' | 'skipped';

export type ShiftState = {
  status: ShiftStatus;
  marks: Partial<Record<MissionId, MissionMark>>;
  /** The finale was seen: the card and the drawer row go. */
  finaleSeen: boolean;
  /** Every mission done once: the Shift lead mascot is the user's. */
  earned: boolean;
};

export const FRESH: ShiftState = { status: 'new', marks: {}, finaleSeen: false, earned: false };

export type Progress = {
  done: number;
  skipped: number;
  total: number;
  /** The first mission with no mark, the one to do next; null once each has one. */
  next: MissionId | null;
};

export function progress(s: ShiftState, missions: readonly MissionId[]): Progress {
  let done = 0;
  let skipped = 0;
  let next: MissionId | null = null;
  for (const id of missions) {
    const mark = s.marks[id];
    if (mark === 'done') done++;
    else if (mark === 'skipped') skipped++;
    else next ??= id;
  }
  return { done, skipped, total: missions.length, next };
}

/** Each mission has a mark: the finale's turn. */
export const resolved = (s: ShiftState, missions: readonly MissionId[]): boolean => progress(s, missions).next == null;

const allDone = (marks: ShiftState['marks'], missions: readonly MissionId[]): boolean =>
  missions.length > 0 && missions.every((id) => marks[id] === 'done');

/** The hello's Start shift, or About's First shift: on, marks kept. */
export function start(s: ShiftState): ShiftState {
  return s.status === 'on' ? s : { ...s, status: 'on' };
}

/** "I'll wing it", or Skip the whole shift. */
export function windOff(s: ShiftState): ShiftState {
  return s.status === 'off' ? s : { ...s, status: 'off' };
}

/** The app saw [id] happen. */
export function markDone(s: ShiftState, id: MissionId, missions: readonly MissionId[]): ShiftState {
  if (s.marks[id] === 'done') return s;
  const marks = { ...s.marks, [id]: 'done' as const };
  return { ...s, marks, earned: s.earned || allDone(marks, missions) };
}

/** Skip or Next on [id]; a done mission stays done. */
export function skip(s: ShiftState, id: MissionId): ShiftState {
  if (s.marks[id]) return s;
  return { ...s, marks: { ...s.marks, [id]: 'skipped' } };
}

/** Try it on a skipped mission: back to the list's open ones. */
export function unskip(s: ShiftState, id: MissionId): ShiftState {
  if (s.marks[id] !== 'skipped') return s;
  const marks = { ...s.marks };
  delete marks[id];
  return { ...s, marks, finaleSeen: false };
}

/** The finale's Back to work. */
export function finish(s: ShiftState): ShiftState {
  return s.finaleSeen ? s : { ...s, finaleSeen: true };
}

/** Start over: a fresh list, the shift on; the reward stays earned. */
export function restart(s: ShiftState): ShiftState {
  return { status: 'on', marks: {}, finaleSeen: false, earned: s.earned };
}

/** The Home card and the drawer row: while the shift runs, until its finale. */
export const shows = (s: ShiftState): boolean => s.status === 'on' && !s.finaleSeen;

/** A stored state; anything unreadable starts fresh. */
export function parseShift(raw: string | null): ShiftState {
  if (!raw) return FRESH;
  try {
    const o = JSON.parse(raw) as Partial<ShiftState>;
    const status = o.status === 'on' || o.status === 'off' ? o.status : 'new';
    const marks: ShiftState['marks'] = {};
    if (o.marks && typeof o.marks === 'object') {
      for (const [id, mark] of Object.entries(o.marks)) {
        if (isMissionId(id) && (mark === 'done' || mark === 'skipped')) marks[id] = mark;
      }
    }
    return { status, marks, finaleSeen: o.finaleSeen === true, earned: o.earned === true };
  } catch {
    return FRESH;
  }
}
