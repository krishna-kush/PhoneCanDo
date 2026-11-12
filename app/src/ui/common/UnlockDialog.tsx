import { useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { confirmUser, NO_SCREEN_LOCK } from '../../engine/auth';
import * as runner from '../../engine/runner';
import { track } from '../../engine/telemetry';
import { unlockLasts } from '../control-lock/modes';
import AppButton from './AppButton';
import { askerTitle, unlockCoversLine, waitingLine } from './promptQueue';
import { markAnswered, pendingUnlockIds, useBridgePrompts } from './useBridgePrompts';

// An agent asks the bridge for phone-control permission; this modal is the
// only UI that answers it. It sits over whatever tab is open (the bridge
// switches to Home first), so the chat never disappears. It shows when the
// oldest waiting prompt is an unlock. In install and launch modes the lock
// is one switch for the phone, so a successful unlock answers every
// waiting unlock; in ask mode the yes is this agent's alone (the bridge
// gives it its own unlock) and the next agent asks again.
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
      setMsg(`Biometric error: ${e instanceof Error ? e.message : String(e)}`);
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
    <Modal visible={prompt !== null} transparent animationType="fade" onRequestClose={close}>
      <YStack
        flex={1}
        backgroundColor="rgba(0,0,0,0.6)"
        alignItems="center"
        justifyContent="center"
        padding="5"
      >
        <YStack
          backgroundColor="panel"
          borderWidth={1}
          borderColor="lineStrong"
          borderRadius={0}
          padding="4"
          gap="3"
          width="100%"
          maxWidth={360}
        >
          <Text fontSize={19} fontWeight="700">
            {prompt ? askerTitle(prompt) : 'Permission required'}
          </Text>
          <Text fontSize={15} color="color10">
            PhoneCanDo needs permission to perform automated actions on this device. Unlock with
            biometrics or your device PIN to continue.
          </Text>
          {prompt ? (
            <Text fontSize={13} color="color10">
              {unlockLasts(mode, prompt.agentName)}
            </Text>
          ) : null}
          <Text fontSize={13} color="color10">
            The AI cannot unlock this; only you can.
          </Text>
          {note ? (
            <Text fontSize={13} color="color10">
              {note}
            </Text>
          ) : null}
          {msg ? (
            <Text fontSize={13} color="color10">
              {msg}
            </Text>
          ) : null}
          <XStack gap="2" marginTop="2">
            <AppButton variant="secondary" flex={1} onPress={close} disabled={busy}>
              Not now
            </AppButton>
            <AppButton flex={1} onPress={unlock} disabled={busy}>
              {busy ? 'Unlocking…' : 'Unlock'}
            </AppButton>
          </XStack>
        </YStack>
      </YStack>
    </Modal>
  );
}
