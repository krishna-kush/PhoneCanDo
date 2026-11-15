// The What it can do rows: grouped by where each capability runs (ACP
// mode, its own app), and each row's line: its state as usual or, while a
// check runs, where the check is with it (testing now, queued, answered,
// couldn't tell, skipped). Unknown and skipped lines stay after the run
// until the next check. Pure (zero RN imports):
// scripts/vectors/test_checks.js checks it.
import type { CapabilityCheck, CapabilityId, CheckRun, CheckRunRow } from '../../../../../engine/checks/types';
import { stateLine, stateTone, type Tone } from './copy.ts';
import { stepView } from './run.ts';

export type CheckGroup = { id: 'acp' | 'app'; title: string; checks: CapabilityCheck[] };

const GROUPS: readonly { id: CheckGroup['id']; title: string; ids: readonly CapabilityId[] }[] = [
  { id: 'acp', title: 'In ACP mode', ids: ['acp', 'acpTools', 'acpMessages'] },
  { id: 'app', title: 'In its own app', ids: ['tools', 'messages', 'wake', 'task', 'chat', 'state'] },
];

/** The capabilities by where they run, in each group's order; a group with nothing set up (every row off) is left out. */
export function checkGroups(capabilities: readonly CapabilityCheck[]): CheckGroup[] {
  const byId = new Map(capabilities.map((c) => [c.id, c]));
  return GROUPS.flatMap((g) => {
    const checks = g.ids.flatMap((id) => {
      const check = byId.get(id);
      return check ? [check] : [];
    });
    return checks.some((c) => c.state !== 'off') ? [{ id: g.id, title: g.title, checks }] : [];
  });
}

/** A row's line, its ink and, while a local model reads the task for it, the thin bar's fill (0 to 1). */
export type RowLine = { text: string; tone: Tone; progress: number | null };

const SKIPPED_WHY = 'needs a turn in its own app; checked the first time you use it';

/** "Skipped: <why>", unless the runner's words already say so; the why reads on after the colon in lower case. */
function skippedText(why: string | null): string {
  const text = why ?? SKIPPED_WHY;
  return /^skipped\b/i.test(text) ? text : `Skipped: ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

/** What the check says about the row: while it runs, any status; after it, only unknown and skipped. */
function rowStatus(run: CheckRun | null, id: CapabilityId): CheckRunRow | null {
  const row = run?.rows.find((r) => r.id === id) ?? null;
  if (!row || row.status === 'answered') return null;
  if (run?.state === 'running') return row;
  return row.status === 'unknown' || row.status === 'skipped' ? row : null;
}

/**
 * The row's line: "Testing now · reading the task · 42%" (with the bar),
 * "Queued · after ACP mode", "Couldn't tell from this turn", "Skipped:
 * …", or, answered or with no check about it, its state line ("Checked
 * with 1.0.51 · just now", "Not working: …").
 */
export function rowLine(check: CapabilityCheck, run: CheckRun | null, name: string, now: number): RowLine {
  const row = rowStatus(run, check.id);
  switch (row?.status) {
    case 'testing': {
      const step = run ? stepView(run, name) : null;
      return { text: step ? `Testing now · ${step.text}` : 'Testing now', tone: 'secondaryInk', progress: step?.progress ?? null };
    }
    case 'queued': {
      const afterAcp = run != null && run.partMode === 'acp' && row.part > run.part;
      return { text: afterAcp ? 'Queued · after ACP mode' : 'Queued', tone: 'dim', progress: null };
    }
    case 'unknown':
      return { text: row.why ?? "Couldn't tell from this turn", tone: 'muted', progress: null };
    case 'skipped':
      return { text: skippedText(row.why), tone: 'dim', progress: null };
    default:
      return { text: stateLine(check, now), tone: stateTone(check.state), progress: null };
  }
}

/** The run has rows to show its progress in (a runner from before rows: the step goes under the head instead). */
export function runHasRows(run: CheckRun | null): boolean {
  return (run?.rows.length ?? 0) > 0;
}
