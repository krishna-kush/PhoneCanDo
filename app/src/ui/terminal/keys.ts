// Pure key/byte mapping for the terminal input path. No RN imports.
// Covered by scripts/vectors/test_modifiers.js — keep the two in sync.
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
