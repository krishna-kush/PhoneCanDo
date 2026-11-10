// The hosted terminal of an agent whose engine is a TUI (engine.style
// "tui"): the runner's foreground service runs the program in a PTY of its
// own, so it keeps running with no screen on it. A screen attaches as the
// one viewer (a new attach detaches the old one), reads the replay first
// (the terminal modes and the screen so far, drawn at the size attach
// reports), then live output, and detaches on the way out; the program
// keeps running. Bytes cross as base64. Reaches the native module through
// runner.ts only.
import type { AgentId } from './agents/records';
import { nativeRunner } from './runner';

export type TerminalViewerId = string;

/** One attach: the viewer, and the PTY's size now (the replay is drawn at it). */
export type EngineTerminalAttach = { viewerId: TerminalViewerId; rows: number; cols: number };

/**
 * Why the hosted terminal refused a viewer: the agent's engine is not a
 * running TUI engine, the engine stopped or died, or another viewer took it.
 */
export type EngineTerminalEnd = 'not_running' | 'ended' | 'detached';

const ENDS: EngineTerminalEnd[] = ['not_running', 'ended', 'detached'];

/** Attaches as the one viewer. Throws `not_running` when no TUI engine runs for the agent. */
export function engineTerminalAttach(agentId: AgentId): EngineTerminalAttach {
  return nativeRunner().engineTerminalAttach(agentId);
}

/** Pending output (the replay first), or null when nothing is pending. Throws `ended` or `detached`. */
export function engineTerminalRead(viewerId: TerminalViewerId, max: number): string | null {
  return nativeRunner().engineTerminalRead(viewerId, max);
}

export function engineTerminalWrite(viewerId: TerminalViewerId, b64: string): void {
  nativeRunner().engineTerminalWrite(viewerId, b64);
}

/** A same-size resize still signals the program, so it repaints. */
export function engineTerminalResize(viewerId: TerminalViewerId, rows: number, cols: number): void {
  nativeRunner().engineTerminalResize(viewerId, rows, cols);
}

/**
 * Whether the view shows the program (on screen, the app in front). The
 * program counts as focused only then (focus reports, if it asked for
 * them); a view that attached and never said so does not.
 */
export function engineTerminalFocus(viewerId: TerminalViewerId, shown: boolean): void {
  nativeRunner().engineTerminalFocus(viewerId, shown);
}

/** Stops viewing; the engine keeps running, unfocused. */
export function engineTerminalDetach(viewerId: TerminalViewerId): void {
  nativeRunner().engineTerminalDetach(viewerId);
}

/** The end a native error names (its code, or in its message), or null for any other failure. */
export function engineTerminalEnd(e: unknown): EngineTerminalEnd | null {
  const raw = (e as { code?: unknown } | null)?.code;
  const message = e instanceof Error ? e.message : String(e);
  return ENDS.find((c) => c === raw) ?? ENDS.find((c) => message.includes(c)) ?? null;
}
