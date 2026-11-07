// Engine seam: the ONLY importer of the phonecando-linux native module.
// Lazy require keeps this importable where native code is absent (Expo Go,
// web, a build from before the module). Reads return empty or unavailable
// there; changes throw a LinuxError with code `linux_unavailable`.
//
// Long calls (create, retry, reset) resolve at once with a jobId; the job
// then reports `onLinuxProgress` events (throttled to a few per second, every
// new step passes) and ends with one `finished: true` event, `error` and
// `errorCode` set when it failed. Every record change fires `onLinuxChanged`:
// re-read listEnvs() / listImages(). On a job's end the records are written
// first, then the changed event, then the final progress event.
//
// A rejection is a LinuxError: `code` is the stable code, `message` the
// native line. A failed record's or final event's `error` is one line with
// the code first (`no_space: needs 812 MB, 90 MB free`), next to `errorCode`.
import type { LinuxStatus } from '../../../modules/phonecando-linux/src/PhoneCanDoLinux.types';
import type {
  CatalogImage,
  Env,
  EnvId,
  Image,
  ImageId,
  LinuxErrorCode,
  LinuxJob,
  LinuxProgress,
  ReinstallList,
  TagPage,
  TerminalRecipe,
} from './types';

export type { LinuxStatus };

type Sub = { remove(): void };

type LinuxModule = {
  linuxStatus(): LinuxStatus;
  listEnvs(): Env[];
  listImages(): Image[];
  ensureDefaultEnv(): Promise<Env>;
  ensureAndroidEnv(): Env;
  createRegistryEnv(params: { image: string; tag: string }): Promise<LinuxJob & { envId: EnvId }>;
  retryEnv(envId: EnvId): Promise<LinuxJob>;
  deleteEnv(envId: EnvId): Promise<null>;
  createImage(envId: EnvId): Promise<LinuxJob & { imageId: ImageId }>;
  retryImage(imageId: ImageId): Promise<LinuxJob>;
  resetImage(imageId: ImageId): Promise<LinuxJob>;
  deleteImage(imageId: ImageId): Promise<null>;
  imageSize(imageId: ImageId): Promise<number>;
  prepareImageForStart(imageId: ImageId): Promise<null>;
  reinstallList(imageId: ImageId): ReinstallList | null;
  clearReinstallList(imageId: ImageId): void;
  terminalRecipe(imageId: ImageId): TerminalRecipe;
  catalogOs(): Promise<CatalogImage[]>;
  catalogTags(params: { repo: string; page: number; query?: string }): Promise<TagPage>;
  cancelJob(jobId: string): boolean;
  addListener(name: string, listener: (e: never) => void): Sub;
};

const CODES: ReadonlySet<string> = new Set<LinuxErrorCode>([
  'unsafe_entry',
  'too_large',
  'invalid_ref',
  'no_space',
  'digest_mismatch',
  'network',
  'rate_limited',
  'not_found',
  'no_arm64',
  'unsupported_layer',
  'unsupported_manifest',
  'no_shell',
  'corrupt',
  'cancelled',
  'linux_unavailable',
  'env_in_use',
  'busy',
  'internal',
]);

/** A native failure with its stable code; `message` is the native line, fit for the UI. */
export class LinuxError extends Error {
  readonly code: LinuxErrorCode;

  constructor(code: LinuxErrorCode, message: string) {
    super(message);
    this.name = 'LinuxError';
    this.code = code;
  }
}

function unavailable(reason: string): LinuxStatus {
  return { available: false, reason, libDir: '', launcher: '', proot: '', loader: '' };
}

function load(): LinuxModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../modules/phonecando-linux/src/PhoneCanDoLinuxModule');
    const impl = (mod?.default ?? mod) as Partial<LinuxModule> | undefined;
    return typeof impl?.listEnvs === 'function' ? (impl as LinuxModule) : null;
  } catch {
    return null;
  }
}

function required(): LinuxModule {
  const mod = load();
  if (!mod) throw new LinuxError('linux_unavailable', 'the native Linux module is missing');
  return mod;
}

// Expo prefixes a sync call's message ("Call to function ... has been
// rejected. → Caused by: <message>"); we keep the native line only.
function toLinuxError(e: unknown): LinuxError {
  if (e instanceof LinuxError) return e;
  const raw = e instanceof Error ? e.message : String(e);
  const marker = '→ Caused by: ';
  const at = raw.lastIndexOf(marker);
  const message = at >= 0 ? raw.slice(at + marker.length).trim() : raw;
  const code = (e as { code?: unknown } | null)?.code;
  return new LinuxError(typeof code === 'string' && CODES.has(code) ? (code as LinuxErrorCode) : 'internal', message);
}

function sync<T>(call: (mod: LinuxModule) => T): T {
  const mod = required();
  try {
    return call(mod);
  } catch (e) {
    throw toLinuxError(e);
  }
}

async function callAsync<T>(call: (mod: LinuxModule) => Promise<T>): Promise<T> {
  const mod = required();
  try {
    return await call(mod);
  } catch (e) {
    throw toLinuxError(e);
  }
}

// --- Status -----------------------------------------------------------------

// Whether this build can run Linux images (not play, and the launcher, proot
// and its loader are in the native lib dir), with their paths. Never throws.
export function getLinuxStatus(): LinuxStatus {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../modules/phonecando-linux/src/PhoneCanDoLinuxModule');
    const impl = (mod?.default ?? mod) as Partial<LinuxModule> | undefined;
    if (typeof impl?.linuxStatus !== 'function') return unavailable('the native Linux module is missing');
    const status = impl.linuxStatus();
    if (typeof status?.available !== 'boolean') return unavailable('the native Linux module answered nothing');
    return status;
  } catch (e) {
    return unavailable(`the native Linux module failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// --- Envs -------------------------------------------------------------------

/** Every env record; empty where the module is missing. */
export function listEnvs(): Env[] {
  return load() ? sync((m) => m.listEnvs()) : [];
}

/** The Default env (the image baked into this APK). Idempotent. Rejects
    `linux_unavailable` on play or when the launcher, proot or the image asset is missing. */
export function ensureDefaultEnv(): Promise<Env> {
  return callAsync((m) => m.ensureDefaultEnv());
}

/** The env with no Linux (play, or "continue without Linux"). Idempotent, every channel. */
export function ensureAndroidEnv(): Env {
  return sync((m) => m.ensureAndroidEnv());
}

/** Starts downloading a registry image (arm64) as a new env, `downloading` until the job ends.
    Its layers stay compressed and verified in the env; its config is saved with them. A blank
    tag means the image's own or `latest`; a `sha256:` tag pins a digest. Rejects `invalid_ref`
    at once for a bad reference, `linux_unavailable` on play. */
export function createRegistryEnv(image: string, tag = ''): Promise<LinuxJob & { envId: EnvId }> {
  return callAsync((m) => m.createRegistryEnv({ image, tag }));
}

/** Downloads a registry env again: partial layers resume, finished ones are re-verified. */
export function retryEnv(envId: EnvId): Promise<LinuxJob> {
  return callAsync((m) => m.retryEnv(envId));
}

/** Deletes an env and its downloaded layers (a running download is cancelled first).
    Rejects `env_in_use` while an image was made from it. Idempotent. */
export async function deleteEnv(envId: EnvId): Promise<void> {
  await callAsync((m) => m.deleteEnv(envId));
}

// --- Images -----------------------------------------------------------------

/** Every image record; empty where the module is missing. */
export function listImages(): Image[] {
  return load() ? sync((m) => m.listImages()) : [];
}

/** Starts making an image from a ready env; `creating` until the job ends (then `ready`, or
    `failed` with `failedStep`, `error` and `errorCode`). */
export function createImage(envId: EnvId): Promise<LinuxJob & { imageId: ImageId }> {
  return callAsync((m) => m.createImage(envId));
}

/** Runs setup again: a failed image resumes at the step that failed. */
export function retryImage(imageId: ImageId): Promise<LinuxJob> {
  return callAsync((m) => m.retryImage(imageId));
}

/** Resets a ready Linux image to a fresh copy of its env (home/ is kept). Stop the image's
    engine first. On failure the image stays as it was: `ready`, with `error` set. */
export function resetImage(imageId: ImageId): Promise<LinuxJob> {
  return callAsync((m) => m.resetImage(imageId));
}

/** Deletes an image (a running job on it is cancelled first; the files go in the background).
    Stop the image's engine first. Idempotent. */
export async function deleteImage(imageId: ImageId): Promise<void> {
  await callAsync((m) => m.deleteImage(imageId));
}

/** Measures the image (system + home) in bytes and updates its record; 0 where the module is missing. */
export function imageSize(imageId: ImageId): Promise<number> {
  return load() ? callAsync((m) => m.imageSize(imageId)) : Promise.resolve(0);
}

/** Await before EVERY engine start and terminal on this image (then the runner's startEngine,
    or terminalRecipe): rewrites what depends on the phone and the APK's lib dir, finishes a
    cut-short reset. Cheap when nothing changed; runs off the JS thread. Rejects `busy` while a
    job runs on the image, `not_found` when its setup failed, `linux_unavailable` on play. */
export async function prepareImageForStart(imageId: ImageId): Promise<void> {
  await callAsync((m) => m.prepareImageForStart(imageId));
}

/** The packages a reset found installed by hand, to offer reinstalling; null when none. */
export function reinstallList(imageId: ImageId): ReinstallList | null {
  return load() ? sync((m) => m.reinstallList(imageId)) : null;
}

/** Forgets the reinstall offer once it was used or dismissed. */
export function clearReinstallList(imageId: ImageId): void {
  sync((m) => m.clearReinstallList(imageId));
}

/** A login shell in the image for our PTY: the image's bash for Linux, Android's sh otherwise.
    Cheap; await prepareImageForStart first. Never carries PHONECANDO_AGENT. */
export function terminalRecipe(imageId: ImageId): TerminalRecipe {
  return sync((m) => m.terminalRecipe(imageId));
}

// --- Docker Hub -------------------------------------------------------------

/** Docker Hub's official operating systems with an arm64 build, most relevant first. */
export function catalogOs(): Promise<CatalogImage[]> {
  return callAsync((m) => m.catalogOs());
}

/** One page (from 1) of a Docker Hub repository's arm64 tags; `query` filters by name. */
export function catalogTags(repo: string, page = 1, query?: string | null): Promise<TagPage> {
  const q = query?.trim();
  // Only defined fields: the native side takes a map of non-null values.
  return callAsync((m) => m.catalogTags(q ? { repo, page, query: q } : { repo, page }));
}

// --- Jobs and events --------------------------------------------------------

/** Asks a job to stop at its next check; false when it is not running. */
export function cancelJob(jobId: string): boolean {
  const mod = load();
  return mod ? sync(() => mod.cancelJob(jobId)) : false;
}

function subscribe<T>(name: string, listener: (e: T) => void): Sub {
  const mod = load();
  if (!mod || typeof mod.addListener !== 'function') return { remove() {} };
  return mod.addListener(name, listener as (e: never) => void);
}

/** Progress of every native job; a no-op subscription where the module is missing. */
export function onLinuxProgress(listener: (e: LinuxProgress) => void): Sub {
  return subscribe('phonecandoLinuxProgress', listener);
}

/** Fires on any env or image record change; re-read listEnvs() / listImages(). */
export function onLinuxChanged(listener: () => void): Sub {
  return subscribe('phonecandoLinuxChanged', () => listener());
}
