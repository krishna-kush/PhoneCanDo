import { useMemo, useState } from 'react';
import { getBuildChannel } from '../../../engine/runner';
import { useAgentsStore } from '../../../state/agents';
import { createAndroidAgent } from '../../../state/flows/createAgentFromEnv';
import { useLinuxStore } from '../../../state/linux';
import AppButton from '../../common/AppButton';
import Screen from '../../common/Screen';
import SectionTitle from '../../common/SectionTitle';
import { linuxFailureText } from '../logic/errorText';
import { buildEnvSections } from '../logic/sections';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import EnvSection from './EnvSection';

// The Env tab's home: every env with the agents whose machines come from it.
// New env only where Linux runs (never on play); elsewhere New agent makes
// one with Android's own shell.
export default function EnvList() {
  const envs = useLinuxStore((s) => s.envs);
  const images = useLinuxStore((s) => s.images);
  const linuxAvailable = useLinuxStore((s) => s.status.available);
  const agents = useAgentsStore((s) => s.agents);
  const open = useEnvNav((s) => s.open);
  const sections = useMemo(() => buildEnvSections(envs, images, agents), [envs, images, agents]);
  const play = getBuildChannel() === 'play';
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAgent = (agentId: string) => open({ name: 'agent', agentId });

  const newAndroidAgent = () => {
    if (adding) return;
    setAdding(true);
    setError(null);
    createAndroidAgent()
      .then((agent) => openAgent(agent.id))
      .catch((e: unknown) => setError(linuxFailureText(e)))
      .finally(() => setAdding(false));
  };

  return (
    <Screen>
      <SectionTitle>Envs and agents</SectionTitle>
      <Note>
        {play
          ? 'Each agent has its own space for its projects and chats.'
          : 'An env is a base system. Each agent gets its own machine made from one, and what it installs stays in that machine.'}
      </Note>
      {sections.map((s) => (
        <EnvSection
          key={s.key}
          env={s.env}
          rows={s.rows}
          linuxAvailable={linuxAvailable}
          onOpenAgent={openAgent}
        />
      ))}
      {sections.length === 0 ? <Note>Nothing here yet.</Note> : null}
      {linuxAvailable ? (
        <AppButton onPress={() => open({ name: 'new-env' })}>New env</AppButton>
      ) : (
        <>
          {!play ? <Note>Linux isn't available in this build, so agents use Android's own shell.</Note> : null}
          <AppButton loading={adding} onPress={newAndroidAgent}>
            New agent
          </AppButton>
          {error ? <Note tone="error">{error}</Note> : null}
        </>
      )}
    </Screen>
  );
}
