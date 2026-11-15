// Capability checks as the screens read them (engine/checks/): each kind's
// messaging level now (the kind list, the Messages page, an agent's
// Messages line, a shared machine's agents), read at start and on each
// change, and, while a page watches an agent (its page, What it can do,
// a message waiting for it), that agent's checks. The first read
// subscribes to the runner's changes and to the app coming back to the
// foreground; a burst of changes reads once. Re-read records that did not
// change stay the same objects, so a row that shows one skips the render.
import { AppState } from 'react-native';
import { create } from 'zustand';
import type { AgentId } from '../engine/agents/records';
import { agentKind } from '../engine/agents/registry';
import { agentChecks, checkCancel, checkNow, kindLevels, onChecks } from '../engine/checks/native';
import type { AgentChecks, KindLevels, MessagingLevel } from '../engine/checks/types';
import { keepUnchangedMap, sameValue } from './logic/keepUnchanged';

/** A burst of runner changes within this reads once. */
const SETTLE_MS = 150;

interface ChecksState {
  /** Each kind's level now; a kind left out (a build without checks) reads its declared level. */
  levels: KindLevels;
  /** The watched agents' checks; an agent not read yet, or a build without checks, is left out. */
  byAgent: Record<AgentId, AgentChecks>;
  /** Reads the kind levels; subscribes once. */
  hydrateChecks: () => void;
  /** A page that shows these agents' checks: reads them now and on each change, until the returned stop. */
  watchChecks: (agentIds: readonly AgentId[]) => () => void;
  /** Re-reads the levels and every watched agent (a page back in front). */
  refreshChecks: () => void;
  /** Starts Check now for the agent, every capability when full, else only those not checked yet: null when it started, else why not. */
  checkNow: (agentId: AgentId, full: boolean) => string | null;
  /** Stops the agent's running check; false when none runs. */
  checkCancel: (agentId: AgentId) => boolean;
}

let subscribed = false;
const watched = new Map<AgentId, number>();
/** Agents changed since the last read; null: all of them. */
let dirty: Set<AgentId> | null = new Set();
let pending: ReturnType<typeof setTimeout> | null = null;

export const useChecksStore = create<ChecksState>((set, get) => {
  const readLevels = () => {
    const levels = keepUnchangedMap(get().levels, kindLevels());
    if (levels !== get().levels) set({ levels });
  };

  const readAgents = (ids: Iterable<AgentId>) => {
    const prev = get().byAgent;
    let next: Record<AgentId, AgentChecks> | null = null;
    for (const id of ids) {
      if (!watched.has(id)) continue;
      const checks = agentChecks(id);
      const was = prev[id];
      if (checks ? was !== undefined && sameValue(was, checks) : was === undefined) continue;
      next ??= { ...prev };
      if (checks) next[id] = checks;
      else delete next[id];
    }
    if (next) set({ byAgent: next });
  };

  const read = () => {
    const ids = dirty ?? watched.keys();
    dirty = new Set();
    readLevels();
    readAgents([...ids]);
  };

  const soon = (agentId: AgentId | null) => {
    if (agentId == null) dirty = null;
    else dirty?.add(agentId);
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      read();
    }, SETTLE_MS);
  };

  const subscribe = () => {
    if (subscribed) return;
    subscribed = true;
    onChecks((change) => soon(change.agentId));
    AppState.addEventListener('change', (state) => {
      if (state === 'active') soon(null);
    });
  };

  return {
    levels: {},
    byAgent: {},

    hydrateChecks: () => {
      subscribe();
      readLevels();
    },

    watchChecks: (agentIds) => {
      subscribe();
      const ids = [...new Set(agentIds)];
      for (const id of ids) watched.set(id, (watched.get(id) ?? 0) + 1);
      readAgents(ids);
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        for (const id of ids) {
          const n = (watched.get(id) ?? 1) - 1;
          if (n > 0) watched.set(id, n);
          else watched.delete(id);
        }
      };
    },

    refreshChecks: () => {
      subscribe();
      readLevels();
      readAgents([...watched.keys()]);
    },

    checkNow: (agentId, full) => {
      const refused = checkNow(agentId, full);
      readAgents([agentId]);
      return refused;
    },

    checkCancel: (agentId) => {
      const stopped = checkCancel(agentId);
      readAgents([agentId]);
      return stopped;
    },
  };
});

/** The kind's messaging level now; its declared level until (or unless) the runner says. */
export function useKindLevel(kindId: string): MessagingLevel {
  const now = useChecksStore((s) => s.levels[kindId]);
  return now ?? agentKind(kindId).messaging;
}

/** The kind's level now outside a render, as useKindLevel reads it. */
export function kindLevelNow(levels: KindLevels, kindId: string): MessagingLevel {
  return levels[kindId] ?? agentKind(kindId).messaging;
}

/** The agent's checks as last read; null until a watch reads them (or on a build without checks). */
export function useAgentChecks(agentId: AgentId): AgentChecks | null {
  return useChecksStore((s) => s.byAgent[agentId] ?? null);
}
