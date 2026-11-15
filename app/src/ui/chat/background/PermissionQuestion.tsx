import { YStack } from 'tamagui';
import type { AcpOption } from '../../../engine/acp/types';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';
import { mainOption, permissionStep, permissionTitle, toolKindLine } from './logic/copy';

type Props = {
  agentName: string;
  /** The step, as the agent titles it. */
  title: string | null | undefined;
  toolKind: string | null | undefined;
  options: readonly AcpOption[];
  onAnswer: (optionId: string) => void;
};

// An agent in ACP mode asks before a tool step: who asks, the step (as the
// agent titles it, selectable), what kind of step it is, and one button per
// answer it offers, in its order; the one that allows it once leads. Drawn
// on the background run's card and in the app-wide dialog.
export default function PermissionQuestion({ agentName, title, toolKind, options, onAnswer }: Props) {
  const main = mainOption(options);
  const kindLine = toolKindLine(toolKind);
  return (
    <YStack gap="3">
      <PlainText fontSize={17} fontWeight="700">
        {permissionTitle(agentName)}
      </PlainText>
      <PlainText fontFamily="mono" fontSize={13} color="fg" numberOfLines={8} userSelect="text">
        {permissionStep(title)}
      </PlainText>
      {kindLine ? (
        <PlainText fontSize={13} color="muted">
          {kindLine}
        </PlainText>
      ) : null}
      <YStack gap="2">
        {options.map((o) => (
          <AppButton key={o.optionId} variant={o.optionId === main ? 'primary' : 'secondary'} onPress={() => onAnswer(o.optionId)}>
            {o.name}
          </AppButton>
        ))}
      </YStack>
    </YStack>
  );
}
