// Shared file-list helper for the lint scripts (zero deps).
//
// In CI the list comes from git (the source of truth for "tracked"):
//   git ls-files -s -z | node <script> --git-stage
// Locally (no git allowed in this repo's agent workflow) it walks the tree and
// approximates the .gitignore files: generated/build/dependency dirs are pruned
// and ignored file patterns are skipped. Each entry is { path, mode } where
// mode is the git mode string ('100644', '100755', '120000', '160000').
import { appendFileSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const PRUNE_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.expo', '.gradle', '.cxx', '.kotlin',
  '.tamagui', '.astro', '__pycache__', '.playwright-mcp', 'reference', 'web-build',
]);
// Paths ignored by the repo .gitignore files (root, app/, pce/, web/, videos/).
const PRUNE_PATHS = new Set([
  'app/android', 'app/ios', 'videos/out', 'videos/public',
  'app/modules/phonecando-linux/android/src/linux/libs',
  'app/modules/phonecando-linux/android/src/linux/assets',
  'app/modules/phonecando-linux/android/src/linux/dev-assets',
  'app/modules/phonecando-models/android/src/main/jniLibs',
]);
// The same, for ignored paths with a wildcard (staged native agent payloads).
const PRUNE_PATTERNS = [/^app\/modules\/phonecando-runner\/android\/src\/agents\/[^/]+\/libs$/];
const IGNORED_FILES = [
  /\.log$/, /(^|\/)\.DS_Store$/, /(^|\/)local\.properties$/, /\.iml$/, /\.tsbuildinfo$/,
  /(^|\/)expo-env\.d\.ts$/, /\.(jks|keystore|p8|p12|key|pem|mobileprovision)$/,
  /(^|\/)release\.env$/, /(^|\/)\.env(\.(?!example$)[^/]*)?$/, /\.orig\./, /(^|\/)\.metro-health-check/,
  /^videos\/brand\/facts\/facts\.gen\.json$/,
];

function walk(root) {
  const out = [];
  const visit = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, ent.name);
      const rel = relative(root, abs).split(sep).join('/');
      if (ent.isDirectory()) {
        if (PRUNE_DIRS.has(ent.name) || PRUNE_PATHS.has(rel) || PRUNE_PATTERNS.some((re) => re.test(rel))) continue;
        visit(abs);
      } else if (!IGNORED_FILES.some((re) => re.test(rel))) {
        const st = lstatSync(abs);
        const mode = st.isSymbolicLink() ? '120000' : st.mode & 0o111 ? '100755' : '100644';
        out.push({ path: rel, mode });
      }
    }
  };
  visit(root);
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

// Parses `git ls-files -s -z` ("<mode> <sha> <stage>\t<path>\0" records).
function fromGitStage(buf) {
  return buf
    .split('\0')
    .filter(Boolean)
    .map((rec) => {
      const tab = rec.indexOf('\t');
      return { path: rec.slice(tab + 1), mode: rec.slice(0, rec.indexOf(' ')) };
    });
}

/** Returns [{ path, mode }] relative to `root` (the repo root). */
export function listFiles(argv, root = process.cwd()) {
  if (argv.includes('--git-stage')) return fromGitStage(readFileSync(0, 'utf8'));
  return walk(root);
}

/** GitHub annotation when running in Actions, plain line otherwise. */
export function report(level, file, line, msg) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    const loc = line ? `file=${file},line=${line}` : `file=${file}`;
    console.log(`::${level} ${loc}::${msg.replace(/\r?\n/g, ' ')}`);
  } else {
    console.log(`${level}: ${file}${line ? `:${line}` : ''}: ${msg}`);
  }
}

/** Prints `text` and, in Actions, appends it to the job summary. */
export function summary(text) {
  console.log(text);
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${text}\n`);
}

/** Git's own heuristic: a NUL byte in the first 8000 bytes means binary. */
export const isBinary = (buf) => buf.subarray(0, 8000).includes(0);
