// Which agents a model on the phone serves: the line on its card on the
// Models page and the order of Used by on its own page. Pure (zero RN
// imports).

/** The agents set to `modelId`, the running ones first (each group keeps the list's order). */
export function usersOf<A extends { model: string | null }>(
  agents: readonly A[],
  modelId: string,
  running: (agent: A) => boolean,
): A[] {
  const on = agents.filter((a) => a.model === modelId);
  return [...on.filter(running), ...on.filter((a) => !running(a))];
}

/** Its card's line: "loaded · 2 agents · 1 running", "not loaded · 1 agent", "not loaded · no agents". */
export function usageLine(serving: boolean, agents: number, running: number): string {
  const count = agents === 0 ? 'no agents' : agents === 1 ? '1 agent' : `${agents} agents`;
  return [serving ? 'loaded' : 'not loaded', count, running > 0 ? `${running} running` : '']
    .filter((part) => part.length > 0)
    .join(' · ');
}

/** Used by, with no agent set to the model. */
export const NO_USERS_NOTE = 'No agent uses it yet. An agent picks it on its own page, under Model.';
