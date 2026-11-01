import { NativeModule, requireNativeModule } from 'expo';

export type PtyOpenOpts = {
  cmd: string[];
  env?: Record<string, string>;
  cwd?: string;
  rows?: number;
  cols?: number;
};

declare class PhoneCanDoTerminalModule extends NativeModule {
  getLibDir(): string;
  open(params: PtyOpenOpts): number;
  read(params: { fd: number; maxBytes?: number }): string;
  write(params: { fd: number; data: string }): number;
  resize(params: { fd: number; rows: number; cols: number }): string;
  close(params: { fd: number }): string;
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

export default mod;
