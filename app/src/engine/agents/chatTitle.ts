// The chat a kind's TUI shows, read from the title it gives the terminal:
// group 1 of the kind's chatTitle regex (KindView). opencode's is
// `^OC \| (.+)$`: in a titled chat its TUI sets "OC | <title>", cut to 37
// characters plus "…" past 40; its home and an untitled chat show "OpenCode".
// Pure; vectors in scripts/vectors/test_chat_pages.js.
const compiled = new Map<string, RegExp>();

/** The chat title in `terminalTitle`; null when the kind has no pattern or the title names no chat. */
export function chatTitleOf(pattern: string | null, terminalTitle: string): string | null {
  if (!pattern) return null;
  let re = compiled.get(pattern);
  if (!re) {
    re = new RegExp(pattern);
    compiled.set(pattern, re);
  }
  const m = re.exec(terminalTitle);
  return m ? m[1] : null;
}
