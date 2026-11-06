import { Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { answerTelemetryNotice } from '../../engine/telemetry';
import { useAppStore } from '../../state/app';
import AppButton from './AppButton';
import { useTheme } from './globals';

// First-launch notice: usage stats are on by default, so say so once, in
// plain words, with the off switch right here. Shown after telemetry has
// started (a few seconds after launch, never in the engine's way). Nothing
// is sent until it is answered: "Keep on" (or Android back) sends, "Turn
// off" deletes what was queued.
export default function TelemetryNotice() {
  const t = useTheme();
  const telemetry = useAppStore((s) => s.telemetry);
  const open = telemetry.ready && telemetry.available && !telemetry.noticeShown;

  function keepOn() {
    void answerTelemetryNotice(true);
  }

  function turnOff() {
    void answerTelemetryNotice(false);
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={keepOn}>
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
            Anonymous usage stats
          </Text>
          <Text fontSize={15} color="$color10">
            PhoneCanDo shares anonymous usage stats to find bugs: your device type, the app
            version, crashes and how often features are used. Never your chats, files or keys.
          </Text>
          <Text fontSize={13} color="$color10">
            You can change this any time in Settings → Privacy.
          </Text>
          <XStack gap="$2" marginTop="$2">
            <AppButton variant="secondary" flex={1} onPress={turnOff}>
              Turn off
            </AppButton>
            <AppButton flex={1} onPress={keepOn}>
              Keep on
            </AppButton>
          </XStack>
        </YStack>
      </YStack>
    </Modal>
  );
}
