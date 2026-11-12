import type { Agent } from '../../../engine/agents/records';
import { importFromPhone } from '../../../state/flows/modelActions';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import SectionTitle from '../../common/SectionTitle';
import { engineIsUp } from '../../env/logic/engineState';
import Note from '../../env/parts/Note';
import { useSlidInList } from '../../nav/slidIn';
import { usersOf } from '../logic/usage';
import ModelCard from '../parts/ModelCard';
import { useAction } from '../useAction';

// The models on the phone, each a card saying whether it is loaded and how
// many agents use it, which opens its page (model/ModelPage.tsx: Stop,
// Context, Used by, Delete), and Import: a GGUF file from the phone's
// storage. `firstScreen` cards draw as the page opens (ModelsPage.tsx).
export default function OnPhone({ firstScreen }: { firstScreen: number }) {
  const models = useModelsStore((s) => s.models);
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);
  const push = useAppStore((s) => s.push);
  const shown = useSlidInList(models, firstScreen);
  const importing = useAction();
  const running = (a: Agent) => engineIsUp(statuses[a.id]?.state);

  return (
    <>
      <SectionTitle>On this phone</SectionTitle>
      {models.length === 0 ? <Note>No models yet: download one below, or import a GGUF file.</Note> : null}
      {shown.map((m) => {
        const users = usersOf(agents, m.id, running);
        return (
          <ModelCard
            key={m.id}
            model={m}
            agents={users.length}
            running={users.filter(running).length}
            onOpen={() => push({ name: 'model', modelId: m.id })}
          />
        );
      })}
      <AppButton variant="secondary" loading={importing.busy} onPress={() => void importing.run(importFromPhone)}>
        Import a model file
      </AppButton>
      {importing.error ? <Note tone="error">{importing.error}</Note> : null}
    </>
  );
}
