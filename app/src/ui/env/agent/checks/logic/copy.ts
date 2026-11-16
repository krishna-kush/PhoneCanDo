// What the What it can do page and its row on the agent page say: each
// capability's name and state line and the row's summary (Check now's
// words are run.ts). Plain and short. Pure (zero RN imports):
// scripts/vectors/test_checks.js checks it.
import type { AgentChecks, CapabilityCheck, CapabilityId, CheckState } from '../../../../../engine/checks/types';
import { messageTime } from '../../../../messages/logic/messagesCopy.ts';

/** A palette role (theme/tokens.json) for a line's ink. */
export type Tone = 'fg' | 'muted' | 'dim' | 'faint' | 'primary' | 'secondaryInk';

export const CHECKS_TITLE = 'What it can do';

export const CHECKS_INTRO =
  "What this agent is set up to do, and whether we've seen it work. We see it as the agent runs; a thing not checked yet is still used as set up.";

/** The page on a build that doesn't check (a notice from a newer runner can still open it). */
export const NO_CHECKS = "This version of the app doesn't check what agents can do.";

const LABELS: Record<CapabilityId, string> = {
  tools: 'Phone tools',
  messages: 'Messages during its turns',
  wake: 'Woken while idle',
  task: 'Starts with a task',
  state: 'Its own sign-in and chats',
  acp: 'ACP mode',
  acpTools: 'Phone tools in ACP mode',
  acpMessages: 'Messages during ACP turns',
  chat: 'Opens the ACP chat after',
};

/** "Phone tools", "Woken while idle". */
export function capabilityLabel(id: CapabilityId): string {
  return LABELS[id];
}

const TONES: Record<CheckState, Tone> = {
  checked: 'secondaryInk',
  failed: 'primary',
  unchecked: 'dim',
  off: 'faint',
};

export function stateTone(state: CheckState): Tone {
  return TONES[state];
}

/**
 * A capability's state in a line: "Checked with 1.0.51 · 12 min ago",
 * "Not checked yet: …", "Not working: <the runner's words>", "Off: …".
 */
export function stateLine(check: Pick<CapabilityCheck, 'state' | 'cliVersion' | 'at' | 'detail'>, now: number): string {
  switch (check.state) {
    case 'checked': {
      const head = check.cliVersion ? `Checked with ${check.cliVersion}` : 'Checked';
      const when = check.at != null ? messageTime(check.at, now) : '';
      return when ? `${head} · ${when}` : head;
    }
    case 'unchecked':
      return 'Not checked yet: used as set up, checked the first time it runs.';
    case 'failed':
      return `Not working: ${check.detail ?? 'we saw it fail the last time it ran.'}`;
    case 'off':
      return 'Off: not set up for this agent.';
  }
}

/**
 * Woken while idle for an agent that wakes only in ACP mode (its own wake
 * off, ACP mode set up), by ACP mode's state.
 */
export function wakeByAcpLine(acp: CheckState): string {
  return acp === 'failed'
    ? "Not working: it wakes only in ACP mode, which isn't working."
    : 'In ACP mode: a message that asks wakes it with an ACP turn.';
}

/**
 * The agent page's row detail: "4 checked · 1 not working", "2 checked · 3
 * not checked", "checking now" while Check now runs. A failure always
 * shows; with three kinds of state, the not checked count gives way.
 */
export function checksSummary(checks: Pick<AgentChecks, 'capabilities' | 'run'>): { text: string; alert: boolean } {
  let checked = 0;
  let failed = 0;
  let unchecked = 0;
  for (const c of checks.capabilities) {
    if (c.state === 'checked') checked++;
    else if (c.state === 'failed') failed++;
    else if (c.state === 'unchecked') unchecked++;
  }
  const alert = failed > 0;
  if (checks.run?.state === 'running') return { text: 'checking now', alert };
  const parts = [
    checked > 0 ? `${checked} checked` : null,
    failed > 0 ? `${failed} not working` : null,
    unchecked > 0 && !(checked > 0 && failed > 0) ? `${unchecked} not checked` : null,
  ].filter((p): p is string => p != null);
  return { text: parts.length > 0 ? parts.join(' · ') : 'nothing set up', alert };
}
