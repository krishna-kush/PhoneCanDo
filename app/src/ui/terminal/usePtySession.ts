import { useEffect, useRef, useState, type RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import type { PtyRecipe } from '../../engine/agents/types';
import { openPty, ptyClose, ptyRead, ptyResize, ptyWrite } from '../../engine/terminal';
import { toB64 } from './keys';

export type TermSize = { cols: number; rows: number };

type Opts = {
  available: boolean;
  htmlUri: string | null;
  webRef: RefObject<WebView<object> | null>;
  /** Builds what the PTY runs (sessionRecipe.ts): the agent's TUI or a
      Linux shell. Called once per mount; the screen is keyed per session. */
  prepare: () => Promise<PtyRecipe>;
};

// Output quiet this long after the program last printed: it waits for
// input (a shell drew its prompt). A program that prints nothing counts as
// waiting after SILENT_START_MS.
const SETTLE_MS = 400;
const SILENT_START_MS = 3000;

// Owns the PTY fd lifecycle: build the recipe, open once at the boot
// snapshot size, 60ms poll pump page-ward (16ms while scrolling — 60ms
// quantizes scroll to ~16fps no matter how fine the steps), close on
// unmount. All later sizes arrive via ptyResize — PTY size always follows
// the page's own ResizeObserver measurements through applySize, never
// event math. `outputSettled` turns true once the program first waits for
// input (see SETTLE_MS).
export function usePtySession({ available, htmlUri, webRef, prepare }: Opts) {
  const [termSize, setTermSize] = useState<TermSize>({ cols: 80, rows: 24 });
  const [error, setError] = useState<string | null>(null);
  const [outputSettled, setOutputSettled] = useState(false);
  const prepareRef = useRef(prepare);
  prepareRef.current = prepare;
  const fdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const boostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boostFn = useRef<(steps: number, postedAt: number) => void>(() => {});
  // Scroll telemetry, aggregated per boost window and logged to logcat:
  // bridge delay, step rate, pump ticks vs output bytes. Scroll-only.
  // Size measured by the page before the PTY exists yet (the open effect
  // awaits engine start first, so 'ready' routinely wins the race). Queued
  // here and applied to the fresh fd instead of being dropped.
  const pendingSize = useRef<TermSize | null>(null);
  const scrollStats = useRef({ msgs: 0, steps: 0, delaySum: 0, ticks: 0, bytes: 0 });

  useEffect(() => {
    if (!available || htmlUri == null) return;
    let fd = -1;
    let stopped = false;
    (async () => {
      try {
        const recipe = await prepareRef.current();
        if (stopped) return;
        fd = openPty(recipe, termSize.rows, termSize.cols);
        if (stopped) {
          ptyClose(fd);
          return;
        }
        fdRef.current = fd;
        if (pendingSize.current) {
          try {
            ptyResize(fd, pendingSize.current.rows, pendingSize.current.cols);
          } catch {
            // fd gone already
          }
          pendingSize.current = null;
        }
        // Render pump: idle 60ms is plenty for typing, but it quantizes
        // scroll feedback to ~16fps (several line-steps land between polls
        // and paint as one jump). boostPump() drops to 16ms for 1.5s after
        // scroll input; telemetry aggregates per window to logcat.
        const openedAt = Date.now();
        let lastOutputAt = 0;
        let settled = false;
        const pumpOnce = () => {
          scrollStats.current.ticks++;
          try {
            const b64 = ptyRead(fd, 8192);
            if (!b64) {
              // Idle poll: non-blocking read, nothing to render.
              if (!settled) {
                const quietFor = Date.now() - (lastOutputAt || openedAt);
                if (quietFor >= (lastOutputAt ? SETTLE_MS : SILENT_START_MS)) {
                  settled = true;
                  setOutputSettled(true);
                }
              }
              return;
            }
            lastOutputAt = Date.now();
            scrollStats.current.bytes += b64.length;
            webRef.current?.injectJavaScript(`window.__writeB64(${JSON.stringify(b64)});true;`);
          } catch {
            // EOF: child exited; stop polling.
            if (pollRef.current) clearInterval(pollRef.current);
          }
        };
        pollRef.current = setInterval(pumpOnce, 60);
        boostFn.current = (steps: number, postedAt: number) => {
          if (pollRef.current == null || fdRef.current == null) return;
          if (boostTimer.current == null) {
            // Fresh window: reset counters, drop to 16ms.
            scrollStats.current = { msgs: 0, steps: 0, delaySum: 0, ticks: 0, bytes: 0 };
            clearInterval(pollRef.current);
            pollRef.current = setInterval(pumpOnce, 16);
          } else {
            clearTimeout(boostTimer.current);
          }
          scrollStats.current.msgs++;
          scrollStats.current.steps += steps;
          scrollStats.current.delaySum += Date.now() - postedAt;
          boostTimer.current = setTimeout(() => {
            boostTimer.current = null;
            const s = scrollStats.current;
            console.log(
              `[phonecando-scroll] steps=${s.steps} msgs=${s.msgs} avgBridge=${s.msgs ? Math.round(s.delaySum / s.msgs) : 0}ms ticks=${s.ticks} b64=${s.bytes}`,
            );
            if (fdRef.current != null) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = setInterval(pumpOnce, 60);
            }
          }, 1500);
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      stopped = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (boostTimer.current) clearTimeout(boostTimer.current);
      boostTimer.current = null;
      if (fdRef.current != null) {
        try {
          ptyClose(fdRef.current);
        } catch {
          // already closed
        }
        fdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, htmlUri]);

  // Apply measured size to both xterm and the PTY.
  function applySize(cols: number, rows: number) {
    console.log(`[phonecando-size] apply cols=${cols} rows=${rows} fd=${fdRef.current != null ? 'open' : 'pending'}`);
    setTermSize({ cols, rows });
    webRef.current?.injectJavaScript(`window.__resize(${cols},${rows});true;`);
    if (fdRef.current != null) {
      try {
        ptyResize(fdRef.current, rows, cols);
      } catch {
        // fd gone
      }
    } else {
      // PTY not open yet ('ready' beat the async open): queue it.
      pendingSize.current = { cols, rows };
    }
  }

  function sendText(text: string) {
    if (fdRef.current == null || text.length === 0) return;
    try {
      ptyWrite(fdRef.current, toB64(text));
    } catch (e) {
      console.warn(`[phonecando] ptyWrite failed err=${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Scroll boost: 16ms render pump for 1.5s so feedback tracks the finger.
  // No-op before the PTY opens.
  function boostPump(steps: number, postedAt: number) {
    boostFn.current(steps, postedAt);
  }

  return { termSize, error, outputSettled, applySize, sendText, boostPump };
}
