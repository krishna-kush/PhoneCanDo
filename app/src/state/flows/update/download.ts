// The update's first step: the runner downloads the APK while every agent
// keeps running, with the box up or hidden, and carries on after a dropped
// connection or a process death. Its events land here (follow); once it is
// in, the box comes back with the install, the step that stops things.
import { errorMessage } from '../../../engine/errors/message';
import { track } from '../../../engine/telemetry';
import { downloadUpdate, stopUpdate } from '../../../engine/updates/download';
import { isLiteUpgrade } from '../../../engine/updates/manifest';
import { onUpdateDownload, type UpdateDownload, updateDownloadState } from '../../../engine/updates/native';
import { stillDownloading } from '../../logic/update/steps';
import { setUpdate, useUpdateStore } from '../../update';

/** [show]: the box shows it (off for Settings → Updates, which draws it in place). */
export async function startDownload({ show = true }: { show?: boolean } = {}): Promise<void> {
  const { manifest, step, shown } = useUpdateStore.getState();
  if (!manifest || step === 'downloading') return;
  track('update.accepted', { version: manifest.version, lite: isLiteUpgrade(), stage: 'download' });
  setUpdate({
    step: 'downloading',
    shown: show || shown,
    error: null,
    phase: 'download',
    progress: { written: 0, total: manifest.size ?? 0 },
    // Its pace counts from the first bytes the runner reports (a resumed one starts part way).
    startedAt: null,
    startedFrom: 0,
  });
  try {
    follow(await downloadUpdate(manifest));
  } catch (e) {
    track('update.failed', { stage: 'download' });
    setUpdate({ step: 'error', shown: true, phase: null, error: { stage: 'download', message: errorMessage(e) } });
  }
}

/** Stop: what it fetched goes, and the offer stands. */
export function stopDownload(): void {
  track('update.cancelled', { stage: 'downloading' });
  stopUpdate();
  setUpdate({ step: 'offer', phase: null, progress: { written: 0, total: 0 }, startedAt: null, startedFrom: 0 });
}

/**
 * The runner's download as the store has it. Only for the newer build the
 * store knows (a launch with none yet takes a download under way or done,
 * with a stand-in for its build until the check names it). Finished while
 * this app watched it, the box comes back with the install, hidden or not:
 * you asked for it, and the install says what it stops before it does.
 */
function follow(s: UpdateDownload): void {
  const { manifest, step, startedAt } = useUpdateStore.getState();
  if (manifest && manifest.versionCode !== s.versionCode) return;
  if (!manifest && !stillDownloading(s.step) && s.step !== 'done') return;
  const build = manifest ?? { versionCode: s.versionCode, version: s.version, apk: '', size: s.total || undefined };
  if (stillDownloading(s.step)) {
    setUpdate({
      manifest: build,
      step: 'downloading',
      phase: s.step,
      progress: { written: s.written, total: s.total },
      ...(startedAt == null || step !== 'downloading' ? { startedAt: Date.now(), startedFrom: s.written } : {}),
    });
  } else if (s.step === 'done') {
    const watched = step === 'downloading';
    if (watched) track('update.downloaded', { version: s.version });
    setUpdate({ manifest: build, step: 'downloaded', phase: null, progress: { written: s.total, total: s.total }, ...(watched ? { shown: true } : {}) });
  } else if (s.step === 'failed' && step === 'downloading') {
    track('update.failed', { stage: 'download' });
    setUpdate({ step: 'error', shown: true, phase: null, error: { stage: 'download', message: s.error ?? 'The download failed.' } });
  } else if (s.step === 'stopped' && step === 'downloading') {
    setUpdate({ step: 'offer', phase: null, progress: { written: 0, total: 0 }, startedAt: null, startedFrom: 0 });
  }
}

/** Once, at launch: a download the runner carried on (or finished) is shown, and every move after. */
export function followDownloads(): () => void {
  const now = updateDownloadState();
  if (now) follow(now);
  const sub = onUpdateDownload(follow);
  return () => sub.remove();
}
