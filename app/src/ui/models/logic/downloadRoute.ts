// Where a model download's parcel run stands (common/route): A-01's spot on
// the road, and whether it is settling (starting, or re-reading what an
// earlier try left: it hops where it stands, the spot the download had
// reached) or waiting (paused, or waiting to try again or for a network:
// it naps there). Only real bytes move it, so a resume never sends it back
// to the start. Pure (zero RN imports).
import { fraction } from './modelText.ts';

type RouteSpot = { fraction: number | null; working: boolean; paused: boolean };

type Kept = { doneBytes: number; sizeBytes: number };
type Job = { step: string; done: number; total: number | null };

export function downloadRoute(download: Kept, job: Job | undefined, running: boolean): RouteSpot {
  const kept = fraction(download.doneBytes, download.sizeBytes);
  if (!running) return { fraction: kept, working: false, paused: true };
  if (!job || job.step === 'start' || job.step === 'verify' || job.total == null) return { fraction: kept, working: true, paused: false };
  const now = fraction(job.done, job.total);
  return { fraction: now, working: false, paused: job.step === 'retry' || job.step === 'offline' };
}
