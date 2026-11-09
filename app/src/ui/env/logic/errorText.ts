// Error codes as plain sentences. Pure (zero RN imports). The Env tab and
// first launch both say failures through here, so one cause reads the same
// everywhere. Only `internal` adds the native line: it is the one case
// where the code alone tells nobody anything.
import type { EngineStartError } from '../../../engine/agents/records';
import {
  failureOf,
  failureOfError,
  type JobFailure,
  type LinuxErrorCode,
} from '../../../state/flows/logic/errors.ts';
import type { InstallErrorCode, InstallFailure } from '../../../state/flows/logic/installErrors.ts';

const LINUX_TEXT: Record<LinuxErrorCode, string> = {
  unsafe_entry: 'This image has a file that points outside it, so we stopped unpacking it.',
  too_large: 'This image is too big to unpack on this phone.',
  invalid_ref: "That isn't a valid image name. Try something like alpine or kalilinux/kali-rolling.",
  no_space: 'Your phone is out of space. Free some up and try again.',
  digest_mismatch: 'The download got damaged on the way. Try again.',
  network: "We couldn't reach the internet. Check your connection and try again.",
  rate_limited: 'Docker Hub is limiting downloads right now (it allows a few an hour). Try again later.',
  not_found: "We couldn't find that image or version.",
  no_arm64: "This image has no build for your phone's processor (arm64).",
  unsupported_layer: "This image is packed in a way we can't unpack yet.",
  unsupported_manifest: "This image uses a format we can't read yet.",
  no_shell: "This image has no shell (/bin/sh), so an agent can't run commands in it.",
  corrupt: 'Some files are damaged. Try again; if it keeps failing, delete it and start over.',
  cancelled: 'It stopped before it finished.',
  linux_unavailable: "Linux isn't available in this build.",
  env_in_use: 'Agents still use this env. Delete them first.',
  busy: 'Something else is still running on it. Wait a moment and try again.',
  command_failed: 'A command failed. Its last lines are below.',
  timed_out: 'It took too long, so we stopped it. Check your connection and try again.',
  internal: 'Something went wrong on our side.',
};

export function linuxErrorText(code: LinuxErrorCode): string {
  return LINUX_TEXT[code];
}

/** A failure as a sentence; `internal` keeps the native line so it can be reported. */
export function failureText(failure: JobFailure): string {
  const text = LINUX_TEXT[failure.code];
  const detail = failure.message.trim();
  return failure.code === 'internal' && detail ? `${text} (${detail})` : text;
}

/** Any rejection from the Linux seam, the runner or a flow, as a sentence. */
export function linuxFailureText(e: unknown): string {
  return failureText(failureOfError(e));
}

/** A record's failure (`error` + `errorCode`) as a sentence; null when it has none. */
export function recordErrorText(record: { error: string | null; errorCode?: string | null }): string | null {
  const failure = failureOf(record.error, record.errorCode);
  return failure ? failureText(failure) : null;
}

const INSTALL_TEXT: Record<Exclude<InstallErrorCode, LinuxErrorCode>, string> = {
  no_recipe: "We don't know how to install this agent on this machine's system.",
  verify_failed: "It installed, but we couldn't read its version, so it may not run.",
};

/** An install's failure as a sentence: the runner's own codes, else the Linux ones. */
export function installErrorText(failure: InstallFailure): string {
  const code = failure.code;
  return code === 'no_recipe' || code === 'verify_failed' ? INSTALL_TEXT[code] : failureText({ code, message: failure.message });
}

const START_TEXT: Record<EngineStartError, string> = {
  too_many_running: 'Three agents are already running. Stop one first.',
  image_not_ready: "This agent's machine isn't ready yet. Wait for its setup to finish.",
  engine_missing: "This build doesn't include the agent's program.",
  port_unavailable: "We couldn't find a free port to start on. Try again.",
  start_failed: "The agent didn't start. Try again.",
  agent_not_installed: "This agent isn't installed in its machine yet. Install it on its page in the Env tab.",
};

export function startErrorText(code: EngineStartError): string {
  return START_TEXT[code];
}

/** The code inside an EnsureResult status (`start-failed:<code>`), else null. */
export function startFailureCode(status: string): EngineStartError | null {
  const m = /^start-failed:(\w+)$/.exec(status);
  return m && Object.prototype.hasOwnProperty.call(START_TEXT, m[1]) ? (m[1] as EngineStartError) : null;
}
