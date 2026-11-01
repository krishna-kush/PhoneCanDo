// Serve session REST client (engine seam): the ONLY place that talks to
// opencode's API. Home IS the web UI (pair-loaded, no app-side chats), the
// terminal attaches by folder (legacy attach-by-dir) — so this keeps only
// what those paths need: listing (idle-stop + health waits) and pairing.
// opencode is v2 (native bionic) and auth-first: every call carries
// HTTP Basic with the random server password the service captures from
// serve.log (user `opencode`). A 401 refreshes the password once and retries,
// covering serve restarts (which rotate it).
// Every call is best-effort with a short timeout: the engine may be down,
// and callers must degrade, never crash.
import { engineBaseUrl, getServePassword } from './runner';

export type ServerSession = {
  id: string;
  title?: string;
  directory?: string;
  time?: { created: number; updated: number };
};

const TIMEOUT_MS = 8000;

function authHeader(): Record<string, string> {
  try {
    const pw = getServePassword();
    if (!pw) return {};
    // btoa exists in Hermes (see terminal/keys.ts toB64).
    return { Authorization: `Basic ${btoa(`opencode:${pw}`)}` };
  } catch {
    return {};
  }
}

async function req<T>(port: string, path: string, init?: RequestInit, retried = false): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${engineBaseUrl(port)}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...authHeader(), ...(init?.headers ?? {}) },
    });
    if (res.status === 401 && !retried) {
      // Password rotated under us (serve restart): re-read and retry once.
      clearTimeout(t);
      return req<T>(port, path, init, true);
    }
    if (!res.ok) throw new Error(`serve ${res.status} on ${path}`);
    // v2 replies 204 No Content on writes — no body to parse.
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`serve timeout on ${path}`);
    }
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(t);
  }
}

// v2 envelopes are {data} (single/list) — unwrap defensively; raw arrays
// pass through for callers that already handle them.
function unwrapList<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object' && Array.isArray((v as { data?: unknown }).data)) {
    return (v as { data: T[] }).data;
  }
  return [];
}

type V2Session = {
  id: string;
  title?: string;
  location?: { directory?: string };
  time?: { created: number; updated: number };
};

function toServerSession(s: V2Session): ServerSession {
  return { id: s.id, title: s.title, directory: s.location?.directory, time: s.time };
}

export async function listSessions(port: string): Promise<ServerSession[]> {
  const all = unwrapList<V2Session>(await req<unknown>(port, '/api/session'));
  return all.map(toServerSession);
}

// Web-UI pairing (v2): `POST /api/pair` mints a short-lived single-use code;
// loading `/auth/connect/{code}` in a WebView redeems it into a session
// cookie (30 days) + redirect to the web app. Fresh code per mount — never
// cached (5-min expiry, single-use). Basic-authenticated like all REST calls.
export type PairingCode = {
  code: string;
  expires_in: number;
};

function unwrapOne<T>(v: T | { data?: T }): T | undefined {
  if (v && typeof v === 'object' && 'data' in v) return (v as { data?: T }).data;
  return v as T;
}

export async function createPairingCode(port: string): Promise<PairingCode> {
  const res = await req<PairingCode | { data?: PairingCode }>(port, '/api/pair', {
    method: 'POST',
  });
  const unwrapped = unwrapOne<PairingCode>(res);
  if (!unwrapped || !unwrapped.code) throw new Error('serve empty pairing code');
  return unwrapped;
}

export function pairingUrl(port: string, code: string): string {
  return `${engineBaseUrl(port)}/auth/connect/${encodeURIComponent(code)}`;
}

// Blocks until the engine answers (fresh start takes a few seconds) so a
// first open succeeds instead of attaching to a half-born serve.
export async function waitForEngine(port: string, timeoutMs = 9000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await listSessions(port);
      return true;
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
