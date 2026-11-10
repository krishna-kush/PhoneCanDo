import { useLinuxStore } from '../../../state/linux';
import AppButton from '../../common/AppButton';
import Screen from '../../common/Screen';
import { pickLabel, targetLine, targetOfferEnv } from '../logic/agentChoice';
import type { NewAgentTarget } from '../logic/routes';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import PageHeader from '../parts/PageHeader';
import ProgressBar from '../parts/ProgressBar';
import AgentPicker from './AgentPicker';
import ModelStep from './ModelStep';
import { useModelPick } from './useModelPick';
import { useNewAgent } from './useNewAgent';
import { useOffers } from './useOffers';

// Choose agent: which kind a new agent is, in every creation path (New env
// → Default or Own, New agent here, New agent without Linux), and, for a
// kind that takes a local model while one fits this phone, its model (the
// Model step). Shown only when there is a choice; the default kind starts
// picked, or the custom one just added from here. An Own env's download
// starts from here.
export default function ChooseAgent({ target, picked }: { target: NewAgentTarget; picked: string | null }) {
  const back = useEnvNav((s) => s.back);
  const open = useEnvNav((s) => s.open);
  const envs = useLinuxStore((s) => s.envs);
  const offerEnv = targetOfferEnv(target, envs);
  const { offers, selected, select } = useOffers(offerEnv, picked);
  const model = useModelPick(selected);
  const newAgent = useNewAgent();

  return (
    <Screen>
      <PageHeader title="Choose agent" onBack={back} />
      <Note>{targetLine(target, envs)}</Note>
      <AgentPicker offers={offers} selected={selected} onSelect={select} />
      <ModelStep pick={model} />
      {newAgent.busy && target.kind !== 'own' ? <ProgressBar label="Making a new agent" fraction={null} /> : null}
      {newAgent.error ? <Note tone="error">{newAgent.error}</Note> : null}
      <AppButton
        loading={newAgent.busy}
        disabled={selected == null}
        onPress={() => selected && newAgent.make(target, { kindId: selected, modelId: model.modelId })}
      >
        {pickLabel(target)}
      </AppButton>
      <Note>You pick the agent once: a machine keeps the agent it was made with.</Note>
      {offerEnv.kind === 'linux' ? (
        <AppButton variant="secondary" onPress={() => open({ name: 'custom-agent', kindId: null, target })}>
          Add your own agent
        </AppButton>
      ) : null}
    </Screen>
  );
}
