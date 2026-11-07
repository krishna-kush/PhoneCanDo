// The opencode v2 TUI attached to our serve. The engine is a native bionic
// binary executed directly from the native-library dir. `--server` connects
// to our serve instead of the background service, `--session` continues
// exactly that session; the project directory rides as the trailing
// positional arg (v2 has no --dir flag — it errors on it). Without a session
// id the server picks by directory.
import type { PtyRecipe, TuiTarget } from '../types';

// In a titled chat the TUI sets the terminal title to "OC | <title>", cut to
// 37 characters plus "…" past 40; its home and an untitled chat show
// "OpenCode" (packages/tui/src/app.tsx).
export function tuiChatTitle(terminalTitle: string): string | null {
  const m = /^OC \| (.+)$/.exec(terminalTitle);
  return m ? m[1] : null;
}

export function tui(target: TuiTarget): PtyRecipe {
  const { libDir, homeDir, projectDir, serverUrl, password } = target;
  const cmd = [`${libDir}/liboc-engine.so`, '--server', serverUrl];
  if (target.sessionId) cmd.push('--session', target.sessionId);
  cmd.push(projectDir);
  return {
    cmd,
    env: {
      HOME: homeDir,
      TMPDIR: homeDir,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      OPENCODE_DISABLE_AUTOUPDATE: '1',
      OPENTUI_LIB_PATH: `${libDir}/liboc-opentui.so`,
      OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: 'true',
      // v2 serve is auth-first: the TUI health check fails without the server
      // password (device-verified: UnsupportedContentType).
      ...(password ? { OPENCODE_SERVER_PASSWORD: password } : {}),
    },
    cwd: projectDir,
  };
}
