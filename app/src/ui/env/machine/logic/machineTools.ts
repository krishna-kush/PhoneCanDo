// A machine's tools as one list, for its inspection tag: the commands its
// agents' kinds need first (in their order), then the common tools the
// look inside asks for (inside.ts). Each one is here (with its version
// when the look inside read one), missing (a needed one the tools check
// didn't find), absent (a common one no agent needs, not found) or not
// known yet. Pure (zero RN imports): scripts/vectors/test_machine_page.js
// checks it.
import { INSIDE_TOOLS, type Inside } from './inside.ts';

export type ToolState = 'here' | 'missing' | 'absent' | 'unknown';

export type MachineTool = {
  id: string;
  /** "Git"; a needed command we have no name for is its own name. */
  name: string;
  /** "2.39.5"; null when not read. */
  version: string | null;
  state: ToolState;
  /** One of its agents' kinds needs it. */
  needed: boolean;
};

export function machineTools(
  needed: readonly string[],
  /** The tools check's missing commands; null while not known. */
  missing: readonly string[] | null,
  /** What the look inside found, by id; null before it read anything. */
  found: Inside['tools'] | null,
): MachineTool[] {
  const ids = [...new Set([...needed, ...INSIDE_TOOLS.map((t) => t.id)])];
  return ids.map((id) => {
    const isNeeded = needed.includes(id);
    const seen = found != null && id in found;
    return {
      id,
      name: INSIDE_TOOLS.find((t) => t.id === id)?.label ?? id,
      version: seen ? found[id] : null,
      state: stateOf(id, isNeeded, seen, missing, found != null),
      needed: isNeeded,
    };
  });
}

function stateOf(id: string, needed: boolean, seen: boolean, missing: readonly string[] | null, read: boolean): ToolState {
  if (seen) return 'here';
  if (needed) return missing == null ? 'unknown' : missing.includes(id) ? 'missing' : 'here';
  return read ? 'absent' : 'unknown';
}

/** Whose needs they are: one kind's name ("Resident"), or null when its agents are of several kinds. */
export function whoNeeds(labels: readonly string[]): string | null {
  const kinds = [...new Set(labels)];
  return kinds.length === 1 ? kinds[0] : null;
}
