import { useEffect, useState } from 'react';
import type { AgentId } from '../../../engine/agents/records';
import type { EnsureResult } from '../../../engine/ensureEngine';
import { errorMessage } from '../../../engine/errors/message';
import { useAgentsStore } from '../../../state/agents';
import { useAppActive } from '../../common/useAppActive';
import { useHomeInFront } from '../../nav/homeInFront';
import type { PtyEnd } from '../../terminal/transport/types';
import { onChatAsk, takeChat } from '../chatAsk';
import { SETTLE_MS, tuiPhase, wantsTerminal, type TuiStart } from './tuiPhase';

// The engine behind a TUI home. Each run (the mount, every Restart) starts
// it or finds it running (startAgent: prepare the image, then ensure), and
// the engine's state, which the runner's events keep fresh, says when the
// terminal can attach. A terminal that ends shows the stopped state until
// Restart or until something else starts the engine again (the app's
// foreground start, the agent page's Start). An engine in ACP mode (a task
// that came while nobody watched) shows its run instead; once that run is
// over and Home is in front, a new run asks for the terminal back.
export function useTuiEngine(agentId: AgentId) {
  const state = useAgentsStore((s) => s.statuses[agentId]?.state);
  const stateError = useAgentsStore((s) => s.statuses[agentId]?.error ?? null);
  const mode = useAgentsStore((s) => s.statuses[agentId]?.mode);
  const busy = useAgentsStore((s) => s.statuses[agentId]?.busy === true);
  const inFront = useHomeInFront();
  const appActive = useAppActive();
  const [run, setRun] = useState(0);
  const [start, setStart] = useState<TuiStart>({ kind: 'pending' });
  const [ended, setEnded] = useState(false);
  const [shown, setShown] = useState(false);
  // Asked for the terminal (any start counts) since the background run last
  // worked: once is enough.
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAsked(true);
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
          if (!cancelled) setStart({ kind: 'failed', error: errorMessage(e) });
        },
      );
    return () => {
      cancelled = true;
    };
  }, [agentId, run]);

  // A chat Home was asked to open (openChat: one its ACP mode ran, kept
  // natively for the terminal's next launch). A terminal already up and
  // idle stops and starts again on it; a stopped engine, one in ACP mode or
  // one at work opens it at its next launch anyway. Asked before this Home
  // mounted, it is taken as it mounts.
  useEffect(() => {
    const reopen = () => {
      if (!takeChat(agentId)) return;
      const agents = useAgentsStore.getState();
      const s = agents.statuses[agentId];
      if (s?.state !== 'ready' || s.mode === 'acp' || s.busy) return;
      void agents.stopAgent(agentId).then(() => setRun((r) => r + 1));
    };
    reopen();
    return onChatAsk(agentId, reopen);
  }, [agentId]);

  // A new start of the engine brings a new program to attach to.
  useEffect(() => {
    if (state === 'starting') {
      setEnded(false);
      setShown(false);
    }
  }, [state]);

  const phase = tuiPhase({ start, ended, shown, state, stateError, mode });
  useEffect(() => {
    if (phase.name === 'attached') setShown(true);
  }, [phase.name]);

  // A background run that works again, or Home that shows something else,
  // may ask once more when it is over. After the start's effect: a start
  // made while the run works does not count.
  const background = phase.name === 'background';
  useEffect(() => {
    if (!background || busy) setAsked(false);
  }, [background, busy, run]);
  const wants = wantsTerminal({ phase, state, busy, start, inFront, appActive, asked });
  useEffect(() => {
    if (!wants) return;
    const timer = setTimeout(() => setRun((r) => r + 1), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [wants]);

  return {
    phase,
    /** One per run: a restarted terminal mounts fresh. */
    run,
    /** An ACP turn is running (the background view's Stop). */
    busy,
    restart: () => setRun((r) => r + 1),
    /** The terminal's output stopped for good; a takeover by another view is not a stop. */
    onEnd: (end: PtyEnd) => {
      if (end !== 'detached') setEnded(true);
    },
  };
}

function startOutcome(res: EnsureResult): TuiStart {
  if (res.status === 'unavailable') return { kind: 'failed', error: res.error ?? 'engine unavailable' };
  if (res.status === 'start-failed:acp_busy') return { kind: 'busy' };
  if (res.status.startsWith('start-failed')) return { kind: 'failed', error: res.error ?? res.status };
  return { kind: 'ok' };
}
