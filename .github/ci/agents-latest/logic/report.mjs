// A leg's report: a Markdown table for the step summary, a collapsed log
// per failure, a GitHub annotation per failure that names the kind, the
// probe and what is missing, and one JSON line per check. Pure.
import { plain } from './probes.mjs';

export function header(kind) {
  return [`### \`${kind}\` at its newest release`, '', '| Check | | Time | Output |', '|---|---|---|---|'];
}

/** One line of at most 100 characters, escapes stripped, pipes escaped for the table. */
export function oneline(text) {
  const flat = plain(text ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
  return flat.length > 100 ? `${flat.slice(0, 97)}...` : flat;
}

export function row({ check, ok, secs, detail }) {
  return `| ${check} | ${ok ? 'OK' : '**FAIL**'} | ${secs}s | ${oneline(detail)} |`;
}

/** The log of a failed check, collapsed, its last 80 lines. */
export function details(check, log) {
  const tail = plain(log ?? '').split('\n').slice(-80).join('\n').replace(/```/g, "'''");
  return ['', `<details><summary>${check}</summary>`, '', '```', tail, '```', '</details>'].join('\n');
}

/** A GitHub error annotation: the kind in the title, the check and what is wrong in the message. */
export function annotation(kind, check, detail) {
  const escape = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  return `::error title=agents-latest ${kind}::${escape(`${kind}: ${check}: ${oneline(detail)}`)}`;
}

export function resultLine(kind, { check, ok, secs, detail }) {
  return JSON.stringify({ kind, check, ok, secs, detail: oneline(detail) });
}
