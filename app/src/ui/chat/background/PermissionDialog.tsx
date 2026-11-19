import { resolvePermission } from '../../../engine/acp/native';
import DeckKeys from '../../common/actions/DeckKeys';
import PlainText from '../../common/PlainText';
import { waitingLine } from '../../common/promptQueue';
import SlipDialog from '../../common/slip/SlipDialog';
import SlipFrom from '../../common/slip/SlipFrom';
import { markAnswered, useBridgePrompts } from '../../common/useBridgePrompts';
import PermissionQuestion from './PermissionQuestion';
import { useShownRun } from './shownRun';

/** After its desk, on the slip. */
const ASKS = 'asks before it goes on';

// An agent in ACP mode (a task in the background) asks before a tool step,
// over whatever page is open, as a permission slip from it (its face, name
// and desk): one key per answer it offers; Back cancels the question. It
// shows when the oldest waiting prompt is a permission, except while Home
// shows that agent's run: its card there asks instead. Mounted once, with
// the other prompt dialogs.
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
    <SlipDialog open={prompt !== null} onClose={() => answer(null)} slip="slipPermission">
      {prompt ? <SlipFrom agentId={prompt.agentId} name={prompt.agentName} asks={ASKS} /> : null}
      <PermissionQuestion
        agentName={prompt?.agentName ?? ''}
        title={prompt?.title}
        toolKind={prompt?.toolKind}
        options={options}
        onAnswer={answer}
        heading={false}
      />
      {/* A question with no answers to pick (a runner that sent none) can still be put away. */}
      {options.length === 0 ? <DeckKeys actions={[{ label: 'Not now', role: 'back', onPress: () => answer(null) }]} /> : null}
      {note ? (
        <PlainText fontSize={13} color="muted">
          {note}
        </PlainText>
      ) : null}
    </SlipDialog>
  );
}
