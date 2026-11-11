// When the RAM warning speaks up, so it never nags. Pure (zero RN imports):
// the memory store (state/memory.ts) folds each reading of the runner's
// memory guard through it, and scripts/vectors/test_memory.js checks it.
// An episode runs from the level leaving ok until it has stayed ok a while
// (a level that bounces around the line is one episode). The warning opens
// by itself once when an episode starts and once more if it turns
// critical; in between, a pill keeps the countdown in sight. An automatic
// stop is told once: when it is newer than the last one told, or, on the
// first reading (the app was away), when it is recent.
import type { AutoStop, MemoryLevel, MemoryStatus } from '../../engine/memory';

export type Episode = {
  /** The highest level the warning opened at by itself in this episode; null outside one. */
  shownAt: MemoryLevel | null;
  /** When the level came back to ok; null while it is not ok. */
  okSince: number | null;
  /** The newest automatic stop already told (its `at`); null before any. */
  toldStopAt: number | null;
};

export const NO_EPISODE: Episode = { shownAt: null, okSince: null, toldStopAt: null };

/** How long the level stays ok before the episode is over. */
export const SETTLE_MS = 3 * 60_000;

/** How old an automatic stop may be on the first reading and still be told. */
export const RECENT_STOP_MS = 5 * 60_000;

const RANK: Record<MemoryLevel, number> = { ok: 0, warn: 1, critical: 2 };

export type Fold = {
  episode: Episode;
  /** Open the warning now. */
  open: boolean;
  /** An automatic stop to tell now; null for none. */
  told: AutoStop | null;
};

export function foldReading(prev: Episode, status: Pick<MemoryStatus, 'level' | 'lastAutoStop'>, now: number): Fold {
  let { shownAt, okSince } = prev;
  let open = false;
  if (status.level === 'ok') {
    okSince = okSince ?? now;
  } else {
    if (okSince != null && now - okSince >= SETTLE_MS) shownAt = null;
    okSince = null;
    if (shownAt == null || RANK[status.level] > RANK[shownAt]) {
      open = true;
      shownAt = status.level;
    }
  }

  const stop = status.lastAutoStop;
  const fresh =
    stop != null && (prev.toldStopAt == null ? now - stop.at <= RECENT_STOP_MS : stop.at > prev.toldStopAt);
  const toldStopAt = stop != null && (prev.toldStopAt == null || stop.at > prev.toldStopAt) ? stop.at : prev.toldStopAt;

  return { episode: { shownAt, okSince, toldStopAt }, open, told: fresh ? stop : null };
}
