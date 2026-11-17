// The chat Home was asked to open, per agent (openChat in ui/nav: a
// scheduled run's notice, or its row on the Schedules page), until that
// agent's Home takes it: a web view at once while it shows a page, else
// once it has paired and loaded (useChatAsk.ts); a TUI Home at once, or
// as it mounts (useTuiEngine.ts). Kept in memory, like lastPage.ts:
// a newer ask replaces an older one. No RN imports.
const asked = new Map<string, string>();
const pokes = new Map<string, () => void>();

export function askChat(agentId: string, chatId: string): void {
  asked.set(agentId, chatId);
  pokes.get(agentId)?.();
}

/** The chat waiting for [agentId], cleared as it is read; null when none waits. */
export function takeChat(agentId: string): string | null {
  const chatId = asked.get(agentId) ?? null;
  asked.delete(agentId);
  return chatId;
}

/** Calls [poke] on each ask for [agentId] from now on; the result stops it. */
export function onChatAsk(agentId: string, poke: () => void): () => void {
  pokes.set(agentId, poke);
  return () => {
    if (pokes.get(agentId) === poke) pokes.delete(agentId);
  };
}
