// The runtime blocks: how the engine starts and answers (engine.ts), its
// events and idle rule (events.ts), chat titles, the surfaces the app shows
// (surfaces.ts), code hooks and sign-in. The runner renders these
// (agents/kit/kotlin/render); the app reads what the native KindView passes
// on.
import { checkEngine, engineStyle } from './engine.ts';
import { checkEvents, checkIdle } from './events.ts';
import { fields, list, oneOf, string, text, type Add, type Json } from './primitives.ts';
import { MAX, PATTERNS, PHONE_TOOLS, SIGN_IN_METHODS } from './rules.ts';
import { checkSurfaces } from './surfaces.ts';
import { httpBlock } from './templates.ts';

export function checkRuntime(add: Add, m: Json) {
  const style = engineStyle(m);
  if ('engine' in m) checkEngine(add, m.engine);
  if ('events' in m) checkEvents(add, m.events, m.hooks, style);
  if ('chats' in m) checkChats(add, m.chats, m.hooks, style);
  if ('idle' in m) checkIdle(add, m.idle, m.events, style);
  if ('surfaces' in m) checkSurfaces(add, m.surfaces, style);
  if ('phoneTools' in m) oneOf(add, '/phoneTools', m.phoneTools, PHONE_TOOLS);
  if ('hooks' in m) checkHooks(add, m.hooks, m.id);
  if ('signIn' in m) checkSignIn(add, m.signIn);
}

// A chat's title, the chats running now, a chat's last reply and its stop,
// over HTTP (server); a tui engine's title comes from its window title
// (surfaces.chatTitle). The reply is read by a code hook, as an SSE stream is.
function checkChats(add: Add, chats: unknown, hooks: unknown, style: string | null) {
  if (!fields(add, '/chats', chats, ['title', 'active', 'reply', 'interrupt'], [])) return;
  if (style !== 'server') add('/chats', 'forbidden', 'chats over HTTP need engine.style server');
  const c = chats as Json;
  if (!('title' in c) && !('active' in c)) add('/chats', 'required', 'title or active is required');
  for (const key of ['title', 'active']) {
    if (!(key in c)) continue;
    if (!fields(add, `/chats/${key}`, c[key], ['http'], ['http'])) continue;
    const http = httpBlock(add, `/chats/${key}/http`, (c[key] as Json).http, ['json']);
    if (http) string(add, `/chats/${key}/http/json`, http.json, PATTERNS.jsonPointer, MAX.relPath);
  }
  if ('reply' in c) checkReply(add, c.reply, hooks);
  if ('interrupt' in c && fields(add, '/chats/interrupt', c.interrupt, ['http'], ['http'])) {
    httpBlock(add, '/chats/interrupt/http', (c.interrupt as Json).http);
    // Stop names the chats to interrupt by asking which run now.
    if (!('active' in c)) add('/chats/interrupt', 'required', 'interrupt needs active, the chats to stop');
  }
}

function checkReply(add: Add, reply: unknown, hooks: unknown) {
  if (!fields(add, '/chats/reply', reply, ['http'], ['http'])) return;
  const http = httpBlock(add, '/chats/reply/http', (reply as Json).http, ['parser']);
  if (!http || !string(add, '/chats/reply/http/parser', http.parser, PATTERNS.hookId, MAX.hookId)) return;
  if (!(Array.isArray(hooks) && hooks.includes(http.parser))) {
    add('/chats/reply/http/parser', 'mismatch', `parser ${String(http.parser)} is not in hooks`);
  }
}

function checkHooks(add: Add, hooks: unknown, id: unknown) {
  list(add, '/hooks', hooks, { min: 0, unique: true }, (path, hook) => {
    if (!string(add, path, hook, PATTERNS.hookId, MAX.hookId) || typeof id !== 'string') return;
    if (!(hook as string).startsWith(`${id}.`)) add(path, 'mismatch', `a hook of ${id} is named ${id}.<name>`);
  });
}

function checkSignIn(add: Add, signIn: unknown) {
  list(add, '/signIn', signIn, { min: 0, unique: true }, (path, method) => {
    if (!fields(add, path, method, ['method', 'note'], ['method'])) return;
    const m = method as Json;
    oneOf(add, `${path}/method`, m.method, SIGN_IN_METHODS);
    if ('note' in m) text(add, `${path}/note`, m.note, MAX.note);
  });
}
