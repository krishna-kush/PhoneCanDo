// Asking GitHub for a newer build: quietly at launch, where the box opens
// by itself only for a build it has not offered before (logic/updateOffer.ts),
// or from Settings → Updates, where it opens at once and always answers.
import { errorMessage } from '../../../engine/errors/message';
import { track } from '../../../engine/telemetry';
import { downloadOf } from '../../../engine/updates/download';
import { checkForUpdate, isLiteUpgrade, type UpdateManifest } from '../../../engine/updates/manifest';
import { useAppStore } from '../../app';
import { restingStep } from '../../logic/update/steps';
import { offerAtLaunch } from '../../logic/updateOffer';
import { setUpdate, useUpdateStore } from '../../update';

let checking: AbortController | null = null;

function found(m: UpdateManifest): void {
  setUpdate({ manifest: m, step: restingStep(true, downloadOf(m)) });
}

/**
 * Settings → Updates (and lite's full-build button): the box opens at once
 * and says what it found, even nothing newer. An update already downloading,
 * downloaded or installing just shows its box.
 */
export async function checkNow(): Promise<void> {
  const { step } = useUpdateStore.getState();
  if (step != null && step !== 'none' && step !== 'offer' && step !== 'error') {
    setUpdate({ shown: true });
    return;
  }
  checking?.abort();
  const ctrl = new AbortController();
  checking = ctrl;
  setUpdate({ step: 'checking', shown: true, error: null });
  try {
    const m = await checkForUpdate(ctrl.signal);
    if (ctrl.signal.aborted) return;
    track(m ? 'update.check.newer' : 'update.check.none', { manual: true });
    if (m) {
      found(m);
      track('update.offered', { version: m.version, lite: isLiteUpgrade() });
    } else {
      setUpdate({ manifest: null, step: 'none' });
    }
  } catch (e) {
    if (ctrl.signal.aborted) return;
    track('update.check.failed', { manual: true });
    setUpdate({ step: 'error', error: { stage: 'check', message: `Could not reach GitHub: ${errorMessage(e)}` } });
  } finally {
    if (checking === ctrl) checking = null;
  }
}

/** Walking away while Settings' check is out: its answer is dropped. */
export function abortCheck(): void {
  checking?.abort();
  checking = null;
}

/** At launch, in the background: says nothing unless offerAtLaunch opens the box. */
export function launchCheck(): Promise<void> {
  return quietCheck(true);
}

/**
 * Settings → Updates opened with nothing found yet: asks GitHub without a
 * word, so a newer build shows on the page itself; the box stays shut.
 */
export function checkQuietly(): Promise<void> {
  if (useUpdateStore.getState().step != null) return Promise.resolve();
  return quietCheck(false);
}

async function quietCheck(offerIt: boolean): Promise<void> {
  // A check is already out.
  if (checking) return;
  const ctrl = new AbortController();
  checking = ctrl;
  const lite = isLiteUpgrade();
  try {
    const m = await checkForUpdate(ctrl.signal);
    if (ctrl.signal.aborted) return;
    track(m ? 'update.check.newer' : 'update.check.none', { manual: false });
    if (!m) return;
    found(m);
    if (!offerIt) return;
    const app = useAppStore.getState();
    const offer = offerAtLaunch({
      newer: m.versionCode,
      offered: app.updateOffered,
      lite,
      muted: app.updatePromptMuted,
    });
    if (!offer) return;
    void app.setUpdateOffered(m.versionCode);
    setUpdate({ shown: true });
    track('update.offered', { version: m.version, lite });
  } catch {
    // Offline at launch: the site is the fallback.
    if (!ctrl.signal.aborted) track('update.check.failed', { manual: false });
  } finally {
    if (checking === ctrl) checking = null;
  }
}
