import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { chatTitleOf } from '../../engine/agents/chatTitle';
import type { AgentId } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { agentById, setOpenChat } from '../../engine/engines';

// The TUI's counterpart of useOpenChat (ui/chat): an agent TUI in front
// tells the runner which chat it shows, so a run that ends there is seen.
// The TUI never says which session it is on, only the title it
// gives the terminal, so the chat goes by title (the runner matches it to
// that agent's chats). `agentId` is the agent whose TUI is in front: its
// TUI client in a terminal, or a TUI engine on Home; null for a
// Linux shell or a TUI off screen. A title naming no chat or the app in
// the background reports none.
export function useOpenTuiChat(agentId: AgentId | null, terminalTitle: string) {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  const agent = agentId ? agentById(agentId) : undefined;
  const title = agent && active ? chatTitleOf(agentKind(agent.kind).chatTitle, terminalTitle) : null;
  const shownId = agent?.id ?? null;
  useEffect(() => {
    if (!shownId || !title) return;
    report(shownId, title);
    return () => report(null, null);
  }, [shownId, title]);
}

function report(agentId: string | null, title: string | null) {
  try {
    setOpenChat(agentId, null, title);
  } catch {
    // native side not ready: no engine runs, so no chat is listed either
  }
}
