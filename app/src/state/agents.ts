// The agents and the one the app follows. The header switcher sets the
// active agent; chat, the terminal UI and the launch/foreground start use
// it. Records and engines stay native (engine/engines.ts): this mirrors
// them for screens and keeps engine states fresh from the runner's events.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { guestUnset } from '../engine/agents/guestEnv';
import type { Agent, AgentId, EngineStatus } from '../engine/agents/records';
import {
  agentById,
  engineStatus,
  engineStatuses,
  listAgents,
  onEngineState,
  stopEngine,
} from '../engine/engines';
import { ensureEngine, type EnsureResult } from '../engine/ensureEngine';
import { errorMessage } from '../engine/errors/message';
import { prepareImageForStart } from '../engine/linux/native';
import type { ImageId } from '../engine/linux/types';
import { isRunnerAvailable } from '../engine/runner';
import { inOrder, readOrder } from './logic/agentOrder';
import { agentsOn } from './flows/logic/machineTenants';
import { keepUnchangedList, keepUnchangedMap, withUnchangedEntry } from './logic/keepUnchanged';

const ACTIVE_AGENT_KEY = 'phonecando.activeAgent.v1';
const ORDER_KEY = 'phonecando.agentOrder.v1';

interface AgentsState {
  agents: Agent[];
  statuses: Record<AgentId, EngineStatus>;
  /** The agent the screens follow: the one picked, else the first; null without agents. */
  activeAgentId: AgentId | null;
  /** True once hydrateAgents has read the list. */
  hydrated: boolean;
  /** The ids in the order the user dragged them (logic/agentOrder.ts); `agents` follows it. */
  order: readonly AgentId[];

  /** Reads agents and engine states and subscribes to engine changes (once). */
  hydrateAgents: () => Promise<void>;
  /** Re-reads agents and engine states, e.g. after creating or deleting an agent. */
  refreshAgents: () => void;
  /** Null forgets the pick, so the first agent is active. */
  setActiveAgent: (id: AgentId | null) => Promise<void>;
  /** Keeps the agents in this order (the drawer's drag), here and on the next launch. */
  setOrder: (ids: readonly AgentId[]) => void;
  /** Prepares the agent's image, then starts its engine or finds it running. */
  startAgent: (id: AgentId) => Promise<EnsureResult>;
  stopAgent: (id: AgentId) => Promise<void>;
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

/** The stored pick and order, in one read: launch waits on it. */
async function readStored(): Promise<{ active: string | null; order: AgentId[] }> {
  let active: string | null = null;
  let rawOrder: string | null = null;
  try {
    [[, active], [, rawOrder]] = await AsyncStorage.multiGet([ACTIVE_AGENT_KEY, ORDER_KEY]);
  } catch {
    // unreadable: the first agent, in the runner's order
  }
  try {
    return { active, order: readOrder(JSON.parse(rawOrder ?? '[]')) };
  } catch {
    // malformed: the runner's order
    return { active, order: [] };
  }
}

async function persistActive(id: AgentId | null): Promise<void> {
  try {
    if (id) await AsyncStorage.setItem(ACTIVE_AGENT_KEY, id);
    else await AsyncStorage.removeItem(ACTIVE_AGENT_KEY);
  } catch {
    // Best-effort; the in-memory pick applies for this run.
  }
}

export const useAgentsStore = create<AgentsState>((set, get) => {
  const syncStatus = (id: AgentId) => {
    try {
      const status = engineStatus(id);
      set((s) => ({ statuses: withUnchangedEntry(s.statuses, id, status) }));
    } catch {
      // native bridge absent: events keep the rest current
    }
  };

  const start = async (id: AgentId): Promise<EnsureResult> => {
    if (!isRunnerAvailable()) return ensureEngine(id);
    const agent = get().agents.find((a) => a.id === id) ?? agentById(id);
    if (!agent) return { status: 'unavailable', port: null, error: `no agent ${id}` };
    // Its install may be running in the image right now; native refuses too.
    if (agent.needsInstall) {
      return { status: 'start-failed:agent_not_installed', port: null, error: `${agent.name} is not installed yet` };
    }
    // A ready engine proves its image is prepared; only a start needs it.
    if (engineStatus(id).state !== 'ready') {
      try {
        await prepareAgentImage(agent);
      } catch (e) {
        return { status: 'start-failed:image_not_ready', port: null, error: errorMessage(e) };
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
    order: [],

    hydrateAgents: async () => {
      if (!subscribed) {
        subscribed = true;
        onEngineState((status) => set((s) => ({ statuses: withUnchangedEntry(s.statuses, status.agentId, status) })));
      }
      const { active: stored, order } = await readStored();
      const read = readNative();
      const agents = inOrder(read.agents, order);
      const activeAgentId = pickActive(agents, stored);
      set({ agents, statuses: read.statuses, activeAgentId, order, hydrated: true });
      if (activeAgentId !== stored) await persistActive(activeAgentId);
    },

    refreshAgents: () => {
      // Until hydrateAgents has read the stored pick there is none to keep:
      // a re-read now (the cold start's first AppState 'active' comes before
      // it) would hand the pick to the first agent, store it and start its
      // engine. Hydration reads everything anyway.
      if (!get().hydrated) return;
      const read = readNative();
      // Unchanged records stay the same objects, so the header, the drawer's
      // rows and the faces skip the render this re-read would cost them.
      const agents = keepUnchangedList(get().agents, inOrder(read.agents, get().order));
      const statuses = keepUnchangedMap(get().statuses, read.statuses);
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

    setOrder: (ids) => {
      const order = [...ids];
      set({ order, agents: inOrder(get().agents, order) });
      AsyncStorage.setItem(ORDER_KEY, JSON.stringify(order)).catch(() => {
        // Best-effort; the in-memory order applies for this run.
      });
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
  };
});

/**
 * Await before anything runs in the agent's image: its engine, a shell, an
 * install. Always with the guest env list of every agent on the image (the
 * runner's guestUnset gives the machine's whole list), so the image's
 * launch.conf never flips between callers. Rejects as prepareImageForStart
 * does.
 */
export async function prepareAgentImage(agent: Agent): Promise<void> {
  await prepareImageForStart(agent.imageId, guestUnset(agent.id));
}

/** Every agent on the machine, oldest first, as the runner has them now (a flow's fresh read). */
export function agentsOnImage(imageId: ImageId): Agent[] {
  return agentsOn(listAgents(), imageId);
}

/** The active agent's record, outside React. */
export function activeAgent(): Agent | null {
  const { agents, activeAgentId } = useAgentsStore.getState();
  return agents.find((a) => a.id === activeAgentId) ?? null;
}

/** The active agent's record; re-renders when it or the pick changes. */
export function useActiveAgent(): Agent | null {
  return useAgentsStore((s) => s.agents.find((a) => a.id === s.activeAgentId) ?? null);
}
