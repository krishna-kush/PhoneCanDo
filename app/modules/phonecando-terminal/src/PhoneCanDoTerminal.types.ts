export type PtyOpenOpts = {
  cmd: string[];
  env?: Record<string, string>;
  cwd?: string;
  rows?: number;
  cols?: number;
  /** Raw tty (default) for a full-screen program; false keeps cooked mode with echo, for a shell. */
  raw?: boolean;
  /** True: the PTY stays no session's controlling terminal, for a program that hands it on to a child. */
  handOver?: boolean;
};

/** Signals `kill` can send to a PTY program's process group. */
export type PtySignal = 'SIGTERM' | 'SIGKILL' | 'SIGINT' | 'SIGHUP';

/** How a PTY program ended: an exit code, or the number of the signal that
    killed it. Both null: it is gone but its status was not ours to read. */
export type PtyExit = { code: number | null; signal: number | null };
