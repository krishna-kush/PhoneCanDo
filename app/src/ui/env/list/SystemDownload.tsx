import type { Env } from '../../../engine/linux/types';
import { useTargetProgress } from '../../../state/linux';
import { downloadLine, stepFraction } from '../logic/steps';
import ProgressBar from '../parts/ProgressBar';

// A system's download in the Systems list: its step over a bar.
export default function SystemDownload({ env }: { env: Env }) {
  const progress = useTargetProgress({ kind: 'env', id: env.id });
  return (
    <ProgressBar
      label={progress ? downloadLine(progress) : 'Downloading'}
      fraction={progress ? stepFraction(progress.step, progress.done, progress.total) : null}
    />
  );
}
