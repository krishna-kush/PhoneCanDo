import { useEffect, useState } from 'react';
import { AppState, Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import * as runner from '../../engine/runner';
import AppButton from './AppButton';
import { useTheme } from './globals';

// The agent asks the bridge for accessibility permission; this confirmation
// sits over the chat. Only the user can flip the Android system toggle.
export default function AccessibilityDialog() {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const check = () => {
      if (runner.consumeAccessibilityRequest()) setOpen(true);
    };
    const sub = runner.onAccessibilityRequest(() => {
      runner.consumeAccessibilityRequest();
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

  function openSettings() {
    const ok = runner.openAccessibilitySettings() === 'opened';
    runner.resolveAccessibility(ok);
    if (!ok) {
      setMsg('Could not open Android settings. Open Settings → Accessibility manually.');
      return;
    }
    setMsg('');
    setOpen(false);
  }

  function close() {
    runner.resolveAccessibility(false);
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
            Accessibility permission
          </Text>
          <Text fontSize={15} color="$color10">
            PhoneCanDo needs Android's Accessibility service to read the screen and perform actions.
            Open Android Accessibility settings and enable PhoneCanDo.
          </Text>
          <Text fontSize={13} color="$color10">
            The AI cannot enable this; only you can.
          </Text>
          {msg ? (
            <Text fontSize={13} color="$color10">
              {msg}
            </Text>
          ) : null}
          <XStack gap="$2" marginTop="$2">
            <AppButton variant="secondary" flex={1} onPress={close}>
              Not now
            </AppButton>
            <AppButton flex={1} onPress={openSettings}>
              Open settings
            </AppButton>
          </XStack>
        </YStack>
      </YStack>
    </Modal>
  );
}
