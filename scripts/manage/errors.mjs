// How a command stops: thrown, never process.exit, so main.mjs picks the
// exit code in one place and the wiring check can call commands safely.

/** A bad command line: main.mjs prints it and exits 2. */
export class UsageError extends Error {}

/** A command we ran exited non-zero: main.mjs exits with its code. */
export class CommandFailed extends Error {
  constructor(cmd, status) {
    super(`${cmd[0]} exited ${status}`);
    this.status = status;
  }
}

/** Stops on a bad argument. */
export function die(message) {
  throw new UsageError(message);
}
