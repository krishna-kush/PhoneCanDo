import { useState } from 'react';
import { useAgentsStore } from '../../../state/agents';
import { renameAgentTo } from '../../../state/flows/renameAgent';
import { useLinuxStore } from '../../../state/linux';
import AppButton from '../../common/AppButton';
import PromptDialog from '../../common/PromptDialog';
import Screen from '../../common/Screen';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import PageHeader from '../parts/PageHeader';
import DangerSection from './DangerSection';
import EngineSection from './EngineSection';
import MachineSection from './MachineSection';

// One agent and its machine: name (Rename), engine, the ways in, the machine
// itself, then Reset and Delete.
export default function AgentPage({ agentId }: { agentId: string }) {
  const back = useEnvNav((s) => s.back);
  const agent = useAgentsStore((s) => s.agents.find((a) => a.id === agentId));
  const image = useLinuxStore((s) => (agent ? s.images.find((i) => i.id === agent.imageId) : undefined));
  const env = useLinuxStore((s) => (image ? s.envs.find((e) => e.id === image.envId) : undefined));
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  if (!agent) {
    return (
      <Screen>
        <PageHeader title="Agent" onBack={back} />
        <Note>This agent is gone.</Note>
      </Screen>
    );
  }

  // Without its env record, a detected OS still says it is Linux.
  const linux = env ? env.source.kind !== 'android' : image?.os != null;

  const rename = () => {
    try {
      if (renameAgentTo(agent.id, name)) setRenaming(false);
    } catch (e) {
      setRenaming(false);
      setRenameError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <PageHeader
        title={agent.name}
        onBack={back}
        trailing={
          <AppButton
            variant="ghost"
            onPress={() => {
              setName(agent.name);
              setRenameError(null);
              setRenaming(true);
            }}
          >
            Rename
          </AppButton>
        }
      />
      {renameError ? <Note tone="error">{`Couldn't rename it: ${renameError}`}</Note> : null}
      <EngineSection agent={agent} image={image} linux={linux} />
      <MachineSection agent={agent} image={image} env={env} linux={linux} />
      <DangerSection agent={agent} image={image} env={env} linux={linux} />
      <PromptDialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Rename agent"
        value={name}
        onChangeText={setName}
        confirmLabel="Rename"
        onConfirm={rename}
      />
    </Screen>
  );
}
