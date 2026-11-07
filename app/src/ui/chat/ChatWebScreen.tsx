import { Text, YStack } from 'tamagui';
import { useActiveAgent } from '../../state/agents';
import { useTheme } from '../common/globals';
import AgentWebView from './AgentWebView';
import { useEngineTouch } from './useEngineTouch';

// Home tab: the active agent's web UI. The view is keyed by agent: a switch
// mounts a fresh one that pairs with that agent's engine where it listens
// now (an engine can come back on another port), then reopens the page the
// agent was last on. The old view's home URL and back stack go with it.
export default function ChatWebScreen() {
  const t = useTheme();
  const agent = useActiveAgent();
  useEngineTouch(agent?.id ?? null);

  if (!agent) {
    return (
      <YStack flex={1} backgroundColor={t.bg} padding="$4" justifyContent="center">
        <Text color={t.muted} fontFamily="$mono">
          No agent yet. Add one on the Env tab.
        </Text>
      </YStack>
    );
  }
  return <AgentWebView key={agent.id} agent={agent} />;
}
