// First launch's setup as the screen draws it: four stages (the image's
// three, SETUP_PHASES, then starting the agent), how far into the one it
// is in and along the whole, the running agent's mood and the finale once
// the agent exists. Pure (zero RN imports).
import { PHASE_SPANS, SETUP_PHASES } from '../../env/logic/steps.ts';

/** The stages in words: the image's three, then the agent's start. */
export const STAGES = [...SETUP_PHASES, 'Starting your agent'] as const;
/** The last stage: the agent is being made and started. */
export const START_STAGE = STAGES.length - 1;
/** How long the finale plays once the agent exists, before Home shows. */
export const FINALE_MS = 1600;

export type SetupState = {
  /** Index into STAGES. */
  stage: number;
  /** The whole image setup, 0 to 1 (setupFraction); 1 once the image is ready. */
  fraction: number;
  /** The agent exists: the finale. */
  done: boolean;
  failed: boolean;
};

export type RunnerMood = 'busy' | 'happy' | 'oops';

/** Which stage: the image's phase while it sets up (before unpacking counts as unpacking), then the agent's start once it is ready; only that on the Android path. */
export function stageOf(path: 'linux' | 'android', phase: number, imageReady: boolean): number {
  if (path === 'android' || imageReady) return START_STAGE;
  return Math.min(Math.max(phase, 0), START_STAGE - 1);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/** How far into its stage the setup is, 0 to 1: by the fraction's span for the image's stages; the agent's start is 0 until the agent exists. */
export function withinStage({ stage, fraction, done }: Pick<SetupState, 'stage' | 'fraction' | 'done'>): number {
  if (done) return 1;
  const span = PHASE_SPANS[stage];
  if (!span) return 0;
  return clamp01((fraction - span[0]) / (span[1] - span[0]));
}

/** How far along the whole setup is, 0 to 1, each stage a quarter however long it takes (unpacking fills its quarter as it goes; the quick ones dash through theirs). */
export function overall(state: Pick<SetupState, 'stage' | 'fraction' | 'done'>): number {
  if (state.done) return 1;
  return Math.min(1, (state.stage + withinStage(state)) / (START_STAGE + 1));
}

/** The running agent's mood: its eyes darting about as it runs, pleased at the finale, frowning on a failure. */
export function runnerMood({ done, failed }: Pick<SetupState, 'done' | 'failed'>): RunnerMood {
  if (failed) return 'oops';
  return done ? 'happy' : 'busy';
}

/** Each stage's mark: done, now or still to come. */
export function stageMark(at: number, { stage, done }: Pick<SetupState, 'stage' | 'done'>): 'done' | 'now' | 'next' {
  if (done || at < stage) return 'done';
  return at === stage ? 'now' : 'next';
}
