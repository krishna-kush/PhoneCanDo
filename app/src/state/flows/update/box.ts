// Walking away from the update box: a download carries on hidden, and
// whatever else was on it settles back to where the update rests (a
// download on the phone waits for its Install). The box can't be left
// while the agents stop or Android's installer is up.
import { track } from '../../../engine/telemetry';
import { downloadOf } from '../../../engine/updates/download';
import { holdsBox, restingStep, runsHidden } from '../../logic/update/steps';
import { setUpdate, useUpdateStore } from '../../update';
import { abortCheck } from './check';

export function closeBox(): void {
  const { step, manifest } = useUpdateStore.getState();
  if (holdsBox(step)) return;
  if (runsHidden(step)) {
    setUpdate({ shown: false });
    return;
  }
  if (step === 'checking') abortCheck();
  if (step === 'offer') track('update.cancelled', { stage: 'offer' });
  if (step === 'downloaded') track('update.cancelled', { stage: 'install' });
  if (step === 'permission') track('update.cancelled', { stage: 'permission' });
  setUpdate({ shown: false, error: null, step: restingStep(manifest != null, manifest ? downloadOf(manifest) : null) });
}
