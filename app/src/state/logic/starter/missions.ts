// The first shift's missions: which ones this phone gets, in order, and
// which are long. A short one is shown straight away; a long one first
// says what it is and where it lives, then asks whether to show how or go
// on to the next. Pure (zero RN imports).

export type MissionId = 'hello' | 'terminal' | 'hands' | 'upgrade' | 'teammate' | 'schedule';

/** What decides the list: the build and what this phone can do. */
export type ShiftFacts = {
  /** full, lite or play. */
  channel: string;
  /** Schedules are in this build and an agent here can run them. */
  schedules: boolean;
};

/**
 * Say hi and the terminal for everyone; phone control on full, the full
 * build's pitch on lite (play has neither); a teammate; a schedule when
 * this phone can run one.
 */
export function missionsFor(f: ShiftFacts): MissionId[] {
  const list: MissionId[] = ['hello', 'terminal'];
  if (f.channel === 'full') list.push('hands');
  else if (f.channel === 'lite') list.push('upgrade');
  list.push('teammate');
  if (f.schedules) list.push('schedule');
  return list;
}

const LONG: ReadonlySet<MissionId> = new Set(['hands', 'teammate', 'schedule']);

/** A long mission asks before it shows how. */
export const isLong = (id: MissionId): boolean => LONG.has(id);

const ALL: ReadonlySet<string> = new Set<MissionId>(['hello', 'terminal', 'hands', 'upgrade', 'teammate', 'schedule']);

export const isMissionId = (v: unknown): v is MissionId => typeof v === 'string' && ALL.has(v);
