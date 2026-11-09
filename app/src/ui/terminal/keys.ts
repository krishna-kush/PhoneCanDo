// Pure key/byte mapping for the terminal input path. No RN imports.
// Covered by scripts/vectors/test_modifiers.js (keep the two in sync) and
// test_scroll_keys.js (imports this file).
export function toB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

export type ModState = { ctrlOn: boolean; shiftOn: boolean };

// Sticky modifiers become terminal bytes: Ctrl+letter -> 0x01..0x1A
// (letters only; digits/symbols pass through), Shift+letter -> upper.
// Ctrl-modified inserts are actions, not text: callers must reset the
// shadow afterwards since the remote line state is then unknown.
export function applyInsertMods(ins: string, mods: ModState): { out: string; ctrlUsed: boolean } {
  if (!mods.ctrlOn && !mods.shiftOn) return { out: ins, ctrlUsed: false };
  let used = false;
  let res = '';
  for (const ch of ins) {
    if (ch === '\n') {
      res += ch;
    } else if (mods.ctrlOn && /[a-zA-Z]/.test(ch)) {
      res += String.fromCharCode(ch.toLowerCase().codePointAt(0)! - 96);
      used = true;
    } else if (mods.shiftOn && /[a-z]/.test(ch)) {
      res += ch.toUpperCase();
    } else {
      res += ch;
    }
  }
  return { out: res, ctrlUsed: used };
}

// Extra-keys with modifiers: arrows gain ;mod (2=shift 5=ctrl 6=both),
// Shift+Tab is CSI Z. Anything unmapped passes through unchanged.
export function modifiedSeq(seq: string, mods: ModState): string {
  if (!mods.ctrlOn && !mods.shiftOn) return seq;
  const m = seq.match(/^\x1b\[([ABCD])$/);
  if (m) {
    const mod = mods.ctrlOn && mods.shiftOn ? 6 : mods.ctrlOn ? 5 : 2;
    return `\x1b[1;${mod}${m[1]}`;
  }
  if (seq === '\t' && mods.shiftOn && !mods.ctrlOn) return '\x1b[Z';
  return seq;
}

// A swipe's steps as bytes for the program (the page decides which, from
// the program's terminal modes; dir < 0 is up, toward older lines).
// Wheel reports, SGR, at the centre cell: for a program that asked for
// mouse reports. Its own wheel path (velocity, scroll speed) moves it,
// never its input line.
export function wheelSeq(dir: number, steps: number, cols: number, rows: number): string {
  const cx = Math.max(1, Math.floor(cols / 2));
  const cy = Math.max(1, Math.floor(rows / 2));
  return `\x1b[<${dir < 0 ? 64 : 65};${cx};${cy}M`.repeat(steps);
}

// Arrow keys, in the program's cursor-key mode: for an alternate screen
// without mouse reports (less, man), as xterm's alternate scroll sends.
export function arrowSeq(dir: number, steps: number, appCursor: boolean): string {
  return `${appCursor ? '\x1bO' : '\x1b['}${dir < 0 ? 'A' : 'B'}`.repeat(steps);
}
