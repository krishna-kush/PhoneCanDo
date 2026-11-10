import { useMemo } from 'react';
import { getBuildChannel } from '../../../engine/runner';
import { useAgentsStore } from '../../../state/agents';
import { useLinuxStore } from '../../../state/linux';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import Screen from '../../common/Screen';
import SectionTitle from '../../common/SectionTitle';
import { buildEnvSections } from '../logic/sections';
import { useNewAgent } from '../new-agent/useNewAgent';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import EnvSection from './EnvSection';

// The Env tab's home: every env with the agents whose machines come from it.
// New env and Custom agents only where Linux runs (never on play);
// elsewhere New agent makes one with Android's own shell (after Choose
// agent when there is a choice). Models on every channel, where the phone
// can run local models at all.
export default function EnvList() {
  const envs = useLinuxStore((s) => s.envs);
  const images = useLinuxStore((s) => s.images);
  const linuxAvailable = useLinuxStore((s) => s.status.available);
  const agents = useAgentsStore((s) => s.agents);
  const open = useEnvNav((s) => s.open);
  const modelsOffered = useModelsStore((s) => s.device.supported);
  const sections = useMemo(() => buildEnvSections(envs, images, agents), [envs, images, agents]);
  const play = getBuildChannel() === 'play';
  const newAgent = useNewAgent();

  const openAgent = (agentId: string) => open({ name: 'agent', agentId });

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
        <>
          <AppButton onPress={() => open({ name: 'new-env' })}>New env</AppButton>
          <AppButton variant="secondary" onPress={() => open({ name: 'custom-agents' })}>
            Custom agents
          </AppButton>
        </>
      ) : (
        <>
          {!play ? <Note>Linux isn't available in this build, so agents use Android's own shell.</Note> : null}
          <AppButton loading={newAgent.busy} onPress={() => newAgent.start({ kind: 'android' })}>
            New agent
          </AppButton>
          {newAgent.error ? <Note tone="error">{newAgent.error}</Note> : null}
        </>
      )}
      {modelsOffered ? (
        <AppButton variant="secondary" onPress={() => open({ name: 'models' })}>
          Models
        </AppButton>
      ) : null}
    </Screen>
  );
}
