// The self-update's download as the runner runs it (runner/update/), reached
// through nativeRunner() like the rest of the engine seam. Absent from a
// native build older than it: a start then says so, and the rest reads as
// no download.
import type { NativeUpdateDownload, NativeUpdateSpec } from '../../../modules/phonecando-runner/src/PhoneCanDoRunner.types';
import { nativeRunner, onRunnerEvent } from '../runner';

/** Where the download stands: its build, its file once done, its bytes, and why it failed. */
export type UpdateDownload = NativeUpdateDownload;
export type UpdateDownloadStep = NativeUpdateDownload['step'];

type UpdateModule = {
  startUpdateDownload?: (spec: NativeUpdateSpec) => Promise<UpdateDownload>;
  stopUpdateDownload?: () => void;
  updateDownloadState?: () => UpdateDownload | null;
};

function mod(): UpdateModule | null {
  try {
    return nativeRunner() as unknown as UpdateModule;
  } catch {
    return null;
  }
}

/** Starts the download, or finds it running or done. */
export async function startUpdateDownload(spec: NativeUpdateSpec): Promise<UpdateDownload> {
  const start = mod()?.startUpdateDownload;
  if (typeof start !== 'function') throw new Error('This build cannot download updates yet: it needs a native rebuild.');
  return start(spec);
}

/** Stops it, and everything of it goes: the part, a finished APK, its record. */
export function stopUpdateDownload(): void {
  try {
    mod()?.stopUpdateDownload?.();
  } catch {
    // Nothing to stop.
  }
}

/** Where it stands now; null for none. */
export function updateDownloadState(): UpdateDownload | null {
  try {
    return mod()?.updateDownloadState?.() ?? null;
  } catch {
    return null;
  }
}

/** Every change, and its progress about four times a second. */
export function onUpdateDownload(listener: (state: UpdateDownload) => void): { remove(): void } {
  return onRunnerEvent<UpdateDownload>('phonecandoUpdateDownload', listener);
}
