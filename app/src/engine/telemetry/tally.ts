// Pure tally math over the runner's telemetry snapshot: one native read in
// session terms (counter keys, the newest exit and boot, crashes), what a
// read holds beyond an earlier read of the same unconsumed period, and
// engine health over a session's counters. No React Native imports.
import type { NativeCrash, TelemetryNativeSnapshot } from '../runner';

/** One native read in session terms: counter keys, the newest exit and boot, crashes. */
export type Tally = {
  counters: Record<string, number>;
  lowMemoryTrims: number;
  crashes: NativeCrash[];
  /** The newest unexpected exit: its code and when it was noticed (epoch ms), or null. */
  exit: { code: number; at: number | null } | null;
  bootMs: number | null;
};

function positive(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

// toolCalls is keyed by bridge route ('pce_act', 'notify'); kept as tool.<route>.
function toolKey(route: string): string | null {
  const k = route.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 48);
  return k ? `tool.${k}` : null;
}

export function tallyOf(snap: TelemetryNativeSnapshot): Tally {
  const counters: Record<string, number> = {};
  const add = (key: string, n: unknown): void => {
    const v = positive(n);
    if (v > 0) counters[key] = (counters[key] ?? 0) + v;
  };
  for (const [route, n] of Object.entries(snap.toolCalls ?? {})) {
    const key = toolKey(route);
    if (key) add(key, n);
  }
  const e = snap.engine;
  add('session.create', snap.sessionCreates);
  add('engine.starts', e?.starts);
  add('engine.startFails', e?.startFails);
  add('engine.died', e?.died);
  add('engine.portSquats', e?.portSquats);
  const at = typeof e?.lastDiedAt === 'number' && e.lastDiedAt > 0 ? e.lastDiedAt : null;
  return {
    counters,
    lowMemoryTrims: positive(snap.lowMemoryTrims),
    crashes: Array.isArray(snap.nativeCrashes) ? snap.nativeCrashes : [],
    exit: typeof e?.lastExitCode === 'number' ? { code: e.lastExitCode, at } : null,
    bootMs: typeof e?.lastBootMs === 'number' ? e.lastBootMs : null,
  };
}

// What `next` holds beyond `base` (an earlier read of the same unconsumed
// period, or null): counts only grow until a consume, a crash is new by its
// id, and an exit or boot is new when it differs from the one in `base`.
export function minus(next: Tally, base: Tally | null): Tally {
  if (!base) return next;
  const counters: Record<string, number> = {};
  for (const [key, n] of Object.entries(next.counters)) {
    const d = n - (base.counters[key] ?? 0);
    if (d > 0) counters[key] = d;
  }
  const seen = new Set(base.crashes.map((c) => c.id));
  const sameExit = next.exit !== null && base.exit !== null && next.exit.code === base.exit.code && next.exit.at === base.exit.at;
  return {
    counters,
    lowMemoryTrims: Math.max(0, next.lowMemoryTrims - base.lowMemoryTrims),
    crashes: next.crashes.filter((c) => !seen.has(c.id)),
    exit: sameExit ? null : next.exit,
    bootMs: next.bootMs !== null && next.bootMs !== base.bootMs ? next.bootMs : null,
  };
}

// True when `t` carries anything a session records (crashes are not session facts).
export function hasSessionFacts(t: Tally): boolean {
  return Object.keys(t.counters).length > 0 || t.lowMemoryTrims > 0 || t.exit !== null || t.bootMs !== null;
}

export function isEmpty(t: Tally): boolean {
  return !hasSessionFacts(t) && t.crashes.length === 0;
}

// Engine health over a session's counters; undefined while the engine never ran.
export function engineOkOf(counters: Record<string, number>): boolean | undefined {
  const starts = counters['engine.starts'] ?? 0;
  const fails = counters['engine.startFails'] ?? 0;
  const died = counters['engine.died'] ?? 0;
  return starts + fails + died > 0 ? fails === 0 && died === 0 : undefined;
}
