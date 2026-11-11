// How a terminal view reaches the PTY it shows (usePtySession.ts). The
// local transport opens a PTY of the view's own (a shell, or an agent's
// TUI client) and hangs it up on close; the engine transport attaches to
// the PTY a TUI-style engine runs in the runner's service and only
// detaches. Bytes are base64. No RN imports.

export type PtyTransport = {
  /**
   * Opens the PTY at rows x cols and resolves with nothing, or attaches to
   * one that already runs and resolves with its size now: the first reads
   * are then a replay drawn at that size.
   */
  open(rows: number, cols: number): Promise<{ rows: number; cols: number } | void>;
  /** Pending output, or empty/null when nothing is pending. Throws once the PTY is gone. */
  read(max: number): string | null;
  write(b64: string): void;
  resize(rows: number, cols: number): void;
  /**
   * Whether the view shows the program: an engine's PTY tells the program
   * (focus reports), since nothing else does. A PTY of the view's own has
   * none: its program sees no focus at all.
   */
  focus?(shown: boolean): void;
  /**
   * The PTY's host answers the program's queries itself (an engine's: the
   * runner, from the first byte, watched or not), so the view's answers
   * (theme/replies.ts) are not written. A PTY of the view's own has only
   * the view to answer.
   */
  hostAnswers?: boolean;
  /** Hangs up or detaches. Safe before open finishes (open then opens nothing) and twice. */
  close(): void;
};

/**
 * Why output stopped for good: `exited`, the PTY's program ended (or a read
 * failed for another reason); `ended`, an engine's program stopped or died;
 * `detached`, another view attached to the engine's PTY.
 */
export type PtyEnd = 'exited' | 'ended' | 'detached';

/** What a transport throws when its PTY is gone for a known reason. */
export class PtyEndError extends Error {
  constructor(
    readonly end: PtyEnd,
    message: string,
  ) {
    super(message);
    this.name = 'PtyEndError';
  }
}

/** The end a failed read means. */
export function ptyEndOf(e: unknown): PtyEnd {
  return e instanceof PtyEndError ? e.end : 'exited';
}
