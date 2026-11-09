// An agent's install in plain words: the script's phases (`runtime:<id>`,
// `packages`, `install` or `update`, `verify`), the run's line over its progress bar,
// what it is doing under it (a retry, a download, or that it still works),
// and where and why it stopped. Pure (zero RN imports).
import type { InstallActivity, InstallRetry, InstallRun } from '../../../state/flows/logic/installRun.ts';
import { installErrorText } from './errorText.ts';
import { formatBytes, formatDuration, formatRate } from './format.ts';

// Runtime plugins by id, as people know them; any other id reads as itself.
const RUNTIME_NAMES: Record<string, string> = { node: 'Node.js', python: 'Python' };

const RUNTIME_PREFIX = 'runtime:';

/** "Installing Node.js", "Installing system packages", "Installing gemini", "Checking the version". */
export function phaseLabel(phase: string | null, agentLabel: string): string {
  if (!phase) return 'Getting ready';
  if (phase.startsWith(RUNTIME_PREFIX)) {
    const id = phase.slice(RUNTIME_PREFIX.length);
    return `Installing ${RUNTIME_NAMES[id] ?? id}`;
  }
  switch (phase) {
    case 'packages':
      return 'Installing system packages';
    case 'install':
      return `Installing ${agentLabel}`;
    case 'update':
      return `Updating ${agentLabel}`;
    case 'verify':
      return 'Checking the version';
  }
  const words = phase.replace(/[_:-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Working';
}

/** What the run is doing now, for the line over its bar. */
export function installLine(run: InstallRun, agentLabel: string): string {
  switch (run.stage) {
    case 'machine':
      return 'Waiting for its machine';
    case 'plan':
      return 'Getting ready';
    case 'script':
      return phaseLabel(run.phase, agentLabel);
    case 'verify':
      return 'Checking the version';
  }
}

/** Below this the app's traffic is noise (an engine, a WebView), not the script downloading. */
export const DOWNLOADING_MIN_RATE = 20_000;

/** "Network hiccup — trying again (2 of 3)": the script's `@retry` line
    names the attempt about to start. */
export function retryLine(retry: InstallRetry): string {
  return `Network hiccup — trying again (${retry.attempt} of ${retry.max})`;
}

/**
 * "No network · 2 min 10 s" while the phone is offline (a download then just
 * waits, which reads as a hang), "Downloading 120 MB · 1.2 MB/s" while bytes
 * come in, else "Still working · 2 min 10 s".
 */
export function activityLine(activity: InstallActivity): string {
  const { downloadedBytes, rateBytesPerSec } = activity;
  if (activity.online === false) return `No network · ${formatDuration(activity.elapsedSec)}`;
  if (downloadedBytes != null && rateBytesPerSec != null && rateBytesPerSec >= DOWNLOADING_MIN_RATE) {
    return `Downloading ${formatBytes(downloadedBytes)} · ${formatRate(rateBytesPerSec)}`;
  }
  return `Still working · ${formatDuration(activity.elapsedSec)}`;
}

/** The lines under the bar while the script runs: a retry under way, then what it is doing. */
export function installActivityLines(run: InstallRun): string[] {
  if (run.status !== 'running' || run.stage !== 'script') return [];
  const lines: string[] = [];
  if (run.retry) lines.push(retryLine(run.retry));
  if (run.activity) lines.push(activityLine(run.activity));
  return lines;
}

/** "The install stopped while installing Node.js. <why>" */
export function installFailureText(run: InstallRun, agentLabel: string): string {
  const what = run.mode === 'update' ? 'The update' : 'The install';
  const line = installLine(run, agentLabel);
  const where = line.charAt(0).toLowerCase() + line.slice(1);
  const why = run.failure ? ` ${installErrorText(run.failure)}` : '';
  return `${what} stopped while ${where}.${why}`;
}

/** "Version 0.12.0" under the Install heading. */
export function versionLine(version: string): string {
  return `Version ${version}`;
}

/** The note right after a run ended well. */
export function installDoneLine(run: InstallRun, agentLabel: string): string {
  const version = run.version ? ` (${run.version})` : '';
  return run.mode === 'update' ? `${agentLabel} is up to date${version}.` : `${agentLabel} is installed${version}.`;
}
