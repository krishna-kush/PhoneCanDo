// Opens one agent's chat (a scheduled run's notice, or its row on the
// Schedules page): the agent becomes the active one and Home shows. A web
// UI Home then goes to that chat (chatAsk.ts: its web view takes it at once,
// or once it has paired). A TUI Home of a kind that opens a chat by id
// (engine.acp.chat) goes to a chat its ACP mode ran: the runner keeps it
// for the terminal's next launch, and a terminal already up and idle
// starts again there (useTuiEngine). Others just show: the TUI, or while
// the engine runs in ACP mode the background view with the last turn. No chat,
// or a web UI whose chats have no URL, and Home just shows. An open
// terminal stays on top (stack.ts towardHome).
import type { AgentId } from '../../engine/agents/records';
import { keepAcpChat } from '../../engine/acp/native';
import { agentKind } from '../../engine/agents/registry';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { askChat } from '../chat/chatAsk';

export function openChat(agentId: AgentId, chatId: string | null): void {
  const agents = useAgentsStore.getState();
  const agent = agents.agents.find((a) => a.id === agentId);
  if (agent && chatId && !agent.needsInstall) {
    const kind = agentKind(agent.kind);
    if (kind.home === 'web' && kind.web?.adapter.sessionUrl) askChat(agentId, chatId);
    // A chat its ACP mode ran: kept as the one its terminal opens next, and
    // a terminal already up starts again there (useTuiEngine).
    else if (kind.home === 'tui' && kind.acp && keepAcpChat(agentId, chatId)) askChat(agentId, chatId);
  }
  if (agentId !== agents.activeAgentId) void agents.setActiveAgent(agentId);
  useAppStore.getState().showHome();
}
