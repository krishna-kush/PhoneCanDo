#!/usr/bin/env node
// Repo hygiene gate: things no linter owns but every reviewer hates.
//
//   CI:    git ls-files -s -z | node .github/ci/lint/check-hygiene.mjs --git-stage
//   Local: node .github/ci/lint/check-hygiene.mjs   (walks the tree, see files.mjs)
//
// Checks, each scoped so the current tree passes and the exceptions are named:
//   crlf          CRLF line endings (Windows batch files exempt)
//   utf8          text files must be valid UTF-8 without a BOM
//   eof-newline   non-empty text files end with "\n"
//   trailing-ws   trailing spaces/tabs (Markdown and vendored text exempt)
//   conflict      leftover merge-conflict markers
//   large-file    > 5 MiB outside the asset dirs (hard cap 25 MiB there)
//   forbidden     signing keys, env files, build outputs, OS junk
//   exec-bit      *.sh and non-Node shebang scripts must be committed 100755
//                 (warning only under .github/, where workflows call the interpreter)
//   portability   names that break Windows/macOS checkouts (case clashes, <>:"|?*)
import { readFileSync, statSync } from 'node:fs';
import { listFiles, report, isBinary, summary } from './files.mjs';

// Generated or vendored: owned by their generator, not hand-edited.
const GENERATED = [
  /(^|\/)pnpm-lock\.yaml$/,
  /^app\/assets\/xterm\/terminal\.bundle\.html$/, // node app/scripts/inline-xterm.js
  /^app\/assets\/xterm\/xterm\.(js|css)$/, // vendored @xterm/xterm dist
  /^pce\/gradlew(\.bat)?$/, /^pce\/gradle\/wrapper\//, // Gradle wrapper
  /\.patch$/, // upstream diffs keep upstream whitespace
];
const CRLF_OK = [/\.(bat|cmd)$/i];
// Markdown is markdownlint's (two trailing spaces are a hard line break);
// the font licence is vendored verbatim.
const TRAILING_WS_SKIP = [/\.md$/i, /^app\/assets\/fonts\//];
const MIB = 1024 * 1024;
const ASSET_DIRS = [/^app\/assets\//, /^web\/public\//];
const FORBIDDEN = [
  [/\.(jks|keystore|p8|p12|pfx|pem|key|mobileprovision)$/i, 'signing key / certificate'],
  [/(^|\/)release\.env$/, 'release secrets file'],
  [/(^|\/)\.env(\.(?!example$)[^/]+)?$/, 'env file (only .env.example may be committed)'],
  [/(^|\/)(id_rsa|id_ed25519|id_ecdsa)(\.pub)?$/, 'SSH key'],
  [/(^|\/)local\.properties$/, 'machine-local Android SDK path'],
  [/\.(apk|aab|apks|idsig)$/i, 'build output (releases go to GitHub Releases)'],
  [/(^|\/)(node_modules|__pycache__|\.gradle|\.cxx|\.expo)\//, 'dependency/build cache'],
  [/\.(pyc|class|o|so)$/, 'compiled artefact'],
  [/(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/, 'OS junk'],
];
const WINDOWS_BAD = /[<>:"|?*\\\x00-\x1f]|[. ]$/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

const files = listFiles(process.argv.slice(2));
const counts = {};
const fail = (check, file, line, msg) => {
  counts[check] = (counts[check] ?? 0) + 1;
  report('error', file, line, `[${check}] ${msg}`);
};
const any = (res, p) => res.some((re) => re.test(p));
const utf8 = new TextDecoder('utf-8', { fatal: true });

// portability: case-insensitive clashes of files or directories (they collapse
// into one on macOS/Windows checkouts) and names Windows cannot create.
const lower = new Map();
const clashed = new Set();
for (const { path } of files) {
  const segs = path.split('/');
  for (let i = 1; i <= segs.length; i++) {
    const p = segs.slice(0, i).join('/');
    const k = p.toLowerCase();
    const seen = lower.get(k);
    if (seen === undefined) lower.set(k, p);
    else if (seen !== p && !clashed.has(k)) {
      clashed.add(k);
      fail('portability', path, 0, `"${p}" differs only in case from "${seen}"`);
    }
  }
  for (const seg of segs) {
    if (WINDOWS_BAD.test(seg)) fail('portability', path, 0, `segment "${seg}" is not a valid Windows file name`);
    if (WINDOWS_RESERVED.test(seg)) fail('portability', path, 0, `segment "${seg}" is a reserved device name on Windows`);
  }
}

let scanned = 0;
for (const { path, mode } of files) {
  for (const [re, why] of FORBIDDEN) if (re.test(path)) fail('forbidden', path, 0, `${why} must not be committed`);
  if (mode === '120000' || mode === '160000') continue; // symlink / submodule: no content to check

  const size = statSync(path).size;
  const cap = any(ASSET_DIRS, path) ? 25 * MIB : 5 * MIB;
  if (size > cap) fail('large-file', path, 0, `${(size / MIB).toFixed(1)} MiB exceeds ${cap / MIB} MiB`);

  const buf = readFileSync(path);
  if (isBinary(buf) || size === 0) continue;
  scanned++;
  const generated = any(GENERATED, path);

  let text;
  try {
    text = utf8.decode(buf);
  } catch {
    fail('utf8', path, 0, 'not valid UTF-8');
    continue;
  }
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) fail('utf8', path, 1, 'starts with a UTF-8 BOM');

  if (!any(CRLF_OK, path) && text.includes('\r\n')) {
    fail('crlf', path, text.slice(0, text.indexOf('\r\n')).split('\n').length, 'CRLF line endings');
  }
  if (!generated && !text.endsWith('\n')) fail('eof-newline', path, 0, 'no newline at end of file');

  const shebang = text.startsWith('#!') ? text.slice(0, text.indexOf('\n')) : '';
  const wantsExec = /\.(sh|bash)$/.test(path) || (shebang && !/\bnode\b|\bbun\b|\bdeno\b/.test(shebang));
  if (wantsExec && mode !== '100755') {
    const msg = `${shebang || 'shell script'} is not executable (git update-index --chmod=+x)`;
    // CI helpers are always run through their interpreter (bash x.sh): warn only.
    if (path.startsWith('.github/')) report('warning', path, 0, `[exec-bit] ${msg}`);
    else fail('exec-bit', path, 0, msg);
  }

  const wsScope = !generated && !any(TRAILING_WS_SKIP, path);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^(<{7}|>{7}|\|{7})( |$)/.test(l)) fail('conflict', path, i + 1, 'merge-conflict marker');
    if (wsScope && /[ \t]+\r?$/.test(l)) fail('trailing-ws', path, i + 1, 'trailing whitespace');
  }
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
summary(
  [
    `**Hygiene:** ${files.length} files listed, ${scanned} text files scanned, ${total} problem(s).`,
    ...Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`),
  ].join('\n'),
);
process.exit(total ? 1 : 0);
