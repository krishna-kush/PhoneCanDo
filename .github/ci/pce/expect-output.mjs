// Checks a program's real output against the "Expected output" block its
// docs promise, so the PCE docs cannot drift from what the code prints.
// Zero deps. `...` inside an expected line matches anything.
//
//   node expect-output.mjs --doc <file.md> --after "<marker>" <actual.txt>...
//
// The expected block is the first ```text fence after the first line that
// contains <marker>. Actual files are concatenated in order; blank lines are
// ignored on both sides. Exits 1 on any mismatch and prints both versions.
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const take = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args.splice(i, 2)[1];
};
const doc = take('--doc');
const marker = take('--after');
if (!doc || !marker || args.length === 0) {
  console.error('usage: expect-output.mjs --doc <file.md> --after "<marker>" <actual.txt>...');
  process.exit(2);
}

const docLines = readFileSync(doc, 'utf8').split(/\r?\n/);
const start = docLines.findIndex((l) => l.includes(marker));
const open = docLines.findIndex((l, i) => i > start && /^```text\s*$/.test(l));
const close = docLines.findIndex((l, i) => i > open && /^```\s*$/.test(l));
if (start < 0 || open < 0 || close < 0) {
  console.error(`expect-output: no \`\`\`text block after "${marker}" in ${doc}`);
  process.exit(2);
}
const nonBlank = (lines) => lines.map((l) => l.trimEnd()).filter((l) => l.trim() !== '');
const expected = nonBlank(docLines.slice(open + 1, close));
const actual = nonBlank(args.flatMap((f) => readFileSync(f, 'utf8').split(/\r?\n/)));

const pattern = (line) =>
  new RegExp(`^${line.split('...').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
const mismatches = [];
for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
  const want = expected[i];
  const got = actual[i];
  if (want === undefined || got === undefined || !pattern(want).test(got)) {
    mismatches.push({ line: i + 1, want: want ?? '<nothing>', got: got ?? '<nothing>' });
  }
}

if (mismatches.length) {
  console.error(`Output does not match ${doc} (block after "${marker}"):`);
  for (const m of mismatches) console.error(`  line ${m.line}\n    expected: ${m.want}\n    actual:   ${m.got}`);
  console.error(`\nIf the new output is right, update the expected block in ${doc} in the same change.`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::error file=${doc},line=${open + 2},title=Docs drift::${mismatches.length} line(s) differ from the real output`);
  }
  process.exit(1);
}
console.log(`Output matches ${doc} (${expected.length} line(s)).`);
