// Picking several agents in the drawer to stop or delete them at once: the
// picked set and what the bar and the delete confirm say. Pure (zero RN
// imports).
import type { EngineState } from '../../../../engine/agents/records';
import { formatBytes } from '../../../env/logic/format.ts';
import { agentCount, nameList } from '../../../memory/logic/memoryCopy.ts';

/** Picked agent ids, in the drawer's order. */
export type Picked = readonly string[];

/** Adds or removes one agent, keeping the drawer's order. */
export function togglePick(picked: Picked, id: string, order: readonly string[]): Picked {
  const next = picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id];
  return order.filter((o) => next.includes(o));
}

/** Drops agents that are gone (deleted meanwhile); the same array when nothing went. */
export function keepPresent(picked: Picked, order: readonly string[]): Picked {
  const kept = picked.filter((p) => order.includes(p));
  return kept.length === picked.length ? picked : kept;
}

/** Every agent picked: the bar's toggle then picks none. */
export function allPicked(picked: Picked, order: readonly string[]): boolean {
  return order.length > 0 && order.every((o) => picked.includes(o));
}

/** An engine Stop can bring down: running, or on its way up. */
export function canStop(state: EngineState | null | undefined): boolean {
  return state === 'ready' || state === 'starting';
}

export function pickedLine(n: number): string {
  return `${n} selected`;
}

/** The delete confirm's title: the name for one, a count for several. */
export function deleteTitle(names: readonly string[]): string {
  return names.length === 1 ? `Delete ${names[0]}?` : `Delete ${agentCount(names.length)}?`;
}

/**
 * The delete confirm's message. `bytes`: the size of the machines that go,
 * together, null while measuring, 0 when unknown. `every`: no agent would
 * be left. `staying`: the picked agents whose machine stays, because an
 * agent not picked shares it.
 */
export function deleteMessage(
  names: readonly string[],
  bytes: number | null,
  every: boolean,
  staying: readonly string[] = [],
): string {
  const size = bytes == null ? ' Measuring their size…' : bytes > 0 ? ` That frees about ${formatBytes(bytes)}.` : '';
  if (staying.length > 0) return `${sharedDeleteLine(names, staying)}${size}`;
  const what =
    names.length === 1
      ? 'This deletes the agent and its machine'
      : `This deletes ${nameList(names)}, each with its machine`;
  const last = !every
    ? ''
    : names.length === 1
      ? " It's your only agent, so we'll set up a fresh one right after."
      : " That's every agent, so we'll set up a fresh one right after.";
  return `${what} with everything in it: projects, chats, keys and installed tools.${size}${last}`;
}

// Some picked agents share their machine with an agent not picked: it stays.
function sharedDeleteLine(names: readonly string[], staying: readonly string[]): string {
  const kept =
    names.length === 1
      ? 'Its machine stays, because other agents still use it, and so do the projects in it.'
      : staying.length === 1
        ? `${staying[0]}'s machine stays, because other agents still use it, and so do the projects in it.`
        : `Any machine ${orList(staying)} shares with an agent you didn't pick stays, and so do the projects in it.`;
  if (staying.length === names.length) return `This deletes ${nameList(names)}. ${kept}`;
  return `This deletes ${nameList(names)}. A machine no other agent uses goes with everything in it: projects, chats, keys and installed tools. ${kept}`;
}

// "Bob, Ann or Cy".
function orList(names: readonly string[]): string {
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** After a delete, what did not go: "Couldn't delete Bob: …" (the first reason for several). */
export function failedLine(failed: readonly { name: string; reason: string }[]): string | null {
  if (failed.length === 0) return null;
  if (failed.length === 1) return `Couldn't delete ${failed[0].name}: ${failed[0].reason}`;
  return `Couldn't delete ${nameList(failed.map((f) => f.name))}. ${failed[0].reason}`;
}
