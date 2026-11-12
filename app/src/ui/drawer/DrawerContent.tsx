import { memo, useEffect, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { messagesAvailable } from '../../engine/messages/native';
import { getBuildChannel, isRunnerAvailable } from '../../engine/runner';
import { installedVersion } from '../../engine/updates';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { useLinuxStore } from '../../state/linux';
import { useMessagesStore } from '../../state/messages';
import { useModelsStore } from '../../state/models';
import AppButton from '../common/AppButton';
import { crewLine } from '../common/face/lines';
import { moodOf } from '../common/face/mood';
import LogoMark from '../common/LogoMark';
import SectionTitle from '../common/SectionTitle';
import { useStartNewAgent } from '../env/new-agent/useStartNewAgent';
import Note from '../env/parts/Note';
import AgentRow from './AgentRow';
import DownloadRow from './DownloadRow';
import LinkRow from '../common/LinkRow';
import { unreadText } from '../messages/logic/messagesCopy';
import { unreadTotal } from '../messages/logic/messageView';
import PlainText from '../common/PlainText';
import SelectBar from './select/SelectBar';
import TextAction from './select/TextAction';
import { useAgentSelection } from './select/useAgentSelection';

// The drawer's padding and the space between its parts. The places' rows
// reach over both (LinkRow `reach`), so a tap beside a row still opens it.
const PAD = 16;
const GAP = 8;
const PLACE_REACH = { x: PAD, y: GAP / 2 };

function channel(): string {
  try {
    return isRunnerAvailable() ? getBuildChannel() : 'full';
  } catch {
    return 'full';
  }
}

// What the drawer holds: every agent (tap to switch, › for its page, a long
// press or Select to pick several, with the selection's bar pinned below),
// Own envs still downloading, New agent, then the app's other places:
// Models, Systems, Custom agents, Messages (once agents can talk to each
// other), Settings, About. Memoised: the drawer's own renders (open, shut)
// pass the same `still` until its slide ends. Mounting it starts the
// unread counts (each row's mark), which the runner keeps current.
function DrawerContent({ still }: { still: boolean }) {
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
  const order = useMemo(() => agents.map((a) => a.id), [agents]);
  const pick = useAgentSelection(order, still);
  const unread = useMessagesStore((s) => unreadTotal(s.unread));
  const messaging = messagesAvailable() && (agents.length > 1 || unread > 0);
  useEffect(() => useMessagesStore.getState().refreshMessages(), []);

  return (
    <YStack flex={1}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: PAD, gap: GAP }}>
        <XStack alignItems="center" gap="2" paddingTop="2">
          <LogoMark size={16} />
          <PlainText fontFamily="mono" fontSize={18} fontWeight="600" letterSpacing={-0.4}>
            PhoneCanDo
          </PlainText>
        </XStack>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
          {crewLine(agents.length, awake)}
        </PlainText>

        <XStack alignItems="flex-end" justifyContent="space-between">
          <SectionTitle>Agents</SectionTitle>
          {agents.length > 1 && !pick.on ? <TextAction label="Select" onPress={() => pick.start()} /> : null}
        </XStack>
        <YStack gap="1">
          {agents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              active={agent.id === activeAgentId}
              still={still}
              picking={pick.on}
              picked={pick.picked.includes(agent.id)}
              onSwitch={() => {
                goHome();
                if (agent.id !== activeAgentId) void setActiveAgent(agent.id);
              }}
              onOpen={() => push({ name: 'agent', agentId: agent.id })}
              onPick={() => (pick.on ? pick.toggle(agent.id) : pick.start(agent.id))}
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

        <YStack height={1} backgroundColor="line" marginVertical="3" />

        {modelsOffered ? (
          <LinkRow
            label="Models"
            detail={modelCount === 1 ? '1 on phone' : `${modelCount} on phone`}
            onPress={() => push({ name: 'models' })}
            reach={PLACE_REACH}
          />
        ) : null}
        <LinkRow
          label="Systems"
          detail={envs.length === 1 ? '1 system' : `${envs.length} systems`}
          onPress={() => push({ name: 'systems' })}
          reach={PLACE_REACH}
        />
        {linuxAvailable ? (
          <LinkRow label="Custom agents" onPress={() => push({ name: 'custom-agents' })} reach={PLACE_REACH} />
        ) : null}
        {messaging ? (
          <LinkRow
            label="Messages"
            detail={unreadText(unread) || undefined}
            onPress={() => push({ name: 'messages' })}
            reach={PLACE_REACH}
          />
        ) : null}
        <LinkRow label="Settings" onPress={() => push({ name: 'settings' })} reach={PLACE_REACH} />
        <LinkRow label="About" onPress={() => push({ name: 'about' })} reach={PLACE_REACH} />

        <Text fontFamily="mono" fontSize={10} letterSpacing={1.2} color="faint" textTransform="uppercase" marginTop="4">
          {`v${version.version} · ${channel()}`}
        </Text>
      </ScrollView>
      {pick.on ? <SelectBar picked={pick.picked} all={pick.all} onToggleAll={pick.toggleAll} onEnd={pick.end} /> : null}
    </YStack>
  );
}

export default memo(DrawerContent);
