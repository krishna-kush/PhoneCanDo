import { useEffect, useState } from 'react';
import { AppState, Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import * as LocalAuthentication from 'expo-local-authentication';
import * as runner from '../../engine/runner';
import AppButton from './AppButton';
import { useTheme } from './globals';

// The agent asks the bridge for phone-control permission; this modal is the
// only UI that can flip the native gate. It sits over whatever tab is open
// (the bridge switches to Home first), so the chat never disappears.
export default function UnlockDialog() {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const check = () => {
      if (runner.consumeUnlockRequest()) setOpen(true);
    };
    const sub = runner.onUnlockRequest(() => {
      runner.consumeUnlockRequest();
      setOpen(true);
    });
    check();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      sub.remove();
      appState.remove();
    };
  }, []);

  async function unlock() {
    setBusy(true);
    setMsg('');
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock phone control',
        cancelLabel: 'Cancel',
      });
      if (!res.success) {
        runner.resolveUnlock(false);
        setOpen(false);
        return;
      }
      const ok = runner.setAutomationEnabled(true);
      runner.resolveUnlock(ok);
      if (!ok) {
        setMsg('This install has no phone-control driver.');
        return;
      }
      setOpen(false);
    } catch (e) {
      // Keep the bridge waiting so the user can retry; "Not now" resolves false.
      setMsg(`Biometric error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    runner.resolveUnlock(false);
    setOpen(false);
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <YStack
        flex={1}
        backgroundColor="rgba(0,0,0,0.6)"
        alignItems="center"
        justifyContent="center"
        padding="$5"
      >
        <YStack
          backgroundColor={t.panel}
          borderWidth={1}
          borderColor={t.lineStrong}
          borderRadius={0}
          padding="$4"
          gap="$3"
          width="100%"
          maxWidth={360}
        >
          <Text fontSize={19} fontWeight="700">
            Permission required
          </Text>
          <Text fontSize={15} color="$color10">
            PhoneCanDo needs permission to perform automated actions on this device. Unlock with
            biometrics or your device PIN to continue.
          </Text>
          <Text fontSize={13} color="$color10">
            The AI cannot unlock this; only you can.
          </Text>
          {msg ? (
            <Text fontSize={13} color="$color10">
              {msg}
            </Text>
          ) : null}
          <XStack gap="$2" marginTop="$2">
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
