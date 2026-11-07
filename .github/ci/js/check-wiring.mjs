#!/usr/bin/env node
// Script wiring gate: the entry points people type still reach real files.
//
//   ./manage        loaded as a module with `sh` swapped for a recorder, then
//                   every dispatchable subcommand is called with valid args;
//                   each recorded `node <file>`, `<file>.sh` and `pnpm <script>`
//                   must resolve (nothing is executed). Every COMMANDS entry
//                   must be documented in its --help text and vice versa.
//   package.json    root/app/web scripts: `node <file>` targets exist and
//                   `pnpm -C app|web <script>` names a script there.
//   vectors         every app/scripts/vectors/*.js runs from `check:vectors`
//                   (AGENTS.md rule 4: keep vectors in sync or delete them).
//   versions        app/package.json version == app/app.json expo.version,
//                   and updates.ts REPO == web/src/data/release.json repo
//                   (scripts/release-android.mjs writes them together).
//
//   node .github/ci/js/check-wiring.mjs      (needs python3 for ./manage)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { ROOT, createReport, readJson, summary } from './lib.mjs';

const r = createReport();
const rows = [];
const ok = (what, pass, detail = '') => rows.push(`| ${pass ? '✅' : '❌'} | ${what} | ${detail} |`);

const pkgs = { '.': readJson('package.json'), app: readJson('app/package.json'), web: readJson('web/package.json') };
// Scripts of the package at a repo-relative dir ({} when it has none).
function scriptsOf(dir) {
  const key = relative(ROOT, join(ROOT, dir)) || '.';
  if (!(key in pkgs)) {
    const file = join(ROOT, key, 'package.json');
    pkgs[key] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  }
  return pkgs[key].scripts ?? {};
}
const hasScript = (dir, name) => Object.hasOwn(scriptsOf(dir), name);
const PNPM_BUILTINS = new Set(['install', 'add', 'remove', 'update', 'exec', 'dlx']);

// ---------- package.json scripts ----------
for (const dir of ['.', 'app', 'web']) {
  const pkg = pkgs[dir];
  const where = dir === '.' ? 'package.json' : `${dir}/package.json`;
  for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
    for (const m of cmd.matchAll(/(?:^|&&|;)\s*(?:\w+=\S+\s+)*node\s+([^\s&;|]+)/g)) {
      const target = join(ROOT, dir, m[1]);
      const pass = existsSync(target);
      ok(`\`${where}\` ${name} → node ${m[1]}`, pass);
      if (!pass) r.error(`script "${name}" runs node ${m[1]}, which does not exist`, where);
    }
    for (const m of cmd.matchAll(/pnpm\s+-C\s+(\S+)\s+(?:run\s+)?([\w:.-]+)/g)) {
      const [, sub, script] = m;
      if (PNPM_BUILTINS.has(script)) continue;
      const pass = hasScript(join(dir, sub), script);
      ok(`\`${where}\` ${name} → ${sub} script ${script}`, pass);
      if (!pass) r.error(`script "${name}" calls \`pnpm -C ${sub} ${script}\`, but ${sub}/package.json has no such script`, where);
    }
  }
}

// ---------- vectors ----------
const vectorCmd = pkgs.app.scripts?.['check:vectors'] ?? '';
for (const f of readdirSync(join(ROOT, 'app/scripts/vectors')).filter((f) => /\.m?js$/.test(f))) {
  const pass = vectorCmd.includes(`scripts/vectors/${f}`);
  ok(`vector ${f} runs from check:vectors`, pass);
  if (!pass) r.error(`app/scripts/vectors/${f} is never run: add it to "check:vectors" or delete it`, 'app/package.json');
}

// ---------- versions ----------
const appJson = readJson('app/app.json');
const vOk = pkgs.app.version === appJson.expo?.version;
ok('app/package.json version == app/app.json expo.version', vOk, `${pkgs.app.version} / ${appJson.expo?.version}`);
if (!vOk) r.error(`version ${pkgs.app.version} != app.json ${appJson.expo?.version} (release-android.mjs bumps both)`, 'app/package.json');
const updates = readFileSync(join(ROOT, 'app/src/engine/updates.ts'), 'utf8');
const repo = /const REPO = '([^']+)'/.exec(updates)?.[1];
const release = readJson('web/src/data/release.json');
const rOk = Boolean(repo) && repo === release.repo;
ok('updates.ts REPO == web release.json repo', rOk, `${repo} / ${release.repo}`);
if (!rOk) r.error(`REPO ${repo} != web/src/data/release.json repo ${release.repo}`, 'app/src/engine/updates.ts');

// ---------- ./manage dispatch (dry run) ----------
const PY = String.raw`
import importlib.machinery, importlib.util, json, sys
path = sys.argv[1]
loader = importlib.machinery.SourceFileLoader("manage", path)
spec = importlib.util.spec_from_loader("manage", loader)
m = importlib.util.module_from_spec(spec)
loader.exec_module(m)
calls = []
def record(cmd, cwd=m.ROOT, env=None):
    calls.append({"cmd": [str(c) for c in cmd], "cwd": str(cwd)})
m.sh = record
m.capture = lambda cmd: ""
probes = [("check", []), ("logos", []), ("xterm", []), ("prebuild", []), ("prebuild", ["--clean"]),
          ("web", ["dev"]), ("web", ["build"]), ("web", ["preview"]), ("engine", ["oc", "build"]), ("engine", ["oc", "stage"]),
          ("release", ["0.0.0", "--dry-run"]), ("build", ["lite"]), ("build", ["full"])]
probes += [("android", [c]) for c in m.CHANNELS]
probes += [("image", ["fetch"]), ("image", ["stage"]), ("image", ["lock", "1"]), ("image", ["build"]),
           ("image", ["stage", "--local"])]
for name, args in probes:
    if name in m.COMMANDS:
        m.COMMANDS[name](args)
print(json.dumps({"root": str(m.ROOT), "commands": sorted(m.COMMANDS), "doc": m.__doc__ or "", "calls": calls}))
`;
const py = spawnSync('python3', ['-I', '-B', '-c', PY, join(ROOT, 'manage')], { encoding: 'utf8' });
if (py.status !== 0) {
  r.error(`could not load ./manage as a module:\n${py.stderr || py.stdout}`, 'manage');
} else {
  const { root, commands, doc, calls } = JSON.parse(py.stdout.trim().split('\n').pop());
  const documented = new Set([...doc.matchAll(/\.\/manage (\w+)/g)].map((m) => m[1]));
  for (const c of commands) {
    if (!documented.has(c)) r.error(`command "${c}" is not in the --help text`, 'manage');
  }
  for (const c of documented) {
    if (!commands.includes(c)) r.error(`--help documents "./manage ${c}", which is not a command`, 'manage');
  }
  ok(`./manage --help lists all ${commands.length} commands`, commands.every((c) => documented.has(c)));

  for (const { cmd, cwd } of calls) {
    const rel = relative(root, cwd) || '.';
    const shown = `${cmd.map((a) => (isAbsolute(a) ? relative(root, a) : a)).join(' ')}  (in ${rel})`;
    let pass = true;
    let why = '';
    if (cmd[0] === 'node') {
      const target = isAbsolute(cmd[1]) ? cmd[1] : join(cwd, cmd[1]);
      pass = existsSync(target);
      why = `${relative(root, target)} does not exist`;
    } else if (cmd[0] === 'pnpm') {
      pass = hasScript(rel, cmd[1]);
      why = `${rel}/package.json has no "${cmd[1]}" script`;
    } else if (cmd[0].endsWith('.sh')) {
      pass = existsSync(cmd[0]);
      why = `${relative(root, cmd[0])} does not exist`;
    } else {
      continue; // npx/adb: external tools, nothing in the repo to resolve
    }
    ok(`\`./manage\` → \`${shown}\``, pass);
    if (!pass) r.error(`dispatches \`${shown}\`, but ${why}`, 'manage');
  }
}

summary(['### Script wiring', '', '| | Check | Detail |', '|---|---|---|', ...rows, ''].join('\n'));
r.finish('wiring');
