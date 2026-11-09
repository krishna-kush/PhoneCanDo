import { Text, YStack } from 'tamagui';
import type { Agent } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { useInstallRun } from '../../state/flows/installRuns';
import { useLinuxStore } from '../../state/linux';
import { useTheme } from '../common/globals';
import InstallStatus from '../env/parts/InstallStatus';

// Home of an agent that is not installed in its machine yet (a kind with an
// install; its engine refuses to start until then): the install run, which
// starts by itself once the agent is made, with Retry or Install. Once it
// records a version, HomeScreen shows the agent's own UI instead.
export default function InstallHome({ agent }: { agent: Agent }) {
  const t = useTheme();
  const image = useLinuxStore((s) => s.images.find((i) => i.id === agent.imageId));
  const running = useInstallRun(agent.id)?.status === 'running';
  const label = agentKind(agent.kind).label;
  return (
    <YStack flex={1} backgroundColor={t.bg} padding="$4" gap="$3" justifyContent="center">
      <Text color={t.fg} fontFamily="$mono">
        {running ? `Installing ${label} in its machine…` : `${label} isn't installed in its machine yet`}
      </Text>
      <InstallStatus agent={agent} image={image} />
    </YStack>
  );
}
