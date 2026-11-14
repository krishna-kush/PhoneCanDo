// The stage of the composition being drawn.

import { useMemo } from 'react';
import { useVideoConfig } from 'remotion';
import { stageOf, type Stage } from './stage.ts';

export function useStage(): Stage {
  const { width, height } = useVideoConfig();
  return useMemo(() => stageOf(width, height), [width, height]);
}
