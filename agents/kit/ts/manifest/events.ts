// Event sources and the idle rule. A server engine streams server-sent
// events, parsed by a code hook of the kind; a tui engine's PTY output is
// scanned for bells, OSC notifications and OSC 7501 status reports, which
// rules map to engine events, and the kind's own hooks may call
// `phonecando-event <name>`, which `hook` maps to one. Idle means nothing
// from `idle.from` for `quietSec`.
import { fields, integer, list, oneOf, record, regex, string, type Add, type Json } from './primitives.ts';
import { EVENT_SOURCES as SOURCES, IDLE_SOURCES, MAX, PATTERNS, PTY_EVENTS, PTY_SIGNALS } from './rules.ts';
import { httpBlock } from './templates.ts';

export function checkEvents(add: Add, events: unknown, hooks: unknown, style: string | null) {
  list(add, '/events', events, { min: 0, unique: true }, (path, event) => {
    if (!fields(add, path, event, SOURCES, [])) return;
    const e = event as Json;
    const named = SOURCES.filter((key) => key in e);
    if (named.length === 0) add(path, 'required', `an event source is one of ${SOURCES.join(', ')}`);
    for (const extra of named.slice(1)) add(`${path}/${extra}`, 'forbidden', `one source per item (${named[0]} is set)`);
    if ('sse' in e) checkSse(add, `${path}/sse`, e.sse, hooks, style);
    if ('pty' in e) checkPty(add, `${path}/pty`, e.pty, style);
    if ('hook' in e) checkHook(add, `${path}/hook`, e.hook, style);
  });
}

// The runner names the events file only in a tui engine's env
// (PHONECANDO_EVENTS), so only a tui engine's hooks can write to it.
function checkHook(add: Add, at: string, value: unknown, style: string | null) {
  if (style !== 'tui') add(at, 'forbidden', 'hook events need engine.style tui');
  if (!fields(add, at, value, ['map'], ['map'])) return;
  const map = (value as Json).map;
  const ok = record(add, `${at}/map`, map, (path, name, event) => {
    string(add, path, name, PATTERNS.eventName, MAX.name);
    oneOf(add, path, event, PTY_EVENTS);
  });
  if (ok && Object.keys(map as Json).length === 0) add(`${at}/map`, 'length', 'maps at least one event name');
}

function checkSse(add: Add, at: string, value: unknown, hooks: unknown, style: string | null) {
  if (style !== 'server') add(at, 'forbidden', 'an SSE stream needs engine.style server');
  const sse = httpBlock(add, at, value, ['parser']);
  if (!sse || !string(add, `${at}/parser`, sse.parser, PATTERNS.hookId, MAX.hookId)) return;
  if (!(Array.isArray(hooks) && hooks.includes(sse.parser))) {
    add(`${at}/parser`, 'mismatch', `parser ${String(sse.parser)} is not in hooks`);
  }
}

function checkPty(add: Add, at: string, value: unknown, style: string | null) {
  if (style !== 'tui') add(at, 'forbidden', 'PTY rules need engine.style tui');
  if (!fields(add, at, value, ['rules'], ['rules'])) return;
  list(add, `${at}/rules`, (value as Json).rules, { min: 1, unique: true }, (path, rule) => {
    if (!fields(add, path, rule, ['on', 'match', 'event'], ['on', 'event'])) return;
    const r = rule as Json;
    oneOf(add, `${path}/on`, r.on, PTY_SIGNALS);
    if ('match' in r) {
      if (r.on === 'bel') add(`${path}/match`, 'forbidden', 'a bell carries no text to match');
      else regex(add, `${path}/match`, r.match, false);
    }
    oneOf(add, `${path}/event`, r.event, PTY_EVENTS);
  });
}

export function checkIdle(add: Add, idle: unknown, events: unknown, style: string | null) {
  if (!fields(add, '/idle', idle, ['from', 'quietSec'], ['from', 'quietSec'])) return;
  const i = idle as Json;
  list(add, '/idle/from', i.from, { min: 1, unique: true }, (path, source) => {
    if (!oneOf(add, path, source, IDLE_SOURCES)) return;
    if (source === 'events' && !(Array.isArray(events) && events.length > 0)) {
      add(path, 'mismatch', 'idle from events needs an event stream (events)');
    }
    if (source === 'output' && style !== 'tui') add(path, 'mismatch', 'idle from output needs a PTY (engine.style tui)');
  });
  integer(add, '/idle/quietSec', i.quietSec, 1, MAX.quietSec);
}
