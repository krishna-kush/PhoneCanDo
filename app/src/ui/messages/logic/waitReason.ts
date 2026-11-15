// Why a message still waits for an agent whose messages we saw not
// working (its kind's `messages` check failed): one line per such
// recipient, under the card's status lines. Pure (zero RN imports):
// scripts/vectors/test_checks.js checks it.
import type { AgentId } from '../../../engine/agents/records';
import type { AgentChecks, CapabilityCheck } from '../../../engine/checks/types';
import type { AgentMessage, MessageDelivery } from '../../../engine/messages/types';

/** One recipient's line, or null when it doesn't wait or its messages aren't seen failing. */
export function waitReason(
  d: Pick<MessageDelivery, 'name' | 'status'>,
  check: Pick<CapabilityCheck, 'state' | 'code'> | null | undefined,
): string | null {
  if (d.status !== 'queued' || check?.state !== 'failed') return null;
  const name = d.name || 'It';
  const http = /^http_(\d{3})$/.exec(check.code ?? '');
  if (http) return `${name}'s server turned the last message away (error ${http[1]}), so this waits.`;
  if (check.code === 'no_hook') return `${name}'s message hooks didn't run in its last turn, so this waits until it checks its inbox.`;
  return `Messages during ${name}'s turns aren't working, so this waits until it checks its inbox.`;
}

/** The agents a message still waits for: the Messages page reads their checks. */
export function waitingAgents(m: Pick<AgentMessage, 'deliveries'>): AgentId[] {
  return m.deliveries.filter((d) => d.status === 'queued').map((d) => d.agentId);
}

/** The card's why lines, keyed by agent, from the checks read so far. */
export function waitReasonLines(
  m: Pick<AgentMessage, 'deliveries'>,
  byAgent: Readonly<Record<AgentId, Pick<AgentChecks, 'capabilities'>>>,
): { key: string; text: string }[] {
  return m.deliveries.flatMap((d) => {
    const check = byAgent[d.agentId]?.capabilities.find((c) => c.id === 'messages');
    const text = waitReason(d, check);
    return text ? [{ key: d.agentId, text }] : [];
  });
}
