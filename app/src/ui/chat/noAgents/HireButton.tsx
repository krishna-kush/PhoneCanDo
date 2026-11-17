import { YStack } from 'tamagui';
import AppButton from '../../common/AppButton';
import Note from '../../env/parts/Note';
import { NO_AGENTS } from './copy';

// The empty office's way out: hire the next agent, the drawer's New agent
// way, and why that failed if it did.
export default function HireButton({ hire }: { hire: { start: () => void; busy: boolean; error: string | null } }) {
  return (
    <YStack alignSelf="stretch" gap="2">
      <AppButton loading={hire.busy} onPress={hire.start}>
        {NO_AGENTS.button}
      </AppButton>
      {hire.error ? <Note tone="error">{hire.error}</Note> : null}
    </YStack>
  );
}
