// Engine seam: the ONLY importer of the phonecando-terminal native module.
// Owns the TUI launch recipe so screens stay dumb.
import {
  getLibDir as nativeGetLibDir,
  isTerminalAvailable as nativeAvailable,
  ptyClose as nativeClose,
  ptyOpen as nativeOpen,
  ptyRead as nativeRead,
  ptyResize as nativeResize,
  ptyWrite as nativeWrite,
} from '../../modules/phonecando-terminal/src/PhoneCanDoTerminalModule';
import { getServePassword } from './runner';

export function isTerminalAvailable(): boolean {
  return nativeAvailable();
}

export function getLibDir(): string {
  return nativeGetLibDir();
}

export type AttachOpts = {
  libDir: string;
  homeDir: string;
  projectDir: string;
  serverUrl: string;
  /** Linked opencode session to continue. Absent = legacy attach-by-dir. */
  sessionId?: string;
  rows?: number;
  cols?: number;
};

// Open a PTY running the v2 TUI against our serve. The engine is a native
// bionic binary executed directly. `--server`
// connects to our serve instead of the background service, `--session`
// continues exactly that session; the project directory rides as the
// trailing positional arg (v2 has no --dir flag — it errors on it). Without
// a session id the server picks by directory (legacy behavior, kept as the
// offline fallback when sync can't reach the engine).
export function openAttachSession(opts: AttachOpts): number {
  const { libDir, homeDir, projectDir, serverUrl } = opts;
  const cmd = [`${libDir}/libopencode2.so`, '--server', serverUrl];
  if (opts.sessionId) cmd.push('--session', opts.sessionId);
  cmd.push(projectDir);
  // v2 serve is auth-first: the TUI health check fails without the server
  // password (device-verified: UnsupportedContentType). Same stable password
  // the service set on serve and every REST call uses.
  let serverPassword = '';
  try {
    serverPassword = getServePassword();
  } catch {
    // native bridge absent: TUI shows the health error, nothing crashes
  }
  return nativeOpen({
    cmd,
    env: {
      HOME: homeDir,
      TMPDIR: homeDir,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      OPENCODE_DISABLE_AUTOUPDATE: '1',
      OPENTUI_LIB_PATH: `${libDir}/libopentui.so`,
      OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: 'true',
      ...(serverPassword ? { OPENCODE_SERVER_PASSWORD: serverPassword } : {}),
    },
    cwd: projectDir,
    rows: opts.rows ?? 24,
    cols: opts.cols ?? 80,
  });
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
