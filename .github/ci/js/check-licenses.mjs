#!/usr/bin/env node
// Licence notice gate: THIRD_PARTY_NOTICES.md and the app's Licenses dialog
// (app/src/ui/common/licenses.ts) list the same components under the same
// licenses, and every component we know the APKs ship has an entry in both.
//
//   headings  notices "## <components> — <license>" and the dialog's
//             "=====" banners around "<components> — <license>". Components
//             split on ", " and " and "; a "(...)" note is ignored for
//             matching. Each component on one side is on the other with the
//             same license, except NOTICE_ONLY sections (in no APK), which
//             must stay out of the dialog.
//   shipped   each SHIPPED entry (native libs, Gradle deps, the baked image)
//             has its component in both files, and both sections name it and,
//             where a build file pins it, the version we build.
//   texts     each license the dialog names has its full text there exactly
//             once (other entries point to it), in licenses.ts or the
//             ./license-texts/ modules it interpolates.
//   repo      both files point at our releases page, app/src/engine/updates.ts
//             REPO (the repo the app updates from).
//
//   node .github/ci/js/check-licenses.mjs [--notices <md>] [--app <licenses.ts>]
// The flags read other copies (e.g. a deliberately broken one in a scratch
// dir); pins, build files and updates.ts always come from the repo.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { ROOT, createReport, summary } from './lib.mjs';

// Notice sections for things no APK ships, and why.
const NOTICE_ONLY = {
  Shizuku: 'PCE-only module, not bundled',
  Website: 'the site, not the app',
  'npm dependencies': 'pointer to the bundled JavaScript',
};

// What we know ships: [what, component, text both sections must name,
// optional [build file, regex capturing the version we build]].
const SHIPPED = [
  ['libproot.so', 'PRoot', 'libproot.so', ['lre/proot/pins.env', /^PROOT_VERSION=(\S+)$/m]],
  ['libproot-loader.so', 'PRoot', 'libproot-loader.so'],
  ['talloc (static in libproot.so)', 'talloc', 'libproot.so', ['lre/proot/pins.env', /^TALLOC_VERSION=(\S+)$/m]],
  ['org.tukaani:xz', 'XZ for Java', 'org.tukaani:xz', ['lre/tar/build.gradle.kts', /"org\.tukaani:xz:([^"]+)"/]],
  ['kotlinx-serialization-json', 'kotlinx', 'kotlinx-serialization-json',
    ['lre/oci/build.gradle.kts', /"org\.jetbrains\.kotlinx:kotlinx-serialization-json:([^"]+)"/]],
  ['org.nanohttpd:nanohttpd', 'NanoHTTPD', 'NanoHTTPD',
    ['app/modules/phonecando-runner/android/build.gradle', /'org\.nanohttpd:nanohttpd:([^']+)'/]],
  ['Default Linux image (assets/default-image/)', 'Default Linux image', 'linux-image-'],
];

// Start and end phrases of each full license text (whitespace-insensitive);
// each start phrase must be unique to its text, since it is also how we
// count copies. A license may need several texts (LGPL-3.0 incorporates
// GPL-3.0; PRoot, our one GPL-2.0-or-later component, carries GNU C Library
// definitions under LGPL-2.1-or-later).
const TEXTS = {
  'MIT License': [['Permission is hereby granted, free of charge, to any person obtaining a copy of this software', 'OTHER DEALINGS IN THE SOFTWARE.']],
  'SIL Open Font License 1.1': [['SIL OPEN FONT LICENSE Version 1.1', 'OTHER DEALINGS IN THE FONT SOFTWARE.']],
  'BSD-3-Clause': [['Redistributions of source code must retain', 'EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.']],
  'Apache License 2.0': [['Apache License Version 2.0, January 2004', 'limitations under the License.']],
  '0BSD': [['Permission to use, copy, modify, and/or distribute this software', 'PERFORMANCE OF THIS SOFTWARE.']],
  'GPL-2.0-or-later': [
    ['GNU GENERAL PUBLIC LICENSE Version 2, June 1991', 'Ty Coon, President of Vice'],
    ['GNU LESSER GENERAL PUBLIC LICENSE Version 2.1, February 1999', "That's all there is to it!"],
  ],
  'LGPL-3.0-or-later': [
    ['This version of the GNU Lesser General Public License incorporates', 'choose that version for the Library.'],
    ['The GNU General Public License is a free, copyleft license for', 'why-not-lgpl.html>.'],
  ],
  // The packages' own texts ship inside the image (/usr/share/doc/*/copyright).
  'per-package licenses': [],
};

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : fallback;
};
const noticesPath = flag('--notices', join(ROOT, 'THIRD_PARTY_NOTICES.md'));
const appPath = flag('--app', join(ROOT, 'app/src/ui/common/licenses.ts'));
const show = (p) => (relative(ROOT, p).startsWith('..') || isAbsolute(relative(ROOT, p)) ? p : relative(ROOT, p));
const NOTICES = show(noticesPath);
const APP = show(appPath);
const r = createReport();

for (const p of [noticesPath, appPath]) if (!existsSync(p)) r.error('file not found', show(p));
if (r.errors.length) r.finish('licenses');

// The dialog's text as the app composes it: licenses.ts with each
// ${NAME} imported from ./license-texts/ replaced by that module's string.
function composeApp(path) {
  let src = readFileSync(path, 'utf8');
  for (const [, name, mod] of src.matchAll(/^import \{ (\w+) \} from '(\.\/license-texts\/[\w.-]+)';$/gm)) {
    const file = join(dirname(path), `${mod}.ts`);
    const body = existsSync(file) && readFileSync(file, 'utf8').match(new RegExp(`export const ${name} = \`([\\s\\S]*)\`;`));
    if (!body) r.error(`${mod}.ts has no \`export const ${name} = \\\`...\\\`;\``, APP);
    else src = src.split(`\${${name}}`).join(body[1]);
  }
  for (const [ph] of src.matchAll(/\$\{[^}]*\}/g)) r.error(`${ph} is unresolved (not a ./license-texts/ import, or its module failed)`, APP);
  return src.replace(/\\`/g, '`').replace(/\\\$\{/g, '${').replace(/\\\\/g, '\\');
}

// [{ heading, license, keys, body }] from heading line indexes.
function sections(lines, starts, bodyStart, prefix = '') {
  return starts.map((at, n) => {
    const heading = lines[at].slice(prefix.length).trim();
    const m = heading.match(/^(.*?)\s+—\s+(.+)$/);
    const names = (m ? m[1] : heading).split(/,\s*|\s+and\s+/);
    const end = n + 1 < starts.length ? starts[n + 1] : lines.length;
    return {
      heading,
      license: m ? m[2].trim() : null,
      keys: names.map((s) => s.replace(/\s*\([^)]*\)/g, '').trim()).filter(Boolean),
      body: lines.slice(at + bodyStart, end).join('\n'),
    };
  });
}

const notesText = readFileSync(noticesPath, 'utf8');
const notesLines = notesText.split('\n');
const notes = sections(notesLines, notesLines.flatMap((l, i) => (/^## /.test(l) ? [i] : [])), 1, '## ');

const appText = composeApp(appPath);
const appLines = appText.split('\n');
const banner = (l) => /^={20,}$/.test(l ?? '');
const app = sections(appLines, appLines.flatMap((l, i) => (banner(appLines[i - 1]) && banner(appLines[i + 1]) && l.trim() ? [i] : [])), 2);

function index(list, file) {
  const map = new Map();
  for (const s of list) {
    for (const key of s.keys) {
      if (map.has(key)) r.error(`"${key}" is listed twice ("${map.get(key).heading}", "${s.heading}")`, file);
      else map.set(key, s);
    }
  }
  return map;
}
const byNote = index(notes, NOTICES);
const byApp = index(app, APP);
if (!app.length) r.error('no "=====" banner headings found', APP);

// headings
for (const [key, s] of byNote) {
  if (key in NOTICE_ONLY) {
    if (byApp.has(key)) r.error(`"${key}" is in no APK (${NOTICE_ONLY[key]}) but is in the dialog`, APP);
    continue;
  }
  if (!s.license) r.error(`heading "## ${s.heading}" has no " — <license>"`, NOTICES);
  const a = byApp.get(key);
  if (!a) r.error(`"${key}" (${s.license}) is in ${NOTICES} but not in the dialog`, APP);
  else if (a.license !== s.license) r.error(`"${key}": ${NOTICES} says "${s.license}", the dialog "${a.license}"`, APP);
}
for (const [key, a] of byApp) {
  if (!a.license) r.error(`banner "${a.heading}" has no " — <license>"`, APP);
  if (!byNote.has(key) && !(key in NOTICE_ONLY)) r.error(`"${key}" (${a.license}) is in the dialog but not in ${NOTICES}`, NOTICES);
}
for (const key of Object.keys(NOTICE_ONLY)) {
  if (!byNote.has(key)) r.warn(`NOTICE_ONLY lists "${key}", which ${NOTICES} no longer has`);
}

// shipped
const shippedRows = [];
for (const [what, key, mention, pin] of SHIPPED) {
  let version = '';
  if (pin) {
    const m = readFileSync(join(ROOT, pin[0]), 'utf8').match(pin[1]);
    if (!m) r.error(`cannot read the version of ${what} from ${pin[0]}`, pin[0]);
    else version = m[1];
  }
  for (const [map, file] of [[byNote, NOTICES], [byApp, APP]]) {
    const s = map.get(key);
    if (!s) {
      r.error(`${what} ships but has no "${key}" entry`, file);
      continue;
    }
    if (!s.body.includes(mention)) r.error(`"${s.heading}" does not name ${mention} (${what})`, file);
    if (version && !s.body.includes(version)) r.error(`"${s.heading}" does not name ${what} ${version}, the version we build`, file);
  }
  shippedRows.push(`| ${what} | ${key} | ${version || '-'} |`);
}

// texts
const flat = (s) => s.replace(/\s+/g, ' ');
const appFlat = flat(appText);
const needed = new Map(); // start phrase -> [end phrase, license]
for (const license of new Set(app.map((s) => s.license).filter(Boolean))) {
  if (!(license in TEXTS)) r.error(`no full-text phrases known for "${license}"; add them to TEXTS in this script`, APP);
  else for (const [start, end] of TEXTS[license]) if (!needed.has(start)) needed.set(start, [end, license]);
}
for (const [start, [end, license]] of needed) {
  const at = appFlat.indexOf(flat(start));
  const copies = appFlat.split(flat(start)).length - 1;
  if (at < 0 || appFlat.indexOf(flat(end), at) < 0) r.error(`the full "${license}" text ("${start}" ... "${end}") is missing`, APP);
  else if (copies > 1) r.error(`the "${license}" text ("${start}") appears ${copies} times; keep one and point to it`, APP);
}

// repo
const repo = readFileSync(join(ROOT, 'app/src/engine/updates.ts'), 'utf8').match(/const REPO = '([^']+)'/)?.[1];
if (!repo) r.error("no `const REPO = '...'` in app/src/engine/updates.ts", 'app/src/engine/updates.ts');
for (const [text, file] of [[notesText, NOTICES], [appText, APP]]) {
  if (repo && !text.includes(`https://github.com/${repo}/releases`)) r.error(`no link to https://github.com/${repo}/releases (source offer)`, file);
  for (const [, other] of text.matchAll(/github\.com\/([\w.-]+\/PhoneCanDo)\b/gi)) {
    if (repo && other !== repo) r.error(`links github.com/${other}, but the app updates from ${repo}`, file);
  }
}

summary(
  [
    '### Licence notices',
    '',
    `${notes.length} sections in ${NOTICES}, ${app.length} entries in the dialog (${APP}, ${Buffer.byteLength(appText)} bytes composed).`,
    '',
    '| Component | License | Notices | Dialog |',
    '|---|---|---|---|',
    ...[...new Set([...byNote.keys(), ...byApp.keys()])].map((k) => {
      const s = byNote.get(k) ?? byApp.get(k);
      const note = k in NOTICE_ONLY ? `notice only: ${NOTICE_ONLY[k]}` : byNote.has(k) ? 'yes' : '**missing**';
      return `| ${k} | ${s.license ?? '-'} | ${note} | ${byApp.has(k) ? 'yes' : k in NOTICE_ONLY ? '-' : '**missing**'} |`;
    }),
    '',
    '| Ships | Entry | Version built |',
    '|---|---|---|',
    ...shippedRows,
  ].join('\n'),
);
r.finish('licenses');
