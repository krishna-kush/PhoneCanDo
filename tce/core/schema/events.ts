// The event vocabulary. A name is valid if it is listed here or matches one of
// the patterns. Adding an event = add it here (and to docs/telemetry.md); the
// server drops unknown names instead of storing them.

export const EVENT_NAMES = [
  'update.offered',
  'update.accepted',
  'update.downloaded',
  'update.installed',
  'update.cancelled',
  'update.failed',
  'a11y.restricted_seen',
  'control.unlock',
  'chat.open',
  'terminal.open',
  'env.add',
  'engine.start.ok',
  'engine.start.fail',
  'engine.port_squat',
  'engine.died',
  'report.sent',
  'forget.requested',
  // props { code }: a tracked share link went out (an app was picked in the share sheet).
  'share.sent',
  // props { code }: this install was opened through a share link within 7 days of installing.
  'share.install',
] as const;

export type StaticEventName = (typeof EVENT_NAMES)[number];

export const EVENT_PATTERNS: readonly RegExp[] = [
  /^update\.check\.(none|newer|failed)$/,
  /^a11y\.step\.[0-9]{1,2}\.(reached|done)$/,
  /^tool\.[a-z0-9_]{1,48}$/, // tool.mobile_click
  /^provider\.[a-z0-9_.-]{1,48}$/, // provider.anthropic (name only)
];

const STATIC = new Set<string>(EVENT_NAMES);

export function isEventName(name: string): boolean {
  if (STATIC.has(name)) return true;
  return EVENT_PATTERNS.some((p) => p.test(name));
}
