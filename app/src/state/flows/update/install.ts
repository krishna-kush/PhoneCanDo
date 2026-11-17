// The update's second step, the only one that stops anything: every running
// agent stops (the runs they have going are kept, and the new build offers
// each one's Continue), then Android's installer opens over the app. If it
// comes back without installing, those runs are offered at once (each
// agent's notice has Continue) and the other agents it stopped start again.
import type { AgentId } from '../../../engine/agents/records';
import { updateCancelled } from '../../../engine/engines';
import { errorMessage } from '../../../engine/errors/message';
import { track } from '../../../engine/telemetry';
import { downloadedApk } from '../../../engine/updates/download';
import { canInstallUpdates, openInstaller, stopForInstall } from '../../../engine/updates/install';
import { isLiteUpgrade } from '../../../engine/updates/manifest';
import { useAgentsStore } from '../../agents';
import { setUpdate, useUpdateStore } from '../../update';
import { startDownload } from './download';

const DEV_NOTE =
  'Dev build: Android will not install the release APK over a debug-signed app, so nothing was stopped. Test the install with a release build.';

/** The agents whose engines run now or are on their way up. */
function runningAgentIds(): AgentId[] {
  const { agents, statuses } = useAgentsStore.getState();
  return agents
    .filter((a) => {
      const state = statuses[a.id]?.state;
      return state === 'ready' || state === 'starting';
    })
    .map((a) => a.id);
}

export async function install(): Promise<void> {
  const { manifest, step } = useUpdateStore.getState();
  if (!manifest || step === 'stopping' || step === 'installer') return;
  track('update.accepted', { version: manifest.version, lite: isLiteUpgrade(), stage: 'install' });
  if (__DEV__) {
    setUpdate({ step: 'error', error: { stage: 'install', message: DEV_NOTE } });
    return;
  }
  const file = downloadedApk(manifest);
  if (!file) {
    // Gone since it downloaded (storage cleared): fetch it again.
    void startDownload();
    return;
  }
  // Without Android's "Install unknown apps" switch the installer would
  // open Android's own prompt over this box; ask here first instead.
  if (!canInstallUpdates()) {
    setUpdate({ step: 'permission', shown: true, error: null });
    return;
  }
  const stopped = runningAgentIds();
  setUpdate({ step: 'stopping', shown: true, error: null, stopped });
  await stopForInstall();
  setUpdate({ step: 'installer' });
  let failure: unknown = null;
  try {
    await openInstaller(file);
  } catch (e) {
    failure = e;
  }
  // The app survives only if you backed out of the installer or it failed.
  // (A finished install replaces the process; telemetry counts it as
  // update.installed on the next launch.)
  const offered = await updateCancelled();
  if (failure) {
    track('update.failed', { stage: 'install' });
    setUpdate({ step: 'error', error: { stage: 'install', message: errorMessage(failure) } });
  } else {
    track('update.cancelled', { stage: 'installer' });
    setUpdate({ step: 'cancelled' });
  }
  // An agent offered back waits for its notice's Continue: a start of ours would settle it.
  await startAgain(stopped.filter((id) => !offered.includes(id)));
}

// One at a time, as at launch: each start checks for room on its own.
async function startAgain(ids: readonly AgentId[]): Promise<void> {
  const { startAgent } = useAgentsStore.getState();
  for (const id of ids) {
    try {
      await startAgent(id);
    } catch {
      // Its own page says why; the others still start.
    }
  }
}
