// opencode REST client: the only place that speaks opencode's API. Home is
// the web UI (pair-loaded, no app-side chats) and the terminal attaches by
// folder, so this keeps only what those paths need: listing (idle stop,
// health waits) and pairing.
// opencode v2 is auth-first: every call carries HTTP Basic with the server
// password (auth.ts). A 401 re-reads the password once and retries, which
// covers a fresh install whose engine minted it a moment ago.
// Every call is best-effort with a short timeout: the engine may be down,
// and callers must degrade, never crash.
import type { AgentSession, EngineConn } from '../types';
import { authHeader } from './auth';

const TIMEOUT_MS = 8000;

async function req<T>(conn: EngineConn, path: string, init?: RequestInit, retried = false): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${conn.baseUrl}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...authHeader(conn), ...(init?.headers ?? {}) },
    });
    if (res.status === 401 && !retried) {
      clearTimeout(t);
      return req<T>(conn, path, init, true);
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
// pass through.
function unwrapList<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object' && Array.isArray((v as { data?: unknown }).data)) {
    return (v as { data: T[] }).data;
  }
  return [];
}

function unwrapOne<T>(v: T | { data?: T }): T | undefined {
  if (v && typeof v === 'object' && 'data' in v) return (v as { data?: T }).data;
  return v as T;
}

type V2Session = {
  id: string;
  title?: string;
  location?: { directory?: string };
  time?: { created: number; updated: number };
};

export async function listSessions(conn: EngineConn): Promise<AgentSession[]> {
  const all = unwrapList<V2Session>(await req<unknown>(conn, '/api/session'));
  return all.map((s) => ({ id: s.id, title: s.title, directory: s.location?.directory, time: s.time }));
}

// Web-UI pairing (v2): `POST /api/pair` mints a short-lived single-use code;
// loading `/auth/connect/{code}` in a WebView redeems it into a session
// cookie (30 days) + redirect to the web app. Fresh code per pairing — never
// cached (5-min expiry, single-use).
type PairingCode = { code: string; expires_in: number };

export async function pairUrl(conn: EngineConn): Promise<string> {
  const res = await req<PairingCode | { data?: PairingCode }>(conn, '/api/pair', { method: 'POST' });
  const pair = unwrapOne<PairingCode>(res);
  if (!pair || !pair.code) throw new Error('serve empty pairing code');
  return `${conn.baseUrl}/auth/connect/${encodeURIComponent(pair.code)}`;
}
