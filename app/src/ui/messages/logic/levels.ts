// How far other agents' messages reach an agent, in words: the four levels
// a kind's manifest makes (KindView.messaging, kit-api MessagingLevel), as
// a short tag for the kind list, a line for the agent page and a row of
// the Messages page's explainer, with which agents sit at each. Pure (zero
// RN imports).
import type { MessagingLevel } from '../../../../../agents/kit/ts/contract/view.ts';

export type { MessagingLevel };

/** The explainer's heading on the Messages page. */
export const LEVELS_HEADING = 'How messages reach each agent';

/** Best first, as the explainer lists them. */
export const LEVELS: readonly MessagingLevel[] = ['wakes', 'delivered', 'inbox', 'none'];

const TAGS: Record<MessagingLevel, string> = {
  wakes: 'Messages · wakes',
  delivered: 'Messages · delivered',
  inbox: 'Messages · inbox only',
  none: 'No messages',
};

const TITLES: Record<MessagingLevel, string> = {
  wakes: 'Delivered, and can be woken',
  delivered: 'Delivered',
  inbox: 'Inbox only',
  none: "Can't read messages",
};

const MEANINGS: Record<MessagingLevel, string> = {
  wakes:
    'Messages reach it during its runs and at its next turn, and a message that asks can start a turn while it is idle.',
  delivered: 'Messages reach it during its runs and at its next turn. It is never woken while idle.',
  inbox: 'Nothing is pushed to it: it reads messages when it checks its inbox, and its tool results say when some are waiting.',
  none: 'It has no phone tools, so it can neither read nor send messages. Messages to it are refused.',
};

/** For the kind list: "Messages · wakes", "No messages". */
export function levelTag(level: MessagingLevel): string {
  return TAGS[level];
}

/** The explainer's heading for a level. */
export function levelTitle(level: MessagingLevel): string {
  return TITLES[level];
}

/** What a level means, in a sentence. */
export function levelMeaning(level: MessagingLevel): string {
  return MEANINGS[level];
}

/** The agent page's line under Messages, for an agent of `kindLabel` at `level`. */
export function agentLevelLine(level: MessagingLevel, kindLabel: string): string {
  switch (level) {
    case 'wakes':
      return `${kindLabel} gets messages during its runs and at its next turn; one that asks can wake it while it is idle.`;
    case 'delivered':
      return `${kindLabel} gets messages during its runs and at its next turn; it can't be woken while idle.`;
    case 'inbox':
      return `${kindLabel} reads messages only when it checks its inbox; nothing is pushed to it.`;
    case 'none':
      return `${kindLabel} can't read or send messages: it isn't connected to the phone tools.`;
  }
}

/**
 * The explainer's rows: each level with its title, meaning and the names
 * of the agents at it (by their kind's level), best first; a level no agent
 * is at still shows, with no names, so the four always read the same.
 */
export function levelRows(
  agents: readonly { name: string; kind: string }[],
  levelOfKind: (kind: string) => MessagingLevel,
): { level: MessagingLevel; title: string; meaning: string; names: string[] }[] {
  return LEVELS.map((level) => ({
    level,
    title: TITLES[level],
    meaning: MEANINGS[level],
    names: agents.filter((a) => levelOfKind(a.kind) === level).map((a) => a.name),
  }));
}
