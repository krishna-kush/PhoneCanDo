import { Text, YStack } from 'tamagui';
import { agentKind } from '../../engine/agents/registry';
import { useActiveAgent } from '../../state/agents';
import { useTheme } from '../common/globals';
import AgentWebView from './AgentWebView';
import InstallHome from './InstallHome';
import AgentTuiHome from './tui/AgentTuiHome';
import { useEngineTouch } from './useEngineTouch';

// Home: the active agent's own UI, as its kind's manifest says
// (KindView `home`): its web UI, or the TUI its engine runs. The view is
// keyed by agent: a switch mounts a fresh one. A web view pairs with that
// agent's engine where it listens now (an engine can come back on another
// port), then reopens the page the agent was last on; a TUI view attaches
// to the engine's terminal and the replay restores its screen. An agent not
// installed in its machine yet (a kind with an install) shows that install.
export default function HomeScreen() {
  const t = useTheme();
  const agent = useActiveAgent();
  useEngineTouch(agent?.id ?? null);

  if (!agent) {
    return (
      <YStack flex={1} backgroundColor={t.bg} padding="4" justifyContent="center">
        <Text color={t.muted} fontFamily="mono">
          No agent yet. Tap the name up top to add one.
        </Text>
      </YStack>
    );
  }
  if (agent.needsInstall) return <InstallHome key={agent.id} agent={agent} />;
  if (agentKind(agent.kind).home === 'tui') return <AgentTuiHome key={agent.id} agent={agent} />;
  return <AgentWebView key={agent.id} agent={agent} />;
}
