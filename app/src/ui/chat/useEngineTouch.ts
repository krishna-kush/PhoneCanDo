import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { AgentId } from '../../engine/agents/records';
import { dismissAgentAlert, touchEngine } from '../../engine/engines';
import { useAppStore } from '../../state/app';

const TOUCH_EVERY_MS = 2 * 60 * 1000;

// While the chat is in front (Home tab, no terminal or folder picker over
// it, app in the foreground), marks the agent's engine used: on showing and
// every couple of minutes. At the running-engine cap the service stops the
// least recently used idle engine, and that must never be the one on screen.
// Showing the chat also takes down the agent's alert (finished, failed,
// waiting for your answer) or return notice: the user is looking at it.
export function useEngineTouch(agentId: AgentId | null) {
  const inFront = useAppStore((s) => s.footerTab === 'home' && s.terminal == null && !s.folderPickerOpen);

  useEffect(() => {
    if (!agentId || !inFront) return;
    const touch = () => {
      if (AppState.currentState !== 'active') return;
      try {
        dismissAgentAlert(agentId);
      } catch {
        // no notice up, or the native side is not ready: nothing to take down
      }
      try {
        touchEngine(agentId);
      } catch {
        // engine not running yet: its start marks it used
      }
    };
    touch();
    const timer = setInterval(touch, TOUCH_EVERY_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') touch();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [agentId, inFront]);
}
