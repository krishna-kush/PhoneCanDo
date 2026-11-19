import { useEffect, useMemo, useState } from 'react';
import { confirmUser, NO_SCREEN_LOCK } from '../../engine/auth';
import { errorMessage } from '../../engine/errors/message';
import * as runner from '../../engine/runner';
import { track } from '../../engine/telemetry';
import { unlockLasts } from '../control-lock/modes';
import DeckKeys from './actions/DeckKeys';
import PlainText from './PlainText';
import { unlockCoversLine, waitingLine } from './promptQueue';
import SlipDialog from './slip/SlipDialog';
import SlipField from './slip/SlipField';
import SlipFrom from './slip/SlipFrom';
import { markAnswered, pendingUnlockIds, useBridgePrompts } from './useBridgePrompts';

/** After its desk, on the slip. */
const ASKS = 'wants to control the phone';

// An agent asks the bridge for phone-control permission; this modal is the
// only UI that answers it. It sits over whatever tab is open (the bridge
// switches to Home first), so the chat never disappears. It shows when the
// oldest waiting prompt is an unlock. In install and launch modes the lock
// is one switch for the phone, so a successful unlock answers every
// waiting unlock; in ask mode the yes is this agent's alone (the bridge
// gives it its own unlock) and the next agent asks again. A permission
// slip from the agent: its face, and why it asks when it says.
export default function UnlockDialog() {
  const { current, queue } = useBridgePrompts();
  const prompt = current?.kind === 'unlock' ? current : null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const requestId = prompt?.requestId;
  // Read per prompt: Settings may have changed it since the last one.
  const mode = useMemo(() => (requestId ? runner.getLockMode() : 'install'), [requestId]);
  const asks = mode === 'ask';

  useEffect(() => setMsg(''), [requestId]);

  const unlocks = queue.filter((p) => p.kind === 'unlock').length;
  const note = (asks ? '' : unlockCoversLine(unlocks - 1)) || waitingLine(queue.length - 1);

  async function unlock() {
    if (!requestId) return;
    setBusy(true);
    setMsg('');
    try {
      // Install mode saves the unlock: a fingerprint or the screen lock only.
      const auth = await confirmUser('Unlock phone control', { strong: mode === 'install' });
      if (auth === 'no_screen_lock') {
        // No prompt can show; keep the agent waiting until "Not now".
        setMsg(NO_SCREEN_LOCK);
        return;
      }
      if (auth !== 'passed') {
        answer([requestId], false);
        return;
      }
      if (asks) {
        track('control.unlock');
        answer([requestId], true);
        return;
      }
      if (!runner.setAutomationEnabled(true)) {
        answer([requestId], false);
        return;
      }
      track('control.unlock');
      // Read again: more agents may have asked while biometrics was up.
      answer([requestId, ...pendingUnlockIds()], true);
    } catch (e) {
      // Keep the bridge waiting so the user can retry; "Not now" refuses.
      setMsg(`Biometric error: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function answer(ids: string[], ok: boolean) {
    const unique = [...new Set(ids)];
    for (const id of unique) runner.resolveUnlock(id, ok);
    markAnswered(unique);
  }

  // "Not now" refuses this agent only; the next waiting prompt shows.
  function close() {
    if (busy || !requestId) return;
    answer([requestId], false);
  }

  return (
    <SlipDialog open={prompt !== null} onClose={close} slip="slipUnlock">
      {prompt ? <SlipFrom agentId={prompt.agentId} name={prompt.agentName} asks={ASKS} /> : null}
      {prompt?.reason ? <SlipField label="Why" value={prompt.reason} lines={6} /> : null}
      <PlainText fontSize={15} color="muted">
        PhoneCanDo needs permission to perform automated actions on this device. Unlock with biometrics or your device
        PIN to continue.
      </PlainText>
      {[prompt ? unlockLasts(mode, prompt.agentName) : '', 'The AI cannot unlock this; only you can.', note, msg]
        .filter((line) => line)
        .map((line) => (
          <PlainText key={line} fontSize={13} color="muted">
            {line}
          </PlainText>
        ))}
      <DeckKeys
        actions={[
          { label: busy ? 'Unlocking…' : 'Unlock', role: 'go', disabled: busy, onPress: () => void unlock() },
          { label: 'Not now', role: 'back', disabled: busy, onPress: close },
        ]}
      />
    </SlipDialog>
  );
}
