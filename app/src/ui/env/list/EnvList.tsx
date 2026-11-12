import { useEffect, useMemo } from 'react';
import { getBuildChannel } from '../../../engine/runner';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import { useLinuxStore } from '../../../state/linux';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { useSlidIn, useSlidInList } from '../../nav/slidIn';
import { buildEnvSections } from '../logic/sections';
import { useAddSystem } from '../new-env/useAddSystem';
import Note from '../parts/Note';
import SystemCard from './SystemCard';

// Cards drawn as the page opens; the rest come once it has slid in.
const FIRST_SCREEN_CARDS = 6;

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
  const shown = useSlidInList(sections, FIRST_SCREEN_CARDS);
  const play = getBuildChannel() === 'play';
  const slidIn = useSlidIn();

  // Once the page is in, not on the tap: the re-read re-renders the drawer
  // and Home too, and the page's first draw waits for all of it, so on the
  // tap the page only showed up after its slide had ended.
  useEffect(() => {
    if (!slidIn) return;
    useLinuxStore.getState().refreshLinux();
    useAgentsStore.getState().refreshAgents();
    useModelsStore.getState().refreshModels();
  }, [slidIn]);

  return (
    <Screen>
      <PageHeader kicker="envs · machines" title="Systems" />
      <Note>
        {play
          ? 'Each agent works in a space for its projects, its own or one it shares, and keeps its own chats.'
          : 'A system is a base OS. Each agent runs in a machine made from one, its own or one it shares, and what it installs stays in that machine.'}
      </Note>
      {!linuxAvailable && !play ? <Note>Linux isn't available in this build, so agents use Android's own shell.</Note> : null}
      {shown.map((s) => (
        <SystemCard key={s.key} env={s.env} rows={s.rows} onOpen={() => push({ name: 'system', envId: s.env?.id ?? null })} />
      ))}
      {sections.length === 0 ? <Note>Nothing here yet.</Note> : null}
      {linuxAvailable ? <AppButton onPress={addSystem}>Add system</AppButton> : null}
      {linuxAvailable ? <Note>A new system comes with its first agent: you pick it before the download starts.</Note> : null}
    </Screen>
  );
}
