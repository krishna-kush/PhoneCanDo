import type { LocalModel } from '../../../engine/models/types';
import AppCard from '../../common/AppCard';
import PlainText from '../../common/PlainText';
import { modelLine, verdictText } from '../logic/modelText';
import { usageLine } from '../logic/usage';

type Props = {
  model: LocalModel;
  /** How many agents are set to it, and how many of them run now. */
  agents: number;
  running: number;
  onOpen: () => void;
};

// One model on the phone in the Models page's list: its name, size and
// context, whether it is loaded and how many agents use it, and its RAM
// verdict when it can't run well here. A tap opens its page
// (model/ModelPage.tsx), where its actions are.
export default function ModelCard({ model, agents, running, onOpen }: Props) {
  const v = model.ram.verdict;
  const warn = v === 'too_big' || v === 'over_budget' || v === 'unsupported';
  return (
    <AppCard title={model.name} subtitle={modelLine(model)} onPress={onOpen}>
      <PlainText
        fontFamily="mono"
        fontSize={11}
        letterSpacing={1.2}
        color={model.serving ? 'secondaryInk' : 'dim'}
        textTransform="uppercase"
        numberOfLines={1}
      >
        {usageLine(model.serving, agents, running)}
      </PlainText>
      {warn ? (
        <PlainText fontSize={12} color="primary" numberOfLines={2}>
          {verdictText(model.ram)}
        </PlainText>
      ) : null}
    </AppCard>
  );
}
