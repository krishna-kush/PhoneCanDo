import { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { confirmUser } from '../../engine/auth';
import * as runner from '../../engine/runner';
import { track } from '../../engine/telemetry';
import AppButton from './AppButton';
import { askerTitle, unlockCoversLine, waitingLine } from './promptQueue';
import { markAnswered, pendingUnlockIds, useBridgePrompts } from './useBridgePrompts';

// An agent asks the bridge for phone-control permission; this modal is the
// only UI that can flip the native gate. It sits over whatever tab is open
// (the bridge switches to Home first), so the chat never disappears. It
// shows when the oldest waiting prompt is an unlock; the gate is one switch
// for the phone, so a successful unlock answers every waiting unlock.
export default function UnlockDialog() {
  const { current, queue } = useBridgePrompts();
  const prompt = current?.kind === 'unlock' ? current : null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const requestId = prompt?.requestId;

  useEffect(() => setMsg(''), [requestId]);

  const unlocks = queue.filter((p) => p.kind === 'unlock').length;
  const note = unlockCoversLine(unlocks - 1) || waitingLine(queue.length - 1);

  async function unlock() {
    if (!requestId) return;
    setBusy(true);
    setMsg('');
    try {
      if (!(await confirmUser('Unlock phone control'))) {
        answer([requestId], false);
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
