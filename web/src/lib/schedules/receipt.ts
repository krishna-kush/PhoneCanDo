// The receipt the roll prints at 09:00 (NightRoll.astro): each run of the
// night with what it did, in the app's words for a run (ui/schedule/logic/
// scheduleCopy.ts), and the night's totals. Pure.

import { clock, span } from './clock';
import type { Outcome, Run } from './night';

const WORDS: Record<Outcome, string> = {
  started: 'started',
  woke: 'woke',
  restarted: 'restarted',
  skipped: 'skipped: busy',
};

export type Line = { time: string; who: string; task: string; what: string; own: boolean; outcome: Outcome };

/** The runs in the order they ran, `names` by lane. */
export function receiptLines(runs: Run[], names: string[]): Line[] {
  return [...runs]
    .sort((a, b) => a.at - b.at || a.task.lane - b.task.lane)
    .map((r) => ({
      time: clock(r.at),
      who: names[r.task.lane] ?? '',
      task: r.task.text,
      own: r.task.by === 'agent',
      outcome: r.outcome,
      what: [
        WORDS[r.outcome],
        r.late ? 'late' : null,
        !r.late && r.outcome !== 'skipped' && r.at > r.due ? `waited ${span(r.at - r.due)}` : null,
        r.cut ? 'cut off' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }));
}

/** "9 runs · 4 started · 3 woke · 1 restarted · 1 late", or the empty night's line. */
export function totals(runs: Run[]): string {
  if (!runs.length) return 'No runs. A quiet night.';
  const count = (o: Outcome) => runs.filter((r) => r.outcome === o).length;
  const late = runs.filter((r) => r.late).length;
  return [
    `${runs.length} ${runs.length === 1 ? 'run' : 'runs'}`,
    ...(['started', 'woke', 'restarted', 'skipped'] as const).map((o) => (count(o) ? `${count(o)} ${o}` : null)),
    late ? `${late} late` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
