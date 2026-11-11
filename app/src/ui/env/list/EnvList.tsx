import { useEffect, useMemo } from 'react';
import { getBuildChannel } from '../../../engine/runner';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import { useLinuxStore } from '../../../state/linux';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { buildEnvSections } from '../logic/sections';
import { useAddSystem } from '../new-env/useAddSystem';
import Note from '../parts/Note';
import SystemCard from './SystemCard';

// Systems, from the drawer: every env (system) as one card with its OS,
// size and how many agents run on it (a download shows its bar); a tap
// opens the system's page with its agents. Add system where Linux runs.
// Showing it re-reads everything: sizes and states move while it is away.
export default function EnvList() {
  const envs = useLinuxStore((s) => s.envs);
  const images = useLinuxStore((s) => s.images);
  const linuxAvailable = useLinuxStore((s) => s.status.available);
  const agents = useAgentsStore((s) => s.agents);
  const push = useAppStore((s) => s.push);
  const addSystem = useAddSystem();
  const sections = useMemo(() => buildEnvSections(envs, images, agents), [envs, images, agents]);
  const play = getBuildChannel() === 'play';

  useEffect(() => {
    useLinuxStore.getState().refreshLinux();
    useAgentsStore.getState().refreshAgents();
    useModelsStore.getState().refreshModels();
  }, []);

  return (
    <Screen>
      <PageHeader kicker="envs · machines" title="Systems" />
      <Note>
        {play
          ? 'Each agent has its own space for its projects and chats.'
          : 'A system is a base OS. Each agent gets its own machine made from one, and what it installs stays in that machine.'}
      </Note>
      {!linuxAvailable && !play ? <Note>Linux isn't available in this build, so agents use Android's own shell.</Note> : null}
      {sections.map((s) => (
        <SystemCard key={s.key} env={s.env} rows={s.rows} onOpen={() => push({ name: 'system', envId: s.env?.id ?? null })} />
      ))}
      {sections.length === 0 ? <Note>Nothing here yet.</Note> : null}
      {linuxAvailable ? <AppButton onPress={addSystem}>Add system</AppButton> : null}
      {linuxAvailable ? <Note>A new system comes with its first agent: you pick it before the download starts.</Note> : null}
    </Screen>
  );
}
