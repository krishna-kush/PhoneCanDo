import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { AgentId } from '../../engine/agents/records';
import { setOpenChat } from '../../engine/engines';
import { useHomeInFront } from '../nav/homeInFront';

// Tells the runner which chat is on screen, so the service notification
// leaves it out: you are in it. On screen means the web UI shows that chat,
// Home is up with no page over it, and the app is in the foreground.
// Anything else, and unmounting, reports none.
export function useOpenChat(agentId: AgentId, sessionId: string | null) {
  const inFront = useHomeInFront();
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  const open = inFront && active ? sessionId : null;
  useEffect(() => {
    if (!open) return;
    report(agentId, open);
    return () => report(null, null);
  }, [agentId, open]);
}

// The chat last reported on screen, for readers outside the web view (the
// "Having fun?" card); null when none is.
let onScreen: { agentId: AgentId; sessionId: string } | null = null;

export function chatOnScreen(): { agentId: AgentId; sessionId: string } | null {
  return onScreen;
}

function report(agentId: AgentId | null, sessionId: string | null) {
  onScreen = agentId && sessionId ? { agentId, sessionId } : null;
  try {
    setOpenChat(agentId, sessionId);
  } catch {
    // native side not ready: no engine runs, so no chat is listed either
  }
}
