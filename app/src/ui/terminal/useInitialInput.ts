import { useEffect, useRef } from 'react';

type Opts = {
  /** Text to type once; newlines are dropped, so nothing runs before Enter. */
  text: string | undefined;
  /** The program waits for input (usePtySession's outputSettled). */
  ready: boolean;
  /** The mirror's current line; nothing is typed once the user has typed. */
  mirror: string;
  /** useMirrorInput's handleFieldChange. */
  type: (next: string) => void;
};

// Types a suggested command into the shell once it has drawn its prompt,
// WITHOUT Enter: the user reads it, edits it if they like, and presses
// Enter. It goes through the mirror's own change path as if the keyboard
// had typed it, so the shadow holds the text and Gboard backspace, glide
// and the mic edit it like anything else (IME contract: every text-
// inserting path folds into the shadow). Skipped if the user typed first.
export function useInitialInput({ text, ready, mirror, type }: Opts) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !ready || !text) return;
    done.current = true;
    const line = text.replace(/[\r\n]+/g, ' ').trimEnd();
    if (mirror === '' && line !== '') type(line);
  }, [ready, text, mirror, type]);
}
