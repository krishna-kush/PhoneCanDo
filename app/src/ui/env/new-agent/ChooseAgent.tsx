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
import { useNewAgent } from './useNewAgent';
import { useOffers } from './useOffers';

// Choose agent: which kind a new agent is, in every creation path (New env
// → Default or Own, New agent here, New agent without Linux). Shown only
// when there is a choice; the default kind starts picked. An Own env's
// download starts from here.
export default function ChooseAgent({ target }: { target: NewAgentTarget }) {
  const back = useEnvNav((s) => s.back);
  const envs = useLinuxStore((s) => s.envs);
  const { offers, selected, select } = useOffers(targetOfferEnv(target, envs));
  const newAgent = useNewAgent();

  return (
    <Screen>
      <PageHeader title="Choose agent" onBack={back} />
      <Note>{targetLine(target, envs)}</Note>
      <AgentPicker offers={offers} selected={selected} onSelect={select} />
      {newAgent.busy && target.kind !== 'own' ? <ProgressBar label="Making a new agent" fraction={null} /> : null}
      {newAgent.error ? <Note tone="error">{newAgent.error}</Note> : null}
      <AppButton
        loading={newAgent.busy}
        disabled={selected == null}
        onPress={() => selected && newAgent.make(target, selected)}
      >
        {pickLabel(target)}
      </AppButton>
      <Note>You pick the agent once: a machine keeps the agent it was made with.</Note>
    </Screen>
  );
}
