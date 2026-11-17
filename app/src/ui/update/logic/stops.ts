// What the install stops, said before you tap it: an APK replace ends this
// process, so every running agent stops (a run it cuts short is offered
// back after: its notice's Continue carries on in the same chat), downloads
// pause and pick up where they were, and a setup or import stops for good.
// Busy is a running agent its engine doesn't call idle (a chat working, a
// job it started, or activity just now). Pure (zero RN imports).

export type RunningAgent = { id: string; name: string; working: boolean };

/** Linux and model jobs under way: downloads resume after the update, setups and imports don't. */
export type JobCounts = { downloads: number; setups: number };

export type StopRow =
  | { kind: 'agent'; id: string; title: string; line: string; working: boolean }
  | { kind: 'job'; id: 'downloads' | 'setups'; title: string; line: string };

// A Linux job's steps that are its download (types.ts's LinuxProgress.step).
const DOWNLOAD_STEPS = new Set(['resolve', 'download', 'verify', 'retry', 'offline']);

/** Counts the jobs under way: Linux jobs by their step, model jobs by their kind. */
export function jobCounts(linuxSteps: readonly string[], modelJobs: readonly ('download' | 'import')[]): JobCounts {
  const linuxDownloads = linuxSteps.filter((s) => DOWNLOAD_STEPS.has(s)).length;
  const modelDownloads = modelJobs.filter((k) => k === 'download').length;
  return {
    downloads: linuxDownloads + modelDownloads,
    setups: linuxSteps.length - linuxDownloads + modelJobs.length - modelDownloads,
  };
}

function count(n: number, one: string): string {
  return `${n} ${one}${n === 1 ? '' : 's'}`;
}

export function agentLine(working: boolean): string {
  return working
    ? 'Busy. It stops now; if a run is cut short, its notice after the update offers Continue, in the same chat.'
    : 'Idle. It stops now and starts again when you open it.';
}

export function stopRows(agents: readonly RunningAgent[], jobs: JobCounts): StopRow[] {
  const rows: StopRow[] = agents.map((a) => ({
    kind: 'agent',
    id: a.id,
    title: a.name,
    line: agentLine(a.working),
    working: a.working,
  }));
  if (jobs.downloads > 0) {
    rows.push({
      kind: 'job',
      id: 'downloads',
      title: count(jobs.downloads, 'download'),
      line: jobs.downloads === 1 ? 'Pauses, then picks up where it was once the new build is in.' : 'Pause, then pick up where they were once the new build is in.',
    });
  }
  if (jobs.setups > 0) {
    rows.push({
      kind: 'job',
      id: 'setups',
      title: count(jobs.setups, 'setup'),
      line: jobs.setups === 1 ? 'Stops; run it again after the update.' : 'Stop; run them again after the update.',
    });
  }
  return rows;
}

/** One line over the rows: what the install stops, or that nothing does. */
export function stopsHead(agents: readonly RunningAgent[], jobs: JobCounts): string {
  const parts = [
    agents.length > 0 ? count(agents.length, 'agent') : null,
    jobs.downloads > 0 ? count(jobs.downloads, 'download') : null,
    jobs.setups > 0 ? count(jobs.setups, 'setup') : null,
  ].filter((p): p is string => p != null);
  if (parts.length === 0) return 'Nothing is running, so nothing stops. PhoneCanDo restarts on the new build.';
  const what = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  const working = agents.filter((a) => a.working).length;
  const mid = working > 0 ? ` (${working} busy)` : '';
  return `Installing stops ${what}${mid} for a minute or so, while PhoneCanDo restarts on the new build.`;
}

/** Under the rows, always. */
export const KEPT_LINE = 'Your chats, machines, models and settings all stay.';
