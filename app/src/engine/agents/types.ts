// Agent kinds: everything the app needs to know about one kind of coding
// agent (opencode is the first). Screens and state reach a kind through the
// registry (registry.ts), never by importing its folder, so adding a kind is
// a folder plus one registry line, with no conditionals in screens.

export type AgentKindId = 'opencode';

/** How to reach one running engine. The password is read per call: a fresh
    install mints it only when the engine first starts. */
export type EngineConn = { baseUrl: string; password: () => string };

export type AgentSession = {
  id: string;
  title?: string;
  directory?: string;
  time?: { created: number; updated: number };
};

/** A process for our PTY: argv, environment and working directory. */
export type PtyRecipe = { cmd: string[]; env: Record<string, string>; cwd: string };

/** Where a TUI attaches: the engine, its HOME and a project folder. */
export type TuiTarget = {
  libDir: string;
  homeDir: string;
  projectDir: string;
  serverUrl: string;
  password: string;
  /** Session to continue; absent = the engine picks by folder. */
  sessionId?: string;
};

export type WebThemeMode = 'system' | 'light' | 'dark';

/** The app palette a web adapter maps onto the agent's own web UI. */
export type WebPalette = {
  bg: string;
  panel: string;
  panel2: string;
  fg: string;
  muted: string;
  dim: string;
  faint: string;
  line: string;
  lineStrong: string;
  primary: string;
  primaryHi: string;
};

/** The agent's web UI inside our WebView. */
export type AgentWebUi = {
  /** Injected before and after every page load: follows the app's mode and palette. */
  themeScript(mode: WebThemeMode, palette: WebPalette): string;
  /** Hides the web UI's own chrome that duplicates our header. */
  embedScript: string;
  /** URLs of the sign-in hand-off, which never count as the web UI's home. */
  isAuthUrl(url: string): boolean;
};

export type AgentKind = {
  id: AgentKindId;
  label: string;
  listSessions(conn: EngineConn): Promise<AgentSession[]>;
  /** A one-time URL that signs the WebView in and lands on the web UI. */
  pairUrl(conn: EngineConn): Promise<string>;
  /** True when nothing moved recently, so the engine may stop. Throws when unreachable. */
  isIdle(conn: EngineConn): Promise<boolean>;
  web: AgentWebUi;
  tui(target: TuiTarget): PtyRecipe;
  /** Deletes the agent's own database (sessions, projects) under its HOME.
      Returns how many files went. */
  wipeData(homeDir: string): Promise<number>;
};
