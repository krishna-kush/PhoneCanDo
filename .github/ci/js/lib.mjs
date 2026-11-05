// Shared bits for the ci.yml helpers (zero deps). Every helper resolves the
// repo from this file's location, so it runs the same from any cwd:
//   node .github/ci/js/<helper>.mjs
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

export function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(2)} MiB`;
}

// Markdown goes to the job summary on GitHub and to stdout everywhere, so a
// local run shows the same report.
export function summary(markdown) {
  process.stdout.write(`${markdown}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}

// GitHub annotations (::error file=...::) when in Actions, plain lines locally.
const ACTIONS = process.env.GITHUB_ACTIONS === 'true';
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
function annotate(level, msg, file) {
  if (ACTIONS) console.log(`::${level}${file ? ` file=${file}` : ''}::${esc(msg)}`);
  else console.log(`${level.toUpperCase()}${file ? ` ${file}` : ''}: ${msg}`);
}

// Collects failures so a helper reports every problem in one run, then exits.
export function createReport() {
  const errors = [];
  return {
    errors,
    error(msg, file) {
      errors.push(file ? `${file}: ${msg}` : msg);
      annotate('error', msg, file);
    },
    warn: (msg, file) => annotate('warning', msg, file),
    notice: (msg, file) => annotate('notice', msg, file),
    finish(what) {
      if (errors.length) {
        console.log(`\n${what}: ${errors.length} problem(s)`);
        process.exit(1);
      }
      console.log(`\n${what}: OK`);
    },
  };
}
