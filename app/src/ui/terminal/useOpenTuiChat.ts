import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { agentKind } from '../../engine/agents/registry';
import { agentById, setOpenChat } from '../../engine/engines';
import type { TerminalSession } from '../../state/app';

// The TUI's counterpart of useOpenChat (ui/chat): an agent TUI in front
// tells the runner which chat it shows, so the service notification leaves
// it out. The TUI never says which session it is on, only the title it
// gives the terminal, so the chat goes by title (the runner matches it to
// that agent's chats). A Linux shell, a title naming no chat or the app in
// the background reports none.
export function useOpenTuiChat(session: TerminalSession, terminalTitle: string) {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  const agent = session.kind === 'tui' ? agentById(session.agentId) : undefined;
  const title = agent && active ? agentKind(agent.kind).tuiChatTitle(terminalTitle) : null;
  const agentId = agent?.id ?? null;
  useEffect(() => {
    if (!agentId || !title) return;
    report(agentId, title);
    return () => report(null, null);
  }, [agentId, title]);
}

function report(agentId: string | null, title: string | null) {
  try {
    setOpenChat(agentId, null, title);
  } catch {
    // native side not ready: no engine runs, so no chat is listed either
  }
}
