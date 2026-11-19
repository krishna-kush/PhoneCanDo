// What native sends for presence, in the shapes the app reads (types.ts).
// Every field is checked: an older or newer runner may leave one out or
// send one we don't know, and a bad record must not take a screen down
// (it is dropped, or the field takes its default). Pure (zero RN
// imports): scripts/vectors/test_presence.js checks it.
import type { AgentStatus, HandOver, PresenceFrame, StatusMood } from './types';

export const NO_PRESENCE: PresenceFrame = { driver: null, handOver: null, statuses: {} };

const MOODS: readonly string[] = ['working', 'thinking', 'waiting'];

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** The runner sends its enum names in lower case; upper case reads the same. */
const word = (v: unknown): string | null => str(v)?.toLowerCase() ?? null;

function asDriver(value: unknown): PresenceFrame['driver'] {
  const raw = obj(value);
  const agentId = str(raw?.agentId);
  if (!agentId) return null;
  return { agentId, name: str(raw?.name) || agentId };
}

/** A hand-over, or null without an agent or with a mode we don't know (nothing to offer then). */
export function asHandOver(value: unknown): HandOver | null {
  const raw = obj(value);
  const agentId = str(raw?.agentId);
  const mode = word(raw?.mode);
  if (!agentId || (mode !== 'watch' && mode !== 'paused')) return null;
  const by = word(raw?.by);
  const why = str(raw?.why)?.trim();
  return {
    agentId,
    agentName: str(raw?.agentName) || agentId,
    mode,
    by: by === 'agent' ? 'agent' : 'user',
    why: why ? why : null,
  };
}

/** One agent's line, or null when it has no text (an empty line is no line). */
export function asStatus(value: unknown): AgentStatus | null {
  const raw = obj(value);
  const text = str(raw?.text)?.trim();
  if (!text) return null;
  const mood = word(raw?.mood);
  return { text, mood: mood && MOODS.includes(mood) ? (mood as StatusMood) : 'working' };
}

/** The whole frame; nobody and no lines for anything unreadable. */
export function asPresence(value: unknown): PresenceFrame {
  const raw = obj(value);
  if (!raw) return NO_PRESENCE;
  const statuses: Record<string, AgentStatus> = {};
  for (const [id, v] of Object.entries(obj(raw.statuses) ?? {})) {
    const status = asStatus(v);
    if (id && status) statuses[id] = status;
  }
  return { driver: asDriver(raw.driver), handOver: asHandOver(raw.handOver), statuses };
}
