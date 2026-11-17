// Where opening the app should land (a notification's tap, an agent's
// return after phone control or its prompt): the target names Home, the
// agent's page ('env'; with no agent, Systems), what it can do ('checks':
// its page, then its checks), Settings, Models, Settings' Updates or the
// RAM warning ('memory') and, when the reason is one agent, that agent,
// which becomes the active one. An open terminal stays on top whatever the
// target (stack.ts towardHome).
import { Keyboard } from 'react-native';
import type { LaunchTarget } from '../../engine/runner';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { useMemoryStore } from '../../state/memory';

export function applyLaunchTarget(target: LaunchTarget | null): void {
  if (!target) return;
  Keyboard.dismiss();
  const agents = useAgentsStore.getState();
  if (target.agentId && target.agentId !== agents.activeAgentId) void agents.setActiveAgent(target.agentId);
  const app = useAppStore.getState();
  app.showHome();
  switch (target.tab) {
    case 'settings':
      app.push({ name: 'settings' });
      break;
    case 'env':
      app.push(target.agentId ? { name: 'agent', agentId: target.agentId } : { name: 'systems' });
      break;
    case 'checks':
      if (!target.agentId) break;
      app.push({ name: 'agent', agentId: target.agentId });
      app.push({ name: 'agent-checks', agentId: target.agentId });
      break;
    case 'models':
      app.push({ name: 'models' });
      break;
    case 'updates':
      app.push({ name: 'settings' });
      app.push({ name: 'settings-page', page: 'updates' });
      break;
    case 'memory':
      useMemoryStore.getState().openSheet();
      break;
    case 'home':
      break;
  }
}
