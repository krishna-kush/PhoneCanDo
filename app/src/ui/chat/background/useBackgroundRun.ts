import { useCallback, useEffect, useState } from 'react';
import { acpCancel, acpSnapshot, onAcpEvent, resolvePermission } from '../../../engine/acp/native';
import type { AgentId } from '../../../engine/agents/records';
import { markAnswered } from '../../common/useBridgePrompts';
import { EMPTY_RUN, foldEvent, runOf, type BackgroundRun } from './logic/transcript';

// One agent's background run, as the runner has it: read once on mount,
// then kept fresh from its phonecandoAcp events; read again when a new turn
// starts (the runner keeps one turn). Stop cancels the turn; an answer to
// its question goes to the runner and off the app-wide prompt queue.
export function useBackgroundRun(agentId: AgentId) {
  const [run, setRun] = useState<BackgroundRun>(EMPTY_RUN);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let live = true;
    const read = () => {
      void acpSnapshot(agentId).then((snapshot) => {
        if (live && snapshot) setRun((now) => ({ ...runOf(snapshot), end: snapshot.busy ? null : now.end }));
      });
    };
    // Subscribed before the read: nothing between the two is lost.
    const sub = onAcpEvent((e) => {
      if (e.agentId !== agentId) return;
      setRun((now) => foldEvent(now, e));
      if (e.type === 'busy' && e.busy) read();
      if (e.type === 'turnEnd' || (e.type === 'busy' && !e.busy)) setStopping(false);
    });
    read();
    return () => {
      live = false;
      sub.remove();
    };
  }, [agentId]);

  const stop = useCallback(() => {
    if (acpCancel(agentId)) setStopping(true);
  }, [agentId]);

  /** False when the question is gone (answered elsewhere, or the turn moved on). */
  const answer = useCallback((requestId: string, optionId: string | null): boolean => {
    const ok = resolvePermission(requestId, optionId);
    markAnswered([requestId]);
    setRun((now) => (now.permission?.requestId === requestId ? { ...now, permission: null } : now));
    return ok;
  }, []);

  return { run, stopping, stop, answer };
}
