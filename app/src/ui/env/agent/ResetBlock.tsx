import { useEffect, useState } from 'react';
import type { Agent } from '../../../engine/agents/records';
import type { Env, Image, ReinstallList } from '../../../engine/linux/types';
import { pendingReinstall, resetAgentImage } from '../../../state/flows/resetAgentImage';
import AppButton from '../../common/AppButton';
import ConfirmDialog from '../../common/ConfirmDialog';
import { linuxFailureText, recordErrorText } from '../logic/errorText';
import { envTitle } from '../logic/titles';
import Note from '../parts/Note';
import ReinstallOffer from './ReinstallOffer';

type Props = { agent: Agent; image: Image; env: Env };

// Reset: system files back to the env's base, home kept, the engine stopped
// first. Afterwards (or when an earlier reset left one) the reinstall offer.
export default function ResetBlock({ agent, image, env }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<ReinstallList | null>(null);

  const ready = image.state === 'ready';
  // An offer a reset left while this page was closed.
  useEffect(() => {
    if (ready) setOffer(pendingReinstall(image.id));
  }, [image.id, ready]);

  const reset = () => {
    setConfirm(false);
    setBusy(true);
    setError(null);
    setDone(false);
    resetAgentImage(agent.id)
      .then((again) => {
        setDone(true);
        setOffer(again);
      })
      .catch((e: unknown) => setError(linuxFailureText(e)))
      .finally(() => setBusy(false));
  };

  // A failed reset leaves the machine ready with the reason noted.
  const lastFailure = ready && !busy && !error ? recordErrorText(image) : null;

  return (
    <>
      <AppButton variant="secondary" loading={busy} disabled={!ready} onPress={() => setConfirm(true)}>
        Reset machine
      </AppButton>
      {error ? <Note tone="error">{`The reset didn't finish. ${error}`}</Note> : null}
      {lastFailure ? <Note tone="error">{`The last reset didn't finish. ${lastFailure}`}</Note> : null}
      {done && !offer ? <Note>Reset done. Your projects, chats and keys are still there.</Note> : null}
      {offer ? <ReinstallOffer agentId={agent.id} imageId={image.id} offer={offer} onDone={() => setOffer(null)} /> : null}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset this machine?"
        message={`System files go back to the ${envTitle(env.source)} base. Your projects, chats and keys stay. Anything you installed goes; we'll offer to install it again. The agent stops first.`}
        confirmLabel="Reset"
        onConfirm={reset}
      />
    </>
  );
}
