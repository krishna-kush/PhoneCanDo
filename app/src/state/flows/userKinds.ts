// Custom agent kinds: save one (from the form or an import), delete one,
// and hand one's JSON out (clipboard, share sheet). The runner writes its
// folder and reloads its catalog; then the app reads the kinds again (the
// registry and the kinds store, so the Choose agent step offers a new kind
// at once) and the agents (whether one needs an install follows its kind).
import { formOf, type UserAgentForm } from '../../engine/agents/user/form';
import {
  deleteUserKind,
  readUserKind,
  saveUserKind,
  validateUserKind,
  type KindProblem,
} from '../../engine/agents/user/native';
import { copyText, shareText } from '../../engine/sharing';
import { useAgentsStore } from '../agents';
import { useKindsStore } from '../kinds';

export type SaveOutcome = { ok: true; id: string } | { ok: false; problems: string[] };
export type DeleteOutcome = { ok: true } | { ok: false; usedBy: string[] };

const problemLine = (p: KindProblem): string => `${p.path || '/'}: ${p.detail}`;

function afterChange() {
  useKindsStore.getState().refreshKinds();
  useAgentsStore.getState().refreshAgents();
}

/** The saved kind and the form it fills, for an edit; null when it is gone or not an object. */
export function kindForEdit(id: string): { base: Record<string, unknown>; form: UserAgentForm } | null {
  const text = readUserKind(id);
  if (text == null) return null;
  try {
    const base = JSON.parse(text) as unknown;
    if (typeof base !== 'object' || base === null || Array.isArray(base)) return null;
    const manifest = base as Record<string, unknown>;
    return { base: manifest, form: formOf(manifest) };
  } catch {
    return null;
  }
}

/** Why the runner would not load the kind's JSON (its own check, after the kit's); empty when it would. */
export function checkKind(text: string): string[] {
  return validateUserKind(text).map(problemLine);
}

/** Saves the kind's JSON; one of the same id is replaced only with `replace`. */
export function saveKind(text: string, replace: boolean): SaveOutcome {
  const saved = saveUserKind(text, replace);
  if (saved.id == null) return { ok: false, problems: saved.problems.map(problemLine) };
  afterChange();
  return { ok: true, id: saved.id };
}

/** Deletes the kind, unless agents are of it. */
export function deleteKind(id: string): DeleteOutcome {
  const gone = deleteUserKind(id);
  if (gone.usedBy.length > 0) return { ok: false, usedBy: gone.usedBy };
  afterChange();
  return { ok: true };
}

/** The kind's JSON on the clipboard; false when it is gone or nothing was copied. */
export function copyKind(id: string): boolean {
  const text = readUserKind(id);
  return text != null && copyText(text);
}

/** The kind's JSON in the share sheet; false when it is gone. */
export async function shareKind(id: string, label: string): Promise<boolean> {
  const text = readUserKind(id);
  if (text == null) return false;
  await shareText(text, label);
  return true;
}
