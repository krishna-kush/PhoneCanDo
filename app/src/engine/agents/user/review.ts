// What a custom agent kind runs on the phone, read out of its manifest for
// the review step before a save or an import: the command that starts it,
// what its install puts in the machine (runtimes, packages per family, its
// steps), what its update runs, its env and whether it gets the phone
// tools. Pure (zero RN imports).
import { isObject, type Json } from '../../../../../agents/kit/ts/manifest/primitives.ts';
import { textArgv } from './form.ts';
import { joinWords } from './words.ts';

export type KindReview = {
  id: string;
  label: string;
  /** The words that start its TUI. */
  command: string;
  /** Runtimes installed first (`node>=22`). */
  runtimes: string[];
  /** Packages per family, `*` for any other; in manifest order. */
  packages: { family: string; names: string[] }[];
  installSteps: string[];
  /** Its own update steps; null when it has none or they are the install steps. */
  updateSteps: string[] | null;
  /** What prints its version; null without an install. */
  versionCommand: string | null;
  /** NAME=value for each env value it sets. */
  env: string[];
  phoneTools: boolean;
};

export function reviewOf(m: Json): KindReview {
  const engine = isObject(m.engine) ? m.engine : {};
  const launch = isObject(engine.launch) ? engine.launch : {};
  const install = isObject(m.install) ? m.install : {};
  const packages = isObject(install.packages) ? install.packages : {};
  const requires = isObject(m.requires) ? m.requires : {};
  const installSteps = textArgv(install.steps);
  const update = isObject(m.update) ? textArgv(m.update.steps) : null;
  const check = isObject(m.versionCheck) ? textArgv(m.versionCheck.argv) : null;
  return {
    id: String(m.id ?? ''),
    label: String(m.label ?? ''),
    command: joinWords(textArgv(launch.argv)),
    runtimes: textArgv(requires.runtimes),
    packages: Object.entries(packages).map(([family, names]) => ({ family, names: textArgv(names) })),
    installSteps,
    updateSteps: update && update.length > 0 && JSON.stringify(update) !== JSON.stringify(installSteps) ? update : null,
    versionCommand: check && check.length > 0 ? joinWords(check) : null,
    env: isObject(launch.env) ? Object.entries(launch.env).map(([name, value]) => `${name}=${String(value)}`) : [],
    phoneTools: typeof m.phoneTools === 'string' && m.phoneTools !== 'none',
  };
}
