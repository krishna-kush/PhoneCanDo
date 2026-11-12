// Linux runtime contract (envs and images), shared by the engine seam, the
// stores and the agent and system pages. The native side (phonecando-linux over lre/) owns
// the records; JS only reads them and asks for changes.
//
// Env:   a fixed base OS, never modified: the Default env baked into this APK,
//        an Own env pulled from a container registry, or Android (no Linux).
// Image: a VM-like machine made from an env. Everything done inside it stays,
//        in that image only. One agent attaches to exactly one image.

export type EnvId = string;
export type ImageId = string;

export type EnvSource =
  /** The Debian-based image baked into this APK (full and lite). */
  | { kind: 'default'; version: string }
  /** Any registry image the user picked, e.g. `alpine:3.22` or `kalilinux/kali-rolling`. */
  | { kind: 'registry'; image: string; tag: string; digest: string }
  /** No Linux: the agent runs commands with Android's shell (play, or Linux unavailable). */
  | { kind: 'android' };

/** Package-manager families we know an install command and proot fix for. */
export type PackageFamily = 'apt' | 'apk' | 'dnf' | 'yum' | 'microdnf' | 'pacman' | 'zypper' | 'xbps';

/** What we detected inside an env's base, never a hand-kept per-OS table. */
export type OsInfo = {
  /** os-release ID, e.g. `debian`, `alpine`. */
  id: string;
  versionId: string | null;
  /** os-release ID_LIKE, e.g. `['rhel', 'centos', 'fedora']`. */
  idLike: string[];
  prettyName: string | null;
  /** Null when no known package manager exists; the image still works. */
  family: PackageFamily | null;
  /** Guest path of the login shell we use (`/bin/bash`, else `/bin/sh`). */
  shell: string | null;
};

export type EnvState = 'downloading' | 'ready' | 'failed';

export type Env = {
  id: EnvId;
  name: string;
  source: EnvSource;
  state: EnvState;
  /** Set once the base is unpacked once and detected. */
  os: OsInfo | null;
  /** Bytes the env's own base takes (0 for Default and Android). */
  sizeBytes: number;
  createdAt: number;
  /** Why the last download failed, one line with the code first (`network: ...`); null when it did not. */
  error: string | null;
  /** The stable code of `error` (native records always set it, null when no error). */
  errorCode?: LinuxErrorCode | null;
};

/** Image setup steps, in order. Each is idempotent; a failed step is retried. */
export type ImageStep = 'space' | 'unpack' | 'detect' | 'fixups' | 'shims' | 'seed';

export type ImageState = 'creating' | 'ready' | 'failed' | 'resetting' | 'deleting';

export type Image = {
  id: ImageId;
  envId: EnvId;
  state: ImageState;
  /** The setup step that failed, when state is `failed` (null when it failed before setup began). */
  failedStep: ImageStep | null;
  /** Why the last create or reset failed, one line with the code first (`no_space: ...`). */
  error: string | null;
  os: OsInfo | null;
  /** System + home, in bytes, as last measured. */
  sizeBytes: number;
  createdAt: number;
  /** The stable code of `error` (native records always set it, null when no error). A failed
      reset leaves the image `ready` with `error` and `errorCode` set: the image is unchanged. */
  errorCode?: LinuxErrorCode | null;
};

/** Progress of a long native job (download, image setup, reset, guest script). */
export type LinuxProgress = {
  jobId: string;
  target: { kind: 'env'; id: EnvId } | { kind: 'image'; id: ImageId };
  /** `start` first; a download `resolve`, `download` (and `verify` while it re-reads what an
      earlier try left; `retry` while it waits to try again, `offline` while it waits for a
      network); setup the ImageStep ids; a reset `packages`, `unpack`, `swap`; setup and reset end
      with `measure`; a guest script `script`. */
  step: string;
  /** Progress within the step: bytes for `download`, `verify` and `unpack` (a download's waits
      keep its last count), else 0. */
  done: number;
  /** Null while the total is unknown (or the step has none). */
  total: number | null;
  /** Set once, on the last event of a failed job: one line with the code first. */
  error: string | null;
  /** The stable code of `error`, on the same event. */
  errorCode?: LinuxErrorCode | null;
  finished: boolean;
  /** On the last event only: true when the job succeeded. */
  ok?: boolean;
  /** A guest script job only: the name of its last `@phase <name>` line, null before the first. */
  phase?: string | null;
  /** A guest script job only: its last 100 output lines, redacted. */
  tail?: string[];
  /** A guest script job only: its exit code once it ended by itself (on the last event); null
      while it runs, and when it was stopped (timed out, cancelled). */
  exitCode?: number | null;
  /** A guest script job: its last `@retry <phase> <n>/<max>` line since the phase began (a step
      failed and runs again: try `attempt` of `max`); null when none came. A download waiting to try
      again (step `retry`): also how long (`delaySec`) and what failed (`reason`: Docker Hub's limit,
      a 429, or the network). */
  retry?: { attempt: number; max: number; delaySec?: number; reason?: 'network' | 'rate_limited' } | null;
  /** A guest script job only: whole seconds since it started. Its events come about once a second
      even while it prints nothing. */
  elapsedSec?: number;
  /** A guest script job only: bytes the app received since it started (the whole app's count, so
      an engine's traffic counts too); null where Android cannot count them. */
  downloadedBytes?: number | null;
  /** A guest script job only: that count's rate over the last ~3 s, in bytes per second. */
  rateBytesPerSec?: number | null;
  /** A guest script job only: the phone has a network that offers the internet, as of the last
      reading (false in airplane mode or with no signal); null when Android won't say. */
  online?: boolean | null;
};

/** Stable codes of a native failure: a thrown LinuxError's `code`, a record's `errorCode`. */
export type LinuxErrorCode =
  | 'unsafe_entry'
  | 'too_large'
  | 'invalid_ref'
  | 'no_space'
  | 'digest_mismatch'
  | 'network'
  | 'rate_limited'
  | 'not_found'
  | 'no_arm64'
  | 'unsupported_layer'
  | 'unsupported_manifest'
  | 'no_shell'
  | 'corrupt'
  | 'cancelled'
  /** Play, or a build without the launcher, proot or the Default image asset. */
  | 'linux_unavailable'
  /** deleteEnv while an image was made from it (a reset needs the env's base). */
  | 'env_in_use'
  /** A job already runs for that env or image, or it is not in a state for this. */
  | 'busy'
  /** A guest script (runGuestScript) exited non-zero; the final event's `exitCode` says how. */
  | 'command_failed'
  /** A guest script or command ran past its time limit and was stopped. */
  | 'timed_out'
  | 'internal';

/** What a long native call resolves with at once; progress follows as LinuxProgress events. */
export type LinuxJob = { jobId: string };

/** One Docker Hub repository for the "Own env" picker. */
export type CatalogImage = {
  /** What to pass as createRegistryEnv's `image`: `alpine` for official images, else `namespace/name`. */
  name: string;
  description: string;
  pullCount: number | null;
  /** https link to the repository's logo, when Docker Hub has one. */
  logoUrl: string | null;
};

/** One tag that has a linux/arm64 image. */
export type CatalogTag = {
  name: string;
  /** Compressed size of the arm64 image, when listed. */
  sizeArm64: number | null;
  /** ISO-8601 time of the last push. */
  lastUpdated: string | null;
  /** Digest of the arm64 image manifest. */
  digest: string | null;
};

/** One page of repositories; `next` is the page to ask for next, null on the last page. */
export type CatalogImagePage = { images: CatalogImage[]; next: number | null };

/** One page of tags; `next` is the page to ask for next, null on the last page. */
export type TagPage = { tags: CatalogTag[]; next: number | null };

/** A shell for our PTY (same shape as the agents' PtyRecipe): argv, env over the app's, cwd, and
    handOver for our launcher, which hands the terminal to the guest shell. */
export type TerminalRecipe = { cmd: string[]; env: Record<string, string>; cwd: string; handOver: boolean };

/** Packages installed by hand before a reset, and the one line that installs them again. */
export type ReinstallList = { installCommand: string; packages: string[] };

/** The commands (an agent's tools) an image lacks, and the line that installs them with its
    package manager: null when none are missing or the package manager is unknown. */
export type MissingTools = { missingTools: string[]; installCommand: string | null };

/** The end of a machine's last guest script log (an agent's install or update): its `# <label>`
    line, then what it printed, redacted, in whole lines. */
export type ScriptLog = {
  text: string;
  /** Earlier lines were left out: the log is longer than the part read back. */
  cut: boolean;
  /** When it was last written (epoch ms): about when the script ended. */
  modifiedAt: number;
};

/** runGuestScript's options: the time limit, and a short name for the log and the error line. */
export type GuestScriptOptions = { timeoutSec: number; label: string };

/** How a guest command ended: its exit code and the first 64 KiB of its stdout. */
export type GuestCommandResult = { exitCode: number; stdout: string };
