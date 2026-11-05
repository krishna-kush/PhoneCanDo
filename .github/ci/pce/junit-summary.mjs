// Summarises the JUnit XML files Gradle writes under */build/test-results/
// as a Markdown table per module and test task, plus the failing cases.
// Zero deps. Appends to $GITHUB_STEP_SUMMARY when set, else prints.
//
//   node junit-summary.mjs <root> [--title "PCE tests"] [--require-tests]
//
// --require-tests fails when no test ran at all, so a misconfigured task
// filter can never pass silently. Test failures themselves are Gradle's to
// report; this script only exits non-zero for --require-tests.
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const args = process.argv.slice(2);
const take = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args.splice(i, 2)[1];
};
const title = take('--title') ?? 'Test results';
const requireTests = args.includes('--require-tests');
const root = args.find((a) => !a.startsWith('--')) ?? '.';

// Every */build/test-results/<task>/*.xml below root (skips Gradle caches).
function findResults(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.gradle' || name === '.git') continue;
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) {
      const parts = relative(root, path).split(sep);
      const at = parts.indexOf('test-results');
      if (name.endsWith('.xml') && at > 0 && parts[at - 1] === 'build') out.push({ path, parts, at });
    } else {
      findResults(path, out);
    }
  }
  return out;
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const unescape = (s) =>
  (s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
// One Markdown table/list cell: single line, pipes and HTML neutralised.
const cell = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

const rows = new Map(); // "module|task" -> totals
const failures = [];
for (const { path, parts, at } of findResults(root)) {
  const module = parts.slice(0, at - 1).join('/') || '.';
  const task = parts[at + 1] ?? '?';
  const xml = readFileSync(path, 'utf8');
  for (const [suite] of xml.matchAll(/<testsuite\b[^>]*>/g)) {
    const key = `${module}|${task}`;
    const row = rows.get(key) ?? { module, task, tests: 0, failed: 0, skipped: 0, time: 0 };
    row.tests += Number(attr(suite, 'tests') ?? 0);
    row.failed += Number(attr(suite, 'failures') ?? 0) + Number(attr(suite, 'errors') ?? 0);
    row.skipped += Number(attr(suite, 'skipped') ?? 0);
    row.time += Number(attr(suite, 'time') ?? 0);
    rows.set(key, row);
  }
  // Self-closing <testcase .../> passed; only bodies can hold <failure>/<error>.
  for (const [, open, body] of xml.matchAll(/<testcase\b((?:[^>"]|"[^"]*")*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const problem = body?.match(/<(failure|error)\b((?:[^>"]|"[^"]*")*)>/);
    if (!problem) continue;
    const message = unescape(attr(problem[2], 'message') ?? problem[1]).split('\n')[0].slice(0, 200);
    failures.push({ module, test: `${unescape(attr(open, 'classname'))}.${unescape(attr(open, 'name'))}`, message });
  }
}

const sorted = [...rows.values()].sort((a, b) => `${a.module}${a.task}`.localeCompare(`${b.module}${b.task}`));
const total = sorted.reduce(
  (t, r) => ({ tests: t.tests + r.tests, failed: t.failed + r.failed, skipped: t.skipped + r.skipped, time: t.time + r.time }),
  { tests: 0, failed: 0, skipped: 0, time: 0 },
);

const lines = [`### ${title}`, ''];
if (sorted.length === 0) {
  lines.push(`No JUnit XML found under \`${root}\`.`);
} else {
  const status = total.failed ? `❌ ${total.failed} failed` : '✅ all passed';
  lines.push(`**${total.tests} tests**, ${status}, ${total.skipped} skipped, ${total.time.toFixed(1)} s`, '');
  lines.push('| Module | Task | Tests | Passed | Failed | Skipped | Time (s) |', '|---|---|--:|--:|--:|--:|--:|');
  for (const r of sorted) {
    const passed = r.tests - r.failed - r.skipped;
    lines.push(`| ${cell(r.module)} | ${cell(r.task)} | ${r.tests} | ${passed} | ${r.failed} | ${r.skipped} | ${r.time.toFixed(2)} |`);
  }
}
if (failures.length) {
  lines.push('', '<details open><summary>Failing tests</summary>', '');
  for (const f of failures.slice(0, 50)) lines.push(`- \`${cell(f.module)}\` **${cell(f.test)}**: ${cell(f.message)}`);
  if (failures.length > 50) lines.push(`- … and ${failures.length - 50} more`);
  lines.push('', '</details>');
  if (process.env.GITHUB_ACTIONS) {
    for (const f of failures.slice(0, 10)) console.log(`::error title=Test failed (${f.module})::${f.test}: ${f.message}`);
  }
}
const markdown = `${lines.join('\n')}\n\n`;

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);

if (requireTests && total.tests === 0) {
  console.error(`junit-summary: --require-tests, but no tests ran under ${root}`);
  process.exit(1);
}
