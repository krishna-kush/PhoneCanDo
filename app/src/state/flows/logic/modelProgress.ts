// Live model jobs (downloads, imports), folded per target. Pure: the models
// store calls applyModelProgress on every native event and keeps the result.
import type { ModelJobTarget, ModelProgress } from '../../../engine/models/types';

export type ModelJobKey = `download:${string}` | `import:${string}`;

export function modelJobKey(target: ModelJobTarget): ModelJobKey {
  return `${target.kind}:${target.id}`;
}

/**
 * The running job's last event per target. A job that ended well is gone
 * (its model or download list says the rest); one that failed stays, so
 * its row can say why, until the target runs again or is dismissed.
 */
export type ModelJobs = Record<string, ModelProgress>;

export function applyModelProgress(jobs: ModelJobs, p: ModelProgress): ModelJobs {
  const key = modelJobKey(p.target);
  if (p.finished && p.ok !== false) {
    const { [key]: _done, ...rest } = jobs;
    return rest;
  }
  return { ...jobs, [key]: p };
}

/** Forgets a failed job's last event (its row was dismissed or deleted). */
export function dropModelJob(jobs: ModelJobs, key: string): ModelJobs {
  const { [key]: _gone, ...rest } = jobs;
  return rest;
}

/** The imports to show: running or failed, oldest first. */
export function importJobs(jobs: ModelJobs): ModelProgress[] {
  return Object.values(jobs)
    .filter((p) => p.target.kind === 'import')
    .sort((a, b) => a.target.id.localeCompare(b.target.id, 'en', { numeric: true }));
}
