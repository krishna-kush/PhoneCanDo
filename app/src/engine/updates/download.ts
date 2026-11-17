// The update's download, the first of its two steps, run by the runner
// (native.ts): the APK lands in files/updates/ while everything else keeps
// running (it touches no agent), resumes after a dropped connection or a
// process death, is checked against latest.json's size and sha256, and
// stays until it is installed (the new build clears the folder) or a newer
// build replaces it, so a "Later" on the install never costs a second
// download.
import { File } from 'expo-file-system';
import type { UpdateManifest } from './manifest';
import {
  startUpdateDownload,
  stopUpdateDownload,
  type UpdateDownload,
  type UpdateDownloadStep,
  updateDownloadState,
} from './native';

export type UpdateProgress = { written: number; total: number };

function apkName(m: UpdateManifest): string {
  return m.apk.split('/').pop() ?? `phonecando-${m.version}-full-arm64.apk`;
}

/** Downloads [m]'s APK, or finds it downloading or done. Rejects without the size and sha256 to check it by. */
export function downloadUpdate(m: UpdateManifest): Promise<UpdateDownload> {
  if (!m.size || !m.sha256) return Promise.reject(new Error('The release says no size or checksum to check the download by.'));
  return startUpdateDownload({ url: m.apk, name: apkName(m), size: m.size, sha256: m.sha256, versionCode: m.versionCode, version: m.version });
}

/** Stops the download; what it fetched goes. */
export function stopUpdate(): void {
  stopUpdateDownload();
}

/** The download of [m]'s build, where it stands; null for none (or another build's). */
export function downloadOf(m: UpdateManifest): UpdateDownloadStep | null {
  const s = updateDownloadState();
  return s && s.versionCode === m.versionCode ? s.step : null;
}

/** [m]'s APK when it is on this phone in full and checked. */
export function downloadedApk(m: UpdateManifest): File | null {
  const s = updateDownloadState();
  if (!s || s.versionCode !== m.versionCode || s.step !== 'done' || !s.path) return null;
  return new File(`file://${s.path}`);
}

/** An older build's download goes once a newer one is out. */
export function dropOlderDownload(m: UpdateManifest): void {
  const s = updateDownloadState();
  if (s && s.versionCode < m.versionCode) stopUpdateDownload();
}
