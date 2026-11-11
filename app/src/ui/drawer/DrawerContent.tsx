import { memo } from 'react';
import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { getBuildChannel, isRunnerAvailable } from '../../engine/runner';
import { installedVersion } from '../../engine/updates';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { useLinuxStore } from '../../state/linux';
import { useModelsStore } from '../../state/models';
import AppButton from '../common/AppButton';
import { crewLine } from '../common/face/lines';
import { moodOf } from '../common/face/mood';
import { useTheme } from '../common/globals';
import LogoMark from '../common/LogoMark';
import SectionTitle from '../common/SectionTitle';
import { useStartNewAgent } from '../env/new-agent/useStartNewAgent';
import Note from '../env/parts/Note';
import AgentRow from './AgentRow';
import DownloadRow from './DownloadRow';
import LinkRow from '../common/LinkRow';

function channel(): string {
  try {
    return isRunnerAvailable() ? getBuildChannel() : 'full';
  } catch {
    return 'full';
  }
}

// What the drawer holds: every agent (tap to switch, › for its page), Own
// envs still downloading, New agent, then the app's other places: Models,
// Systems, Custom agents, Settings, About. Memoised: the drawer's own
// renders (open, shut) pass the same `still` until its slide ends.
function DrawerContent({ still }: { still: boolean }) {
  const t = useTheme();
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);
  const activeAgentId = useAgentsStore((s) => s.activeAgentId);
  const setActiveAgent = useAgentsStore((s) => s.setActiveAgent);
  const push = useAppStore((s) => s.push);
  const goHome = useAppStore((s) => s.goHome);
  const linuxAvailable = useLinuxStore((s) => s.status.available);
  const envs = useLinuxStore((s) => s.envs);
  const downloading = envs.filter((e) => e.state === 'downloading');
  const modelsOffered = useModelsStore((s) => s.device.supported);
  const modelCount = useModelsStore((s) => s.models.length);
  const newAgent = useStartNewAgent();
  const awake = agents.filter((a) => moodOf(statuses[a.id]?.state) === 'awake').length;
  const version = installedVersion();

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
      <XStack alignItems="center" gap="$2" paddingTop="$2">
        <LogoMark size={16} />
        <Text fontFamily="$mono" fontSize={18} fontWeight="600" letterSpacing={-0.4}>
          PhoneCanDo
        </Text>
      </XStack>
      <Text fontFamily="$mono" fontSize={11} letterSpacing={1.4} color={t.dim} textTransform="uppercase">
        {crewLine(agents.length, awake)}
      </Text>

      <SectionTitle>Agents</SectionTitle>
      <YStack gap="$1">
        {agents.map((agent) => (
          <AgentRow
            key={agent.id}
            agent={agent}
            active={agent.id === activeAgentId}
            still={still}
            onSwitch={() => {
              goHome();
              if (agent.id !== activeAgentId) void setActiveAgent(agent.id);
            }}
            onOpen={() => push({ name: 'agent', agentId: agent.id })}
          />
        ))}
        {downloading.map((env) => (
          <DownloadRow key={env.id} env={env} onOpen={() => push({ name: 'system', envId: env.id })} />
        ))}
      </YStack>
      <AppButton loading={newAgent.busy} onPress={newAgent.start}>
        New agent
      </AppButton>
      {newAgent.error ? <Note tone="error">{newAgent.error}</Note> : null}

      <YStack height={1} backgroundColor={t.line} marginVertical="$3" />

      {modelsOffered ? (
        <LinkRow
          label="Models"
          detail={modelCount === 1 ? '1 on phone' : `${modelCount} on phone`}
          onPress={() => push({ name: 'models' })}
        />
      ) : null}
      <LinkRow label="Systems" detail={envs.length === 1 ? '1 system' : `${envs.length} systems`} onPress={() => push({ name: 'systems' })} />
      {linuxAvailable ? <LinkRow label="Custom agents" onPress={() => push({ name: 'custom-agents' })} /> : null}
      <LinkRow label="Settings" onPress={() => push({ name: 'settings' })} />
      <LinkRow label="About" onPress={() => push({ name: 'about' })} />

      <Text fontFamily="$mono" fontSize={10} letterSpacing={1.2} color={t.faint} textTransform="uppercase" marginTop="$4">
        {`v${version.version} · ${channel()}`}
      </Text>
    </ScrollView>
  );
}

export default memo(DrawerContent);
