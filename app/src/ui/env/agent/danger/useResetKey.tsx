import { type ReactNode, useEffect, useState } from 'react';
import type { Agent } from '../../../../engine/agents/records';
import type { Env, Image, ReinstallList } from '../../../../engine/linux/types';
import { useAgentReinstallOffered } from '../../../../state/flows/installRuns';
import { pendingReinstall, resetAgentImage } from '../../../../state/flows/resetAgentImage';
import type { DeckAction } from '../../../common/actions/types';
import ConfirmDialog from '../../../common/ConfirmDialog';
import { linuxFailureText, recordErrorText } from '../../logic/errorText';
import { resetMessage } from '../../logic/sharedMachineText';
import { envTitle } from '../../logic/titles';
import Note from '../../parts/Note';
import ReinstallOffer from '../ReinstallOffer';
import { useMachineMates } from '../useMachineMates';

type Target = { image: Image; env: Env };

// Reset: system files back to the env's base, home kept, every agent on
// the machine stopped first (the confirm names them when it is shared).
// Afterwards (or when an earlier reset left one) the reinstall offer: the
// agent itself (a kind with an install; each agent on the machine gets its
// own on its page) and what was installed by hand.
// Its key goes in the danger deck; `below` is what shows under the deck.
// No target (an Android agent, or its env gone): no key.
export function useResetKey(agent: Agent, target: Target | null): { action: DeckAction | null; below: ReactNode } {
  const mates = useMachineMates(agent);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<ReinstallList | null>(null);
  const agentReinstall = useAgentReinstallOffered(agent.id);

  const imageId = target?.image.id;
  const ready = target?.image.state === 'ready';
  // An offer a reset left while this page was closed.
  useEffect(() => {
    if (imageId && ready) setOffer(pendingReinstall(imageId));
  }, [imageId, ready]);

  if (!target) return { action: null, below: null };

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
  const lastFailure = ready && !busy && !error ? recordErrorText(target.image) : null;

  return {
    action: { label: 'Reset machine', role: 'danger', loading: busy, disabled: !ready, onPress: () => setConfirm(true) },
    below: (
      <>
        {error ? <Note tone="error">{`The reset didn't finish. ${error}`}</Note> : null}
        {lastFailure ? <Note tone="error">{`The last reset didn't finish. ${lastFailure}`}</Note> : null}
        {done && !offer && !agentReinstall ? <Note>Reset done. Your projects, chats and keys are still there.</Note> : null}
        {offer || agentReinstall ? (
          <ReinstallOffer
            agent={agent}
            imageId={target.image.id}
            offer={offer}
            agentReinstall={agentReinstall}
            onDone={() => setOffer(null)}
          />
        ) : null}
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Reset this machine?"
          message={resetMessage(envTitle(target.env.source), [agent.name, ...mates.map((a) => a.name)])}
          confirmLabel="Reset"
          onConfirm={reset}
        />
      </>
    ),
  };
}
