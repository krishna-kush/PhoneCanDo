// The preflight result as terminal lines: one line per gate, the CI table
// (every gate, plus every check that is not green, blocking ones first; one
// line instead when asked to leave it out), then the verdict. Pure:
// release-android.mjs prints it, passing colours as `paint`.

import { GATE_ROLES } from './ci/classify.mjs';
import { renderTable } from './table.mjs';

const MAX_DETAIL = 20;
const HEADER = ['CHECK', 'WORKFLOW', 'STATE', 'ROLE', 'DECISION', 'NOTE'];

const blocking = (result) => (result.ci?.rows ?? []).filter((row) => row.decision === 'block');

/** True when a CI check blocks the release. */
export function ciBlocks(result) {
  return blocking(result).length > 0;
}

/** One line per CI check that blocks the release: what, where, its state and why. */
export function ciProblems(result) {
  return blocking(result).map((row) => `${row.name} (${row.workflow}): ${row.state}${row.note ? `, ${row.note}` : ''}`);
}

const same = (text) => text;
const PLAIN = { good: same, bad: same, warn: same, dim: same, bold: same };
// Blocking checks first, then warnings, then the green ones.
const ORDER = { block: 0, warn: 1, ok: 2 };

/**
 * runPreflight's result -> lines to print. ciTable false folds the table into
 * a line; paint ({good, bad, warn, dim, bold}, each text -> text) colours it.
 */
export function preflightReport(result, { ciTable = true, paint = {} } = {}) {
  const p = { ...PLAIN, ...paint };
  const from = result.sha === result.head ? 'HEAD' : `the staged APKs' commit; HEAD is ${result.head.slice(0, 12)}`;
  const lines = [p.bold(`Preflight for ${result.sha} (${from})`)];
  for (const gate of result.gates) {
    const passed = gate.remind ? p.warn('ASK AGAIN') : p.good('ok');
    const mark = gate.ok ? passed : result.overridden.includes(gate.id) ? p.warn('OVERRIDDEN') : p.bad('REFUSED');
    lines.push(`  ${gate.title.padEnd(7)} ${mark}: ${gate.summary}`);
    const detail = gate.detail ?? [];
    for (const line of detail.slice(0, MAX_DETAIL)) lines.push(p.dim(`            ${line}`));
    if (detail.length > MAX_DETAIL) lines.push(p.dim(`            ... and ${detail.length - MAX_DETAIL} more`));
  }

  if (result.ci && !ciTable) {
    const blocks = blocking(result).length;
    const count = blocks ? p.bad(`${blocks} blocking`) : p.good('none blocking');
    lines.push('', `  CI table left out: ${result.ci.rows.length} check(s), ${count}`);
  } else if (result.ci) {
    const shown = result.ci.rows
      .filter((row) => GATE_ROLES.has(row.role) || row.decision !== 'ok')
      .sort((a, b) => (ORDER[a.decision] ?? 1) - (ORDER[b.decision] ?? 1));
    const cells = shown.map((row) => [
      row.name,
      row.workflow,
      row.state,
      row.role,
      row.decision === 'block' ? 'BLOCK' : row.decision,
      row.note,
    ]);
    const decide = { BLOCK: p.bad, warn: p.warn, ok: p.good };
    const cell = (text, row, column) =>
      row < 0 ? p.bold(text) : column === 4 ? (decide[cells[row][4]] ?? same)(text) : text;
    lines.push('', ...renderTable(HEADER, cells, cell).map((line) => `  ${line}`));
    const hidden = result.ci.rows.length - shown.length;
    if (hidden) lines.push(p.dim(`  (${hidden} other check(s) green or skipped)`));
  }

  lines.push('');
  if (!result.proceed) {
    lines.push(p.bad('Preflight refused the release:'), ...result.refusals.map((reason) => p.bad(`  - ${reason}`)));
    const ciOnly = result.gates.filter((gate) => !gate.ok).every((gate) => gate.overridable);
    if (ciOnly) lines.push(p.warn('Red CI can be overridden with --allow-red-ci; the release notes then say so.'));
  } else if (result.notes.length) {
    lines.push(p.warn('Preflight passed with --allow-red-ci. The GitHub release notes will end with:'));
    lines.push(...result.notes.map((note) => p.warn(`  ${note}`)));
  } else {
    lines.push(p.good('Preflight passed.'));
  }
  return lines;
}
