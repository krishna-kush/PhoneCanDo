import { Modal } from 'react-native';
import { YStack } from 'tamagui';
import { resolvePermission } from '../../../engine/acp/native';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';
import { waitingLine } from '../../common/promptQueue';
import { markAnswered, useBridgePrompts } from '../../common/useBridgePrompts';
import PermissionQuestion from './PermissionQuestion';
import { useShownRun } from './shownRun';

// An agent in ACP mode (a task in the background) asks before a tool step,
// over whatever page is open: one button per answer it offers; Back cancels
// the question. It shows when the oldest waiting prompt is a permission,
// except while Home shows that agent's run: its card there asks instead.
// Mounted once, with the other prompt dialogs.
export default function PermissionDialog() {
  const { current, queue } = useBridgePrompts();
  const shownRun = useShownRun();
  const onCard = current?.agentId === shownRun && (current?.options?.length ?? 0) > 0;
  const prompt = current?.kind === 'permission' && !onCard ? current : null;
  const options = prompt?.options ?? [];

  function answer(optionId: string | null) {
    if (!prompt) return;
    resolvePermission(prompt.requestId, optionId);
    markAnswered([prompt.requestId]);
  }

  const note = waitingLine(queue.length - 1);

  return (
    <Modal visible={prompt !== null} transparent animationType="fade" onRequestClose={() => answer(null)}>
      <YStack flex={1} backgroundColor="scrimSoft" alignItems="center" justifyContent="center" padding="5">
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
          <PermissionQuestion
            agentName={prompt?.agentName ?? ''}
            title={prompt?.title}
            toolKind={prompt?.toolKind}
            options={options}
            onAnswer={answer}
          />
          {/* A question with no answers to pick (a runner that sent none) can still be put away. */}
          {options.length === 0 ? (
            <AppButton variant="secondary" onPress={() => answer(null)}>
              Not now
            </AppButton>
          ) : null}
          {note ? (
            <PlainText fontSize={13} color="muted">
              {note}
            </PlainText>
          ) : null}
        </YStack>
      </YStack>
    </Modal>
  );
}
