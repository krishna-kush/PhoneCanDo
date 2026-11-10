// The custom agent kinds on the phone, through the runner (Kotlin:
// api/UserKindFunctions.kt): each file with what keeps it from loading,
// one's JSON, the runner's own check, a save and a delete. A save or delete
// reloads the runner's kind catalog at once; registry.ts reads it again
// after (state/flows/userKinds.ts does both).
import type {
  NativeKindDeleted,
  NativeKindProblem,
  NativeKindSaved,
  NativeUserKind,
} from '../../../../modules/phonecando-runner/src/PhoneCanDoRunner.types';
import { nativeRunner } from '../../runner';

export type KindProblem = NativeKindProblem;
export type UserKindFile = NativeUserKind;

/** Every file in the folder, by name; none where the native runner is absent. */
export function listUserKinds(): UserKindFile[] {
  try {
    return nativeRunner().listUserKinds();
  } catch {
    return [];
  }
}

/** The kind's JSON as saved; null when there is none (or no native runner). */
export function readUserKind(id: string): string | null {
  try {
    return nativeRunner().readUserKind(id) ?? null;
  } catch {
    return null;
  }
}

/** Why the runner would not load this JSON as a user kind; empty when it would. */
export function validateUserKind(json: string): KindProblem[] {
  return nativeRunner().validateUserKind(json);
}

/** Saves the JSON as `<id>.json`; a kind of that id is replaced only with `replace`. */
export function saveUserKind(json: string, replace: boolean): NativeKindSaved {
  return nativeRunner().saveUserKind(json, replace);
}

/** Deletes the kind unless agents are of it (`usedBy` names them then). */
export function deleteUserKind(id: string): NativeKindDeleted {
  return nativeRunner().deleteUserKind(id);
}
