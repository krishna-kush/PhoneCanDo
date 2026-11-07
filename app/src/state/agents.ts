// The agents and the one the app follows. The header switcher sets the
// active agent; chat, the terminal UI and the launch/foreground start use
// it. Records and engines stay native (engine/engines.ts): this mirrors
// them for screens and keeps engine states fresh from the runner's events.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { create } from 'zustand';
import type { Agent, AgentId, EngineStatus } from '../engine/agents/records';
import { agentKind } from '../engine/agents/registry';
import { engineConn } from '../engine/connection';
import {
  agentById,
  engineStatus,
  engineStatuses,
  listAgents,
  onEngineState,
  stopEngine,
} from '../engine/engines';
import { ensureEngine, type EnsureResult } from '../engine/ensureEngine';
import { prepareImageForStart } from '../engine/linux/native';
import { isAutomationEnabled, isRunnerAvailable } from '../engine/runner';

const ACTIVE_AGENT_KEY = 'phonecando.activeAgent.v1';

interface AgentsState {
  agents: Agent[];
  statuses: Record<AgentId, EngineStatus>;
  /** The agent the screens follow: the one picked, else the first; null without agents. */
  activeAgentId: AgentId | null;
  /** True once hydrateAgents has read the list. */
  hydrated: boolean;

  /** Reads agents and engine states and subscribes to engine changes (once). */
  hydrateAgents: () => Promise<void>;
  /** Re-reads agents and engine states, e.g. after creating or deleting an agent. */
  refreshAgents: () => void;
  /** Null forgets the pick, so the first agent is active. */
  setActiveAgent: (id: AgentId | null) => Promise<void>;
  /** Prepares the agent's image, then starts its engine or finds it running. */
  startAgent: (id: AgentId) => Promise<EnsureResult>;
  stopAgent: (id: AgentId) => Promise<void>;
  /** The app went to the background: stops every running engine that is idle. */
  stopIdleAgents: () => Promise<void>;
}

let subscribed = false;
const starting = new Map<AgentId, Promise<EnsureResult>>();

function readNative(): { agents: Agent[]; statuses: Record<AgentId, EngineStatus> } {
  try {
    const statuses: Record<AgentId, EngineStatus> = {};
    for (const s of engineStatuses()) statuses[s.agentId] = s;
    return { agents: listAgents(), statuses };
  } catch {
    return { agents: [], statuses: {} };
  }
}

function pickActive(agents: Agent[], wanted: AgentId | null): AgentId | null {
  if (wanted && agents.some((a) => a.id === wanted)) return wanted;
  return agents[0]?.id ?? null;
}

async function persistActive(id: AgentId | null): Promise<void> {
  try {
    if (id) await AsyncStorage.setItem(ACTIVE_AGENT_KEY, id);
    else await AsyncStorage.removeItem(ACTIVE_AGENT_KEY);
  } catch {
    // Best-effort; the in-memory pick applies for this run.
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const useAgentsStore = create<AgentsState>((set, get) => {
  const syncStatus = (id: AgentId) => {
    try {
      const status = engineStatus(id);
      set((s) => ({ statuses: { ...s.statuses, [id]: status } }));
    } catch {
      // native bridge absent: events keep the rest current
    }
  };

  const start = async (id: AgentId): Promise<EnsureResult> => {
    if (!isRunnerAvailable()) return ensureEngine(id);
    const agent = get().agents.find((a) => a.id === id) ?? agentById(id);
    if (!agent) return { status: 'unavailable', port: null, error: `no agent ${id}` };
    // A ready engine proves its image is prepared; only a start needs it.
    if (engineStatus(id).state !== 'ready') {
      try {
        await prepareImageForStart(agent.imageId);
      } catch (e) {
        return { status: 'start-failed:image_not_ready', port: null, error: errorText(e) };
      }
    }
    const res = await ensureEngine(id);
    syncStatus(id);
    return res;
  };

  return {
    agents: [],
    statuses: {},
    activeAgentId: null,
    hydrated: false,

    hydrateAgents: async () => {
      let stored: string | null = null;
      try {
        stored = await AsyncStorage.getItem(ACTIVE_AGENT_KEY);
      } catch {
        // unreadable: fall back to the first agent
      }
      if (!subscribed) {
        subscribed = true;
        onEngineState((status) => set((s) => ({ statuses: { ...s.statuses, [status.agentId]: status } })));
      }
      const { agents, statuses } = readNative();
      const activeAgentId = pickActive(agents, stored);
      set({ agents, statuses, activeAgentId, hydrated: true });
      if (activeAgentId !== stored) await persistActive(activeAgentId);
    },

    refreshAgents: () => {
      const { agents, statuses } = readNative();
      const prev = get().activeAgentId;
      // A deleted active agent hands over to the first one left.
      const activeAgentId = pickActive(agents, prev);
      set({ agents, statuses, activeAgentId });
      if (activeAgentId !== prev) void persistActive(activeAgentId);
    },

    setActiveAgent: async (id) => {
      if (id != null && !get().agents.some((a) => a.id === id)) get().refreshAgents();
      if (id != null && !get().agents.some((a) => a.id === id)) return;
      set({ activeAgentId: pickActive(get().agents, id) });
      await persistActive(id);
    },

    startAgent: (id) => {
      const running = starting.get(id);
      if (running) return running;
      const attempt = start(id).finally(() => starting.delete(id));
      starting.set(id, attempt);
      return attempt;
    },

    stopAgent: async (id) => {
      try {
        await stopEngine(id);
      } catch {
        // already down
      }
      syncStatus(id);
    },

    // Quiet-when-idle stop: runs ONLY when the app UI goes away. Each running
    // engine whose agent kind says it is idle (opencode: nothing touched in
    // the last minute) stops; an unreachable one stops too.
    stopIdleAgents: async () => {
      // Phone control unlocked means an agent may be driving another app
      // while PhoneCanDo is backgrounded (mobile_home/launch); stopping its
      // engine here strands the turn before the next tool call.
      if (isAutomationEnabled()) return;
      const { agents, statuses } = readNative();
      const running = agents.filter((a) => {
        const state = statuses[a.id]?.state;
        return state === 'ready' || state === 'starting';
      });
      await Promise.all(
        running.map(async (agent) => {
          let idle: boolean;
          try {
            idle = await agentKind(agent.kind).isIdle(engineConn(agent.id));
          } catch {
            idle = true;
          }
          // The check is async: if the user came back meanwhile, the
          // foreground has already re-ensured the active engine, so leave
          // them (a stop now races the service's foreground start:
          // ForegroundServiceDidNotStartInTimeException).
          if (!idle || AppState.currentState === 'active') return;
          await get().stopAgent(agent.id);
        }),
      );
    },
  };
});

/** The active agent's record, outside React. */
export function activeAgent(): Agent | null {
  const { agents, activeAgentId } = useAgentsStore.getState();
  return agents.find((a) => a.id === activeAgentId) ?? null;
}

/** The active agent's record; re-renders when it or the pick changes. */
export function useActiveAgent(): Agent | null {
  return useAgentsStore((s) => s.agents.find((a) => a.id === s.activeAgentId) ?? null);
}
