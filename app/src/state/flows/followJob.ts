// Follows one native job from the call that starts it to its last event,
// handing each of its progress events on. We listen before the call, since
// a fast job may report before the call resolves with its id; events of
// other jobs are dropped. The linux store sees the same events for its own
// fold; this keeps what it drops (a job's every field, its last event).
import { onLinuxProgress } from '../../engine/linux/native';
import type { LinuxJob, LinuxProgress } from '../../engine/linux/types';

/** Resolves with the job's last event (`finished: true`); rejects when the start call does. */
export async function followJob(
  start: () => Promise<LinuxJob>,
  onEvent: (p: LinuxProgress) => void,
): Promise<LinuxProgress> {
  const early: LinuxProgress[] = [];
  let jobId: string | null = null;
  let end: (p: LinuxProgress) => void = () => {};
  const ended = new Promise<LinuxProgress>((resolve) => {
    end = resolve;
  });

  const take = (p: LinuxProgress) => {
    onEvent(p);
    if (p.finished) end(p);
  };
  const sub = onLinuxProgress((p) => {
    if (jobId == null) early.push(p);
    else if (p.jobId === jobId) take(p);
  });
  try {
    jobId = (await start()).jobId;
    for (const p of early.splice(0)) if (p.jobId === jobId) take(p);
    return await ended;
  } finally {
    sub.remove();
  }
}
