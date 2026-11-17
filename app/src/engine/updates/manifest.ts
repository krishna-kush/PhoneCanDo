// In-app updater: GitHub Releases is the store. Each release carries
// latest.json (this manifest), phonecando-<version>-full-arm64.apk (the
// target here) and phonecando-<version>-lite-arm64.apk (the site download).
// No GitHub API: /releases/latest skips pre-releases and the API is
// rate-limited (60/h/IP); a release asset URL is neither. The asset name is
// stable, so the check URL never changes. Downloading is download.ts,
// handing it to Android's installer install.ts.
import { nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import { getBuildChannel } from '../runner';
import { dropOlderDownload } from './download';

const REPO = 'krishna-kush/PhoneCanDo';
const MANIFEST_URL = `https://github.com/${REPO}/releases/latest/download/latest.json`;
const APK_PREFIX = `https://github.com/${REPO}/releases/download/`;

export type UpdateManifest = {
  versionCode: number;
  version: string;
  apk: string;
  size?: number;
  /** The APK's sha256, hex; the download is checked against it. */
  sha256?: string;
  notes?: string;
};

// Lite is the download users get past Play Protect with; its only "update" is
// the full build with phone control. Same version string, higher versionCode.
export function isLiteUpgrade(): boolean {
  return getBuildChannel() === 'lite';
}

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
  const sha256 = typeof m.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(m.sha256) ? m.sha256.toLowerCase() : undefined;
  const notes = typeof m.notes === 'string' ? m.notes.slice(0, 500) : undefined;
  return {
    versionCode: m.versionCode as number,
    version: m.version,
    apk: m.apk,
    size,
    sha256,
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
  // Play updates through Play. Full and lite both use the full GitHub APK.
  if (getBuildChannel() === 'play') return null;
  const remote = await fetchLatest(signal);
  if (!remote) return null;
  if (remote.versionCode <= installedVersion().versionCode) return null;
  dropOlderDownload(remote);
  return remote;
}
