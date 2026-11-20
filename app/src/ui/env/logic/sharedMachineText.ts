// What the pages say about a machine several agents share: New agent's
// place step and its Share confirm, the agent's Delete confirm, its
// Machine page and Reset confirm there, its Install page, and the agents on
// a machine as a system's page and a machine's page list them. Pure (zero RN imports). Names come oldest agent first.
import { nameList } from '../../memory/logic/memoryCopy.ts';

/** The place step's note over the choices; `canShare` when there are machines to share. */
export function placeNote(label: string, canShare: boolean): string {
  return canShare
    ? `${label} gets its own machine, made from the system you pick, or shares a machine with agents you have. What it installs stays in its machine.`
    : `${label} gets its own machine, made from the system you pick. What it installs stays in that machine.`;
}

/** The Share confirm's title: "Share Bob's machine?", or for several, "Share this machine with Bob and Ann?". */
export function shareTitle(names: readonly string[]): string {
  return names.length === 1 ? `Share ${names[0]}'s machine?` : `Share this machine with ${nameList(names)}?`;
}

/** The Share confirm: what sharing means, `newName` being the name the new agent gets. */
export function shareMessage(newName: string, names: readonly string[]): string {
  const two = names.length === 1;
  const points = two
    ? [
        "If both work on the same project at once, they can undo each other's changes. We tell each agent who else is here and ask it to work on its own branch.",
        'Resetting the machine stops both and resets it for both.',
        'An install or update by one can change tools the other uses.',
      ]
    : [
        "If two of them work on the same project at once, they can undo each other's changes. We tell each agent who else is here and ask it to work on its own branch.",
        'Resetting the machine stops them all and resets it for all of them.',
        'An install or update by one can change tools the others use.',
      ];
  points.push('The machine is deleted only with its last agent.');
  const joins = `If ${newName} joins ${nameList(names)}, they ${two ? '' : 'all '}share everything in it: projects, installed tools and settings. Each keeps its own sign-in and chats.`;
  return [`We recommend its own machine. ${joins}`, points.map((p) => `• ${p}`).join('\n')].join('\n\n');
}

/**
 * Delete confirm for an agent whose machine others still use: the machine
 * stays, and its sign-in and chats go with it (the runner deletes its own
 * state folder, or its kind's default one when it used that).
 */
export function deleteSharedMessage(others: readonly string[]): string {
  const uses = others.length === 1 ? 'uses' : 'use';
  return `Its machine stays, because ${nameList(others)} still ${uses} it, and so do the projects in it. Its sign-in and chats go with it.`;
}

/** Reset confirm: `names` are every agent on the machine, the one asking first. */
export function resetMessage(system: string, names: readonly string[]): string {
  const base = `System files go back to the ${system} base.`;
  if (names.length <= 1) {
    return `${base} Your projects, chats and keys stay. Anything you installed goes; we'll offer to install it again. The agent stops first.`;
  }
  const two = names.length === 2;
  const stop = two ? 'so both stop first' : 'so they all stop first';
  const who = two ? 'either agent' : 'any of them';
  return `${base} ${nameList(names)} share it, ${stop}. Your projects, chats and keys stay. Tools ${who} installed go away; we'll offer to install them again.`;
}

/** The title over the agents on a system's machines, or on one machine: "2 agents on it". */
export function agentsOnItTitle(count: number): string {
  if (count === 0) return 'No agents on it';
  return `${count} ${count === 1 ? 'agent' : 'agents'} on it`;
}

/** Under a shared machine's agents on its page: what they share and what each keeps. */
export const SHARED_MACHINE_NOTE =
  'They share its projects, installed tools and settings. Each keeps its own sign-in and chats, and its instructions name the others here.';

/** Under Update agent: the agent stops first, and so do `others` (same kind or same runtimes); a good update starts them again. */
export function updateStopsLine(others: readonly string[]): string {
  if (others.length === 0) return 'An update stops the agent first and starts it again when done.';
  const they = others.length === 1 ? 'it uses' : 'they use';
  return `An update stops the agent first, and ${nameList(others)} too, since ${they} the same files; they start again when done.`;
}

/** Over the last install log on a machine others use: it may be one of theirs. */
export function sharedLogLine(others: readonly string[]): string {
  return others.length === 1
    ? `${others[0]} shares this machine, so this may be the log of its install.`
    : `${nameList(others)} share this machine, so this may be the log of one of their installs.`;
}

/** The line over a machine's agents, as it heads them in a list: "Shared machine · room 1 · 1.2 GB". */
export function machineLine(agents: number, room: string | null, size: string | null): string {
  const what = agents > 1 ? 'Shared machine' : agents === 0 ? 'Unused machine' : 'Machine';
  return [what, room, size].filter(Boolean).join(' · ');
}
