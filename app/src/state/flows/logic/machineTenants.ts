// Agents that share a machine (image), like apps on one PC: they share its
// system, tools, projects and background processes, and each keeps its own
// sign-in and chats. A machine is made with its first agent and deleted with
// its last. Which agents are on a machine, which of them an install stops
// first, which machines go with a set of agents, and whether a new agent of
// a kind can join a machine. Pure.
import type { OfferBlock } from '../../../engine/agents/offers.ts';
import type { Agent } from '../../../engine/agents/records';
import type { ImageId, ImageState } from '../../../engine/linux/types';

type AgentLike = Pick<Agent, 'id' | 'imageId' | 'createdAt'>;

/** Every agent on the image, oldest first. */
export function agentsOn<A extends AgentLike>(agents: readonly A[], imageId: ImageId): A[] {
  return agents.filter((a) => a.imageId === imageId).sort((a, b) => a.createdAt - b.createdAt);
}

/** The other agents on this agent's machine, oldest first. */
export function coTenants<A extends AgentLike>(agents: readonly A[], agent: Pick<Agent, 'id' | 'imageId'>): A[] {
  return agentsOn(agents, agent.imageId).filter((a) => a.id !== agent.id);
}

/**
 * The co-tenants an install or update of `agent` stops first: those of its
 * kind (they run the same files) and those whose kind needs one of the same
 * runtimes (the install may put a new one in their place).
 */
export function stoppedByInstall<A extends AgentLike & Pick<Agent, 'kind'>>(
  agents: readonly A[],
  agent: Pick<Agent, 'id' | 'imageId' | 'kind'>,
  runtimesOf: (kind: string) => readonly string[],
): A[] {
  const runtimes = runtimesOf(agent.kind);
  return coTenants(agents, agent).filter(
    (a) => a.kind === agent.kind || runtimesOf(a.kind).some((r) => runtimes.includes(r)),
  );
}

/** The machines that go with these agents: those no other agent uses, each once. */
export function freedImages(agents: readonly Pick<Agent, 'id' | 'imageId'>[], goingIds: readonly string[]): ImageId[] {
  const going = new Set(goingIds);
  const kept = new Set(agents.filter((a) => !going.has(a.id)).map((a) => a.imageId));
  const theirs = new Set(agents.filter((a) => going.has(a.id)).map((a) => a.imageId));
  return [...theirs].filter((id) => !kept.has(id));
}

/** Why a new agent can't join a machine. */
export type ShareBlock =
  /** The machine is being set up, reset or deleted, or its setup failed. */
  | { kind: 'not_ready'; state: ImageState }
  /** The kind can't run on the machine's system (offers.ts, as for a new machine from it). */
  | { kind: 'offer'; block: OfferBlock }
  /** An agent of the kind is on it, and the kind can't give each agent its own sign-in and chats. */
  | { kind: 'same_kind' };

/**
 * Whether an agent of `kind` can join the machine; null when it can.
 * `offerBlock` is the kind's offer on the machine's system, judged as ready
 * (the machine's own state is judged here).
 */
export function shareBlockOf(
  machine: { state: ImageState; agents: readonly Pick<Agent, 'kind'>[] },
  kind: { id: string; stateFolder: boolean },
  offerBlock: OfferBlock | null,
): ShareBlock | null {
  if (machine.state !== 'ready') return { kind: 'not_ready', state: machine.state };
  if (offerBlock) return { kind: 'offer', block: offerBlock };
  if (!kind.stateFolder && machine.agents.some((a) => a.kind === kind.id)) return { kind: 'same_kind' };
  return null;
}
