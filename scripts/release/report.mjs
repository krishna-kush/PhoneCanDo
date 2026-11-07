// The preflight result as terminal lines: one line per gate, the CI table
// (every gate, plus every check that is not green), then the verdict. Pure:
// release-android.mjs prints it.

import { GATE_ROLES } from './ci/classify.mjs';
import { renderTable } from './table.mjs';

const MAX_DETAIL = 20;
const HEADER = ['CHECK', 'WORKFLOW', 'STATE', 'ROLE', 'DECISION', 'NOTE'];

/** runPreflight's result -> lines to print. */
export function preflightReport(result) {
  const from = result.sha === result.head ? 'HEAD' : `the staged APKs' commit; HEAD is ${result.head.slice(0, 12)}`;
  const lines = [`Preflight for ${result.sha} (${from})`];
  for (const gate of result.gates) {
    const mark = gate.ok ? 'ok' : result.overridden.includes(gate.id) ? 'OVERRIDDEN' : 'REFUSED';
    lines.push(`  ${gate.title.padEnd(7)} ${mark}: ${gate.summary}`);
    const detail = gate.detail ?? [];
    for (const line of detail.slice(0, MAX_DETAIL)) lines.push(`            ${line}`);
    if (detail.length > MAX_DETAIL) lines.push(`            ... and ${detail.length - MAX_DETAIL} more`);
  }

  if (result.ci) {
    const shown = result.ci.rows.filter((row) => GATE_ROLES.has(row.role) || row.decision !== 'ok');
    const cells = shown.map((row) => [
      row.name,
      row.workflow,
      row.state,
      row.role,
      row.decision === 'block' ? 'BLOCK' : row.decision,
      row.note,
    ]);
    lines.push('', ...renderTable(HEADER, cells).map((line) => `  ${line}`));
    const hidden = result.ci.rows.length - shown.length;
    if (hidden) lines.push(`  (${hidden} other check(s) green or skipped)`);
  }

  lines.push('');
  if (!result.proceed) {
    lines.push('Preflight refused the release:', ...result.refusals.map((reason) => `  - ${reason}`));
    const ciOnly = result.gates.filter((gate) => !gate.ok).every((gate) => gate.overridable);
    if (ciOnly) lines.push('Red CI can be overridden with --allow-red-ci; the release notes then say so.');
  } else if (result.notes.length) {
    lines.push('Preflight passed with --allow-red-ci. The GitHub release notes will end with:');
    lines.push(...result.notes.map((note) => `  ${note}`));
  } else {
    lines.push('Preflight passed.');
  }
  return lines;
}
