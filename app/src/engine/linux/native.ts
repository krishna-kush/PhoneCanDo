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
// A guest script (runGuestScript) is such a job on its image: its events
// also carry `phase`, `retry`, `tail` and its activity (`elapsedSec`,
// `downloadedBytes`, `rateBytesPerSec`), about once a second even while it
// prints nothing; its last one `ok` and `exitCode`.
//
// A rejection is a LinuxError: `code` is the stable code, `message` the
// native line. A failed record's or final event's `error` is one line with
// the code first (`no_space: needs 812 MB, 90 MB free`), next to `errorCode`.
import type { LinuxStatus } from '../../../modules/phonecando-linux/src/PhoneCanDoLinux.types';
import type {
  CatalogImage,
  Env,
  EnvId,
  GuestCommandResult,
  GuestScriptOptions,
  Image,
  ImageId,
  LinuxErrorCode,
  LinuxJob,
  LinuxProgress,
  MissingTools,
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
  prepareImageForStart(imageId: ImageId, guestUnset: string[]): Promise<null>;
  checkTools(imageId: ImageId, commands: string[]): Promise<MissingTools>;
  runGuestScript(imageId: ImageId, script: string, opts: GuestScriptOptions): Promise<LinuxJob>;
  runGuestCommand(imageId: ImageId, argv: string[], timeoutSec: number): Promise<GuestCommandResult>;
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
  'command_failed',
  'timed_out',
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

/** Await before EVERY engine start, terminal and guest program on this image (then the runner's
    startEngine, terminalRecipe, runGuestScript or runGuestCommand): rewrites what depends on the
    phone and the APK's lib dir, finishes a cut-short reset. `guestUnset` names the variables (a
    trailing `*` for a prefix) the image's agent holds as secrets: no guest command inherits them,
    nor any `LD_*`, until the next prepare. Cheap when nothing changed; runs off the JS thread.
    Rejects `busy` while a create or reset runs on the image (a guest script does not block it),
    `not_found` when its setup failed, `unsafe_entry` for a name that is not a variable name,
    `linux_unavailable` on play. */
export async function prepareImageForStart(imageId: ImageId, guestUnset: readonly string[]): Promise<void> {
  await callAsync((m) => m.prepareImageForStart(imageId, [...guestUnset]));
}

/** Which of `commands` (an agent's tools, e.g. `rg`) the image's guest PATH lacks, and the line
    that installs them; nothing for an image with no Linux. Cheap file checks. Rejects `busy`
    unless the image is ready, `unsafe_entry` for a command that is not a plain name. */
export function checkTools(imageId: ImageId, commands: readonly string[]): Promise<MissingTools> {
  return callAsync((m) => m.checkTools(imageId, [...commands]));
}

/** Starts a POSIX sh script in the image (`sh -s`, the script on stdin, HOME=/root) as a job on
    it; await prepareImageForStart first. Its LinuxProgress events (step `script`) carry the
    phase its `@phase <name>` lines name, the retry its `@retry <phase> <n>/<max>` lines announce
    (until the next phase), its last 20 other lines, redacted, and its time and bytes received so
    far, about once a second even while it prints nothing; it logs to the image's
    logs/install.log. The last event has `ok` and `exitCode`: it fails `command_failed` on a
    non-zero exit, `timed_out` past `timeoutSec`, `cancelled` on cancelJob. What it leaves
    running is stopped when it ends. Meanwhile a reset, a retry or a second script is refused
    (`busy`) and a delete cancels it; an engine start, a terminal and a guest command still go
    ahead. Rejects at once `busy` while a create, reset or script runs on the image, `not_found`
    for an image with no Linux. */
export function runGuestScript(imageId: ImageId, script: string, opts: GuestScriptOptions): Promise<LinuxJob> {
  return callAsync((m) => m.runGuestScript(imageId, script, { timeoutSec: opts.timeoutSec, label: opts.label }));
}

/** Runs one program in the image (`argv[0]` a guest command, looked up on the guest PATH, or a
    path) with HOME=/root, and resolves with its exit code (non-zero too) and the first 64 KiB
    of its stdout (stderr is dropped); await prepareImageForStart first. What it leaves running is
    stopped when it ends. Rejects `timed_out` past `timeoutSec`, `busy` while a create or reset
    runs on the image, `not_found` for an image with no Linux. */
export function runGuestCommand(
  imageId: ImageId,
  argv: readonly string[],
  timeoutSec: number,
): Promise<GuestCommandResult> {
  return callAsync((m) => m.runGuestCommand(imageId, [...argv], timeoutSec));
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
