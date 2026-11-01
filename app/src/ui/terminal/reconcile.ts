// Shadow-document reconciler core. The RN field holds a copy of the TUI's
// current input line as a REAL document (so Gboard gets composing/glide/
// mic/autocorrect); every change is translated to terminal keystrokes that
// rewrite the remote line identically. Pure: covered by
// scripts/vectors/test_shadow.js — keep the two in sync.
export type TextEdit = { dels: number; ins: string };

// Common prefix/suffix are untouched; the middle becomes DELs + inserts.
// Glide commits, mic dictation and autocorrect rewrites all arrive as
// whole-text changes and forward correctly.
export function diffToEdit(prev: string, next: string): TextEdit {
  let start = 0;
  const m = Math.min(prev.length, next.length);
  while (start < m && prev[start] === next[start]) start++;
  let endP = prev.length;
  let endN = next.length;
  while (endP > start && endN > start && prev[endP - 1] === next[endN - 1]) {
    endP--;
    endN--;
  }
  return { dels: endP - start, ins: next.slice(start, endN) };
}

export function diffToKeys(prev: string, next: string): string {
  const { dels, ins } = diffToEdit(prev, next);
  return '\x7f'.repeat(dels) + ins;
}

// Duplicate-submit guard window: Gboard may deliver one Enter press as
// keypress/action AND a queued newline at once; submissions inside the
// window collapse. Time-based, exercised on-device rather than in vectors.
export const SUBMIT_DEDUPE_MS = 800;
