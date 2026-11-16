import { XStack, YStack } from 'tamagui';
import AppButton from '../common/AppButton';
import PlainText from '../common/PlainText';
import type { ModelStop } from './useModelStop';

// A model's Stop asking in place: which agents stop first, then Keep it or
// stop them all.
export default function ModelStopConfirm({ stop }: { stop: ModelStop }) {
  return (
    <YStack gap="2">
      <PlainText fontSize={14}>{stop.confirm ?? ''}</PlainText>
      <XStack gap="2">
        <AppButton flex={1} variant="secondary" disabled={stop.busy} onPress={stop.keep}>
          Keep it
        </AppButton>
        <AppButton flex={1} variant="danger" loading={stop.busy} onPress={stop.stopAll}>
          {stop.allLabel}
        </AppButton>
      </XStack>
    </YStack>
  );
}
