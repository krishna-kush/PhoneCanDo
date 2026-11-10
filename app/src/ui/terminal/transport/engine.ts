// The PTY a TUI-style engine runs in the runner's service
// (engine/engineTerminal.ts): the view attaches as its one viewer and
// detaches on close, and the program keeps running. Attach reports the
// PTY's size, so the replay that the first reads return lands at the size
// it was drawn at. The view says when it shows the program (focus).
import type { AgentId } from '../../../engine/agents/records';
import {
  engineTerminalAttach,
  engineTerminalDetach,
  engineTerminalEnd,
  engineTerminalFocus,
  engineTerminalRead,
  engineTerminalResize,
  engineTerminalWrite,
  type TerminalViewerId,
} from '../../../engine/engineTerminal';
import { PtyEndError, type PtyTransport } from './types';

export function engineTransport(agentId: AgentId): PtyTransport {
  let viewer: TerminalViewerId | null = null;

  function attached(): TerminalViewerId {
    if (viewer == null) throw new PtyEndError('detached', 'not attached');
    return viewer;
  }

  return {
    async open() {
      try {
        const at = engineTerminalAttach(agentId);
        viewer = at.viewerId;
        return { rows: at.rows, cols: at.cols };
      } catch (e) {
        throw asEnd(e);
      }
    },
    read(max) {
      try {
        return engineTerminalRead(attached(), max);
      } catch (e) {
        throw asEnd(e);
      }
    },
    write: (b64) => engineTerminalWrite(attached(), b64),
    resize: (rows, cols) => engineTerminalResize(attached(), rows, cols),
    focus(shown) {
      if (viewer != null) engineTerminalFocus(viewer, shown);
    },
    close() {
      if (viewer == null) return;
      const was = viewer;
      viewer = null;
      try {
        engineTerminalDetach(was);
      } catch {
        // already detached, or the engine is gone
      }
    },
  };
}

// No TUI engine running and a stopped or dead one both mean the program
// is not there to show: `ended`. A takeover is `detached`.
function asEnd(e: unknown): Error {
  const end = engineTerminalEnd(e);
  const message = e instanceof Error ? e.message : String(e);
  if (end === 'detached') return new PtyEndError('detached', message);
  if (end) return new PtyEndError('ended', message);
  return e instanceof Error ? e : new Error(message);
}
