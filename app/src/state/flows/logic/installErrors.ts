// Why an agent's install stopped, as one code: the runner's own
// (`no_recipe` from the kit renderer, `verify_failed` from recordInstall or
// a version check that failed) or a Linux one (the machine's setup, the
// script's job: command_failed, timed_out, cancelled, busy, …). Pure.
import { failureOf, failureOfError, type LinuxErrorCode } from './errors.ts';

export type InstallErrorCode = LinuxErrorCode | 'no_recipe' | 'verify_failed';

export type InstallFailure = { code: InstallErrorCode; message: string };

const RUNNER_CODES: readonly InstallErrorCode[] = ['no_recipe', 'verify_failed'];

/** A failure the install flow raises itself (a version check that failed). */
export class InstallError extends Error {
  readonly code: InstallErrorCode;
  constructor(failure: InstallFailure) {
    super(failure.message || failure.code);
    this.name = 'InstallError';
    this.code = failure.code;
  }
}

// Expo prefixes a sync call's message ("Call to function ... has been
// rejected. → Caused by: <message>"); the native line is what follows.
const CAUSE = '→ Caused by: ';

function nativeLine(message: string): string {
  const at = message.lastIndexOf(CAUSE);
  return (at >= 0 ? message.slice(at + CAUSE.length) : message).trim();
}

function runnerCode(value: unknown): InstallErrorCode | null {
  return RUNNER_CODES.find((c) => c === value) ?? null;
}

/** Any rejection of the install flow: its runner code (field or leading code), else its Linux failure. */
export function installFailureOf(e: unknown): InstallFailure {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  const line = nativeLine(raw);
  const lead = /^([a-z_]+):\s*/.exec(line);
  const code = runnerCode((e as { code?: unknown } | null)?.code) ?? runnerCode(lead?.[1]);
  if (code) return { code, message: lead && runnerCode(lead[1]) ? line.slice(lead[0].length) : line };
  return failureOfError(e);
}

/** What the script's last job event says: null when it ended well, else why. */
export function scriptFailure(end: {
  ok?: unknown;
  exitCode?: unknown;
  error: string | null;
  errorCode?: string | null;
}): InstallFailure | null {
  const failure = failureOf(end.error, end.errorCode);
  if (failure) return failure;
  if (end.ok === false) {
    const exit = typeof end.exitCode === 'number' ? `exit ${end.exitCode}` : '';
    return { code: 'command_failed', message: exit };
  }
  return null;
}
