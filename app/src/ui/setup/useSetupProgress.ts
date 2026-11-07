import { useRef } from 'react';
import type { ImageId } from '../../engine/linux/types';
import { useLinuxStore, useTargetProgress } from '../../state/linux';
import { progressLine, setupFraction, setupPhase } from '../env/logic/steps';

export type SetupProgress = {
  /** Index into SETUP_PHASES; -1 before unpacking starts. */
  phase: number;
  fraction: number;
  label: string;
  /** The image is set up; only the agent is left to make. */
  imageReady: boolean;
  /** The step that failed, when the image's setup failed. */
  failedStep: string | null;
};

// First launch's progress for the image being set up. It only moves
// forward: between one step's last event and the next one's first the
// store has no progress, and a retry starts its events again from the
// failed step.
export function useSetupProgress(imageId: ImageId | null): SetupProgress {
  const image = useLinuxStore((s) => (imageId ? s.images.find((i) => i.id === imageId) : undefined));
  const progress = useTargetProgress(imageId ? { kind: 'image', id: imageId } : null);
  const best = useRef({ imageId, phase: -1, fraction: 0 });
  if (best.current.imageId !== imageId) best.current = { imageId, phase: -1, fraction: 0 };
  if (progress) {
    best.current.phase = Math.max(best.current.phase, setupPhase(progress.step));
    best.current.fraction = Math.max(best.current.fraction, setupFraction(progress.step, progress.done, progress.total));
  }
  const imageReady = image?.state === 'ready';
  return {
    phase: best.current.phase,
    fraction: imageReady ? 1 : best.current.fraction,
    label: imageReady
      ? 'Starting your agent'
      : progress
        ? progressLine(progress.step, progress.done, progress.total)
        : 'Getting ready',
    imageReady,
    failedStep: image?.state === 'failed' ? image.failedStep : null,
  };
}
