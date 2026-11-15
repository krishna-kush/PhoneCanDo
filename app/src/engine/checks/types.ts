// What we have seen each capability of an agent do, as the app reads it
// (native.ts, parse.ts). The runner records a check per kind and
// capability from exact signals (a call to the phone tools with the
// agent's token, a message hook that ran, the run's exit); a kind file
// that changes reads Not checked yet again. Check now runs one short test
// task to see them all at once.
import type { MessagingLevel } from '../../../../agents/kit/ts/contract/view.ts';
import type { AgentId } from '../agents/records';

export type { MessagingLevel };

/** The runner's capability ids (kit-api `Capability`), in the order the app lists them. */
export const CAPABILITIES = ['tools', 'messages', 'wake', 'task', 'state', 'acp', 'acpTools', 'acpMessages', 'chat'] as const;

export type CapabilityId = (typeof CAPABILITIES)[number];

/** Checked: seen working; failed: seen not working; unchecked: set up, not seen yet; off: not set up for this agent. */
export type CheckState = 'checked' | 'failed' | 'unchecked' | 'off';

/** One capability of one agent. */
export type CapabilityCheck = {
  id: CapabilityId;
  state: CheckState;
  /** The agent's version when it was last seen (empty for a kind without one); null when never seen. */
  cliVersion: string | null;
  /** When it was last seen (ms); null when never seen. */
  at: number | null;
  /** Why it isn't working, as a code (`no_contact`, `http_500`…) and in the runner's words. */
  code: string | null;
  detail: string | null;
};

/** Stuck: in ACP mode nothing moved for 3 minutes, or it ran for 30, so the runner stopped it. */
export type CheckRunState = 'running' | 'done' | 'stuck' | 'cancelled' | 'failed';

/**
 * What a running check does now: its engine starting, a local model
 * reading the prompt, a question waiting for you, the turn, waiting (in
 * its own app nothing moved for a minute while it works: it may be asking
 * you something there), or the grace after the turn while the runner sees
 * what it did.
 */
export type CheckStep = 'starting' | 'reading' | 'answer' | 'working' | 'waiting' | 'checking';

/** A part runs in ACP mode or in the agent's own app (its terminal). */
export type CheckPartMode = 'acp' | 'terminal';

/**
 * Where one capability is in a check: waiting for its part, being tested
 * now, answered (its check changed, so its state line says how), unknown
 * (its part ended with no answer) or skipped (its part can't test it).
 */
export type CheckRowStatus = 'queued' | 'testing' | 'answered' | 'unknown' | 'skipped';

/** One capability the check tests, in its part (1-based); `why` for unknown and skipped, in the runner's words. */
export type CheckRunRow = { id: CapabilityId; part: number; status: CheckRowStatus; why: string | null };

/**
 * The agent's last Check now: kept until the next one or the agent is
 * deleted. A kind with ACP mode runs it in two parts (ACP mode, then its
 * own app on the same chat) when it can start its app on a task or a chat.
 */
export type CheckRun = {
  state: CheckRunState;
  startedAt: number;
  /** When anything about the run last changed (the stuck and waiting clocks run from here). */
  movedAt: number;
  /** 1-based, of `parts`. */
  part: number;
  parts: number;
  partMode: CheckPartMode;
  /** Only while running. */
  step: CheckStep | null;
  /** Prompt tokens read so far, of `total` when the model says; only with step `reading`. */
  reading: { read: number; total: number | null } | null;
  /** The capabilities it tests, one each; empty from a runner before rows. */
  rows: CheckRunRow[];
  detail: string | null;
};

/** What agentChecks returns for one agent. */
export type AgentChecks = {
  capabilities: CapabilityCheck[];
  /** How far messages reach it now: its kind's level, lowered by what isn't working. */
  levelNow: MessagingLevel;
  run: CheckRun | null;
  /** Its kind can start with a task (a prompt or ACP mode), so Check now can run. */
  checkNow: boolean;
  /** How many parts Check now would run (1 or 2); 0 when it can't. */
  parts: number;
  /** What Check the rest would run (only what isn't checked yet): its parts and the ids it tests; null: nothing left it can test. */
  rest: { parts: number; ids: CapabilityId[] } | null;
  /** Check now runs it on our check model (a stand-in that answers at once), not its own model. */
  checkModel: boolean;
  /** Why Check now can't run for its kind; null when it can. */
  checkNowWhy: string | null;
};

/** Each kind's messaging level now (kindLevels), by kind id. */
export type KindLevels = Record<string, MessagingLevel>;

/** The phonecandoChecks event: a check or a Check now run changed for this agent (null: unknown, re-read all). */
export type ChecksChange = { agentId: AgentId | null };
