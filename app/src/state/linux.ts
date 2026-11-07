// Envs, images and live job progress, mirrored from the native Linux module
// (it owns the records; we only read them). Hydrated once: from then on every
// change and progress event lands here, so screens and flows read one place.
import { create } from 'zustand';
import {
  getLinuxStatus,
  listEnvs,
  listImages,
  onLinuxChanged,
  onLinuxProgress,
  type LinuxStatus,
} from '../engine/linux/native';
import type { Env, Image, LinuxProgress } from '../engine/linux/types';
import {
  applyProgress,
  EMPTY_PROGRESS,
  targetKey,
  type ProgressSlice,
  type Target,
} from './flows/logic/progress';

interface LinuxState extends ProgressSlice {
  /** Whether this build can run Linux images at all (not play, files staged). */
  status: LinuxStatus;
  envs: Env[];
  images: Image[];
  hydrated: boolean;
  /** Reads the status and records and subscribes to native events; later calls only re-read. */
  hydrateLinux: () => void;
  refreshLinux: () => void;
}

function readRecords(): { envs: Env[]; images: Image[] } {
  try {
    return { envs: listEnvs(), images: listImages() };
  } catch {
    // Module absent (Expo Go, an old build): nothing to show.
    return { envs: [], images: [] };
  }
}

let subscribed = false;

export const useLinuxStore = create<LinuxState>((set, get) => ({
  status: { available: false, reason: 'not checked yet', libDir: '', launcher: '', proot: '', loader: '' },
  envs: [],
  images: [],
  hydrated: false,
  ...EMPTY_PROGRESS,

  hydrateLinux: () => {
    if (!subscribed) {
      subscribed = true;
      try {
        onLinuxChanged(() => get().refreshLinux());
        onLinuxProgress((p: LinuxProgress) => {
          set((s) => applyProgress(s, p));
          // The last event of a job follows its record change; re-read in
          // case the change event was missed.
          if (p.finished) get().refreshLinux();
        });
      } catch {
        // No native events: the screens still refresh on focus.
      }
    }
    set({ status: getLinuxStatus(), ...readRecords(), hydrated: true });
  },

  refreshLinux: () => set(readRecords()),
}));

/** The running job's last event for an env or image, if one runs. */
export function useTargetProgress(target: Target | null): LinuxProgress | undefined {
  return useLinuxStore((s) => (target ? s.progress[targetKey(target)] : undefined));
}
