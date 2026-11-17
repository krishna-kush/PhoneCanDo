import type { Env } from '../../../engine/linux/types';
import { useLastFinished, useTargetProgress } from '../../../state/linux';
import { downloadSource } from '../logic/imageRef';
import { downloadLine, downloadSpot, pausedDownload } from '../logic/steps';
import { isPaused } from '../logic/titles';
import ProgressBar from '../parts/ProgressBar';

// A system's download (the Systems list, its page, its download page): A-01
// carrying it from its registry, its step under the road; paused, A-01 naps
// where it got to (unknown after a restart: it naps at the start).
export default function SystemDownload({ env }: { env: Env }) {
  const target = { kind: 'env', id: env.id } as const;
  const progress = useTargetProgress(target);
  const last = useLastFinished(target);
  if (isPaused(env)) {
    const paused = pausedDownload(last?.last);
    return <ProgressBar label={paused.label} fraction={paused.fraction} from={downloadSource(env)} paused />;
  }
  return <ProgressBar label={progress ? downloadLine(progress) : 'Downloading'} {...downloadSpot(progress)} from={downloadSource(env)} />;
}
