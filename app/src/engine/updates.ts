// In-app updater: GitHub Releases is the store. Each release carries
// latest.json (this manifest) plus phonecando-<version>-arm64.apk.
// No GitHub API: /releases/latest skips pre-releases and the API is
// rate-limited (60/h/IP); a release asset URL is neither. The asset name is
// stable, so the check URL never changes.
import { applicationId, nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import { Directory, DownloadTask, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { isAutomationBuild, isServeRunning, stopServeService } from './runner';

const REPO = 'krishna-kush/PhoneCanDo';
const MANIFEST_URL = `https://github.com/${REPO}/releases/latest/download/latest.json`;
const APK_PREFIX = `https://github.com/${REPO}/releases/download/`;
const DOWNLOAD_DIR = 'updates';
const PACKAGE = applicationId ?? 'com.phonecando.app';

export type UpdateManifest = {
  versionCode: number;
  version: string;
  apk: string;
  size?: number;
  notes?: string;
};

export type UpdateProgress = { written: number; total: number };

export function installedVersion(): { version: string; versionCode: number } {
  return {
    version: nativeApplicationVersion ?? '0.0.0',
    versionCode: Number.parseInt(nativeBuildVersion ?? '0', 10) || 0,
  };
}

function parseManifest(raw: unknown): UpdateManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (!Number.isInteger(m.versionCode) || (m.versionCode as number) <= 0) return null;
  if (typeof m.version !== 'string' || !m.version) return null;
  if (
    typeof m.apk !== 'string' ||
    !m.apk.startsWith(APK_PREFIX) ||
    !m.apk.endsWith('.apk')
  ) {
    return null;
  }
  const size = typeof m.size === 'number' && m.size > 0 ? m.size : undefined;
  const notes = typeof m.notes === 'string' ? m.notes.slice(0, 500) : undefined;
  return {
    versionCode: m.versionCode as number,
    version: m.version,
    apk: m.apk,
    size,
    notes,
  };
}

// Manifest and APK must come from this repo; Android's signature check is the
// real gate, but a typo'd manifest should not send us to another host.
export async function fetchLatest(signal?: AbortSignal): Promise<UpdateManifest | null> {
  const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return parseManifest(await res.json());
}

export async function checkForUpdate(signal?: AbortSignal): Promise<UpdateManifest | null> {
  // A Play install must update through Play; replacing it with the full APK
  // would silently add the accessibility driver Play strips.
  if (isAutomationBuild() === 'play') return null;
  const remote = await fetchLatest(signal);
  if (!remote) return null;
  const newer = remote.versionCode > installedVersion().versionCode;
  pruneDownloads(newer ? apkName(remote) : null);
  return newer ? remote : null;
}

function apkName(m: UpdateManifest): string {
  return m.apk.split('/').pop() ?? `phonecando-${m.version}-arm64.apk`;
}

function updatesDir(): Directory {
  return new Directory(Paths.document, DOWNLOAD_DIR);
}

function pruneDownloads(keep: string | null): void {
  try {
    const dir = updatesDir();
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.name.endsWith('.apk') && entry.name !== keep) {
        entry.delete();
      }
    }
  } catch {
    // Downloads are disposable; a failed prune must never block a check.
  }
}

export async function downloadUpdate(
  m: UpdateManifest,
  opts: { signal?: AbortSignal; onProgress?: (p: UpdateProgress) => void } = {},
): Promise<File> {
  const dir = updatesDir();
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  const file = new File(dir, apkName(m));

  // A previous install attempt may have left the exact APK behind; reuse it
  // instead of pulling 150 MB again.
  if (file.exists && (!m.size || file.size === m.size)) return file;
  if (file.exists) file.delete();

  const task = new DownloadTask(m.apk, file, {
    signal: opts.signal,
    onProgress: (p) => opts.onProgress?.({ written: p.bytesWritten, total: p.totalBytes }),
  });
  const downloaded = await task.downloadAsync();
  if (!downloaded) throw new Error('Download did not finish.');
  if (m.size && downloaded.size !== m.size) {
    downloaded.delete();
    throw new Error('Download was incomplete. Try again.');
  }
  return downloaded;
}

// The engine is a child of this UID and outlives an APK replace; stop it
// before the installer kills the app so the new build never pairs with the
// old binary.
async function stopEngine(): Promise<void> {
  try {
    if (!isServeRunning()) return;
    stopServeService();
    const deadline = Date.now() + 4000;
    while (isServeRunning() && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
  } catch {
    // Native module absent: the installer still replaces the APK.
  }
}

export async function installDownloaded(apk: File): Promise<void> {
  await stopEngine();
  const uri = await getContentUriAsync(apk.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: uri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}

export async function openInstallSettings(): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
      data: `package:${PACKAGE}`,
    });
  } catch {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${PACKAGE}` },
    );
  }
}
