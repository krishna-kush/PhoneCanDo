import { memo } from 'react';
import type { Route } from '../../state/app';
import { Pages } from './pages';

// One page of the stack, by its route (state/app/routes.ts). Memoised on the
// route, which a page keeps for life: a transition re-renders a layer's part
// (LayerBody), never the page in it.
function PageView({ route }: { route: Route }) {
  switch (route.name) {
    case 'agent':
      return <Pages.AgentPage agentId={route.agentId} fresh={route.fresh === true} />;
    case 'agent-model':
      return <Pages.AgentModelPage agentId={route.agentId} />;
    case 'agent-machine':
      return <Pages.AgentMachinePage agentId={route.agentId} />;
    case 'agent-install':
      return <Pages.AgentInstallPage agentId={route.agentId} />;
    case 'agent-install-log':
      return <Pages.AgentInstallLogPage agentId={route.agentId} />;
    case 'agent-mascot':
      return <Pages.AgentMascotPage agentId={route.agentId} />;
    case 'agent-checks':
      return <Pages.AgentChecksPage agentId={route.agentId} />;
    case 'new-agent':
      return <Pages.ChooseAgent target={route.target ?? null} picked={route.picked ?? null} />;
    case 'new-agent-place':
      return <Pages.ChoosePlace pick={route.pick} />;
    case 'new-env-os':
      return <Pages.OsPicker pick={route.pick} />;
    case 'new-env-tags':
      return <Pages.TagPicker repo={route.repo} pick={route.pick} />;
    case 'new-env-confirm':
      return <Pages.ConfirmPull repo={route.repo} tag={route.tag} typed={route.typed} pick={route.pick} />;
    case 'new-env-pull':
      return <Pages.PullProgress repo={route.repo} tag={route.tag} envId={route.envId} />;
    case 'systems':
      return <Pages.EnvList />;
    case 'system':
      return <Pages.SystemPage envId={route.envId} />;
    case 'add-system':
      return <Pages.AddSystem />;
    case 'custom-agents':
      return <Pages.CustomAgentList />;
    case 'custom-agent':
      return <Pages.CustomAgentForm kindId={route.kindId} forNewAgent={route.forNewAgent === true} />;
    case 'custom-agent-import':
      return <Pages.ImportAgent />;
    case 'models':
      return <Pages.ModelsPage />;
    case 'model':
      return <Pages.ModelPage modelId={route.modelId} />;
    case 'model-log':
      return <Pages.ModelLogPage modelId={route.modelId} />;
    case 'model-repo':
      return <Pages.RepoPage repo={route.repo} />;
    case 'messages':
      return <Pages.MessagesPage agentId={route.agentId ?? null} />;
    case 'schedules':
      return <Pages.SchedulesPage agentId={route.agentId ?? null} />;
    case 'schedule-rules':
      return <Pages.ScheduleRulesPage />;
    case 'settings':
      return <Pages.SettingsScreen />;
    case 'settings-page':
      return <Pages.SettingsPage page={route.page} />;
    case 'about':
      return <Pages.AboutPage />;
    case 'starter':
      return <Pages.ShiftPage />;
    case 'folder-picker':
      return <Pages.FolderPicker />;
    case 'terminal':
      return <Pages.TerminalPage key={route.session.id} session={route.session} />;
  }
}

export default memo(PageView);
