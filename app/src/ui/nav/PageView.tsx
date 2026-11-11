import { memo } from 'react';
import type { Route } from '../../state/app';
import AgentInstallPage from '../env/agent/AgentInstallPage';
import AgentMachinePage from '../env/agent/AgentMachinePage';
import AgentModelPage from '../env/agent/AgentModelPage';
import AgentPage from '../env/agent/AgentPage';
import CustomAgentForm from '../env/custom-agents/CustomAgentForm';
import CustomAgentList from '../env/custom-agents/CustomAgentList';
import ImportAgent from '../env/custom-agents/ImportAgent';
import EnvList from '../env/list/EnvList';
import SystemPage from '../env/list/SystemPage';
import ChooseAgent from '../env/new-agent/ChooseAgent';
import ChoosePlace from '../env/new-agent/ChoosePlace';
import AddSystem from '../env/new-env/AddSystem';
import ConfirmPull from '../env/new-env/ConfirmPull';
import OsPicker from '../env/new-env/OsPicker';
import PullProgress from '../env/new-env/PullProgress';
import TagPicker from '../env/new-env/TagPicker';
import ModelsPage from '../models/ModelsPage';
import RepoPage from '../models/RepoPage';
import AboutPage from '../settings/AboutPage';
import SettingsPage from '../settings/SettingsPage';
import SettingsScreen from '../settings/SettingsScreen';
import FolderPicker from '../terminal/FolderPicker';
import TerminalPage from '../terminal/TerminalPage';

// One page of the stack, by its route (state/app/routes.ts). Memoised on the
// route, which a page keeps for life: a transition re-renders a layer's part
// (LayerBody), never the page in it.
function PageView({ route }: { route: Route }) {
  switch (route.name) {
    case 'agent':
      return <AgentPage agentId={route.agentId} fresh={route.fresh === true} />;
    case 'agent-model':
      return <AgentModelPage agentId={route.agentId} />;
    case 'agent-machine':
      return <AgentMachinePage agentId={route.agentId} />;
    case 'agent-install':
      return <AgentInstallPage agentId={route.agentId} />;
    case 'new-agent':
      return <ChooseAgent target={route.target ?? null} picked={route.picked ?? null} />;
    case 'new-agent-place':
      return <ChoosePlace pick={route.pick} />;
    case 'new-env-os':
      return <OsPicker pick={route.pick} />;
    case 'new-env-tags':
      return <TagPicker repo={route.repo} pick={route.pick} />;
    case 'new-env-confirm':
      return <ConfirmPull repo={route.repo} tag={route.tag} typed={route.typed} pick={route.pick} />;
    case 'new-env-pull':
      return <PullProgress repo={route.repo} tag={route.tag} envId={route.envId} />;
    case 'systems':
      return <EnvList />;
    case 'system':
      return <SystemPage envId={route.envId} />;
    case 'add-system':
      return <AddSystem />;
    case 'custom-agents':
      return <CustomAgentList />;
    case 'custom-agent':
      return <CustomAgentForm kindId={route.kindId} forNewAgent={route.forNewAgent === true} />;
    case 'custom-agent-import':
      return <ImportAgent />;
    case 'models':
      return <ModelsPage />;
    case 'model-repo':
      return <RepoPage repo={route.repo} />;
    case 'settings':
      return <SettingsScreen />;
    case 'settings-page':
      return <SettingsPage page={route.page} />;
    case 'about':
      return <AboutPage />;
    case 'folder-picker':
      return <FolderPicker />;
    case 'terminal':
      return <TerminalPage key={route.session.id} session={route.session} />;
  }
}

export default memo(PageView);
