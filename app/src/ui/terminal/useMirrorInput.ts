import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { applyInsertMods, modifiedSeq } from './keys';
import { diffToEdit, SUBMIT_DEDUPE_MS } from './reconcile';

type Opts = { sendText: (text: string) => void };

// Owns the shadow document + sticky modifiers. Invariant: mirror ===
// remoteLine, except transiently mid-edit. See reconcile.ts for the model.
export function useMirrorInput({ sendText }: Opts) {
  const inputRef = useRef<TextInput | null>(null);
  const [mirror, setMirror] = useState('');
  const mirrorRef = useRef('');
  const remoteLineRef = useRef('');
  const lastSubmitRef = useRef(0);
  // Sticky modifiers for the extra-keys row. Toggle ON with a tap, OFF with
  // another; tapping a toggle summons the keyboard if it isn't up.
  const [ctrlOn, setCtrlOn] = useState(false);
  const [shiftOn, setShiftOn] = useState(false);
  const mods = { ctrlOn, shiftOn };

  // Pure sender: maps stray newlines to \r and splits submits. Remote
  // bookkeeping stays with the callers (they know the target line).
  function sendTracked(keys: string) {
    const mapped = keys.replace(/\n/g, '\r');
    if (mapped.length === 0) return;
    const parts = mapped.split('\r');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].length > 0) sendText(parts[i]);
      if (i < parts.length - 1) sendText('\r');
    }
  }

  // Submit the current line (Enter). Guarded: Gboard may deliver one press
  // as newline + editor action + keypress at once; collapse duplicates.
  // Ctrl is one-shot: a keyboard submit consumes a latched Ctrl (Shift
  // stays latched until manually toggled).
  function submitLine(_source: string) {
    const now = Date.now();
    if (now - lastSubmitRef.current < SUBMIT_DEDUPE_MS) return; // collapsed duplicate
    lastSubmitRef.current = now;
    sendText('\r');
    if (ctrlOn) setCtrlOn(false);
    remoteLineRef.current = '';
    mirrorRef.current = '';
    setMirror('');
  }

  // Mirror change from Gboard (typing, glide commit, mic, autocorrect,
  // backspace incl. word-delete). Newlines become submits; the remainder
  // after a newline starts the next line. mirrorRef (not state) is the
  // base so rapid successive edits can't fork on a stale render.
  // Latched modifiers transform inserts (Ctrl actions reset the shadow).
  // Ctrl is one-shot: the first keyboard change consumes it (Shift stays
  // latched until manually toggled).
  function handleFieldChange(next: string) {
    let base = mirrorRef.current;
    const entryBase = base;
    const hadCtrl = ctrlOn;
    let cur = next;
    for (let guard = 0; guard < 5 && cur.includes('\n'); guard++) {
      const nl = cur.indexOf('\n');
      // Collapse double submits: Enter often arrives as keypress/action AND
      // a queued newline (proven in logcat). The guard skips the resend.
      if (Date.now() - lastSubmitRef.current < SUBMIT_DEDUPE_MS) {
        // Duplicate of a keypress/action submit already sent: advance
        // bookkeeping without resending.
      } else {
        const part = diffToEdit(base, cur.slice(0, nl));
        const t = applyInsertMods(part.ins, mods);
        sendTracked('\x7f'.repeat(part.dels) + t.out);
        sendTracked('\r');
        lastSubmitRef.current = Date.now();
        if (t.ctrlUsed) {
          base = '';
          cur = '';
          break;
        }
      }
      base = '';
      cur = cur.slice(nl + 1);
    }
    const tail = diffToEdit(base, cur);
    const mod = applyInsertMods(tail.ins, mods);
    sendTracked('\x7f'.repeat(tail.dels) + mod.out);
    if (hadCtrl && next !== entryBase) setCtrlOn(false);
    if (mod.ctrlUsed) {
      remoteLineRef.current = '';
      mirrorRef.current = '';
      setMirror('');
    } else {
      remoteLineRef.current = cur;
      mirrorRef.current = cur;
      setMirror(cur);
    }
  }

  // Control sequences bypass the mirror. History keys (up/down) and ^C
  // replace/clear the TUI line, so the shadow resyncs to empty; cursor
  // moves and Esc/Tab are assumed text-preserving.
  function sendControl(seq: string) {
    sendText(seq);
    if (seq === '\x1b[A' || seq === '\x1b[B' || seq === '\x03') {
      remoteLineRef.current = '';
      mirrorRef.current = '';
      setMirror('');
    }
  }

  function toggleCtrl() {
    inputRef.current?.focus();
    setCtrlOn((v) => !v);
  }

  function toggleShift() {
    inputRef.current?.focus();
    setShiftOn((v) => !v);
  }

  function pressExtraKey(seq: string) {
    const out = modifiedSeq(seq, mods);
    sendControl(out);
    if (ctrlOn && out !== seq) {
      remoteLineRef.current = '';
      mirrorRef.current = '';
      setMirror('');
    } else if (out.length === 1 && out >= ' ' && out !== '\x7f') {
      // Text-inserting extra key (|, ~): the byte lands in the TUI's line,
      // so the shadow must grow with it. Otherwise the next Gboard edit
      // (e.g. backspace) diffs from a stale base and mangles the line.
      remoteLineRef.current += out;
      mirrorRef.current += out;
      setMirror(mirrorRef.current);
    }
  }

  return {
    inputRef,
    mirror,
    ctrlOn,
    shiftOn,
    toggleCtrl,
    toggleShift,
    pressExtraKey,
    handleFieldChange,
    submitLine,
  };
}
