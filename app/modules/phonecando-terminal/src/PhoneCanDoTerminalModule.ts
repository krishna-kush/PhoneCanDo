import { NativeModule, requireNativeModule } from 'expo';
import type { PtyExit, PtyOpenOpts, PtySignal } from './PhoneCanDoTerminal.types';

export type { PtyExit, PtyOpenOpts, PtySignal } from './PhoneCanDoTerminal.types';

declare class PhoneCanDoTerminalModule extends NativeModule {
  getLibDir(): string;
  open(params: PtyOpenOpts): number;
  read(params: { fd: number; maxBytes?: number }): string;
  write(params: { fd: number; data: string }): number;
  resize(params: { fd: number; rows: number; cols: number }): string;
  close(params: { fd: number }): string;
  kill(params: { fd: number; signal: PtySignal }): boolean;
  exitStatus(params: { fd: number }): PtyExit | null;
}

let mod: PhoneCanDoTerminalModule | null = null;
try {
  mod = requireNativeModule<PhoneCanDoTerminalModule>('PhoneCanDoTerminal');
} catch {
  mod = null;
}

export function isTerminalAvailable(): boolean {
  return mod != null;
}

export function getLibDir(): string {
  if (!mod) throw new Error('terminal module unavailable');
  return mod.getLibDir();
}

export function ptyOpen(opts: PtyOpenOpts): number {
  if (!mod) throw new Error('terminal module unavailable');
  return mod.open(opts);
}

export function ptyRead(fd: number, maxBytes = 8192): string {
  if (!mod) throw new Error('terminal module unavailable');
  return mod.read({ fd, maxBytes });
}

export function ptyWrite(fd: number, data: string): number {
  if (!mod) throw new Error('terminal module unavailable');
  return mod.write({ fd, data });
}

export function ptyResize(fd: number, rows: number, cols: number): void {
  mod?.resize({ fd, rows, cols });
}

export function ptyClose(fd: number): void {
  mod?.close({ fd });
}

export function ptyKill(fd: number, signal: PtySignal = 'SIGTERM'): boolean {
  if (!mod) throw new Error('terminal module unavailable');
  return mod.kill({ fd, signal });
}

export function ptyExitStatus(fd: number): PtyExit | null {
  if (!mod) throw new Error('terminal module unavailable');
  return mod.exitStatus({ fd });
}

export default mod;
