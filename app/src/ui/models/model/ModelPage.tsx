import type { Agent } from '../../../engine/agents/records';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import { useModelsStore } from '../../../state/models';
import LinkRow from '../../common/LinkRow';
import PageHeader from '../../common/PageHeader';
import RowGroup from '../../common/rows/RowGroup';
import Screen from '../../common/Screen';
import { engineIsUp } from '../../env/logic/engineState';
import Note from '../../env/parts/Note';
import StopModelButton from '../../memory/StopModelButton';
import { reducedLine } from '../logic/context';
import { modelLine, sourceText } from '../logic/modelText';
import { usersOf } from '../logic/usage';
import ModelPanel from '../parts/ModelPanel';
import DeleteModel from './DeleteModel';
import ModelMemory from './ModelMemory';
import UsedBy from './UsedBy';

// One model on the phone, opened from its card on the Models page: what it
// is (size, context, source, dates, a line when we serve it with less
// context than it was trained for, its RAM verdict), Stop while it is
// loaded (its running agents stop first, and it asks first when there are
// any), its Memory setting (its context among its choices), the agents
// set to it (each opens its page), More (its server's log, its Hugging
// Face repository) and Delete (refused while an agent is set to it).
export default function ModelPage({ modelId }: { modelId: string }) {
  const model = useModelsStore((s) => s.models.find((m) => m.id === modelId));
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);
  const push = useAppStore((s) => s.push);
  const back = useAppStore((s) => s.back);

  if (!model) {
    return (
      <Screen>
        <PageHeader kicker="model" title="Model" />
        <Note>This model is gone from the phone.</Note>
      </Screen>
    );
  }

  const running = (a: Agent) => engineIsUp(statuses[a.id]?.state);
  const users = usersOf(agents, model.id, running);
  const source = model.source;

  return (
    <Screen>
      <PageHeader kicker={model.serving ? 'model · loaded' : 'model · on this phone'} title={model.name} />
      <ModelPanel
        lines={[modelLine(model), sourceText(source)]}
        dates={model.dates}
        note={reducedLine(model)}
        ram={model.ram}
      >
        {model.serving ? (
          <StopModelButton modelId={model.id} name={model.name} agentNames={users.filter(running).map((a) => a.name)} />
        ) : null}
        <ModelMemory model={model} />
      </ModelPanel>
      <UsedBy users={users} />
      <RowGroup title="More" barcode="modelMore">
        <LinkRow label="Server log" onPress={() => push({ name: 'model-log', modelId: model.id })} />
        {source.kind === 'huggingface' ? (
          <LinkRow label="Hugging Face" detail={source.repo} onPress={() => push({ name: 'model-repo', repo: source.repo })} />
        ) : null}
      </RowGroup>
      <DeleteModel model={model} onDeleted={back} />
    </Screen>
  );
}
