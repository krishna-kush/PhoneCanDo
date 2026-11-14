// Chrome, headless, driven over the DevTools protocol with Node's own
// WebSocket: just what a frame needs (open the page, run a line of script,
// take its picture), so the video needs no browser library.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const FLAGS = [
  '--headless=new',
  '--remote-debugging-port=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--disable-extensions',
  '--hide-scrollbars',
  '--mute-audio',
  '--font-render-hinting=none',
  '--force-color-profile=srgb',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=Translate,MediaRouter,OptimizationHints',
  '--no-proxy-server',
  '--password-store=basic',
];

const CANDIDATES = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'];

/** The Chrome to drive: $CHROME, or the first one on the PATH. */
export function chromeBin(): string {
  if (process.env.CHROME) return process.env.CHROME;
  for (const bin of CANDIDATES) if (spawnSync('which', [bin]).status === 0) return bin;
  throw new Error(`No Chrome found (tried ${CANDIDATES.join(', ')}); set CHROME to one.`);
}

type Message = { id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; error?: { message: string }; sessionId?: string };

export type Page = {
  /** Runs [expression] in the page, awaiting a promise; its value back. */
  run: <T = unknown>(expression: string) => Promise<T>;
  /** The page as it is now, as an image. */
  shot: (format: 'jpeg' | 'png', quality?: number) => Promise<Buffer>;
  close: () => Promise<void>;
};

/** Opens [url] in a new headless Chrome at [width] x [height], [scale] device pixels a CSS pixel, its profile under [work]. */
export async function openPage(url: string, width: number, height: number, scale: number, work: string): Promise<Page> {
  const profile = join(work, `chrome-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(profile, { recursive: true });
  const proc = spawn(chromeBin(), [...FLAGS, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank'], {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, TMPDIR: work },
  });
  const wsUrl = await new Promise<string>((found, fail) => {
    let seen = '';
    proc.stderr.on('data', (d: Buffer) => {
      seen += d.toString();
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(seen);
      if (m) found(m[1]);
    });
    proc.on('exit', (code) => fail(new Error(`Chrome quit (${code}) before it listened:\n${seen.slice(-2000)}`)));
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((open, fail) => {
    ws.onopen = open;
    ws.onerror = fail;
  });
  let next = 0;
  const waiting = new Map<number, { done: (r: Record<string, unknown>) => void; fail: (e: Error) => void }>();
  const listeners: ((m: Message) => void)[] = [];
  ws.onmessage = (event) => {
    const m = JSON.parse(String(event.data)) as Message;
    if (m.id !== undefined) {
      const w = waiting.get(m.id);
      waiting.delete(m.id);
      if (m.error) w?.fail(new Error(m.error.message));
      else w?.done(m.result ?? {});
    } else for (const l of listeners) l(m);
  };
  const send = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
    new Promise<Record<string, unknown>>((done, fail) => {
      const id = ++next;
      waiting.set(id, { done, fail });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })) as { sessionId: string };
  const on = (method: string, params: Record<string, unknown> = {}) => send(method, params, sessionId);

  // The page's own errors and logs, so a broken scene says why.
  listeners.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params?.exceptionDetails as { exception?: { description?: string }; text?: string };
      console.error(`[page] ${d.exception?.description ?? d.text}`);
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const p = m.params as { type: string; args: { value?: unknown; description?: string }[] };
      if (p.type === 'error' || p.type === 'warn') console.error(`[page ${p.type}] ${p.args.map((a) => a.value ?? a.description).join(' ')}`);
    }
  });
  await on('Runtime.enable');
  await on('Page.enable');
  await on('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  const loaded = new Promise<void>((done) => listeners.push((m) => m.sessionId === sessionId && m.method === 'Page.loadEventFired' && done()));
  await on('Page.navigate', { url });
  await loaded;

  const run = async <T>(expression: string): Promise<T> => {
    const r = (await on('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })) as {
      result: { value?: T };
      exceptionDetails?: { exception?: { description?: string }; text: string };
    };
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value as T;
  };
  await run('window.__ready');

  return {
    run,
    shot: async (format, quality = 95) => {
      const { data } = await on('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality } : {}), optimizeForSpeed: true });
      return Buffer.from(data as string, 'base64');
    },
    close: async () => {
      // A polite close can take Chrome seconds; nothing here needs saving.
      ws.close();
      const exited = new Promise((done) => (proc.exitCode === null ? proc.on('exit', done) : done(null)));
      proc.kill('SIGKILL');
      await exited;
    },
  };
}
