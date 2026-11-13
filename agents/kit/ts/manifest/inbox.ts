// How other agents' messages reach a running agent (`inbox`). The runner
// keeps an agent's undelivered messages in its inbox folder
// (PHONECANDO_INBOX). `hooks`: the kind's own hook events run
// `phonecando-inbox <Event>`, which prints what the runner rendered from
// the event's template ({{messages}}, its one placeholder; a json one must
// be JSON once filled) and exits with its `exit`. `server`: the runner posts
// them to a server engine's chat ({{sessionId}} in the path or body), with
// `deliver` while it works and `wake` to an idle one; `create` makes it a
// new chat ({{title}} in its body) for a task that wants one. `reader`: the kind's
// own extension reads the folder. `wake` names which of these can wake an
// idle agent; the block must have it. kit-render's InboxChecks keeps the
// same rules on the phone.
import { engineStyle } from './engine.ts';
import { escape, fields, integer, isObject, oneOf, record, string, type Add, type Json } from './primitives.ts';
import { INBOX_FORMATS, INBOX_KEYS, INBOX_MESSAGES, INBOX_METHODS, INBOX_SESSION, INBOX_TITLE, INBOX_WAKES, MAX, PATTERNS } from './rules.ts';

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;
const MESSAGES = `{{${INBOX_MESSAGES}}}`;
const HOOK_KEYS = ['format', 'template', 'exit'];
const CALL_KEYS = ['method', 'path', 'body'];
/** What each wake mode needs in the block. */
const WAKE_NEEDS: Record<string, [string, (inbox: Json) => boolean]> = {
  hook: ['/inbox/hooks', (i) => isObject(i.hooks) && Object.keys(i.hooks).length > 0],
  server: ['/inbox/server/wake', (i) => isObject(i.server) && 'wake' in i.server],
  reader: ['/inbox/reader', (i) => i.reader === true],
};

export function checkInbox(add: Add, m: Json) {
  if (!('inbox' in m) || !fields(add, '/inbox', m.inbox, INBOX_KEYS, [])) return;
  const inbox = m.inbox as Json;
  if ('hooks' in inbox) checkHooks(add, inbox.hooks);
  if ('server' in inbox) checkServer(add, inbox.server, engineStyle(m));
  if ('reader' in inbox && typeof inbox.reader !== 'boolean') add('/inbox/reader', 'type', 'must be true or false');
  if (!('hooks' in inbox) && !('server' in inbox) && inbox.reader !== true) {
    add('/inbox', 'required', 'names a way in: hooks, server or reader: true');
  }
  if ('wake' in inbox && oneOf(add, '/inbox/wake', inbox.wake, INBOX_WAKES)) {
    const [at, has] = WAKE_NEEDS[inbox.wake as string];
    if (!has(inbox)) add(at, 'required', `wake ${inbox.wake} needs ${at.slice(1).replace(/\//g, '.')}`);
  }
}

// Each event name is a file name in the inbox folder (`<Event>.out`).
function checkHooks(add: Add, hooks: unknown) {
  const ok = record(add, '/inbox/hooks', hooks, (path, event, hook) => {
    string(add, path, event, PATTERNS.eventName, MAX.name);
    if (!fields(add, path, hook, HOOK_KEYS, ['format', 'template'])) return;
    const h = hook as Json;
    oneOf(add, `${path}/format`, h.format, INBOX_FORMATS);
    integer(add, `${path}/exit`, h.exit, 0, MAX.hookExit);
    if ('template' in h) checkTemplate(add, `${path}/template`, h.template, h.format);
  });
  if (ok && Object.keys(hooks as Json).length === 0) add('/inbox/hooks', 'length', 'names at least one hook event');
}

function checkTemplate(add: Add, at: string, template: unknown, format: unknown) {
  if (isObject(template)) {
    if (format === 'text') add(at, 'mismatch', 'an object template is JSON: format json');
  } else if (typeof template !== 'string') {
    add(at, 'type', 'must be a string or an object');
    return;
  }
  const texts = strings(at, template);
  const named = texts.map(([path, text]) => filled(add, path, text, [INBOX_MESSAGES], PATTERNS.inboxHookTemplate)).every(Boolean);
  if (!texts.some(([, text]) => text.includes(MESSAGES))) add(at, 'required', `names ${MESSAGES}`);
  if (named && format === 'json' && typeof template === 'string') checkJson(add, at, template);
}

// Filled with an escaped control character, a json string template parses,
// and the character is in one of its strings: the messages go inside one.
function checkJson(add: Add, at: string, template: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(template.split(MESSAGES).join('\\u0001'));
  } catch {
    add(at, 'mismatch', `format json: the template must be JSON once ${MESSAGES} is filled`);
    return;
  }
  if (!strings(at, parsed).some(([, text]) => text.includes('\u0001'))) {
    add(at, 'mismatch', `format json: ${MESSAGES} goes inside a JSON string (a value, not a key)`);
  }
}

// The runner posts to the engine's own port, so a server engine only.
function checkServer(add: Add, server: unknown, style: string | null) {
  if (style !== 'server') add('/inbox/server', 'forbidden', 'inbox.server needs engine.style server');
  if (!fields(add, '/inbox/server', server, ['deliver', 'wake', 'latest', 'create'], ['deliver'])) return;
  const s = server as Json;
  for (const key of ['deliver', 'wake']) {
    if (key in s) checkCall(add, `/inbox/server/${key}`, s[key]);
  }
  if ('latest' in s) checkLatest(add, s.latest);
  if ('create' in s) checkCreate(add, s.create);
}

// Make a new chat: a path with no placeholders, a body whose strings may
// name {{title}}, and where the new chat's id is in the answer.
function checkCreate(add: Add, create: unknown) {
  const at = '/inbox/server/create';
  if (!fields(add, at, create, [...CALL_KEYS, 'id'], [...CALL_KEYS, 'id'])) return;
  const c = create as Json;
  oneOf(add, `${at}/method`, c.method, INBOX_METHODS);
  if (filled(add, `${at}/path`, c.path, [], PATTERNS.httpPath)) string(add, `${at}/path`, c.path, PATTERNS.httpPath);
  if (isObject(c.body)) {
    strings(`${at}/body`, c.body).forEach(([path, text]) => filled(add, path, text, [INBOX_TITLE], PATTERNS.inboxCreateTemplate));
  } else if ('body' in c) {
    add(`${at}/body`, 'type', 'must be an object');
  }
  string(add, `${at}/id`, c.id, PATTERNS.jsonPointer);
}

// GET the agent's chats, newest first (no placeholders), and where the newest one's id is.
function checkLatest(add: Add, latest: unknown) {
  if (!fields(add, '/inbox/server/latest', latest, ['path', 'id'], ['path', 'id'])) return;
  const l = latest as Json;
  if (filled(add, '/inbox/server/latest/path', l.path, [], PATTERNS.httpPath)) {
    string(add, '/inbox/server/latest/path', l.path, PATTERNS.httpPath);
  }
  string(add, '/inbox/server/latest/id', l.id, PATTERNS.jsonPointer);
}

function checkCall(add: Add, at: string, call: unknown) {
  if (!fields(add, at, call, CALL_KEYS, CALL_KEYS)) return;
  const c = call as Json;
  oneOf(add, `${at}/method`, c.method, INBOX_METHODS);
  if (filled(add, `${at}/path`, c.path, [INBOX_SESSION], PATTERNS.inboxPathTemplate)) {
    string(add, `${at}/path`, c.path, PATTERNS.httpPath);
  }
  if (!('body' in c)) return;
  if (!isObject(c.body)) {
    add(`${at}/body`, 'type', 'must be an object');
    return;
  }
  const texts = strings(`${at}/body`, c.body);
  texts.forEach(([path, text]) => filled(add, path, text, [INBOX_MESSAGES, INBOX_SESSION], PATTERNS.inboxBodyTemplate));
  if (!texts.some(([, text]) => text.includes(MESSAGES))) add(`${at}/body`, 'required', `names ${MESSAGES}`);
}

// A template naming only `allowed`, with no stray braces (`pattern`).
function filled(add: Add, path: string, value: unknown, allowed: string[], pattern: string): boolean {
  if (!string(add, path, value, undefined, MAX.template)) return false;
  for (const [, name] of (value as string).matchAll(PLACEHOLDER)) {
    if (!allowed.includes(name)) {
      add(path, 'unknown', `{{${name}}} has no value here (only {{${allowed.join('}}, {{')}}})`);
      return false;
    }
  }
  return string(add, path, value, pattern);
}

/** Every string in a JSON value (an object's values, not its keys), with its JSON pointer. */
function strings(path: string, value: unknown): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(`${path}/${i}`, v));
  if (isObject(value)) return Object.entries(value).flatMap(([k, v]) => strings(`${path}/${escape(k)}`, v));
  return [];
}
