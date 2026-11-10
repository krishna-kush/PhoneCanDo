// How far an agent's install run is, for its bar. Pure (types only).
//
// The bar starts a little ahead (START) the moment a run starts, so it never
// sits at 0. The script's phases share [START, SCRIPT_END] by weight: the
// time each typically takes on a phone. Within a phase the bar moves with
// the seconds and the bytes downloaded since the phase began. We never know
// a phase's total, so each counts against a scale (the time, or the bytes,
// that alone would take the bar halfway through the phase): x = seconds /
// halfSec + bytes / halfBytes, and the phase is x / (1 + x) full. That is
// quick at first and slower later, and it never fills the phase, so the bar
// never reaches the next phase's start before that phase begins. halfSec is
// a third of the phase's weight: time alone takes a typical phase three
// quarters through its share, with its bytes about four fifths, and a phase
// that runs three times as long still has room to move. Seconds while the
// phone reports it is offline do not count (the run keeps them,
// installRun.ts): the bar holds still and goes on from there. Our own version
// check after the script is CHECK_AT; only a run that ended well is 1. The
// run keeps the highest value shown (installRun.ts), so a reading that would
// go back (a counter Android stopped giving) never shows.
import type { InstallActivity, InstallStage } from './installRun.ts';

/** Shown as soon as a run starts, before anything is known. */
export const START = 0.04;
/** Where the script's last phase ends. */
export const SCRIPT_END = 0.96;
/** Our version check, once the script ended well. */
export const CHECK_AT = 0.98;

type PhaseProfile = {
  /** Typical seconds on a phone: the phase's share of the bar. */
  weight: number;
  /** Bytes that alone take the bar halfway through the phase; null for a phase that downloads nothing. */
  halfBytes: number | null;
};

const MB = 1_000_000;

// Node.js (a 27 MB tarball, unpacked under proot) or uv and CPython (~45 MB).
const RUNTIME: PhaseProfile = { weight: 45, halfBytes: 20 * MB };
// The agent's own download (npm, uv, a vendor script): the longest by far.
const AGENT: PhaseProfile = { weight: 150, halfBytes: 50 * MB };
// A phase this table does not know.
const OTHER: PhaseProfile = { weight: 60, halfBytes: 25 * MB };

const PROFILES = new Map<string, PhaseProfile>([
  // The index refresh and a few packages.
  ['packages', { weight: 60, halfBytes: 20 * MB }],
  ['install', AGENT],
  ['update', AGENT],
  // The agent prints its version once.
  ['verify', { weight: 5, halfBytes: null }],
]);

// Seconds that alone take the bar halfway through a phase.
const halfSec = (p: PhaseProfile) => p.weight / 3;

const RUNTIME_PREFIX = 'runtime:';

function profileOf(phase: string): PhaseProfile {
  if (phase.startsWith(RUNTIME_PREFIX)) return RUNTIME;
  return PROFILES.get(phase) ?? OTHER;
}

/** A phase's part of the bar: from its start to the next phase's. */
export type PhaseSpan = { phase: string; from: number; to: number };

/** The plan's phases laid out over [START, SCRIPT_END] by weight. */
export function phaseSpans(phases: readonly string[]): PhaseSpan[] {
  const weights = phases.map((p) => profileOf(p).weight);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const at = (w: number) => START + ((SCRIPT_END - START) * w) / total;
  let before = 0;
  return phases.map((phase, i) => {
    const from = at(before);
    before += weights[i];
    return { phase, from, to: at(before) };
  });
}

/** How full a phase is, in [0, 1): from the seconds and bytes (null: not counted) since it began. */
export function phaseEase(phase: string, seconds: number, bytes: number | null): number {
  const p = profileOf(phase);
  const x = Math.max(0, seconds) / halfSec(p) + (bytes != null && p.halfBytes != null ? Math.max(0, bytes) / p.halfBytes : 0);
  return x / (1 + x);
}

/** An activity reading where a phase began, with the run's offline seconds by then. */
export type ActivityMark = { elapsedSec: number; downloadedBytes: number | null; offlineSec: number };

/** What the bar reads from a run (InstallRun has all of it). */
export type ProgressInput = {
  status: 'running' | 'done' | 'failed';
  stage: InstallStage;
  phases: readonly string[];
  phase: string | null;
  activity: InstallActivity | null;
  phaseStart: ActivityMark | null;
  /** Seconds the script ran while the phone was offline. */
  offlineSec: number;
};

/** Where the bar would be now, before the run's high-water mark. */
export function progressNow(run: ProgressInput): number {
  if (run.status === 'done') return 1;
  if (run.stage === 'verify') return CHECK_AT;
  if (run.stage !== 'script' || run.phase == null) return START;
  const span = phaseSpans(run.phases).find((s) => s.phase === run.phase);
  if (!span) return START;
  const now = run.activity;
  const base = run.phaseStart;
  const offline = run.offlineSec - (base?.offlineSec ?? 0);
  const seconds = now ? now.elapsedSec - (base?.elapsedSec ?? 0) - offline : 0;
  const bytes = now?.downloadedBytes == null ? null : now.downloadedBytes - (base?.downloadedBytes ?? 0);
  return span.from + (span.to - span.from) * phaseEase(run.phase, seconds, bytes);
}
