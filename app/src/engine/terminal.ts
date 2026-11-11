// Engine seam: the ONLY importer of the phonecando-terminal native module.
// Generic PTY plumbing; what runs in it comes from a recipe (ui/terminal/sessionRecipe.ts).
import { View, type ViewProps } from 'react-native';
import type { ComponentType } from 'react';
import {
  DirectionLockView,
  isTerminalAvailable as nativeAvailable,
  ptyClose as nativeClose,
  ptyExitStatus as nativeExitStatus,
  ptyKill as nativeKill,
  ptyOpen as nativeOpen,
  ptyRead as nativeRead,
  ptyResize as nativeResize,
  ptyWrite as nativeWrite,
  type PtyExit,
  type PtySignal,
} from '../../modules/phonecando-terminal/src/PhoneCanDoTerminalModule';
import type { PtyRecipe } from '../../../agents/kit/ts/contract/pty.ts';

export type { PtyExit, PtySignal };

/**
 * What a terminal is hosted in: a gesture that starts on it stays with it
 * while it moves up or down, and goes to its parents when it moves sideways
 * first. A plain View without the native module.
 */
export const TerminalGestureHost: ComponentType<ViewProps> = DirectionLockView ?? View;

export function isTerminalAvailable(): boolean {
  return nativeAvailable();
}

/** Starts a PTY running `recipe` (an agent kind's TUI, or a shell in an image). */
export function openPty(recipe: PtyRecipe, rows = 24, cols = 80): number {
  return nativeOpen({ ...recipe, rows, cols });
}

export function ptyRead(fd: number, maxBytes = 8192): string {
  return nativeRead(fd, maxBytes);
}

export function ptyWrite(fd: number, dataB64: string): number {
  return nativeWrite(fd, dataB64);
}

export function ptyResize(fd: number, rows: number, cols: number): void {
  nativeResize(fd, rows, cols);
}

/** Closes the PTY: the kernel hangs up the program, which is then reaped. */
export function ptyClose(fd: number): void {
  nativeClose(fd);
}

/** Signals the PTY program's whole process group (default SIGTERM).
    Returns false once the program has exited. */
export function ptyKill(fd: number, signal: PtySignal = 'SIGTERM'): boolean {
  return nativeKill(fd, signal);
}

/** How the PTY program ended, or null while it runs. Right after reads hit
    end-of-file it can still be null for a moment, until the reap lands. */
export function ptyExitStatus(fd: number): PtyExit | null {
  return nativeExitStatus(fd);
}
