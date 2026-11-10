// Local models, mirrored from the native models module (it owns the files
// and models.json; we only read them): the phone's verdict, our
// suggestions, the models on the phone, the pending downloads and the live
// jobs. Hydrated once; from then on every change and progress event lands
// here, so screens read one place.
import { create } from 'zustand';
import {
  deviceInfo,
  hasHfToken,
  listDownloads,
  listModels,
  onModelProgress,
  onModelsChanged,
  suggestedModels,
} from '../engine/models/native';
import type { LocalModel, ModelDevice, ModelDownload, ModelProgress, SuggestedModel } from '../engine/models/types';
import { applyModelProgress, dropModelJob, type ModelJobs } from './flows/logic/modelProgress';

interface ModelsState {
  device: ModelDevice;
  suggested: SuggestedModel[];
  models: LocalModel[];
  downloads: ModelDownload[];
  /** Running jobs' last events, and failed ones' until dismissed (logic/modelProgress.ts). */
  jobs: ModelJobs;
  /** A Hugging Face token is kept (never its value). */
  hasToken: boolean;
  hydrated: boolean;
  /** Reads everything and subscribes to native events; later calls only re-read. */
  hydrateModels: () => void;
  refreshModels: () => void;
  dismissJob: (key: string) => void;
}

type Records = Pick<ModelsState, 'device' | 'suggested' | 'models' | 'downloads' | 'hasToken'>;

const NONE: Records = {
  device: { supported: false, reason: 'not checked yet', totalRamBytes: 0, availableRamBytes: 0, budgetBytes: 0 },
  suggested: [],
  models: [],
  downloads: [],
  hasToken: false,
};

function readRecords(): Records {
  try {
    return {
      device: deviceInfo(),
      suggested: suggestedModels(),
      models: listModels(),
      downloads: listDownloads(),
      hasToken: hasHfToken(),
    };
  } catch {
    // A models.json we cannot read: the page says nothing is here.
    return { ...NONE, device: safeDevice() };
  }
}

function safeDevice(): ModelDevice {
  try {
    return deviceInfo();
  } catch {
    return NONE.device;
  }
}

let subscribed = false;

export const useModelsStore = create<ModelsState>((set, get) => ({
  ...NONE,
  jobs: {},
  hydrated: false,

  hydrateModels: () => {
    if (!subscribed) {
      subscribed = true;
      onModelsChanged(() => get().refreshModels());
      onModelProgress((p: ModelProgress) => set((s) => ({ jobs: applyModelProgress(s.jobs, p) })));
    }
    set({ ...readRecords(), hydrated: true });
  },

  refreshModels: () => set(readRecords()),

  dismissJob: (key) => set((s) => ({ jobs: dropModelJob(s.jobs, key) })),
}));
