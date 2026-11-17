// The in-app update: where it stands (logic/update/steps.ts), the newer
// build found, the download's progress and whether its box is up. The
// update box, Settings → Updates and its hub row all read it; the flows in
// flows/update/ move it. The download itself and its APK stay native
// (engine/updates/).
import { create } from 'zustand';
import type { AgentId } from '../engine/agents/records';
import type { UpdateProgress } from '../engine/updates/download';
import type { UpdateManifest } from '../engine/updates/manifest';
import type { DownloadStep, UpdateStage, UpdateStep } from './logic/update/steps';

interface UpdateState {
  /** Null: nothing found (no check yet, nothing newer at launch, or a launch check that failed). */
  step: UpdateStep | null;
  /** The newer build, once a check found one. */
  manifest: UpdateManifest | null;
  progress: UpdateProgress;
  /** The runner's step while it downloads: fetching, re-reading, waiting to retry or for a network. */
  phase: DownloadStep | null;
  /** When this app saw the download begin or carry on (epoch ms), and its bytes then: its pace since. */
  startedAt: number | null;
  startedFrom: number;
  error: { stage: UpdateStage; message: string } | null;
  /** The box is up; a download carries on with it hidden. */
  shown: boolean;
  /** The agents that were running when Install was tapped: they start again if it doesn't go ahead. */
  stopped: readonly AgentId[];
}

export const useUpdateStore = create<UpdateState>(() => ({
  step: null,
  manifest: null,
  progress: { written: 0, total: 0 },
  phase: null,
  startedAt: null,
  startedFrom: 0,
  error: null,
  shown: false,
  stopped: [],
}));

export function setUpdate(patch: Partial<UpdateState>): void {
  useUpdateStore.setState(patch);
}
