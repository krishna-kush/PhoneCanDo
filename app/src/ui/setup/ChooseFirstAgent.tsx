import type { AgentPick } from '../../state/flows/logic/modelStep';
import { useLinuxStore } from '../../state/linux';
import AppButton from '../common/AppButton';
import { setupOfferEnv } from '../env/logic/agentChoice';
import AgentPicker from '../env/new-agent/AgentPicker';
import ModelStep from '../env/new-agent/ModelStep';
import { useModelPick } from '../env/new-agent/useModelPick';
import { useOffers } from '../env/new-agent/useOffers';
import Note from '../env/parts/Note';
import { chooseNote, type SetupContext } from './copy';

// First launch's Choose agent, shown only when there is a choice (of kind,
// or of model: the Model step): the default kind and the agent's own setup
// start picked, Continue sets up the pick.
export default function ChooseFirstAgent({ ctx, onChoose }: { ctx: SetupContext; onChoose: (pick: AgentPick) => void }) {
  const envs = useLinuxStore((s) => s.envs);
  const { offers, selected, select } = useOffers(setupOfferEnv(ctx.path, envs));
  const model = useModelPick(selected);
  return (
    <>
      <Note>{chooseNote(ctx)}</Note>
      <AgentPicker offers={offers} selected={selected} onSelect={select} />
      <ModelStep pick={model} />
      <AppButton
        disabled={selected == null}
        onPress={() => selected && onChoose({ kindId: selected, modelId: model.modelId })}
      >
        Continue
      </AppButton>
    </>
  );
}
