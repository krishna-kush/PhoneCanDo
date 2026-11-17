import { fractionOf, secondsLeft } from '../../state/logic/update/steps';
import { useUpdateStore } from '../../state/update';
import { progressLine } from './copy';

type DownloadLine = {
  /** Its share done; null while it re-reads what an earlier try left (A-01 keeps its spot and hops). */
  fraction: number | null;
  line: string;
  written: number;
  total: number;
  /** Re-reading what an earlier try left: no bytes coming yet. */
  working: boolean;
  /** Waiting to try again or for a network: A-01 naps. */
  paused: boolean;
};

/** The update's download as drawn: where A-01 stands, and its line (how far, how long, or what it waits for). */
export function useDownloadLine(): DownloadLine {
  const { written, total } = useUpdateStore((s) => s.progress);
  const startedAt = useUpdateStore((s) => s.startedAt);
  const startedFrom = useUpdateStore((s) => s.startedFrom);
  const phase = useUpdateStore((s) => s.phase);
  // Its pace counts from where this app first saw it: a resumed one starts part way.
  const sec = secondsLeft(written - startedFrom, total - startedFrom, startedAt, Date.now());
  return {
    fraction: phase === 'verify' ? null : fractionOf(written, total),
    line: progressLine(written, total, sec, phase),
    written,
    total,
    working: phase === 'verify',
    paused: phase === 'retry' || phase === 'offline',
  };
}
