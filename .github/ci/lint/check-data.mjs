#!/usr/bin/env node
// Data-file gate: every JSON/JSONC file parses, has no duplicate keys, and the
// few hand-kept data files that other code trusts blindly are well formed.
//
//   CI:    git ls-files -s -z | node .github/ci/lint/check-data.mjs --git-stage
//   Local: node .github/ci/lint/check-data.mjs   (walks the tree, see files.mjs)
//
// YAML, TOML and XML are checked by check-data.py, not here.
//
// JSONC (comments + trailing commas) is accepted only where the consuming tool
// accepts it: *.jsonc, tsconfig*/jsconfig*, .vscode/*.json. Everywhere else a
// comment is a bug (package.json, app.json, theme/*.json are read with
// JSON.parse by scripts and bundlers).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { listFiles, report, summary } from './files.mjs';

const JSON_FILES = /\.(json|jsonc|webmanifest)$/;
const JSONC_OK = [/\.jsonc$/, /(^|\/)(tsconfig|jsconfig)[^/]*\.json$/, /(^|\/)\.vscode\/[^/]+\.json$/];

let problems = 0;
const fail = (file, msg, line = 0) => {
  problems++;
  report('error', file, line, msg);
};

// Strip // and /* */ comments and trailing commas, leaving strings intact and
// keeping newlines so error positions still map to source lines.
function stripJsonc(src) {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j;
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const body = src.slice(i, end < 0 ? src.length : end + 2);
      out += body.replace(/[^\n]/g, ' ');
      i += body.length - 1;
    } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

// JSON.parse keeps the last of duplicate keys silently; walk the tokens to
// catch them. Input must already be valid JSON (checked by JSON.parse first).
function duplicateKeys(src) {
  const dups = [];
  const stack = [];
  let line = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') line++;
    else if (c === '{') stack.push(new Set());
    else if (c === '[') stack.push(null);
    else if (c === '}' || c === ']') stack.pop();
    else if (c === '"') {
      let j = i + 1;
      while (src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
      const raw = src.slice(i, j + 1);
      let k = j + 1;
      while (/\s/.test(src[k] ?? '')) k++;
      const keys = stack[stack.length - 1];
      if (src[k] === ':' && keys) {
        const key = JSON.parse(raw);
        if (keys.has(key)) dups.push({ key, line });
        keys.add(key);
      }
      i = j;
    }
  }
  return dups;
}

function lineOf(src, err) {
  const m = /position (\d+)/.exec(err.message) ?? /line (\d+)/.exec(err.message);
  if (!m) return 0;
  return err.message.includes('position') ? src.slice(0, Number(m[1])).split('\n').length : Number(m[1]);
}

const docs = new Map();
const files = listFiles(process.argv.slice(2)).filter((f) => JSON_FILES.test(f.path) && f.mode !== '120000');
for (const { path } of files) {
  const raw = readFileSync(path, 'utf8');
  const jsonc = JSONC_OK.some((re) => re.test(path));
  const src = jsonc ? stripJsonc(raw) : raw;
  let value;
  try {
    value = JSON.parse(src);
  } catch (err) {
    fail(path, `${jsonc ? 'JSONC' : 'JSON'} does not parse: ${err.message}`, lineOf(src, err));
    continue;
  }
  for (const d of duplicateKeys(src)) fail(path, `duplicate key "${d.key}"`, d.line);
  docs.set(path, value);
}

// ---- semantic checks on files other code trusts -------------------------
// (theme/tokens.json shape and the make-logos outputs such as
// site.webmanifest colours are owned by .github/ci/js/check-theme.mjs and
// check-generated.mjs; not duplicated here.)

// Local paths referenced from config must exist (a typo here only shows up
// at prebuild / deploy time).
function mustExist(file, ref, base) {
  if (typeof ref !== 'string' || !/^\.{0,2}\//.test(ref)) return;
  const target = ref.startsWith('/') ? join(base, ref) : join(dirname(file), ref);
  if (!existsSync(target)) fail(file, `references missing file ${ref}`);
}
const appJson = docs.get('app/app.json');
if (appJson?.expo) {
  const e = appJson.expo;
  const refs = [
    e.icon, e.splash?.image, e.web?.favicon,
    e.android?.adaptiveIcon?.foregroundImage, e.android?.adaptiveIcon?.backgroundImage,
    e.android?.adaptiveIcon?.monochromeImage,
    ...(e.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p)),
  ];
  for (const r of refs) mustExist('app/app.json', r, 'app');
}
const manifest = docs.get('web/public/site.webmanifest');
if (manifest) {
  for (const icon of manifest.icons ?? []) mustExist('web/public/site.webmanifest', icon.src, 'web/public');
}

// web/src/data/release.json feeds the per-OS install commands (sha256 pinned
// into copy-paste shell). A malformed hash there ships a broken command.
const release = docs.get('web/src/data/release.json');
if (release) {
  const f = 'web/src/data/release.json';
  if (!/^\d+\.\d+\.\d+$/.test(release.version ?? '')) fail(f, `version ${JSON.stringify(release.version)} is not x.y.z`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(release.repo ?? '')) fail(f, `repo ${JSON.stringify(release.repo)} is not owner/name`);
  if (release.released && !/^\d{4}-\d{2}-\d{2}$/.test(release.released)) fail(f, `released is not YYYY-MM-DD`);
  for (const ch of ['lite', 'full']) {
    const a = release[ch];
    if (!a) continue;
    if (!/^[0-9a-f]{64}$/.test(a.sha256 ?? '')) fail(f, `${ch}.sha256 is not 64 lowercase hex chars`);
    if (!Number.isInteger(a.size) || a.size <= 0) fail(f, `${ch}.size is not a positive integer`);
  }
}

// One pnpm for the whole repo: a sub-package pinning a different
// packageManager would make corepack/pnpm-action-setup disagree.
const rootPm = docs.get('package.json')?.packageManager;
for (const [path, v] of docs) {
  if (path.endsWith('package.json') && path !== 'package.json' && v?.packageManager && v.packageManager !== rootPm) {
    fail(path, `packageManager ${v.packageManager} differs from root ${rootPm}`);
  }
}

summary(`**Data:** ${files.length} JSON/JSONC file(s) parsed and cross-checked, ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
