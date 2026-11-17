// What the update box says: the offer, the download's progress line and
// its parcel's tracking stops, the install's steps. What the install stops
// is logic/stops.ts. Pure (zero RN imports).
import { formatBytes } from '../env/logic/format.ts';

/** The two steps, said where you start the first. */
export const TWO_STEPS = 'It downloads while your agents keep working. Nothing stops until you tap Install.';

/** Under the box's offer: where the update waits once it shuts. */
export const WHERE_IT_WAITS = 'Not now? It waits in Settings → Updates.';

/** Under the download, while it runs: it goes on hidden, and where to find it. */
export const WHILE_DOWNLOADING =
  'Your agents keep working. Hide this and carry on: it keeps going even if PhoneCanDo closes, Settings → Updates shows how far it got, and this comes back when the parcel is in.';

/** About how long is left, in words; null before there is a pace to go by. */
export function leftLine(sec: number | null): string | null {
  if (sec == null) return null;
  if (sec < 10) return 'a few seconds left';
  if (sec < 60) return 'under a minute left';
  const min = Math.round(sec / 60);
  return `about ${min} min left`;
}

/**
 * "43% · 65 MB of 152 MB · about 1 min left"; the bytes alone while the
 * size is unknown; what it waits for while the runner waits ([phase]:
 * engine/updates/native.ts's step).
 */
export function progressLine(written: number, total: number, sec: number | null, phase: string | null = 'download'): string {
  if (phase === 'offline') return `Waiting for a network · ${formatBytes(written)} kept`;
  if (phase === 'retry') return `Trying again in a moment · ${formatBytes(written)} kept`;
  if (phase === 'verify') return 'Checking what an earlier try left…';
  if (!(total > 0)) return written > 0 ? `${formatBytes(written)} so far` : 'Starting…';
  const pct = Math.floor(Math.min(1, written / total) * 100);
  const left = leftLine(sec);
  return [`${pct}%`, `${formatBytes(written)} of ${formatBytes(total)}`, left].filter(Boolean).join(' · ');
}

/** The install's steps, once you tap it. */
export const STOPPING = {
  title: 'Tucking them in',
  body: 'Each agent stops and keeps note of where it was. Then Android’s installer opens.',
};

export const INSTALLER = {
  title: 'Over to Android',
  body: 'Confirm the install in Android’s dialog. When it says "App installed", tap Open. If you miss it, a notification brings you back.',
};

export const CANCELLED = {
  title: 'Not installed',
  body: 'Android’s installer closed without installing. The agents it stopped are starting again; one that was cut off mid-task has a notice instead, and its Continue carries on in the same chat. The download stays for next time.',
};
