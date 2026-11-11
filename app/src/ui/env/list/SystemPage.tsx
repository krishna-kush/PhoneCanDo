import { useMemo } from 'react';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import { useLinuxStore } from '../../../state/linux';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { buildEnvSections } from '../logic/sections';
import { systemFacts } from '../logic/systemFacts';
import { envTitle } from '../logic/titles';
import Note from '../parts/Note';
import EnvSection from './EnvSection';
import SystemFacts from './SystemFacts';

const KICKER = { default: 'system · in the app', registry: 'system · downloaded', android: 'system · no linux' } as const;

// One system (env): what it is (logic/systemFacts.ts), its download, the
// agents on it and Delete (EnvSection). envId null: the machines whose env
// or image we cannot find, so they can still be opened and deleted.
export default function SystemPage({ envId }: { envId: string | null }) {
  const envs = useLinuxStore((s) => s.envs);
  const images = useLinuxStore((s) => s.images);
  const linuxAvailable = useLinuxStore((s) => s.status.available);
  const agents = useAgentsStore((s) => s.agents);
  const push = useAppStore((s) => s.push);
  const back = useAppStore((s) => s.back);
  const section = useMemo(
    () => buildEnvSections(envs, images, agents).find((s) => s.key === (envId ?? 'lost')),
    [envs, images, agents, envId],
  );
  const env = section?.env ?? null;
  const openAgent = (agentId: string) => push({ name: 'agent', agentId });

  if (!section) {
    return (
      <Screen>
        <PageHeader kicker="system" title={envId ? 'System' : "Machines we can't place"} />
        <Note>{envId ? 'This system is gone.' : 'Nothing here any more.'}</Note>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader kicker={env ? KICKER[env.source.kind] : 'system · missing'} title={env ? envTitle(env.source) : "Machines we can't place"} />
      {env ? (
        <SystemFacts facts={systemFacts(env, Date.now())} />
      ) : (
        <Note>Their system or their machine is missing. Open one to delete it.</Note>
      )}
      <EnvSection env={env} rows={section.rows} linuxAvailable={linuxAvailable} onOpenAgent={openAgent} onDeleted={back} />
    </Screen>
  );
}
