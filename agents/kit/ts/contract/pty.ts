// What runs in our PTY (the app opens it: app/src/engine/terminal.ts).

/** A process for our PTY: argv, environment and working directory. */
export type PtyRecipe = {
  cmd: string[];
  env: Record<string, string>;
  cwd: string;
  /** Raw tty (the default) for a TUI; false for a shell, whose line editor echoes only on a cooked tty. */
  raw?: boolean;
  /** True when the program hands the terminal on (our Linux launcher, to the guest shell): the PTY
      then opens as no session's controlling terminal. */
  handOver?: boolean;
};
