import { YStack } from 'tamagui';
import { canAllowAll, setAllowsAll } from '../../../engine/acp/native';
import type { AcpOption } from '../../../engine/acp/types';
import DeckKeys from '../../common/actions/DeckKeys';
import PlainText from '../../common/PlainText';
import SlipField from '../../common/slip/SlipField';
import { ALLOW_ALL, answerRole, mainOption, permissionStep, permissionTitle, toolKindAsk } from './logic/copy';

type Props = {
  agentId: string;
  agentName: string;
  /** The step, as the agent titles it. */
  title: string | null | undefined;
  toolKind: string | null | undefined;
  options: readonly AcpOption[];
  onAnswer: (optionId: string) => void;
  /** Who asks, as a line over it; the app-wide dialog's slip says it with the agent's face instead. */
  heading?: boolean;
};

// An agent in ACP mode asks before a tool step: who asks, the step (as the
// agent titles it, selectable) in the slip's field labelled with what it
// asks to do ("Run a command"), and one key per answer it offers, in its
// order: the one that allows it once leads, a no is the way back. Then
// Allow everything: it allows this step and switches on the agent's "Allow
// everything", so it asks no more (off again on its agent page). Drawn on
// the background run's card and in the app-wide dialog.
export default function PermissionQuestion({ agentId, agentName, title, toolKind, options, onAnswer, heading = true }: Props) {
  const main = mainOption(options);
  const allowAll =
    main != null && canAllowAll()
      ? {
          label: ALLOW_ALL,
          role: 'more' as const,
          onPress: () => {
            setAllowsAll(agentId, true);
            onAnswer(main);
          },
        }
      : null;
  return (
    <YStack gap="3">
      {heading ? (
        <PlainText fontSize={17} fontWeight="700">
          {permissionTitle(agentName)}
        </PlainText>
      ) : null}
      <SlipField label={toolKindAsk(toolKind)} value={permissionStep(title)} />
      <DeckKeys
        actions={[...options.map((o) => ({ label: o.name, role: answerRole(o, main), onPress: () => onAnswer(o.optionId) })), allowAll]}
      />
    </YStack>
  );
}
