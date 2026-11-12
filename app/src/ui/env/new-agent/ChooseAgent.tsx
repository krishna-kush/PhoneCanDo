import { useAppStore, type NewAgentTarget } from '../../../state/app';
import { useLinuxStore } from '../../../state/linux';
import AppButton from '../../common/AppButton';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { anyPlaceOfferEnv, pickLabel, targetLine, targetOfferEnv } from '../logic/agentChoice';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';
import AgentPicker from './AgentPicker';
import ModelStep from './ModelStep';
import { useModelPick } from './useModelPick';
import { useNewAgent } from './useNewAgent';
import { useOffers } from './useOffers';

// New agent, step 1: which kind, and, for a kind that takes a local model
// while one fits this phone, its model (the Model step). The default kind
// starts picked, or `picked` (a custom one just added from here). Without
// a place yet (the drawer's New agent), Next goes on to pick where it runs
// (ChoosePlace), judged then; with one (New agent here, Android only) it is
// judged against that place and this step makes the agent.
export default function ChooseAgent({ target, picked }: { target: NewAgentTarget | null; picked: string | null }) {
  const push = useAppStore((s) => s.push);
  const envs = useLinuxStore((s) => s.envs);
  const linuxAvailable = useLinuxStore((s) => s.status.available);
  const offerEnv = target ? targetOfferEnv(target, envs) : anyPlaceOfferEnv(linuxAvailable);
  const { offers, selected, select } = useOffers(offerEnv, picked);
  const model = useModelPick(selected);
  const newAgent = useNewAgent();

  const next = () => {
    if (!selected) return;
    const pick = { kindId: selected, modelId: model.modelId };
    if (target) newAgent.make(target, pick);
    else push({ name: 'new-agent-place', pick });
  };

  return (
    <Screen>
      <PageHeader kicker="new agent · who" title="Choose agent" />
      <Note>{target ? targetLine(target, envs) : 'Pick the agent first; where it runs comes next.'}</Note>
      <AgentPicker offers={offers} selected={selected} onSelect={select} />
      <ModelStep pick={model} />
      {newAgent.busy && target && target.kind !== 'own' ? <ProgressBar label="Making a new agent" fraction={null} /> : null}
      {newAgent.error ? <Note tone="error">{newAgent.error}</Note> : null}
      <AppButton loading={newAgent.busy} disabled={selected == null} onPress={next}>
        {target ? pickLabel(target) : 'Next'}
      </AppButton>
      <Note>You pick the agent once: to try another, make another agent.</Note>
      {offerEnv.kind === 'linux' ? (
        <AppButton variant="secondary" onPress={() => push({ name: 'custom-agent', kindId: null, forNewAgent: true })}>
          Add your own agent
        </AppButton>
      ) : null}
    </Screen>
  );
}
