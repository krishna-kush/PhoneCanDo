// A kind's probes (agents/image/<id>/probes.json, agents/kit/ts/manifest/
// probes.ts) as commands in its machine, and what each run proves. Pure.
//
// A probe runs as the kind's terminal launch runs: the launch's guest sh
// (`/bin/sh -c '<cd its cwd; its runtimes on PATH; exec>'`) with the probe's
// argv in place of the program and its args, and the launch env with the
// probe's env on top. The bridge token is a stand-in, never a real one.

/** The text CI puts where the runner puts the agent's bridge token. */
export const TOKEN_STAND_IN = 'agents-latest-stand-in';

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;
// CSI and OSC sequences (colours, titles, hyperlinks) and the rest of the
// two-byte escapes, so a coloured flag in help still matches.
const ESCAPES = /\x1b(?:\[[0-9;?<=>]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g;

/** The probes' placeholders for a rendered launch (kit-cli render-launch). */
export function probeValues(launch) {
  const values = { home: launch.env.HOME, projectDir: `${launch.env.HOME}/projects` };
  if (launch.configDir) values.config = launch.configDir;
  return values;
}

/** `text` with each placeholder of `values` filled in; one it lacks is an error (the validator keeps them out). */
export function fill(text, values) {
  return text.replace(PLACEHOLDER, (_, name) => {
    if (!(name in values)) throw new Error(`{{${name}}} has no value here`);
    return values[name];
  });
}

/** The command for one probe: {argv, env}, through the launch's sh. */
export function probeCommand(launch, probe, values) {
  const [sh, dashC, script] = launch.argv;
  const argv = [sh, dashC, script, probe.argv[0], ...probe.argv.slice(1).map((a) => fill(a, values))];
  return { argv, env: { ...launchEnv(launch), ...fillEnv(probe.env ?? {}, values) } };
}

/** The launch's own command and env: its ACP mode for the ACP probe. */
export function launchCommand(launch) {
  return { argv: launch.argv, env: launchEnv(launch) };
}

/** The launch env with the token's stand-in where the runner puts the token. */
export function launchEnv(launch) {
  return launch.token ? { ...launch.env, [launch.token]: TOKEN_STAND_IN } : { ...launch.env };
}

/** Output as a person reads it: escapes stripped, CRLF as LF. */
export function plain(output) {
  return output.replace(ESCAPES, '').replace(/\r\n?/g, '\n');
}

/** The `has` strings the output lacks. */
export function lacking(output, has = []) {
  const text = plain(output);
  return has.filter((s) => !text.includes(s));
}

/**
 * What a run proves, as null (it passed) or what went wrong: `help` needs
 * only its strings, `run` exit 0 and its strings. `result` is
 * {code, timedOut, output} (exec.mjs).
 */
export function verdict(part, probe, result) {
  if (result.timedOut) return `timed out`;
  if (part === 'run' && result.code !== 0) return `exit ${result.code ?? 'by signal'}`;
  const missing = lacking(result.output, probe.has);
  if (missing.length) return `missing ${missing.map((s) => JSON.stringify(s)).join(', ')}`;
  return null;
}

/** A probe's argv as a short label: `codex --help`. */
export function label(probe) {
  const name = probe.argv[0].split('/').at(-1);
  const text = [name, ...probe.argv.slice(1)].join(' ');
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function fillEnv(env, values) {
  return Object.fromEntries(Object.entries(env).map(([k, v]) => [k, fill(v, values)]));
}
