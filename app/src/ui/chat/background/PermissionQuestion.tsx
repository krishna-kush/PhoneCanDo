import { YStack } from 'tamagui';
import type { AcpOption } from '../../../engine/acp/types';
import DeckKeys from '../../common/actions/DeckKeys';
import PlainText from '../../common/PlainText';
import SlipField from '../../common/slip/SlipField';
import { answerRole, mainOption, permissionStep, permissionTitle, toolKindAsk } from './logic/copy';

type Props = {
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
// order: the one that allows it once leads, a no is the way back. Drawn on
// the background run's card and in the app-wide dialog.
export default function PermissionQuestion({ agentName, title, toolKind, options, onAnswer, heading = true }: Props) {
  const main = mainOption(options);
  return (
    <YStack gap="3">
      {heading ? (
        <PlainText fontSize={17} fontWeight="700">
          {permissionTitle(agentName)}
        </PlainText>
      ) : null}
      <SlipField label={toolKindAsk(toolKind)} value={permissionStep(title)} />
      <DeckKeys actions={options.map((o) => ({ label: o.name, role: answerRole(o, main), onPress: () => onAnswer(o.optionId) }))} />
    </YStack>
  );
}
