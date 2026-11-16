import { XStack, YStack } from 'tamagui';
import type { LocalModel } from '../../../engine/models/types';
import PlainText from '../../common/PlainText';
import LiveLight from '../../common/rows/LiveLight';
import OpenRow from '../../common/rows/OpenRow';
import { usePageActive } from '../../nav/pageActive';
import { modelLine, verdictText } from '../logic/modelText';
import { usageLine } from '../logic/usage';

type Props = {
  model: LocalModel;
  /** How many agents are set to it, and how many of them run now. */
  agents: number;
  running: number;
  onOpen: () => void;
};

// One model on the phone, a row of the Models page's On this phone box:
// its name, size and context, whether it is loaded (a blinking red light
// when it is) and how many agents use it, and its RAM verdict when it
// can't run well here. A tap opens its page (model/ModelPage.tsx, an
// OpenRow), where its actions are.
export default function ModelRow({ model, agents, running, onOpen }: Props) {
  const active = usePageActive();
  const v = model.ram.verdict;
  const warn = v === 'too_big' || v === 'over_budget' || v === 'unsupported';
  const usage = usageLine(model.serving, agents, running);
  return (
    <OpenRow label={`${model.name}, ${modelLine(model)}, ${usage}`} onPress={onOpen}>
      <YStack gap={3}>
        <PlainText fontSize={16} fontWeight="600" numberOfLines={2}>
          {model.name}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={12} color="dim" numberOfLines={1}>
          {modelLine(model)}
        </PlainText>
        <XStack alignItems="center" gap="2">
          {model.serving ? <LiveLight still={!active} /> : null}
          <PlainText
            fontFamily="mono"
            fontSize={11}
            letterSpacing={1.2}
            color={model.serving ? 'secondaryInk' : 'dim'}
            textTransform="uppercase"
            numberOfLines={1}
            flexShrink={1}
          >
            {usage}
          </PlainText>
        </XStack>
        {warn ? (
          <PlainText fontSize={12} color="primary" numberOfLines={2}>
            {verdictText(model.ram)}
          </PlainText>
        ) : null}
      </YStack>
    </OpenRow>
  );
}
