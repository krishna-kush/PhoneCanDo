import { useLinuxStore } from '../../state/linux';
import AppButton from '../common/AppButton';
import { setupOfferEnv } from '../env/logic/agentChoice';
import AgentPicker from '../env/new-agent/AgentPicker';
import { useOffers } from '../env/new-agent/useOffers';
import Note from '../env/parts/Note';
import { chooseNote, type SetupContext } from './copy';

// First launch's Choose agent, shown only when there is a choice: the
// default kind starts picked, Continue sets up the picked one.
export default function ChooseFirstAgent({ ctx, onChoose }: { ctx: SetupContext; onChoose: (kindId: string) => void }) {
  const envs = useLinuxStore((s) => s.envs);
  const { offers, selected, select } = useOffers(setupOfferEnv(ctx.path, envs));
  return (
    <>
      <Note>{chooseNote(ctx)}</Note>
      <AgentPicker offers={offers} selected={selected} onSelect={select} />
      <AppButton disabled={selected == null} onPress={() => selected && onChoose(selected)}>
        Continue
      </AppButton>
    </>
  );
}
