import { useEffect, useRef, useState, type RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import { toB64 } from './keys';
import { PtyEndError, ptyEndOf, type PtyEnd, type PtyTransport } from './transport/types';
import { useViewFocus } from './useViewFocus';

export type TermSize = { cols: number; rows: number };

type Opts = {
  available: boolean;
  htmlUri: string | null;
  webRef: RefObject<WebView<object> | null>;
  /** Makes what the view talks to (transport/): its own PTY built from a
      recipe (sessionRecipe.ts), or a TUI engine's hosted one. Called once
      per mount; the screen is keyed per session. */
  transport: () => PtyTransport;
  /** The view is on screen. The pump runs only then: TabPager keeps every
      page mounted. */
  active: boolean;
  /** Output stopped for good (PtyEnd says why). */
  onEnd?: (end: PtyEnd) => void;
};

// Output quiet this long after the program last printed: it waits for
// input (a shell drew its prompt). A program that prints nothing counts as
// waiting after SILENT_START_MS.
const SETTLE_MS = 400;
const SILENT_START_MS = 3000;

// An attach starts with a replay (a TUI engine's screen so far, up to about
// 1 MiB), read in big pieces before anything else. Past REPLAY_CAP (base64
// characters) the pump takes the rest, so a program that never stops
// printing cannot hold the JS thread.
const REPLAY_READ = 64 * 1024;
const REPLAY_CAP = 4 * 1024 * 1024;

// Owns the PTY lifecycle through its transport: open once at the boot
// snapshot size, 60ms poll pump page-ward (16ms while scrolling — 60ms
// quantizes scroll to ~16fps no matter how fine the steps), close on
// unmount. All later sizes arrive via resize — PTY size always follows
// the page's own ResizeObserver measurements through applySize, never
// event math. `outputSettled` turns true once the program first waits for
// input (see SETTLE_MS). A transport that attaches to a running PTY (an
// engine's) reports that PTY's size: the page takes it, the replay is
// written at it, and only then the measured size goes to page and PTY.
export function usePtySession({ available, htmlUri, webRef, transport, active, onEnd }: Opts) {
  const [termSize, setTermSize] = useState<TermSize>({ cols: 80, rows: 24 });
  const [error, setError] = useState<string | null>(null);
  const [outputSettled, setOutputSettled] = useState(false);
  const transportRef = useRef(transport);
  transportRef.current = transport;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const activeRef = useRef(active);
  activeRef.current = active;
  // The open transport; null until open (and, for an attach, its replay) is done.
  const fdRef = useRef<PtyTransport | null>(null);
  // The same, as state: the view's focus goes to it once it is open.
  const [opened, setOpened] = useState<PtyTransport | null>(null);
  useViewFocus(opened, active);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The pump of the open PTY; null before open and once output ended.
  const pumpRef = useRef<(() => void) | null>(null);
  const boostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boostFn = useRef<(steps: number, postedAt: number) => void>(() => {});
  // Scroll telemetry, aggregated per boost window and logged to logcat:
  // bridge delay, step rate, pump ticks vs output bytes. Scroll-only.
  // Size measured by the page before the PTY exists yet (the open effect
  // awaits engine start first, so 'ready' routinely wins the race). Queued
  // here and applied to the fresh fd instead of being dropped.
  const pendingSize = useRef<TermSize | null>(null);
  // The page's latest measured size, and who waits for the first one.
  const measured = useRef<TermSize | null>(null);
  const onMeasured = useRef<(() => void) | null>(null);
  const scrollStats = useRef({ msgs: 0, steps: 0, delaySum: 0, ticks: 0, bytes: 0 });

  function pageMeasured(): Promise<void> {
    if (measured.current) return Promise.resolve();
    return new Promise((resolve) => {
      onMeasured.current = resolve;
    });
  }

  function writePage(b64: string) {
    webRef.current?.injectJavaScript(`window.__writeB64(${JSON.stringify(b64)});true;`);
  }

  // The replay was drawn at the PTY's own size: xterm takes that size, the
  // replay is written, and the measured size follows once xterm has parsed
  // every byte of it (its writes are async, resize is not). The PTY resize
  // signals even at the same size, so the program repaints at the result.
  function replay(t: PtyTransport, at: TermSize) {
    console.log(`[phonecando-size] attach cols=${at.cols} rows=${at.rows}`);
    webRef.current?.injectJavaScript(`window.__resize(${at.cols},${at.rows});true;`);
    let total = 0;
    while (total < REPLAY_CAP) {
      const b64 = t.read(REPLAY_READ);
      if (!b64) break;
      total += b64.length;
      writePage(b64);
    }
    const want = measured.current ?? at;
    pendingSize.current = null;
    console.log(`[phonecando-size] replayed b64=${total}, apply cols=${want.cols} rows=${want.rows}`);
    setTermSize(want);
    webRef.current?.injectJavaScript(`window.__resizeAfterWrites(${want.cols},${want.rows});true;`);
    t.resize(want.rows, want.cols);
  }

  function endOutput(e: unknown) {
    // EOF: the program exited (or the engine's PTY is gone); stop polling.
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    pumpRef.current = null;
    onEndRef.current?.(ptyEndOf(e));
  }

  useEffect(() => {
    if (!available || htmlUri == null) return;
    const t = transportRef.current();
    let stopped = false;
    (async () => {
      try {
        const attachedAt = await t.open(termSize.rows, termSize.cols);
        if (stopped) {
          t.close();
          return;
        }
        if (attachedAt) {
          // The replay must land on a loaded page.
          await pageMeasured();
          if (stopped) {
            t.close();
            return;
          }
          try {
            replay(t, attachedAt);
          } catch (e) {
            endOutput(e);
            return;
          }
        }
        fdRef.current = t;
        setOpened(t);
        if (pendingSize.current) {
          try {
            t.resize(pendingSize.current.rows, pendingSize.current.cols);
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
            const b64 = t.read(8192);
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
            writePage(b64);
          } catch (e) {
            endOutput(e);
          }
        };
        pumpRef.current = pumpOnce;
        if (activeRef.current) pollRef.current = setInterval(pumpOnce, 60);
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
            if (fdRef.current != null && pumpRef.current != null) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = setInterval(pumpOnce, 60);
            }
          }, 1500);
        };
      } catch (e) {
        if (stopped) return;
        if (e instanceof PtyEndError) endOutput(e);
        else setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      stopped = true;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      pumpRef.current = null;
      if (boostTimer.current) clearTimeout(boostTimer.current);
      boostTimer.current = null;
      fdRef.current = null;
      t.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, htmlUri]);

  // Off screen the pump pauses (output waits in the PTY or the engine's
  // viewer); back on screen it resumes at the idle rate.
  useEffect(() => {
    if (active) {
      if (pumpRef.current && pollRef.current == null) pollRef.current = setInterval(pumpRef.current, 60);
      return;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    if (boostTimer.current) clearTimeout(boostTimer.current);
    boostTimer.current = null;
  }, [active]);

  // Apply measured size to both xterm and the PTY.
  function applySize(cols: number, rows: number) {
    console.log(`[phonecando-size] apply cols=${cols} rows=${rows} fd=${fdRef.current != null ? 'open' : 'pending'}`);
    measured.current = { cols, rows };
    onMeasured.current?.();
    onMeasured.current = null;
    setTermSize({ cols, rows });
    webRef.current?.injectJavaScript(`window.__resize(${cols},${rows});true;`);
    if (fdRef.current != null) {
      try {
        fdRef.current.resize(rows, cols);
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
      fdRef.current.write(toB64(text));
    } catch (e) {
      console.warn(`[phonecando] ptyWrite failed err=${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Scroll boost: 16ms render pump for 1.5s so feedback tracks the finger.
  // No-op before the PTY opens.
  function boostPump(steps: number, postedAt: number) {
    boostFn.current(steps, postedAt);
  }

  // What the terminal answers the program (theme/replies.ts). A PTY whose
  // host answers itself (an engine's) has its answers already; the page
  // also parses its replay, whose old queries need none.
  function reply(text: string) {
    if (fdRef.current?.hostAnswers) return;
    sendText(text);
  }

  return { termSize, error, outputSettled, applySize, sendText, reply, boostPump };
}
