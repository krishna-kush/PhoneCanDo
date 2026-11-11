// Engine seam: the ONLY importer of the phonecando-models native module.
// Lazy require keeps this importable where native code is absent (Expo Go,
// web, a build from before the module). Reads answer empty or unsupported
// there; changes throw a ModelError with code `models_unavailable`.
//
// Downloads and imports resolve at once with a jobId; the job then reports
// `onModelProgress` events (a few per second, each new step and every
// retry or wait for a network at once) and ends with one `finished: true`
// event, `error` and `errorCode` set when it failed. A dropped connection
// waits and resumes by itself, with no network it waits for one, and one
// the app's process or a long outage stopped resumes on the next start; a
// cancelled download stays pending with what arrived, and resumeDownload
// carries on. Every model or download change fires
// `onModelsChanged`: re-read listModels() / listDownloads().
//
// The Hugging Face token goes in (setHfToken) and never comes back out.
import type {
  ModelDevice,
  ModelDownload,
  ModelErrorCode,
  ModelProgress,
  CatalogFile,
  LocalModel,
  ModelDates,
  ModelFilters,
  RamCheck,
  RepoModels,
  RepoSizes,
  SearchPage,
  SuggestedModel,
} from './types';

type Sub = { remove(): void };

type ModelsModule = {
  deviceInfo(): ModelDevice;
  suggestedModels(): SuggestedModel[];
  listModels(): LocalModel[];
  listDownloads(): ModelDownload[];
  contextCheck(modelId: string, context: number): RamCheck;
  setModelContext(modelId: string, context: number | null): Promise<null>;
  searchModels(query: string, filters: Record<string, string | boolean>, limit: number): Promise<SearchPage>;
  nextModelsPage(cursor: string): Promise<SearchPage>;
  repoModels(repo: string): Promise<RepoModels>;
  repoSizes(repos: string[]): Promise<Record<string, RepoSizes>>;
  startDownload(
    repo: string,
    revision: string,
    files: CatalogFile[],
    dates: ModelDates | null,
  ): Promise<{ jobId: string; downloadId: string }>;
  resumeDownload(downloadId: string): Promise<{ jobId: string }>;
  deleteModel(id: string): Promise<null>;
  importModel(): Promise<{ jobId: string } | null>;
  cancelModelJob(jobId: string): boolean;
  hasHfToken(): boolean;
  setHfToken(token: string): void;
  clearHfToken(): void;
  addListener(name: string, listener: (e: never) => void): Sub;
};

const CODES: ReadonlySet<string> = new Set<ModelErrorCode>([
  'invalid_gguf',
  'too_large',
  'bad_answer',
  'invalid_name',
  'exists',
  'no_space',
  'size_mismatch',
  'digest_mismatch',
  'network',
  'rate_limited',
  'not_found',
  'access_denied',
  'corrupt',
  'unsupported_device',
  'not_enough_memory',
  'server_not_ready',
  'cancelled',
  'busy',
  'invalid_token',
  'picker_unavailable',
  'models_unavailable',
  'internal',
]);

/** A native failure with its stable code; `message` is the native line. */
export class ModelError extends Error {
  readonly code: ModelErrorCode;

  constructor(code: ModelErrorCode, message: string) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
  }
}

function load(): ModelsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../modules/phonecando-models/src/PhoneCanDoModelsModule');
    const impl = (mod?.default ?? mod) as Partial<ModelsModule> | undefined;
    return typeof impl?.listModels === 'function' ? (impl as ModelsModule) : null;
  } catch {
    return null;
  }
}

function required(): ModelsModule {
  const mod = load();
  if (!mod) throw new ModelError('models_unavailable', 'the native models module is missing');
  return mod;
}

// Expo prefixes a sync call's message ("Call to function ... has been
// rejected. → Caused by: <message>"); we keep the native line only.
export function toModelError(e: unknown): ModelError {
  if (e instanceof ModelError) return e;
  const raw = e instanceof Error ? e.message : String(e);
  const marker = '→ Caused by: ';
  const at = raw.lastIndexOf(marker);
  const message = at >= 0 ? raw.slice(at + marker.length).trim() : raw;
  const code = (e as { code?: unknown } | null)?.code;
  return new ModelError(typeof code === 'string' && CODES.has(code) ? (code as ModelErrorCode) : 'internal', message);
}

function sync<T>(call: (mod: ModelsModule) => T): T {
  const mod = required();
  try {
    return call(mod);
  } catch (e) {
    throw toModelError(e);
  }
}

async function callAsync<T>(call: (mod: ModelsModule) => Promise<T>): Promise<T> {
  const mod = required();
  try {
    return await call(mod);
  } catch (e) {
    throw toModelError(e);
  }
}

const NO_DEVICE: ModelDevice = {
  supported: false,
  reason: 'this build has no local models',
  totalRamBytes: 0,
  availableRamBytes: 0,
  budgetBytes: 0,
};

// --- The phone and what is on it --------------------------------------------

/** Whether this phone can serve local models, and its RAM; unsupported where the module is missing. */
export function deviceInfo(): ModelDevice {
  return load() ? sync((m) => m.deviceInfo()) : NO_DEVICE;
}

/** Every model on the phone, ready to serve; empty where the module is missing. */
export function listModels(): LocalModel[] {
  return load() ? sync((m) => m.listModels()) : [];
}

/** Downloads in flight or paused; empty where the module is missing. */
export function listDownloads(): ModelDownload[] {
  return load() ? sync((m) => m.listDownloads()) : [];
}

/** A model's RAM verdict served with `context` tokens as the user would choose it: the Context setting's slider. */
export function contextCheck(modelId: string, context: number): RamCheck {
  return sync((m) => m.contextCheck(modelId, context));
}

/**
 * Saves the context a model is served with (tokens, or null for automatic). A running server keeps its own until
 * it starts again (state/flows/modelContext.ts restarts its agents). Rejects not_enough_memory past the phone's RAM.
 */
export async function setModelContext(modelId: string, context: number | null): Promise<void> {
  await callAsync((m) => m.setModelContext(modelId, context));
}

/** Deletes a model or a pending download and its files (a running download is stopped first). */
export async function deleteModel(id: string): Promise<void> {
  await callAsync((m) => m.deleteModel(id));
}

// --- Hugging Face -------------------------------------------------------------

/** Our suggestions, best first, with their verdicts on this phone; no network. */
export function suggestedModels(): SuggestedModel[] {
  return load() ? sync((m) => m.suggestedModels()) : [];
}

/**
 * GGUF repositories matching `query` (all when blank) under `filters`. Native keeps the pages it read for the
 * process (the most recent few), so the list the Models page opens on, a search typed again or a filter set back
 * asks Hugging Face nothing; saving or clearing the token forgets them.
 */
export function searchModels(query: string, filters: ModelFilters, limit = 30): Promise<SearchPage> {
  // Only defined fields: a null filter is left out.
  const wire: Record<string, string | boolean> = { sort: filters.sort, chatOnly: filters.chatOnly };
  if (filters.size) wire.size = filters.size;
  if (filters.license) wire.license = filters.license;
  return callAsync((m) => m.searchModels(query, wire, limit));
}

/** The page after the one whose `next` is `cursor`, under the same filters. */
export function nextModelsPage(cursor: string): Promise<SearchPage> {
  return callAsync((m) => m.nextModelsPage(cursor));
}

/** A repository's models at its `main` commit. Rejects access_denied for a gated or private one without a token that may see it. */
export function repoModels(repo: string): Promise<RepoModels> {
  return callAsync((m) => m.repoModels(repo));
}

/**
 * The size ranges of `repos` (search hits, at most 30). Native asks Hugging Face once per repository and
 * keeps the answer, which repoModels then reuses; it leaves out one it couldn't read or held back because
 * the Hub's call limit runs low.
 */
export function repoSizes(repos: string[]): Promise<Record<string, RepoSizes>> {
  return callAsync((m) => m.repoSizes(repos));
}

// --- Jobs ---------------------------------------------------------------------

/**
 * Starts downloading a variant (its files as repoModels or suggestedModels listed them), with the dates they
 * listed, kept with the model. Rejects exists or no_space at once.
 */
export function startDownload(
  repo: string,
  revision: string,
  files: CatalogFile[],
  dates: ModelDates | null,
): Promise<{ jobId: string; downloadId: string }> {
  return callAsync((m) => m.startDownload(repo, revision, files, dates));
}

/** Runs a paused download again from what is on disk. Rejects busy while it runs. */
export function resumeDownload(downloadId: string): Promise<{ jobId: string }> {
  return callAsync((m) => m.resumeDownload(downloadId));
}

/** Opens the system file picker and copies the picked file in as a job; null when the user backed out. */
export function importModel(): Promise<{ jobId: string } | null> {
  return callAsync((m) => m.importModel());
}

/** Asks a job to stop at its next check; false when it is not running. A download keeps what arrived. */
export function cancelModelJob(jobId: string): boolean {
  const mod = load();
  return mod ? sync(() => mod.cancelModelJob(jobId)) : false;
}

// --- The Hugging Face token ---------------------------------------------------

export function hasHfToken(): boolean {
  return load() ? sync((m) => m.hasHfToken()) : false;
}

/** Keeps the token encrypted on the phone. Rejects invalid_token for blank or spaced input. */
export function setHfToken(token: string): void {
  sync((m) => m.setHfToken(token));
}

export function clearHfToken(): void {
  sync((m) => m.clearHfToken());
}

// --- Events -------------------------------------------------------------------

function subscribe<T>(name: string, listener: (e: T) => void): Sub {
  const mod = load();
  if (!mod || typeof mod.addListener !== 'function') return { remove() {} };
  return mod.addListener(name, listener as (e: never) => void);
}

/** Progress of every download and import; a no-op subscription where the module is missing. */
export function onModelProgress(listener: (e: ModelProgress) => void): Sub {
  return subscribe('phonecandoModelsProgress', listener);
}

/** Fires on any model or download change; re-read listModels() / listDownloads(). */
export function onModelsChanged(listener: () => void): Sub {
  return subscribe('phonecandoModelsChanged', () => listener());
}
