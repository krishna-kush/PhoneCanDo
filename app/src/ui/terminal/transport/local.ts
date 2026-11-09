// The view's own PTY, as the terminal tab always had: built from a recipe
// (sessionRecipe.ts) when the view opens, closed when it closes, which
// hangs up the program.
import type { PtyRecipe } from '../../../../../agents/kit/ts/contract/pty.ts';
import { openPty, ptyClose, ptyRead, ptyResize, ptyWrite } from '../../../engine/terminal';
import type { PtyTransport } from './types';

export function localTransport(prepare: () => Promise<PtyRecipe>): PtyTransport {
  let fd: number | null = null;
  let closed = false;

  function openFd(): number {
    if (fd == null) throw new Error('pty closed');
    return fd;
  }

  return {
    async open(rows, cols) {
      const recipe = await prepare();
      if (closed) return;
      fd = openPty(recipe, rows, cols);
    },
    read: (max) => ptyRead(openFd(), max),
    write: (b64) => {
      ptyWrite(openFd(), b64);
    },
    resize: (rows, cols) => ptyResize(openFd(), rows, cols),
    close() {
      closed = true;
      if (fd == null) return;
      const open = fd;
      fd = null;
      try {
        ptyClose(open);
      } catch {
        // already closed
      }
    },
  };
}
