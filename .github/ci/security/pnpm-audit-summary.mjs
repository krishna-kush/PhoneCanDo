// Summarise a `pnpm audit --json` report for the Security workflow.
// Usage: node pnpm-audit-summary.mjs <project> <report.json> [level]
//
// Writes a severity table plus every advisory at or above <level> (default
// high) to $GITHUB_STEP_SUMMARY, and prints one ::warning:: annotation when
// any such advisory exists. It never fails the job: transitive React Native /
// Expo advisories are common and only fixable by an Expo SDK bump, so this is
// a report, not a gate (dependency-review and osv-scanner gate PRs instead).
// Zero dependencies; the report shape is pnpm 11's AuditReport
// (advisories keyed by id, metadata.vulnerabilities counts).
import { appendFileSync, readFileSync } from 'node:fs';

const LEVELS = ['info', 'low', 'moderate', 'high', 'critical'];
const [project = '?', reportPath, level = 'high'] = process.argv.slice(2);
const threshold = Math.max(0, LEVELS.indexOf(level));

const lines = [`### pnpm audit: \`${project}\``, ''];
// Annotations and table cells must stay on one line.
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const out = () => {
  const text = `${lines.join('\n')}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  else process.stdout.write(text);
};

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (err) {
  lines.push(`pnpm audit produced no readable JSON report (${oneLine(err.message)}).`);
  console.log(`::warning title=pnpm audit (${project})::no readable report; see the audit step log`);
  out();
  process.exit(0);
}

if (report.error) {
  const msg = oneLine(report.error.message ?? JSON.stringify(report.error));
  lines.push(`pnpm audit failed: ${msg}`);
  console.log(`::warning title=pnpm audit (${project})::${msg}`);
  out();
  process.exit(0);
}

const counts = report.metadata?.vulnerabilities ?? {};
const deps = report.metadata?.totalDependencies;
lines.push('| Severity | Advisories |', '| --- | ---: |');
for (const sev of [...LEVELS].reverse()) lines.push(`| ${sev} | ${counts[sev] ?? 0} |`);
if (deps !== undefined) lines.push('', `${deps} dependencies audited.`);

const cell = (s) => oneLine(s).replaceAll('|', '\\|');
const flagged = Object.values(report.advisories ?? {})
  .filter((a) => LEVELS.indexOf(a.severity) >= threshold)
  .sort((a, b) => LEVELS.indexOf(b.severity) - LEVELS.indexOf(a.severity)
    || String(a.module_name).localeCompare(String(b.module_name)));

if (flagged.length) {
  lines.push('', `#### ${level} and above`, '',
    '| Severity | Package | Advisory | Vulnerable | Patched | Scope |',
    '| --- | --- | --- | --- | --- | --- |');
  for (const a of flagged) {
    // A finding is runtime when any install path reaches it outside devDependencies.
    const runtime = (a.findings ?? []).some((f) => !f.dev);
    const title = a.url ? `[${cell(a.title)}](${a.url})` : cell(a.title);
    lines.push(`| ${a.severity} | \`${cell(a.module_name)}\` | ${title} | \`${cell(a.vulnerable_versions)}\` `
      + `| ${a.patched_versions ? `\`${cell(a.patched_versions)}\`` : 'none'} | ${runtime ? 'runtime' : 'dev'} |`);
  }
  console.log(`::warning title=pnpm audit (${project})::${flagged.length} advisories at ${level} or above (non-blocking; see the job summary)`);
} else {
  lines.push('', `No advisories at ${level} or above.`);
}
out();
