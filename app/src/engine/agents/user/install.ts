// How a custom agent installs, as the form asks it: an npm package, a
// Python package, a script of the user's own, or nothing (it is already in
// the machine). A package is the steps we write, the way our image kinds
// install theirs (Qwen Code with npm; Mistral Vibe with uv, then uv cache
// clean, as agents/runtimes/python/README.md says), on the runtime plugin
// it needs (agents/runtimes/: node, python). An edit reads it back: install
// steps that are exactly the steps we would write, with its runtime asked
// for, are that package again; any other steps are a script. Pure
// (zero RN imports): scripts/vectors/test_user_manifest.js.

export type InstallWay = 'npm' | 'python' | 'script' | 'none';

/** The ways in the order the form shows them. */
export const INSTALL_WAYS: readonly InstallWay[] = ['npm', 'python', 'script', 'none'];

export type PresetWay = 'npm' | 'python';

/** The fields of the form an install choice touches (UserAgentForm has them). */
export type InstallFields = {
  install: InstallWay;
  installPackage: string;
  command: string;
  script: string;
  needsNode: boolean;
  needsPython: boolean;
};

type Preset = {
  /** The runtime plugin it runs on (`requires.runtimes`). */
  runtime: 'node' | 'python';
  /** The install flag it needs on in the form when it becomes a script. */
  flag: 'needsNode' | 'needsPython';
  /** The steps that install [spec]. */
  steps: (spec: string) => string[];
  /** The first of them, read back: its package spec. */
  parse: RegExp;
  /** Whether a package names its own version (else we add @latest). */
  versioned: (pkg: string) => boolean;
};

const PRESETS: Record<PresetWay, Preset> = {
  npm: {
    runtime: 'node',
    flag: 'needsNode',
    steps: (spec) => [`npm install -g --prefix "$HOME/.local" ${spec}`],
    parse: /^npm install -g --prefix "\$HOME\/\.local" (\S+)$/,
    versioned: (pkg) => pkg.lastIndexOf('@') > 0,
  },
  python: {
    runtime: 'python',
    flag: 'needsPython',
    // The clean keeps uv's cache off the phone's storage.
    steps: (spec) => [`UV_LINK_MODE=copy uv tool install --force --python 3.12 ${spec}`, 'uv cache clean'],
    parse: /^UV_LINK_MODE=copy uv tool install --force --python 3\.12 (\S+)$/,
    versioned: (pkg) => /[@=<>!~]/.test(pkg),
  },
};

/** Where npm's --prefix and uv put a tool's commands: our kinds start theirs from here. */
export const TOOL_BIN = '/root/.local/bin';

const LATEST = '@latest';

// One word the shell reads as it is: a name, a scope, a version, a URL.
const PACKAGE = /^[A-Za-z0-9@][A-Za-z0-9@/._+:=^~-]*$/;

export function isPreset(way: InstallWay): way is PresetWay {
  return way === 'npm' || way === 'python';
}

/** The runtime plugin a way installs first; null for a script or nothing. */
export function presetRuntime(way: InstallWay): 'node' | 'python' | null {
  return isPreset(way) ? PRESETS[way].runtime : null;
}

/** Why [pkg] can't go in the steps we write; null when it can. */
export function packageProblem(way: PresetWay, pkg: string): string | null {
  const name = pkg.trim();
  if (name === '') return way === 'npm' ? 'Name the npm package.' : 'Name the Python package.';
  if (!PACKAGE.test(name)) return 'One package name, like @scope/cli or cli: letters, digits and @ / . _ - + : = only.';
  return null;
}

/** The install steps for a package: the latest, unless it names its own version. */
export function presetSteps(way: PresetWay, pkg: string): string[] {
  const p = PRESETS[way];
  const name = pkg.trim();
  return p.steps(p.versioned(name) ? name : `${name}${LATEST}`);
}

/**
 * How a kind's install steps read in the form: a package when they are
 * exactly the steps we write for it and its runtime is asked for
 * ([runtimes], ids); else a script, or nothing when there are none.
 */
export function detectInstall(steps: readonly string[], runtimes: readonly (string | null)[]): { way: InstallWay; pkg: string } {
  if (steps.length === 0) return { way: 'none', pkg: '' };
  for (const way of ['npm', 'python'] as const) {
    const match = PRESETS[way].parse.exec(steps[0]);
    if (!match || !runtimes.includes(PRESETS[way].runtime)) continue;
    const spec = match[1];
    const pkg = spec.endsWith(LATEST) && spec.length > LATEST.length ? spec.slice(0, -LATEST.length) : spec;
    if (packageProblem(way, pkg) == null && JSON.stringify(presetSteps(way, pkg)) === JSON.stringify(steps)) return { way, pkg };
  }
  return { way: 'script', pkg: '' };
}

/** The program a package is likely to install: its last segment, without @scope or a version. */
export function programOf(pkg: string): string {
  let name = pkg.trim();
  if (name.startsWith('@')) name = name.includes('/') ? name.slice(name.indexOf('/') + 1) : name.slice(1);
  name = name.split(/[@=<>!~[;]/)[0];
  return name.split('/').filter((s) => s !== '').pop() ?? '';
}

/** The command we fill in for a package: its program in TOOL_BIN; empty without one. */
export function commandGuess(pkg: string): string {
  const program = programOf(pkg);
  return program === '' ? '' : `${TOOL_BIN}/${program}`;
}

/**
 * The install fields after the install choice or the package changes. The
 * command follows the package while it is empty or still the one we filled
 * in. A package turned into a script keeps what it would have run: its
 * steps in the script and its runtime on (when the script is still empty).
 */
export function changeInstall(form: InstallFields, next: { install?: InstallWay; installPackage?: string }): InstallFields {
  const install = next.install ?? form.install;
  const installPackage = next.installPackage ?? form.installPackage;
  const out: InstallFields = {
    install,
    installPackage,
    command: form.command,
    script: form.script,
    needsNode: form.needsNode,
    needsPython: form.needsPython,
  };
  const following = form.command.trim() === '' || form.command === commandGuess(form.installPackage);
  if (isPreset(install) && following) out.command = commandGuess(installPackage);
  const from = form.install;
  if (install === 'script' && isPreset(from) && form.script.trim() === '' && packageProblem(from, installPackage) == null) {
    out.script = presetSteps(from, installPackage).join('\n\n');
    out[PRESETS[from].flag] = true;
  }
  return out;
}
