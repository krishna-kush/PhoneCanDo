// What the Models page does: downloads, imports, deletes and the Hugging
// Face token. Each returns what the screen shows next, never throws: an
// error is a sentence (ui/models/logic/errorText.ts reads the code).
import {
  cancelModelJob,
  clearHfToken,
  deleteModel,
  importModel,
  resumeDownload,
  setHfToken,
  startDownload,
  toModelError,
} from '../../engine/models/native';
import type { CatalogFile, ModelDates } from '../../engine/models/types';
import { useAgentsStore } from '../agents';
import { useModelsStore } from '../models';
import { modelJobKey } from './logic/modelProgress';

export type ActionResult = { ok: true } | { ok: false; code: string; message: string };

const OK: ActionResult = { ok: true };

function failed(e: unknown): ActionResult {
  const err = toModelError(e);
  return { ok: false, code: err.code, message: err.message };
}

async function run(body: () => unknown): Promise<ActionResult> {
  try {
    await body();
    return OK;
  } catch (e) {
    return failed(e);
  } finally {
    useModelsStore.getState().refreshModels();
  }
}

/** Downloads a variant; `dates` as its listing showed them, so they stay with the model. */
export function download(repo: string, revision: string, files: CatalogFile[], dates: ModelDates | null): Promise<ActionResult> {
  return run(() => startDownload(repo, revision, files, dates));
}

export function resume(downloadId: string): Promise<ActionResult> {
  useModelsStore.getState().dismissJob(modelJobKey({ kind: 'download', id: downloadId }));
  return run(() => resumeDownload(downloadId));
}

/** Pauses a download (what arrived stays) or stops an import (nothing of it stays). */
export function cancelJob(jobId: string): void {
  cancelModelJob(jobId);
}

/** Opens the system file picker; nothing happens when the user backs out. */
export function importFromPhone(): Promise<ActionResult> {
  return run(() => importModel());
}

/** The agents set to run on [modelId], by name: a model in use is not deleted. */
export function agentsUsing(modelId: string): string[] {
  const agents = useAgentsStore.getState();
  agents.refreshAgents();
  return useAgentsStore
    .getState()
    .agents.filter((a) => a.model === modelId)
    .map((a) => a.name);
}

/** Deletes a model or a pending download; refused (code `in_use`, the agents' names as message) while an agent is set to it. */
export function remove(id: string): Promise<ActionResult> {
  const users = agentsUsing(id);
  if (users.length > 0) return Promise.resolve({ ok: false, code: 'in_use', message: users.join(', ') });
  useModelsStore.getState().dismissJob(modelJobKey({ kind: 'download', id }));
  return run(() => deleteModel(id));
}

export function saveToken(token: string): Promise<ActionResult> {
  return run(() => setHfToken(token));
}

export function forgetToken(): Promise<ActionResult> {
  return run(() => clearHfToken());
}
