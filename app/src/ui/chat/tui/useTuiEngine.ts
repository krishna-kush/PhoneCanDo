import { useEffect, useState } from 'react';
import type { AgentId } from '../../../engine/agents/records';
import type { EnsureResult } from '../../../engine/ensureEngine';
import { useAgentsStore } from '../../../state/agents';
import type { PtyEnd } from '../../terminal/transport/types';
import { tuiPhase, type TuiStart } from './tuiPhase';

// The engine behind a TUI home. Each run (the mount, every Restart) starts
// it or finds it running (startAgent: prepare the image, then ensure), and
// the engine's state, which the runner's events keep fresh, says when the
// terminal can attach. A terminal that ends shows the stopped state until
// Restart or until something else starts the engine again (the app's
// foreground start, the agent page's Start).
export function useTuiEngine(agentId: AgentId) {
  const state = useAgentsStore((s) => s.statuses[agentId]?.state);
  const stateError = useAgentsStore((s) => s.statuses[agentId]?.error ?? null);
  const [run, setRun] = useState(0);
  const [start, setStart] = useState<TuiStart>({ kind: 'pending' });
  const [ended, setEnded] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStart({ kind: 'pending' });
    setEnded(false);
    setShown(false);
    useAgentsStore
      .getState()
      .startAgent(agentId)
      .then(
        (res) => {
          if (!cancelled) setStart(startOutcome(res));
        },
        (e: unknown) => {
          if (!cancelled) setStart({ kind: 'failed', error: e instanceof Error ? e.message : String(e) });
        },
      );
    return () => {
      cancelled = true;
    };
  }, [agentId, run]);

  // A new start of the engine brings a new program to attach to.
  useEffect(() => {
    if (state === 'starting') {
      setEnded(false);
      setShown(false);
    }
  }, [state]);

  const phase = tuiPhase({ start, ended, shown, state, stateError });
  useEffect(() => {
    if (phase.name === 'attached') setShown(true);
  }, [phase.name]);

  return {
    phase,
    /** One per run: a restarted terminal mounts fresh. */
    run,
    restart: () => setRun((r) => r + 1),
    /** The terminal's output stopped for good; a takeover by another view is not a stop. */
    onEnd: (end: PtyEnd) => {
      if (end !== 'detached') setEnded(true);
    },
  };
}

function startOutcome(res: EnsureResult): TuiStart {
  if (res.status === 'unavailable') return { kind: 'failed', error: res.error ?? 'engine unavailable' };
  if (res.status.startsWith('start-failed')) return { kind: 'failed', error: res.error ?? res.status };
  return { kind: 'ok' };
}
