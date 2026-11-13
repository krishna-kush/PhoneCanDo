// One night on the roll (components/sections/schedules/NightRoll.astro),
// played minute by minute from 21:00. Each task comes due and finds its agent
// as it is, then does what the runner's FireRules would: a stopped agent
// starts with it, an idle one that can be woken wakes with it, one that can
// only start is restarted with it, and a busy one keeps it waiting until its
// run ends (up to the busy wait, then it skips). One waiting run per task.
// The phone can be off for a while: every agent stops, and each task that
// came due in the dark runs once when the phone is back, marked late.
// Pure: no DOM. The roll plays it again whenever a task or the dark changes.

/** 21:00 to 09:00, in minutes. */
export const NIGHT = 720;

/** The minute the night crosses into the next day (midnight). */
const MIDNIGHT = 180;

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

/** How a task reaches an agent of a kind (data/agentCards.ts, ScheduleLevel). */
export type Level = 'wakes' | 'starts' | 'none';
export type AgentState = 'stopped' | 'idle' | 'busy';
export type Outcome = 'started' | 'woke' | 'restarted' | 'skipped';

export type Lane = {
  level: Level;
  /** How it is as you put the phone down. */
  start: AgentState;
  /** Busy at the start: the minute that run ends. */
  busyUntil?: number;
  /** Keep running is on: idle, it stays up. */
  kept?: boolean;
};

/** A note an agent sets itself while it runs a task. */
export type SelfNote = {
  /** Minutes into the run it sets it. */
  after: number;
  /** Due this many minutes after that. */
  in: number;
  text: string;
  run: number;
};

export type Task = {
  id: string;
  lane: number;
  text: string;
  /** Its first time, in minutes from 21:00. */
  at: number;
  /** Again every this many minutes. */
  every?: number;
  /** Daily at `at`, on these days only. */
  days?: readonly Day[];
  by: 'you' | 'agent';
  /** How long its run takes, in minutes. */
  run: number;
  note?: SelfNote;
  /** An agent's own note: the minute it set it. */
  setAt?: number;
};

/** The phone was off from one minute to another. */
export type Dark = { from: number; to: number };

export type Run = {
  task: Task;
  due: number;
  at: number;
  outcome: Outcome;
  /** It came due in the dark and ran when the phone was back. */
  late: boolean;
  /** When its work ended (the dark cuts it short). */
  end: number;
  cut: boolean;
};

/** A stretch an agent worked: a run, or what it was doing as you left. */
export type Work = { lane: number; from: number; to: number; cut: boolean };

/** The runner's numbers (data/schedules.ts reads them), in minutes. */
export type Rules = {
  busyWait: number;
  lateMark: number;
  /** An idle agent with nothing running stops this long after its run. */
  clockOut: number;
};

export type Night = {
  runs: Run[];
  work: Work[];
  /** Each lane's state from each minute it changed. */
  states: { at: number; state: AgentState }[][];
  /** The notes agents set themselves during the night. */
  notes: Task[];
};

/** The day a minute of the night falls on, the evening being `eve`. */
export const dayAt = (eve: number, m: number): Day => DAYS[(eve + (m >= MIDNIGHT ? 1 : 0)) % 7];

/** Every minute a task comes due tonight. */
export function duesOf(task: Task, eve: number): number[] {
  const from = Math.max(task.at, task.setAt ?? 0);
  if (task.every) {
    const out: number[] = [];
    for (let m = task.at; m < NIGHT; m += task.every) if (m >= from) out.push(m);
    return out;
  }
  if (from >= NIGHT) return [];
  if (task.days && !task.days.includes(dayAt(eve, from))) return [];
  return [from];
}

const inDark = (dark: Dark[], m: number) => dark.some((d) => m >= d.from && m < d.to);

/**
 * The night as it plays out. `pulled` are notes an agent would set itself
 * that you took out (by the id it gives them), so they never come due.
 */
export function playNight(
  lanes: Lane[],
  tasks: Task[],
  dark: Dark[],
  eve: number,
  rules: Rules,
  pulled: ReadonlySet<string> = new Set(),
): Night {
  const runs: Run[] = [];
  const work: Work[] = [];
  const notes: Task[] = [];
  const states = lanes.map((l) => [{ at: 0, state: l.start }]);
  const now = lanes.map((l, i) => ({
    state: l.start,
    until: l.start === 'busy' ? (l.busyUntil ?? NIGHT) : 0,
    since: 0,
    run: null as Run | null,
    work: l.start === 'busy' ? push(work, { lane: i, from: 0, to: l.busyUntil ?? NIGHT, cut: false }) : null,
  }));
  const set = (i: number, state: AgentState, m: number) => {
    if (now[i].state === state) return;
    now[i].state = state;
    states[i].push({ at: m, state });
  };

  const due = new Map<number, Task[]>();
  const plan = (t: Task) => {
    for (const m of duesOf(t, eve)) due.set(m, [...(due.get(m) ?? []), t]);
  };
  tasks.filter((t) => lanes[t.lane]?.level !== 'none').forEach(plan);

  const waiting = new Map<string, { task: Task; due: number; late: boolean }>();
  const missed = new Map<string, { task: Task; due: number }>();
  let wasDark = false;

  for (let m = 0; m <= NIGHT; m++) {
    const isDark = inDark(dark, m);
    if (isDark && !wasDark) {
      // Lights out: every run is cut and every agent stops.
      now.forEach((a, i) => {
        if (a.work && a.work.to > m) Object.assign(a.work, { to: m, cut: true });
        if (a.run && a.run.end > m) Object.assign(a.run, { end: m, cut: true });
        a.run = null;
        a.work = null;
        set(i, 'stopped', m);
      });
    }
    if (isDark) {
      for (const t of due.get(m) ?? []) missed.set(t.id, { task: t, due: m });
      wasDark = true;
      continue;
    }
    if (wasDark) {
      // Back on: each task that came due in the dark runs once.
      for (const [id, x] of missed) {
        waiting.delete(id);
        waiting.set(id, { ...x, late: m - x.due > rules.lateMark });
      }
      missed.clear();
      wasDark = false;
    }

    now.forEach((a, i) => {
      if (a.state === 'busy' && m >= a.until) {
        a.run = null;
        a.work = null;
        a.since = m;
        set(i, 'idle', m);
      }
      if (a.state === 'idle' && !lanes[i].kept && m - a.since >= rules.clockOut) set(i, 'stopped', m);
      // Partway through a run, an agent may set itself a note for later.
      const note = a.run?.task.note;
      if (a.run && note && m === a.run.at + note.after) {
        const own: Task = { id: `${a.run.task.id}~${m}`, lane: i, text: note.text, at: m + note.in, by: 'agent', run: note.run, setAt: m };
        if (!pulled.has(own.id)) {
          notes.push(own);
          plan(own);
        }
      }
    });

    for (const t of due.get(m) ?? []) {
      waiting.delete(t.id);
      waiting.set(t.id, { task: t, due: m, late: false });
    }

    for (const [id, w] of waiting) {
      const i = w.task.lane;
      const a = now[i];
      if (a.state === 'busy') {
        if (m - w.due >= rules.busyWait) {
          runs.push({ task: w.task, due: w.due, at: m, outcome: 'skipped', late: w.late, end: m, cut: false });
          waiting.delete(id);
        }
        continue;
      }
      const outcome: Outcome = a.state === 'stopped' ? 'started' : lanes[i].level === 'wakes' ? 'woke' : 'restarted';
      const run: Run = { task: w.task, due: w.due, at: m, outcome, late: w.late, end: m + w.task.run, cut: false };
      runs.push(run);
      waiting.delete(id);
      a.run = run;
      a.until = run.end;
      a.work = push(work, { lane: i, from: m, to: run.end, cut: false });
      set(i, 'busy', m);
    }
  }
  return { runs, work, states, notes };
}

function push<T>(list: T[], item: T): T {
  list.push(item);
  return item;
}

/** A lane's state at minute `t`. */
export function stateAt(night: Night, lane: number, t: number): AgentState {
  const list = night.states[lane];
  let state = list[0].state;
  for (const s of list) if (s.at <= t) state = s.state;
  return state;
}
