// Job steps in plain words, and how far along a job is. Pure (zero RN
// imports). The native steps: a download reports `resolve`, then
// `download` (bytes); an image setup `space`, `unpack` (bytes), `detect`,
// `fixups`, `shims`, `seed`, then `measure`; a reset `packages`, `unpack`,
// `swap`, `measure`. Every job starts with `start`. Setup steps report their
// place in the whole setup as done/total, so only byte steps have a
// fraction of their own. Unknown steps still read as words.
import { formatBytes } from './format.ts';

const STEP_WORDS: Record<string, string> = {
  start: 'Getting ready',
  resolve: 'Finding the image',
  download: 'Downloading',
  space: 'Checking space',
  unpack: 'Unpacking',
  detect: 'Detecting the system',
  fixups: 'Setting up',
  shims: 'Setting up',
  seed: 'Setting up',
  measure: 'Measuring its size',
  packages: 'Noting what you installed',
  swap: 'Putting the fresh system in place',
};

const BYTE_STEPS = new Set(['download', 'unpack']);

export function stepLabel(step: string | null | undefined): string {
  if (!step) return 'Getting ready';
  const known = STEP_WORDS[step];
  if (known) return known;
  const words = step.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Working';
}

/** A byte step's done/total in [0, 1]; null for other steps and while the total is unknown. */
export function stepFraction(step: string | null | undefined, done: number, total: number | null): number | null {
  if (!step || !BYTE_STEPS.has(step) || total == null || total <= 0) return null;
  return Math.min(1, Math.max(0, done / total));
}

/** "Unpacking · 42%", "Downloading · 42% · 120 MB of 290 MB", or just the step. */
export function progressLine(step: string | null | undefined, done: number, total: number | null): string {
  const f = stepFraction(step, done, total);
  if (f == null) return stepLabel(step);
  const line = `${stepLabel(step)} · ${Math.round(f * 100)}%`;
  return step === 'download' ? `${line} · ${formatBytes(done)} of ${formatBytes(total)}` : line;
}

/** First launch's three phases, in order. */
export const SETUP_PHASES = ['Unpacking', 'Detecting the system', 'Setting up'] as const;

/** Which of SETUP_PHASES a setup step belongs to; -1 before unpacking starts. */
export function setupPhase(step: string | null | undefined): number {
  switch (step) {
    case 'unpack':
      return 0;
    case 'detect':
      return 1;
    case 'fixups':
    case 'shims':
    case 'seed':
    case 'measure':
      return 2;
    default:
      return -1;
  }
}

// Where each setup step starts and ends in the whole setup. Unpacking is
// most of the time; the rest are quick file writes.
const SETUP_SPAN: Record<string, [number, number]> = {
  start: [0, 0.02],
  space: [0.02, 0.05],
  unpack: [0.05, 0.8],
  detect: [0.8, 0.85],
  fixups: [0.85, 0.9],
  shims: [0.9, 0.93],
  seed: [0.93, 0.96],
  measure: [0.96, 1],
};

/** The whole image setup in [0, 1]: where the step starts, plus its own bytes for unpacking. */
export function setupFraction(step: string | null | undefined, done: number, total: number | null): number {
  const span = step ? SETUP_SPAN[step] : undefined;
  if (!span) return 0;
  const within = stepFraction(step, done, total) ?? 0;
  return span[0] + (span[1] - span[0]) * within;
}
