import { useEffect, useState } from 'react';
import type { AgentId } from '../../../engine/agents/records';
import { runInAgentMachine } from '../../../state/flows/machineCommand';
import { linuxFailureText } from '../logic/errorText';
import { INSIDE_TIMEOUT_SEC, type Inside, insideScript, parseInside } from './logic/inside';

export type InsideRead =
  /** Nothing read yet, or not a ready Linux machine. */
  | { state: 'none' }
  | { state: 'read'; inside: Inside; /** When it was read. */ at: number }
  | { state: 'failed'; message: string };

// The Inside box's reading: its script run in a ready Linux machine, as
// one of its agents (no agent, no look), when the page opens, and again each time `again` changes (Check
// again). The last reading stays up while the next one runs; one that a
// newer reading replaced is dropped.
export function useInside(
  /** The agent it runs as; null on a machine no agent uses. */
  agentId: AgentId | null,
  /** The image's id while it is a ready Linux machine, else null. */
  readyImageId: string | null,
  again: number,
): { read: InsideRead; reading: boolean } {
  const [read, setRead] = useState<InsideRead>({ state: 'none' });
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!agentId || !readyImageId) {
      setRead({ state: 'none' });
      setReading(false);
      return;
    }
    let live = true;
    setReading(true);
    runInAgentMachine(agentId, ['sh', '-c', insideScript()], INSIDE_TIMEOUT_SEC)
      .then(
        (res) => {
          if (live) setRead({ state: 'read', inside: parseInside(res.stdout), at: Date.now() });
        },
        (e: unknown) => {
          if (live) setRead({ state: 'failed', message: linuxFailureText(e) });
        },
      )
      .finally(() => {
        if (live) setReading(false);
      });
    return () => {
      live = false;
    };
  }, [agentId, readyImageId, again]);

  return { read, reading };
}
