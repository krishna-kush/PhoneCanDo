// Enforces the PCE dependency law (pce/AGENTS.md §2, §3, §5). Zero deps.
// Every rule is one the current tree satisfies, so a failure is a regression.
//
//   node check-deps.mjs [pce-dir]                     build files + sources
//   node check-deps.mjs --resolved <dir> [pce-dir]    Gradle `dependencies` reports
//   node check-deps.mjs --published <dir> [pce-dir]   POMs in <m2>/com/phonecando/pce
//
// LAW is the single source of truth for this check. A module added to
// settings.gradle.kts fails until its allowed edges are added here, so every
// new edge gets a deliberate review against AGENTS.md.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// Allowed production edges, straight from pce/AGENTS.md §2.
const LAW = {
  api: [],
  core: ['api'],
  json: ['api'],
  pack: ['api', 'json'],
  testkit: ['api'],
  android: ['api'],
  ime: ['api'],
  shizuku: ['api'],
  sample: ['core', 'testkit'],
};
const MODULES = Object.keys(LAW);
const PURE = ['api', 'core', 'json', 'pack', 'testkit']; // pure JVM (§2, §5)
const BACKENDS = ['android', 'ime', 'shizuku']; // the only Android modules (§2)
const UNPUBLISHED = ['sample']; // runnable proof, not a library

// §2: pure modules use no Android, no org.json, no app or platform packages.
// `rikka.` is Shizuku, which only the shizuku backend may touch.
const PURE_FORBIDDEN_IMPORTS = [
  'android.', 'androidx.', 'dalvik.', 'com.android.', 'com.google.android.',
  'org.json.', 'com.facebook.react', 'expo.', 'fi.iki.elonen', 'org.nanohttpd',
  'com.phonecando.app', 'com.phonecando.runner', 'rikka.',
];
const PURE_FORBIDDEN_GROUPS = ['androidx.', 'com.android.', 'com.google.android', 'org.json', 'dev.rikka.'];
// §1: host-owned types (React Native, Expo, NanoHTTPD) never enter pce/.
const HOST_ONLY_GROUPS = ['com.facebook.react', 'host.exp.', 'expo.', 'org.nanohttpd', 'fi.iki.elonen'];
// §5: "api: contracts only ... no I/O".
const API_FORBIDDEN_IMPORTS = ['java.io.', 'java.nio.', 'java.net.', 'java.sql.', 'javax.net.', 'kotlin.io.path'];
// §3: "never call a wall clock or random source directly from PCE logic".
const CLOCK_RANDOM = [
  /\bSystem\.currentTimeMillis\b/, /\bSystem\.nanoTime\b/,
  /\b(?:Instant|LocalDate|LocalDateTime|LocalTime|ZonedDateTime|OffsetDateTime)\.now\b/,
  /\bClock\.system(?:UTC|DefaultZone)\b/, /\bjava\.util\.Random\b/, /\bkotlin\.random\b/,
  /\bRandom\.(?:Default|next\w*)\b/, /(?<![\w.])Random\s*\(/, /\bMath\.random\b/,
  /\b(?:ThreadLocal|Secure)Random\b/, /\bUUID\.randomUUID\b/, /\bTimeSource\.Monotonic\b/,
  /\bmeasure(?:TimeMillis|NanoTime|Time|TimedValue)\b/, /(?<![\w.])Date\s*\(\s*\)/,
];
// The one place a wall clock may live: the injectable default in `api`.
const CLOCK_ALLOWED_FILES = ['api/src/main/kotlin/com/phonecando/pce/api/Clock.kt'];

const errors = [];
const notes = [];
const fail = (msg) => errors.push(msg);

// --- helpers ------------------------------------------------------------------

function closure(mod, seen = new Set()) {
  for (const dep of LAW[mod] ?? []) {
    if (!seen.has(dep)) {
      seen.add(dep);
      closure(dep, seen);
    }
  }
  return seen;
}

// Removes comments (and, unless keepStrings, string/char literal contents),
// keeping every newline so line numbers stay right. Kotlin block comments nest.
function strip(src, keepStrings) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('//', i)) {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (src.startsWith('/*', i)) {
      let depth = 0;
      do {
        if (src.startsWith('/*', i)) { depth++; i += 2; continue; }
        if (src.startsWith('*/', i)) { depth--; i += 2; continue; }
        if (src[i] === '\n') out += '\n';
        i++;
      } while (i < src.length && depth > 0);
    } else if (src[i] === '"' || src[i] === "'") {
      const raw = src.startsWith('"""', i);
      const start = i;
      if (raw) {
        const end = src.indexOf('"""', i + 3);
        i = end < 0 ? src.length : end + 3;
      } else {
        const quote = src[i++];
        while (i < src.length && src[i] !== quote && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
        i++;
      }
      const literal = src.slice(start, i);
      out += keepStrings ? literal : '""' + '\n'.repeat(literal.split('\n').length - 1);
    } else {
      out += src[i++];
    }
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const rel = (root, path) => relative(root, path).split(sep).join('/');
const list = (set) => [...set].sort().join(', ') || 'nothing';

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    if (name === 'build' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

const isTestConfig = (config) => /^(?:test|androidTest|unitTest|testFixtures)/.test(config);

// `config(project(":x"))` / `config(projects.x)` edges in a build file.
function projectDeps(raw) {
  const code = strip(raw, true);
  const deps = [];
  const covered = new Set();
  const edge = /\b([A-Za-z]+)\s*\(\s*project\s*\(\s*(?:path\s*=\s*)?"(:[\w:-]+)"/g;
  for (const m of code.matchAll(edge)) {
    deps.push({ config: m[1], target: m[2].slice(1), line: lineOf(code, m.index) });
    covered.add(m.index + m[0].lastIndexOf('project'));
  }
  for (const m of code.matchAll(/\b([A-Za-z]+)\s*\(\s*projects\.([\w.]+)/g)) {
    deps.push({ config: m[1], target: m[2].replace(/\./g, ':'), line: lineOf(code, m.index) });
  }
  for (const m of code.matchAll(/\bproject\s*\(\s*(?:path\s*=\s*)?"(:[\w:-]+)"/g)) {
    if (!covered.has(m.index)) deps.push({ config: null, target: m[1].slice(1), line: lineOf(code, m.index) });
  }
  return deps;
}

// `config("group:artifact:version")` coordinates in a build file.
function coordinates(raw) {
  const code = strip(raw, true);
  return [...code.matchAll(/\b([A-Za-z]+)\s*\(\s*"([\w.-]+):([\w.-]+)(?::[^"]*)?"/g)].map((m) => ({
    config: m[1], group: m[2], coord: `${m[2]}:${m[3]}`, line: lineOf(code, m.index),
  }));
}

// A test-scope edge may only reach pure modules, never one that already
// depends on `mod` (a reverse edge), and testkit never reaches core (§5).
function testEdgeProblem(mod, target) {
  if (target === mod) return null;
  if (!PURE.includes(target)) return `test code may only depend on pure modules (${PURE.join(', ')})`;
  if (closure(target).has(mod)) return `reverse edge: ${target} already depends on ${mod}`;
  if (mod === 'testkit' && target === 'core') return 'testkit must not depend on core (§5)';
  return null;
}

// --- static mode --------------------------------------------------------------

function checkStatic(pceDir) {
  const settings = strip(readFileSync(join(pceDir, 'settings.gradle.kts'), 'utf8'), true);
  const included = [];
  for (const m of settings.matchAll(/\binclude\s*\(([^)]*)\)/g)) {
    for (const s of m[1].matchAll(/"(:?[\w:-]+)"/g)) included.push(s[1].replace(/^:/, ''));
  }
  for (const m of included) {
    if (!MODULES.includes(m)) {
      fail(`settings.gradle.kts includes :${m}, which has no row in the LAW table of ` +
        '.github/ci/pce/check-deps.mjs; add its allowed edges per pce/AGENTS.md §2');
    }
  }
  for (const m of MODULES) {
    if (!included.includes(m)) fail(`LAW lists ${m}, but settings.gradle.kts does not include :${m}`);
  }
  if (/consumer-sample/.test(settings)) {
    fail('settings.gradle.kts must not include consumer-sample (§5: it is a standalone build)');
  }

  for (const mod of MODULES.filter((m) => included.includes(m))) {
    const file = join(pceDir, mod, 'build.gradle.kts');
    if (!existsSync(file)) { fail(`${mod}: missing build.gradle.kts`); continue; }
    const raw = readFileSync(file, 'utf8');
    const code = strip(raw, true);
    const where = `${mod}/build.gradle.kts`;

    // Plugin shape: pure modules are Kotlin/JVM, backends Android libraries.
    const android = /com\.android\.(?:library|application)|kotlin\s*\(\s*"android"\s*\)/.test(code);
    if (PURE.includes(mod) || mod === 'sample') {
      if (android) fail(`${where}: ${mod} must be pure JVM but applies an Android plugin`);
      if (!/kotlin\s*\(\s*"jvm"\s*\)|org\.jetbrains\.kotlin\.jvm/.test(code)) fail(`${where}: ${mod} must apply kotlin("jvm")`);
    }
    if (BACKENDS.includes(mod) && !/com\.android\.library/.test(code)) {
      fail(`${where}: backend ${mod} must be an Android library (com.android.library)`);
    }

    // Each library publishes alone as pce-<module> (§2, docs/release/release.md).
    if (!UNPUBLISHED.includes(mod)) {
      if (!/`maven-publish`|"maven-publish"/.test(code)) fail(`${where}: library ${mod} must apply maven-publish`);
      const artifact = code.match(/artifactId\s*=\s*"([^"]+)"/)?.[1];
      if (artifact !== `pce-${mod}`) fail(`${where}: artifactId is ${artifact ?? '<unset>'}, expected pce-${mod}`);
    }

    const allowed = closure(mod);
    for (const { config, target, line } of projectDeps(raw)) {
      const at = `${where}:${line}`;
      if (!config) { fail(`${at}: project(":${target}") outside a dependency configuration call`); continue; }
      if (!MODULES.includes(target)) { fail(`${at}: ${config}(:${target}) targets an unknown module`); continue; }
      if (isTestConfig(config)) {
        const problem = testEdgeProblem(mod, target);
        if (problem) fail(`${at}: ${config}(:${target}): ${problem}`);
      } else if (!allowed.has(target)) {
        fail(`${at}: ${mod} -> ${target} (${config}) breaks the dependency law; ${mod} may depend on: ${list(allowed)}`);
      }
    }

    for (const { config, group, coord, line } of coordinates(raw)) {
      if (HOST_ONLY_GROUPS.some((p) => group.startsWith(p))) {
        fail(`${where}:${line}: ${coord} is a host/app dependency and does not belong in pce/ (§1)`);
      }
      if (PURE.includes(mod) && PURE_FORBIDDEN_GROUPS.some((p) => group.startsWith(p))) {
        fail(`${where}:${line}: pure module ${mod} must not depend on ${coord} (${config})`);
      }
    }

    checkSources(pceDir, mod, raw);
  }

  checkConsumerSample(pceDir);
  notes.push(`modules: ${included.join(', ')}`);
}

function checkSources(pceDir, mod, buildRaw) {
  const mainAllowed = new Set([mod, ...closure(mod)]);
  const testAllowed = new Set(mainAllowed);
  for (const d of projectDeps(buildRaw).filter((x) => x.config && isTestConfig(x.config))) {
    for (const m of [d.target, ...closure(d.target)]) testAllowed.add(m);
  }
  const files = walk(join(pceDir, mod, 'src')).filter((f) => /\.(?:kt|java)$/.test(f));
  if (files.length === 0) fail(`${mod}: no Kotlin/Java sources (§2: no empty modules)`);

  for (const file of files) {
    const path = rel(pceDir, file);
    const sourceSet = path.split('/')[2];
    const isMain = sourceSet === 'main';
    const raw = readFileSync(file, 'utf8');
    const kept = strip(raw, true);

    // Package ownership keeps the import rules meaningful.
    const pkg = kept.match(/^\s*package\s+([\w.]+)/m)?.[1];
    if (!pkg || !(pkg === `com.phonecando.pce.${mod}` || pkg.startsWith(`com.phonecando.pce.${mod}.`))) {
      fail(`${path}: package ${pkg ?? '<none>'} is outside com.phonecando.pce.${mod}`);
    }

    for (const m of kept.matchAll(/^[ \t]*import\s+([\w.`]+)/gm)) {
      const imp = m[1].replace(/`/g, '');
      const at = `${path}:${lineOf(kept, m.index)}`;
      const target = imp.match(/^com\.phonecando\.pce\.(\w+)/)?.[1];
      if (target && MODULES.includes(target)) {
        const ok = isMain ? mainAllowed : testAllowed;
        if (!ok.has(target)) fail(`${at}: ${mod}/${sourceSet} imports ${imp}; it may only see ${list(ok)}`);
      }
      if (PURE.includes(mod)) {
        const bad = PURE_FORBIDDEN_IMPORTS.find((p) => imp.startsWith(p));
        if (bad) fail(`${at}: pure module ${mod} imports ${imp} (§2 forbids ${bad}*)`);
      }
      if (mod === 'api' && isMain && API_FORBIDDEN_IMPORTS.some((p) => imp.startsWith(p))) {
        fail(`${at}: api is contracts only with no I/O (§5), but imports ${imp}`);
      }
    }

    if (isMain && PURE.includes(mod)) {
      const code = strip(raw, false);
      if (!CLOCK_ALLOWED_FILES.includes(path)) {
        for (const re of CLOCK_RANDOM) {
          for (const m of code.matchAll(new RegExp(re.source, 'g'))) {
            fail(`${path}:${lineOf(code, m.index)}: ${m[0].trim()} in PCE logic; inject Clock/IdGenerator (§3)`);
          }
        }
      }
      checkGlobalState(path, code);
    }
  }
}

// §3 "No global mutable state or singletons": no top-level `var`, and no `var`
// declared directly in a named `object` or `companion object` body.
function checkGlobalState(path, code) {
  const varDecl = /^(?:@[\w.]+(?:\([^)]*\))?\s+)*(?:(?:private|internal|public|protected|lateinit|override|open|final)\s+)*var\s/;
  const objectDecl = /^(?:(?:private|internal|public|protected|data)\s+)*(?:companion\s+object\b|object\s+[A-Za-z_])/;
  let depth = 0; // braces
  let parens = 0; // constructor parameter lists hold `var` properties legally
  let pending = false;
  const objectBodies = [];
  code.split('\n').forEach((line, idx) => {
    const t = line.trim();
    if (varDecl.test(t) && parens === 0) {
      if (depth === 0) fail(`${path}:${idx + 1}: top-level var is global mutable state (§3)`);
      else if (objectBodies.at(-1) === depth) fail(`${path}:${idx + 1}: var in an object is global mutable state (§3)`);
    }
    if (objectDecl.test(t)) pending = true;
    for (const ch of line) {
      if (ch === '(') parens++;
      else if (ch === ')') parens = Math.max(0, parens - 1);
      else if (ch === '{') {
        depth++;
        if (pending) { objectBodies.push(depth); pending = false; }
      } else if (ch === '}') {
        if (objectBodies.at(-1) === depth) objectBodies.pop();
        depth--;
      }
    }
    // `data object Foo` or `object Foo : Bar()` with no body.
    if (pending && t && !/[:,(]$/.test(t)) pending = false;
  });
}

function checkConsumerSample(pceDir) {
  const dir = join(pceDir, 'consumer-sample');
  if (!existsSync(dir)) { notes.push('consumer-sample/ absent; skipped'); return; }
  for (const file of walk(dir).filter((f) => f.endsWith('.gradle.kts'))) {
    const code = strip(readFileSync(file, 'utf8'), true);
    const path = rel(pceDir, file);
    if (/\bproject\s*\(\s*(?:path\s*=\s*)?"|\bprojects\.\w/.test(code)) {
      fail(`${path}: consumer-sample must not use project dependencies (§5)`);
    }
    if (/\bincludeBuild\s*\(/.test(code)) fail(`${path}: consumer-sample must not include the PCE build (§5)`);
    for (const m of code.matchAll(/"com\.phonecando\.pce:pce-([\w-]+):[^"]*"/g)) {
      if (!MODULES.includes(m[1]) || UNPUBLISHED.includes(m[1])) fail(`${path}: depends on unknown artifact pce-${m[1]}`);
    }
  }
}

// --- resolved mode --------------------------------------------------------------

// <dir>/<configuration>.txt holds the -q output of one Gradle invocation of
// `:m:dependencies --configuration <configuration>` over several modules;
// each module's section starts with a "Project ':m'" header.
function checkResolved(dir) {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.txt')) : [];
  if (files.length === 0) fail(`--resolved ${dir}: no reports found`);
  const mainRuntime = new Set();
  for (const file of files) {
    const config = file.slice(0, -4);
    const test = /^test|UnitTest|AndroidTest/.test(config);
    const sections = readFileSync(join(dir, file), 'utf8').split(/^Project '(:[\w:-]+)'\s*$/m);
    if (sections.length < 3) fail(`${file}: no "Project ':x'" sections; was the report produced?`);
    for (let i = 1; i < sections.length; i += 2) {
      const mod = sections[i].slice(1);
      const body = sections[i + 1];
      if (!LAW[mod]) { fail(`${file}: report for unknown module ${mod}`); continue; }
      if (!new RegExp(`^${config} - `, 'm').test(body)) { fail(`${file}: ${mod} has no ${config} report`); continue; }
      if (!test && /RuntimeClasspath$|^runtimeClasspath$/.test(config)) mainRuntime.add(mod);
      const targets = new Set([...body.matchAll(/[+\\]--- project (:[\w:-]+)/g)].map((m) => m[1].slice(1)));
      targets.delete(mod); // Android test classpaths list the tested module itself
      const allowed = closure(mod);
      for (const t of targets) {
        const problem = test ? testEdgeProblem(mod, t) : allowed.has(t) ? null : `outside the law (allowed: ${list(allowed)})`;
        if (problem) fail(`${mod} ${config} resolves :${t}: ${problem}`);
      }
      notes.push(`${mod.padEnd(8)} ${config.padEnd(34)} ${list(targets)}`);
    }
  }
  for (const mod of MODULES) {
    if (!mainRuntime.has(mod)) fail(`--resolved: no main runtime classpath report for ${mod}; the resolve step is incomplete`);
  }
}

// --- published mode -------------------------------------------------------------

function checkPublished(groupDir, pceDir) {
  const root = strip(readFileSync(join(pceDir, 'build.gradle.kts'), 'utf8'), true);
  const version = root.match(/\bversion\s*=\s*"([^"]+)"/)?.[1];
  const group = root.match(/\bgroup\s*=\s*"([^"]+)"/)?.[1];
  if (!version || !group) { fail('pce/build.gradle.kts: cannot read group/version'); return; }
  for (const mod of MODULES.filter((m) => !UNPUBLISHED.includes(m))) {
    const artifact = `pce-${mod}`;
    const base = join(groupDir, artifact, version, `${artifact}-${version}`);
    if (!existsSync(`${base}.pom`)) { fail(`${artifact}: not published (no ${base}.pom)`); continue; }
    const binary = BACKENDS.includes(mod) ? 'aar' : 'jar';
    if (!existsSync(`${base}.${binary}`)) fail(`${artifact}: missing ${artifact}-${version}.${binary}`);
    if (!existsSync(`${base}.module`)) fail(`${artifact}: missing Gradle module metadata (.module)`);
    const pom = readFileSync(`${base}.pom`, 'utf8');
    const allowed = closure(mod);
    const own = [];
    for (const [, body] of pom.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
      const get = (tag) => body.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1];
      const [g, a, v, scope] = [get('groupId'), get('artifactId'), get('version'), get('scope') ?? 'compile'];
      if (HOST_ONLY_GROUPS.some((p) => g?.startsWith(p))) fail(`${artifact}: POM depends on host-only ${g}:${a}`);
      if (g !== group) continue;
      own.push(`${a} (${scope})`);
      const target = a?.replace(/^pce-/, '');
      if (!allowed.has(target)) fail(`${artifact}: POM depends on ${a}, outside the law (allowed: ${list(allowed)})`);
      if (v !== version) fail(`${artifact}: POM pins ${a}:${v}, expected ${version}`);
      if (!existsSync(join(groupDir, a, version))) fail(`${artifact}: POM needs ${a}, which was not published`);
    }
    notes.push(`${artifact.padEnd(12)} ${own.join(', ') || '(no PCE deps)'}`);
  }
}

// --- main -----------------------------------------------------------------------

const args = process.argv.slice(2);
function option(name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const [, value] = args.splice(i, 2);
  if (!value) { console.error(`check-deps: ${name} needs a directory`); process.exit(2); }
  return resolve(value);
}
const resolvedDir = option('--resolved');
const publishedDir = option('--published');
const pceDir = resolve(args[0] ?? 'pce');
if (!existsSync(join(pceDir, 'settings.gradle.kts'))) {
  console.error(`check-deps: ${pceDir} is not the PCE build (no settings.gradle.kts)`);
  process.exit(2);
}

const mode = resolvedDir ? 'resolved' : publishedDir ? 'published' : 'static';
if (resolvedDir) checkResolved(resolvedDir);
else if (publishedDir) checkPublished(publishedDir, pceDir);
else checkStatic(pceDir);

for (const n of notes) console.log(`  ${n}`);
if (errors.length) {
  console.error(`\nPCE dependency law (${mode}): ${errors.length} violation(s)`);
  for (const e of errors) {
    console.error(`  - ${e}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=PCE dependency law (${mode})::${e}`);
  }
  process.exit(1);
}
console.log(`PCE dependency law (${mode}): OK`);
