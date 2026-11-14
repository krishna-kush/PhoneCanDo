// The film's clock, for the picture: the beat the frame being drawn falls
// on. It is set once at the film's root, outside any <Sequence>, so every
// part reads the film's own beat line however deep it sits.

import { createContext, useContext, type ReactNode } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Tempo } from '../beats/tempo.ts';

type Clock = { tempo: Tempo; beat: number; seconds: number };

const ClockContext = createContext<Clock | null>(null);

export function ClockProvider({ tempo, children }: { tempo: Tempo; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  return <ClockContext.Provider value={{ tempo, beat: seconds / tempo.beat, seconds }}>{children}</ClockContext.Provider>;
}

function useClock(): Clock {
  const clock = useContext(ClockContext);
  if (!clock) throw new Error('useBeat() needs a <ClockProvider> above it (the film frame sets one).');
  return clock;
}

/** The beat being drawn, from the film's start. */
export const useBeat = (): number => useClock().beat;

export const useTempo = (): Tempo => useClock().tempo;
