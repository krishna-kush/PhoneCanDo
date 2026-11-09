import { useEffect } from 'react';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { useLinuxStore } from '../../state/linux';
import AgentPage from './agent/AgentPage';
import EnvList from './list/EnvList';
import ChooseKind from './new-env/ChooseKind';
import ChooseAgent from './new-agent/ChooseAgent';
import ConfirmPull from './new-env/ConfirmPull';
import OsPicker from './new-env/OsPicker';
import PullProgress from './new-env/PullProgress';
import TagPicker from './new-env/TagPicker';
import { useEnvNav } from './nav';
import { useEnvBack } from './useEnvBack';

// The Env tab: envs and their agents, one agent's page, and New env. Pages
// switch in place (nav.ts); Android Back walks up them first.
export default function EnvScreen() {
  const route = useEnvNav((s) => s.route);
  const onTab = useAppStore((s) => s.footerTab === 'env');
  const linuxAvailable = useLinuxStore((s) => s.status.available);
  useEnvBack(route.name !== 'list');

  useEffect(() => {
    useLinuxStore.getState().hydrateLinux();
  }, []);

  // Coming to the tab re-reads everything: sizes and states move while away.
  useEffect(() => {
    if (!onTab) return;
    useLinuxStore.getState().refreshLinux();
    useAgentsStore.getState().refreshAgents();
  }, [onTab]);

  switch (route.name) {
    case 'agent':
      return <AgentPage key={route.agentId} agentId={route.agentId} />;
    case 'new-env':
      return linuxAvailable ? <ChooseKind /> : <EnvList />;
    case 'new-env-os':
      return <OsPicker />;
    case 'new-env-tags':
      return <TagPicker key={route.repo} repo={route.repo} />;
    case 'new-env-confirm':
      return (
        <ConfirmPull key={`${route.repo}:${route.tag.name}`} repo={route.repo} tag={route.tag} typed={route.typed} />
      );
    case 'new-env-pull':
      return <PullProgress repo={route.repo} tag={route.tag} envId={route.envId} />;
    case 'new-agent':
      return <ChooseAgent target={route.target} />;
    case 'list':
      return <EnvList />;
  }
}
