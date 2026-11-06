// Engine seam: the ONLY importer of the phonecando-terminal native module.
// Generic PTY plumbing; what runs in it comes from an agent kind's recipe.
import {
  getLibDir as nativeGetLibDir,
  isTerminalAvailable as nativeAvailable,
  ptyClose as nativeClose,
  ptyOpen as nativeOpen,
  ptyRead as nativeRead,
  ptyResize as nativeResize,
  ptyWrite as nativeWrite,
} from '../../modules/phonecando-terminal/src/PhoneCanDoTerminalModule';
import type { PtyRecipe } from './agents/types';

export function isTerminalAvailable(): boolean {
  return nativeAvailable();
}

export function getLibDir(): string {
  return nativeGetLibDir();
}

/** Starts a PTY running `recipe` (built by an agent kind, e.g. its TUI). */
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

export function ptyClose(fd: number): void {
  nativeClose(fd);
}
