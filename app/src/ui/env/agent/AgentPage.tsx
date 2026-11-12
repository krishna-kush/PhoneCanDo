import { useState } from 'react';
import { YStack } from 'tamagui';
import { agentKind } from '../../../engine/agents/registry';
import { useAppStore } from '../../../state/app';
import { useInstallRun } from '../../../state/flows/installRuns';
import { renameAgentTo } from '../../../state/flows/renameAgent';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import LinkRow from '../../common/LinkRow';
import PromptDialog from '../../common/PromptDialog';
import Screen from '../../common/Screen';
import AgentMessageRows from '../../messages/AgentMessageRows';
import SectionTitle from '../../common/SectionTitle';
import { envTitle } from '../logic/titles';
import ImageStatus from '../parts/ImageStatus';
import InstallStatus from '../parts/InstallStatus';
import Note from '../parts/Note';
import AgentGone from './AgentGone';
import AgentHero from './AgentHero';
import { hasModelSetting, installDetail, machineDetail, modelDetail } from './agentSettings';
import DangerSection from './DangerSection';
import EngineSection from './EngineSection';
import KeepRunningRow from './KeepRunningRow';
import { useAgentRecords } from './useAgentRecords';
import { useMachineMates } from './useMachineMates';
import { useMissingTools } from './useMissingTools';

// One agent: its face and name (Rename), its engine and the ways in, then
// its settings as rows that open their own pages (Model for a kind that can
// use one, Machine, Install for a kind with one) and Keep running, a
// switch, then Reset and Delete.
// What needs a look now shows here too: a machine still setting up, an
// install running or stopped, tools the machine lacks (on the Machine row).
export default function AgentPage({ agentId, fresh }: { agentId: string; fresh: boolean }) {
  const push = useAppStore((s) => s.push);
  const { agent, image, env, linux } = useAgentRecords(agentId);
  const device = useModelsStore((s) => s.device);
  const models = useModelsStore((s) => s.models);
  const run = useInstallRun(agentId);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const tools = useMissingTools(agent, image, linux);
  const mates = useMachineMates(agent);

  if (!agent) return <AgentGone />;

  const kind = agentKind(agent.kind);
  const place = env ? envTitle(env.source) : linux ? 'Linux machine' : "Android's own shell";
  const machine = machineDetail(image, env, tools?.missingTools.length ?? 0, mates.length + 1);
  const install = installDetail(agent, run);
  const installBusy = kind.hasInstall && (agent.needsInstall || (run != null && run.status !== 'done'));

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
      <AgentHero
        agent={agent}
        place={place}
        fresh={fresh}
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
      {image && image.state !== 'ready' ? <ImageStatus image={image} /> : null}
      {installBusy ? <InstallStatus agent={agent} image={image} /> : null}

      <SectionTitle>Settings</SectionTitle>
      <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
        {hasModelSetting(agent, device.supported) ? (
          <LinkRow label="Model" {...rowProps(modelDetail(agent, models))} onPress={() => push({ name: 'agent-model', agentId })} />
        ) : null}
        <LinkRow label="Machine" {...rowProps(machine)} onPress={() => push({ name: 'agent-machine', agentId })} />
        {kind.hasInstall ? (
          <LinkRow label="Install" {...rowProps(install)} onPress={() => push({ name: 'agent-install', agentId })} />
        ) : null}
        <KeepRunningRow agentId={agentId} />
        <AgentMessageRows agent={agent} />
      </YStack>

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

function rowProps(detail: { text: string; alert: boolean }) {
  return { detail: detail.text, alert: detail.alert };
}
