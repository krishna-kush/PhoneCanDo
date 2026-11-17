// Where an update stands, apart from whether its box is up: the update
// takes two steps, a download that stops nothing and an install that stops
// every agent, so a download carries on with the box hidden and a finished
// one waits for its Install. Pure (zero RN imports).

export type UpdateStep =
  /** Settings asked GitHub; no answer yet. */
  | 'checking'
  /** Settings asked: nothing newer. */
  | 'none'
  /** A newer build is out, not downloaded. */
  | 'offer'
  | 'downloading'
  /** On this phone in full: Install or Later. */
  | 'downloaded'
  /** Android's "Install unknown apps" is off for us. */
  | 'permission'
  /** The agents stop for the install. */
  | 'stopping'
  /** Android's installer screen is up. */
  | 'installer'
  /** The installer came back without installing; the agents start again. */
  | 'cancelled'
  | 'error';

export type UpdateStage = 'check' | 'download' | 'install';

/** The runner's download, where it stands (engine/updates/native.ts). */
export type DownloadStep = 'download' | 'verify' | 'retry' | 'offline' | 'done' | 'failed' | 'stopped';

/** Still under way: fetching, re-reading what an earlier try left, or waiting to try again or for a network. */
export function stillDownloading(step: DownloadStep | null): boolean {
  return step === 'download' || step === 'verify' || step === 'retry' || step === 'offline';
}

/**
 * Where an update stands from its newer build and the runner's download of
 * it (null: none): a download under way, one on the phone, the offer, or
 * nothing.
 */
export function restingStep(newer: boolean, download: DownloadStep | null): UpdateStep | null {
  if (!newer) return null;
  if (download === 'done') return 'downloaded';
  return stillDownloading(download) ? 'downloading' : 'offer';
}

/** Steps that keep going with the box hidden. */
export function runsHidden(step: UpdateStep | null): boolean {
  return step === 'downloading';
}

/** Steps the box can't be walked away from: the agents are stopping or Android's installer is up. */
export function holdsBox(step: UpdateStep | null): boolean {
  return step === 'stopping' || step === 'installer';
}

/** The download's share done, 0 to 1; null while its size is unknown. */
export function fractionOf(written: number, total: number): number | null {
  if (!(total > 0)) return null;
  return Math.min(1, Math.max(0, written / total));
}

/**
 * Seconds left at the pace so far, once there is a pace to go by (2 s and
 * 1% in); null before that or when the size is unknown.
 */
export function secondsLeft(written: number, total: number, startedAt: number | null, now: number): number | null {
  if (startedAt == null || !(total > 0) || written <= 0) return null;
  const elapsed = (now - startedAt) / 1000;
  if (elapsed < 2 || written / total < 0.01) return null;
  const rate = written / elapsed;
  return Math.max(0, (total - written) / rate);
}
